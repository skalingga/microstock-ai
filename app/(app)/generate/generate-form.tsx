"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Clock, FileDown, LayoutGrid, Loader2, Spline, Square, Wallet } from "lucide-react";
import { ProgressLine } from "@/components/pen-motif";
import { InfoTip } from "@/components/info-tip";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QcBadge } from "@/components/qc-badge";
import { StylePreview } from "@/components/style-preview";
import { Label } from "@/components/ui/label";
import { MAX_VARIATIONS } from "@/lib/generate/schemas";
import { runJob, type JobItem, type JobState } from "@/lib/generate/run-job";
import { formatIdr } from "@/lib/budget";
import { KENARI_IMAGE_PRICES_IDR, imagePriceIdr } from "@/lib/providers/kenari-image-pricing";
import { findBannedWords } from "@/lib/settings/banned";
import { MAX_AVOID, matchSaturated, type SaturatedSubject } from "@/lib/subjects/saturation";
import { isPaidEntry, orderLabel } from "@/lib/settings/provider-label";
import { STYLES, isImageStyle, type Palette, type ProviderEntry, type StyleId } from "@/lib/settings/schema";
import type { CatalogModel } from "@/lib/providers/kenari-pricing";
import { createClient } from "@/lib/supabase/client";
import { selectClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

const REQUESTS_PER_MINUTE = 5; // observed on Kenari free models; the queue reads the real limit from headers
const IMAGE_SECONDS_PER_ASSET = 45; // gpt-image-2 took 13-35s per picture in the Oktober 2026 test, plus metadata
const IMAGE_MODELS = Object.entries(KENARI_IMAGE_PRICES_IDR).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
// The Kenari catalog also lists speech, embedding and image models; none of them can write SVG code.
const NON_TEXT_MODEL = /(tts|speech|audio|whisper|transcri|embed|rerank|moderation|image|dall-e|imagen|veo|video)/i;
const DEFAULT_TITLE = "Generate · MicroStock Vector AI";

const STATUS_LABEL: Record<JobItem["status"], string> = {
  menunggu: "Menunggu",
  berjalan: "Dibuat...",
  selesai: "Selesai",
  gagal: "Gagal",
};

/** A model from the latest /uji-model run, with its result. key = "provider|model". */
export type TestedModel = { key: string; label: string; score: number };

export function GenerateForm({
  userId,
  defaultStyle,
  palettes,
  bannedWords,
  initialTheme = "",
  uploadBy,
  defaultImageModel,
  kenariBudgetLeftIdr,
  providerOrder,
  tested,
  svgCostIdr,
  saturated,
  activeJob,
}: {
  userId: string;
  defaultStyle: StyleId;
  palettes: Palette[];
  bannedWords: string[];
  initialTheme?: string;
  /** Upload deadline of a theme picked on Riset (ISO date), shown under the theme field. */
  uploadBy?: string;
  /** Image model the server uses for the traced styles when none is picked here. */
  defaultImageModel: string;
  /** What is left of this month's Kenari budget; null when it could not be read. */
  kenariBudgetLeftIdr: number | null;
  /** The provider order from Settings: what "Sesuai Pengaturan" means. */
  providerOrder: ProviderEntry[];
  tested: TestedModel[];
  /** Average real cost of one SVG call per paid Kenari model, from provider_usage. */
  svgCostIdr: Record<string, number>;
  /** Subjects Adobe refused as similar content (from Aset): warned about and kept out of the concepts. */
  saturated: SaturatedSubject[];
  /** Read-only card for a batch running elsewhere; hidden once this tab runs its own. */
  activeJob: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [style, setStyle] = useState<StyleId>(defaultStyle);
  const [paletteIndex, setPaletteIndex] = useState(palettes.length > 0 ? "0" : "");
  // Kept as typed text so editing never jumps; clamped when the field is left.
  const [countText, setCountText] = useState("10");
  // "" = the order from Settings; "kenari|<id>" or "gemini|<id>" from the picker; free text = a Kenari id.
  const [model, setModel] = useState("");
  const [imageModel, setImageModel] = useState(""); // "" = defaultImageModel
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [state, setState] = useState<JobState | null>(null);
  const [running, setRunning] = useState(false);
  const [batchCost, setBatchCost] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);

  // The model list comes from Kenari's catalog and the Gemini key; if Kenari's cannot be loaded the field becomes free text.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { models?: CatalogModel[]; geminiModels?: string[] } | null) => {
        if (cancelled) return;
        setCatalog((body?.models ?? []).filter((m) => !NON_TEXT_MODEL.test(m.id)));
        setGeminiModels(body?.geminiModels ?? []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Warn before closing the tab: the queue lives in this page.
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  // Keep the screen on while the queue runs: a locked phone suspends the tab and stalls the batch.
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      navigator.wakeLock.request("screen").then(
        (l) => (lock = l),
        () => undefined, // refused (battery saver, hidden tab): the queue still runs, just without the lock
      );
    };
    // The browser drops the lock whenever the tab is hidden; take it again when it comes back.
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [running]);

  // Release preview object URLs when leaving the page.
  useEffect(() => {
    const urls = urlsRef;
    return () => {
      abortRef.current?.abort();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const done = state?.items.filter((i) => i.status === "selesai").length ?? 0;
  const failed = state?.items.filter((i) => i.status === "gagal").length ?? 0;
  const total = state?.items.length ?? 0;
  const finished = state && !running && state.phase !== "mulai";

  // Progress in the tab title, so it shows in the tab strip and the phone's tab switcher.
  useEffect(() => {
    if (!running) {
      document.title = DEFAULT_TITLE;
      return;
    }
    document.title = total > 0 ? `(${done + failed}/${total}) ${DEFAULT_TITLE}` : `Menyiapkan... · ${DEFAULT_TITLE}`;
  }, [running, done, failed, total]);

  // Ticks once a second while the queue waits for quota, for the countdown.
  const waitUntil = state?.waitUntil;
  useEffect(() => {
    if (!waitUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);

  const traced = isImageStyle(style);
  // Traced styles are always black: the palette is not sent.
  const palette = traced || paletteIndex === "" ? [] : (palettes[Number(paletteIndex)]?.colors ?? []);
  const countNumber = /^\d+$/.test(countText) ? Number(countText) : NaN;
  const countValid = Number.isInteger(countNumber) && countNumber >= 1 && countNumber <= MAX_VARIATIONS;
  const count = countValid ? countNumber : Math.min(MAX_VARIATIONS, Math.max(1, countNumber || 1));
  const estimatedMinutes = traced
    ? Math.max(1, Math.ceil((count * IMAGE_SECONDS_PER_ASSET) / 60))
    : Math.max(1, Math.ceil((count + 1) / REQUESTS_PER_MINUTE));

  const bannedHits = findBannedWords(theme, bannedWords);
  const saturatedHits = matchSaturated(theme, saturated);
  const blockReason =
    theme.trim().length < 2
      ? "Isi tema dulu, minimal 2 huruf."
      : bannedHits.length > 0
        ? "Hapus kata terlarang dari tema."
        : !countValid
          ? `Jumlah variasi harus 1 sampai ${MAX_VARIATIONS}.`
          : null;

  const cost = estimateCost({ traced, imageModel: imageModel || defaultImageModel, model, providerOrder, svgCostIdr, count });
  const left = kenariBudgetLeftIdr;
  const overBudget = cost.paid && cost.totalIdr !== undefined && left !== null && cost.totalIdr > left;
  const costHeavy = cost.paid && cost.totalIdr !== undefined && left !== null && cost.totalIdr > left / 2;

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running || blockReason) return;

    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setBatchCost(null);
    setState({ phase: "mulai", items: [] });
    // The progress card sits above the form; bring it into view, which matters most on a phone.
    requestAnimationFrame(() => progressRef.current?.scrollIntoView({ block: "start" }));

    let startedAt: string | undefined;
    await runJob({
      supabase: createClient(),
      userId,
      theme: theme.trim(),
      style,
      palette,
      count,
      avoid: saturated.slice(0, MAX_AVOID).map((s) => s.subject),
      model: traced ? (imageModel ? { provider: "kenari", model: imageModel } : undefined) : parseModelChoice(model),
      bannedWords,
      signal: controller.signal,
      onState: (next) => {
        for (const item of next.items) {
          if (item.previewUrl && !urlsRef.current.includes(item.previewUrl)) urlsRef.current.push(item.previewUrl);
        }
        startedAt = next.startedAt;
        setState(next);
      },
    });
    setRunning(false);

    // Everything Kenari charged since this batch started, failed calls included (single user, so it is this batch).
    if (startedAt) {
      const { data, error } = await createClient().rpc("provider_cost_since", { p_provider: "kenari", p_since: startedAt });
      if (!error) setBatchCost(Number(data ?? 0));
    }
  }

  const waitSeconds = waitUntil && waitUntil > now ? Math.ceil((waitUntil - now) / 1000) : 0;
  const usedBackup =
    !model && !traced && !!state?.lastProvider && !!providerOrder[0] && state.lastProvider !== providerOrder[0].provider;
  const statusText = waitSeconds
    ? `Menunggu kuota provider, ${waitSeconds} dtk lagi.`
    : (state?.message ??
      (state?.providerNote ? `Model terakhir: ${state.providerNote}${usedBackup ? " (cadangan, model utama gagal)" : ""}` : ""));

  const qcCount = (status: string) => state?.items.filter((i) => i.qc === status).length ?? 0;
  const lolos = qcCount("lolos");
  const summary = [
    `${lolos} Lolos`,
    `${qcCount("perlu_cek")} Perlu cek`,
    `${qcCount("gagal")} Gagal QC`,
    ...(qcCount("menunggu") > 0 ? [`${qcCount("menunggu")} tanpa metadata`] : []),
    ...(failed > 0 ? [`${failed} gagal dibuat`] : []),
  ];
  const notStarted = state?.items.filter((i) => i.status === "menunggu").length ?? 0;

  return (
    <div className="space-y-6">
      {!state && activeJob}

      {state && (
        <Card ref={progressRef} className="scroll-mt-4">
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-extrabold">
                {state.phase === "mulai" && "Menyiapkan job..."}
                {state.phase === "konsep" && "Menyusun konsep..."}
                {state.phase === "antrean" && `Membuat aset (${done + failed}/${total})`}
                {state.phase === "selesai" && `Selesai: ${done} aset jadi`}
                {state.phase === "dihentikan" &&
                  `Dihentikan: ${done} aset jadi${notStarted > 0 ? `, ${notStarted} belum dibuat` : ""}`}
                {state.phase === "gagal" && `Antrean berhenti: ${done} aset jadi`}
              </h2>
            </CardTitle>
            {/* Always mounted, so screen readers announce every change instead of missing the first one. */}
            <p role="status" className="text-sm text-muted-foreground empty:hidden">
              {statusText}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {total > 0 && <ProgressLine value={(done + failed) / total} label="Kemajuan antrean" />}

            {finished && total > 0 && (
              <div className="space-y-3 border-y py-4">
                <p className="text-sm">
                  <span className="font-semibold">{summary.join(" · ")}</span>
                  {batchCost !== null && (
                    <span className="text-muted-foreground"> · biaya Kenari batch ini {formatIdr(batchCost)}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {state.jobId && done > 0 && (
                    <Link href={`/aset?job=${state.jobId}`} className={buttonVariants({ variant: "secondary" })}>
                      <LayoutGrid />
                      Periksa di Aset
                    </Link>
                  )}
                  {lolos > 0 && (
                    <Link href="/ekspor" className={buttonVariants({ variant: "outline" })}>
                      <FileDown />
                      Ekspor {lolos} aset Lolos
                    </Link>
                  )}
                </div>
              </div>
            )}

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {state.items.map((item) => (
                <li key={item.index} className="space-y-1.5 rounded-2xl border bg-card p-2 text-xs">
                  <div
                    className={cn(
                      "bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-xl",
                      item.status === "berjalan" && "animate-pulse ring-2 ring-brand",
                    )}
                  >
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt={item.concept.subject} className="size-full object-contain" />
                    ) : (
                      <span className="rounded-sm bg-card px-2.5 py-1 font-medium text-muted-foreground">
                        {STATUS_LABEL[item.status]}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">{item.concept.subject}</p>
                  {item.qc && <QcBadge status={item.qc} />}
                  {item.note && <p className="text-warning-foreground">{item.note}</p>}
                  {item.error && <p className="text-destructive">{item.error}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-extrabold">Tema baru</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={start} noValidate className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="theme">Tema</Label>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                maxLength={120}
                required
                disabled={running}
                placeholder="mis. autumn harvest icons"
                aria-invalid={bannedHits.length > 0 ? true : undefined}
                aria-describedby={cn(bannedHits.length > 0 && "theme-error", saturatedHits.length > 0 && "theme-saturated", "theme-hint")}
              />
              {bannedHits.length > 0 && (
                <p id="theme-error" className="text-sm text-destructive">
                  Kata terlarang: {bannedHits.join(", ")}. Hapus dari tema, atau ubah daftarnya di Pengaturan.
                </p>
              )}
              <p id="theme-hint" className="text-sm text-muted-foreground">
                Bahasa Inggris. Tanpa merek, tokoh, atau karakter: Adobe menolaknya.
              </p>
              {saturatedHits.length > 0 && (
                <p id="theme-saturated" className="text-sm font-medium">
                  Mirip subjek yang ditolak Adobe sebagai &quot;similar content&quot;:{" "}
                  {saturatedHits.map((s) => `${s.subject.toLowerCase()} (${s.count} aset)`).join(", ")}. Pilih subjek yang lebih spesifik.
                </p>
              )}
              {uploadBy && theme === initialTheme && (
                <p className="text-sm font-medium">
                  Dari Riset: upload sebelum{" "}
                  {new Date(`${uploadBy}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="style">Gaya</Label>
                <select
                  id="style"
                  value={style}
                  onChange={(e) => setStyle(e.target.value as StyleId)}
                  disabled={running}
                  className={selectClass}
                >
                  {STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <StylePreview style={style} palette={palette} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="palette">Palet warna</Label>
                {traced ? (
                  <select id="palette" disabled className={selectClass} value="hitam">
                    <option value="hitam">Hitam (gaya ini selalu hitam)</option>
                  </select>
                ) : (
                  <select
                    id="palette"
                    value={paletteIndex}
                    onChange={(e) => setPaletteIndex(e.target.value)}
                    disabled={running}
                    className={selectClass}
                  >
                    <option value="">Bebas (dipilih AI)</option>
                    {palettes.map((p, i) => (
                      <option key={`${p.name}-${i}`} value={i}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                {palette.length > 0 && (
                  <div className="flex gap-1" aria-hidden>
                    {palette.map((c) => (
                      <span key={c} className="size-4 rounded-sm border" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">Jumlah variasi</Label>
                <Input
                  id="count"
                  inputMode="numeric"
                  value={countText}
                  onChange={(e) => setCountText(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  onBlur={() => setCountText(String(count))}
                  disabled={running}
                  aria-invalid={countValid ? undefined : true}
                  aria-describedby="count-hint"
                />
                <p id="count-hint" className={cn("text-sm", countValid ? "text-muted-foreground" : "text-destructive")}>
                  1 sampai {MAX_VARIATIONS} per batch.
                </p>
              </div>
            </div>

            <details className="group rounded-xl border" open={model !== "" || imageModel !== "" ? true : undefined}>
              <summary
                className={cn(
                  "flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
                  "min-h-11",
                )}
              >
                <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
                <span className="font-semibold">Lanjutan</span>
                <span className="min-w-0 truncate text-muted-foreground">
                  {traced ? "Model gambar" : "Model SVG"}: {cost.modelLabel}
                </span>
              </summary>
              <div className="space-y-2 border-t p-3">
                {traced ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Label htmlFor="image-model">Model gambar</Label>
                      <InfoTip align="start" label="Tentang model gambar">
                        Berbayar dari saldo Kenari. Model menggambar hitam-putih, lalu server mengubahnya jadi SVG. Konsep dan
                        metadata tetap memakai model teks. Tanpa cadangan; gambar yang gagal dicoba ulang sekali.
                      </InfoTip>
                    </div>
                    <select
                      id="image-model"
                      value={imageModel}
                      onChange={(e) => setImageModel(e.target.value)}
                      disabled={running}
                      className={selectClass}
                    >
                      <option value="">
                        Sesuai Pengaturan ({defaultImageModel}
                        {imagePriceIdr(defaultImageModel) !== undefined ? ` · ${formatIdr(imagePriceIdr(defaultImageModel)!)}` : ""})
                      </option>
                      {IMAGE_MODELS.map(([id, price]) => (
                        <option key={id} value={id}>
                          {id} · {formatIdr(price)} per gambar
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1">
                      <Label htmlFor="model">Model SVG</Label>
                      <InfoTip align="start" label="Tentang model SVG">
                        Hanya untuk menggambar SVG; konsep dan metadata memakai model dari Pengaturan. Model yang dipilih di
                        sini jalan sendiri tanpa cadangan. Model Kenari berbayar masuk batas biaya bulanan.
                      </InfoTip>
                    </div>
                    {catalog && catalog.length > 0 ? (
                      <ModelSelect
                        value={model}
                        onChange={setModel}
                        disabled={running}
                        catalog={catalog}
                        geminiModels={geminiModels}
                        tested={tested}
                        svgCostIdr={svgCostIdr}
                        defaultLabel={orderLabel(providerOrder)}
                      />
                    ) : (
                      <Input
                        id="model"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        disabled={running || catalog === null}
                        maxLength={120}
                        placeholder={catalog === null ? "Memuat daftar model..." : "Kosong = model dari Pengaturan; atau ketik nama model Kenari"}
                      />
                    )}
                  </>
                )}
              </div>
            </details>

            {overBudget && (
              <p id="cost-warning" className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-medium text-warning-foreground">
                Perkiraan biaya melebihi sisa batas Kenari bulan ini ({formatIdr(left!)}). Antrean berhenti saat batas tercapai.
              </p>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={running || blockReason !== null}
                  aria-describedby={cn(blockReason && !running && "start-hint", overBudget && "cost-warning") || undefined}
                >
                  {running ? <Loader2 className="animate-spin" /> : <Spline />}
                  {running ? "Sedang berjalan..." : "Mulai generate"}
                </Button>
                {running && (
                  <Button type="button" size="lg" variant="outline" onClick={() => abortRef.current?.abort()}>
                    <Square />
                    Hentikan
                  </Button>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden />±{estimatedMinutes} menit
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                    costHeavy ? "bg-warning-soft text-warning-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Wallet className="size-3.5" aria-hidden />
                  {cost.chip}
                </span>
              </div>
              {blockReason && !running && (
                <p id="start-hint" className="text-sm text-muted-foreground">
                  {blockReason}
                </p>
              )}
              {cost.detail && (
                <p className="text-sm text-muted-foreground">
                  {cost.detail}
                  {cost.paid && left !== null && ` · sisa batas bulan ini ${formatIdr(left)}`}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** The SVG model picker: tested models first with their result, then Kenari free, Kenari paid, Gemini. */
function ModelSelect({
  value,
  onChange,
  disabled,
  catalog,
  geminiModels,
  tested,
  svgCostIdr,
  defaultLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  catalog: CatalogModel[];
  geminiModels: string[];
  tested: TestedModel[];
  svgCostIdr: Record<string, number>;
  defaultLabel: string;
}) {
  const available = new Set([...catalog.map((m) => `kenari|${m.id}`), ...geminiModels.map((id) => `gemini|${id}`)]);
  const testedHere = tested.filter((t) => available.has(t.key)).sort((a, b) => b.score - a.score);
  const testedKeys = new Set(testedHere.map((t) => t.key));
  const kenari = catalog.filter((m) => !testedKeys.has(`kenari|${m.id}`));

  const paidLabel = (m: CatalogModel) => {
    const avg = svgCostIdr[m.id];
    if (avg !== undefined) return ` · ±${formatIdr(avg)} per SVG`;
    if (m.inPerMTokIdr !== null && m.outPerMTokIdr !== null) {
      return ` · Rp${Math.round(m.inPerMTokIdr).toLocaleString("id-ID")} / Rp${Math.round(m.outPerMTokIdr).toLocaleString("id-ID")} per 1 jt token`;
    }
    return "";
  };

  return (
    <select id="model" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={selectClass}>
      <option value="">Sesuai Pengaturan ({defaultLabel})</option>
      {testedHere.length > 0 && (
        <optgroup label="Sudah diuji di Uji model">
          {testedHere.map((t) => (
            <option key={t.key} value={t.key}>
              {t.key.split("|")[1]} · {t.label}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Kenari gratis">
        {kenari
          .filter((m) => m.free)
          .map((m) => (
            <option key={m.id} value={`kenari|${m.id}`}>
              {m.id}
            </option>
          ))}
      </optgroup>
      <optgroup label="Kenari berbayar">
        {kenari
          .filter((m) => !m.free)
          .map((m) => (
            <option key={m.id} value={`kenari|${m.id}`}>
              {m.id}
              {paidLabel(m)}
            </option>
          ))}
      </optgroup>
      {geminiModels.some((id) => !testedKeys.has(`gemini|${id}`)) && (
        <optgroup label="Gemini (free tier)">
          {geminiModels
            .filter((id) => !testedKeys.has(`gemini|${id}`))
            .map((id) => (
              <option key={id} value={`gemini|${id}`}>
                {id}
              </option>
            ))}
        </optgroup>
      )}
    </select>
  );
}

/** Estimated cost of the batch's drawing calls, as shown before it starts. Concepts and metadata are not included. */
function estimateCost(p: {
  traced: boolean;
  imageModel: string;
  model: string;
  providerOrder: ProviderEntry[];
  svgCostIdr: Record<string, number>;
  count: number;
}): { paid: boolean; totalIdr?: number; chip: string; detail?: string; modelLabel: string } {
  if (p.traced) {
    const price = imagePriceIdr(p.imageModel);
    if (price === undefined) return { paid: true, chip: "Harga model belum diketahui", modelLabel: p.imageModel };
    return {
      paid: true,
      totalIdr: price * p.count,
      chip: `±${formatIdr(price * p.count)}`,
      detail: `${p.count} gambar × ${formatIdr(price)}; gambar yang gagal dicoba ulang sekali dan ikut dibayar.`,
      modelLabel: `${p.imageModel} · ${formatIdr(price)} per gambar`,
    };
  }

  const picked = parseModelChoice(p.model);
  const entry = picked ?? p.providerOrder[0];
  const modelLabel = picked ? `${picked.provider} · ${picked.model}` : "Sesuai Pengaturan";
  if (!entry || (entry.provider === "kenari" && !entry.model)) {
    return { paid: false, chip: "Model bawaan server", modelLabel };
  }
  if (entry.provider !== "kenari" || entry.model.endsWith(":free")) {
    // A paid backup only runs when the free model fails, so it is mentioned, not counted.
    const paidBackup = picked ? undefined : p.providerOrder.slice(1).find(isPaidEntry);
    return {
      paid: false,
      chip: "Gratis",
      detail: paidBackup ? `Cadangan ${paidBackup.model} berbayar, dipakai hanya bila model utama gagal.` : undefined,
      modelLabel,
    };
  }

  const perSvg = p.svgCostIdr[entry.model];
  if (perSvg === undefined) {
    return {
      paid: true,
      chip: "Biaya per SVG belum diketahui",
      detail: `${entry.model} berbayar dan belum pernah dipakai; biayanya tercatat setelah SVG pertama.`,
      modelLabel,
    };
  }
  return {
    paid: true,
    totalIdr: perSvg * p.count,
    chip: `±${formatIdr(perSvg * p.count)}`,
    detail: `${p.count} SVG × ±${formatIdr(perSvg)} (rata-rata biaya ${entry.model} sebelumnya)`,
    modelLabel,
  };
}

/** Picker value to the model sent with each SVG call. Typed text without a prefix is a Kenari id. */
function parseModelChoice(value: string): { provider: "kenari" | "gemini"; model: string } | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const [prefix, ...rest] = text.split("|");
  if (rest.length > 0 && (prefix === "kenari" || prefix === "gemini")) return { provider: prefix, model: rest.join("|") };
  return { provider: "kenari", model: text };
}
