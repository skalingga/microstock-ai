"use client";

import { ChevronDown, Clock, FlaskConical, Loader2, Plus, RotateCcw, Shapes, Square, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { InfoTip } from "@/components/info-tip";
import { Anchor, ProgressLine } from "@/components/pen-motif";
import { QcBadge } from "@/components/qc-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QC_LABEL } from "@/lib/assets";
import { formatIdr } from "@/lib/budget";
import {
  cellsToRedo,
  continueBenchmark,
  estimateRemainingMs,
  runBenchmark,
  suggest,
  summarize,
  type BenchCell,
  type BenchModel,
  type BenchSetup,
  type BenchState,
  type ModelSummary,
} from "@/lib/generate/benchmark";
import type { CatalogModel } from "@/lib/providers/kenari-pricing";
import { STYLES, isImageStyle, type StyleId } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/client";
import { selectClass, tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { pakaiModel } from "./actions";

const TEXT_STYLES = STYLES.filter((s) => !isImageStyle(s.value));
const MAX_THEMES = 8;

// One theme per text style, so every model is tried on every kind of asset.
const DEFAULT_THEMES: { theme: string; style: StyleId }[] = [
  { theme: "halloween pumpkin icons", style: "icon_set" },
  { theme: "autumn leaves", style: "seamless_pattern" },
  { theme: "cozy coffee shop", style: "flat_illustration" },
  { theme: "summer camping", style: "badge_label" },
  { theme: "soft geometric waves", style: "abstract_background" },
];

// From the Stage 4 run (2026-10-07): the models that made at least one usable SVG. hy3:free and qwen3-8-27b:free
// made none (all timeouts) and are left out; add them back with "Tambah model" to re-check.
const DEFAULT_MODELS: BenchModel[] = [
  { provider: "gemini", model: "gemini-3.5-flash-lite" },
  { provider: "kenari", model: "agnes-2-0-flash:free" },
  { provider: "kenari", model: "deepseek-v4-flash" },
  { provider: "kenari", model: "muse-spark-1-3-contributor:free" },
  { provider: "kenari", model: "nemotron-3-super-120b-a12b:free" },
  { provider: "kenari", model: "agnes-3-0-flash:free" },
];

const SECONDS_PER_SVG = 30; // before a run: free models took 4-70s per SVG in the check, plus quota waits

const key = (m: { provider: string; model: string }) => `${m.provider}|${m.model}`;
const isPaid = (m: BenchModel) => m.provider === "kenari" && !m.model.endsWith(":free");

/** Wall clock for the elapsed-time display; only called from event handlers and timers, never while rendering. */
function clock() {
  return Date.now();
}

function minutes(ms: number) {
  const m = Math.round(ms / 60_000);
  return m < 1 ? "<1 menit" : `±${m} menit`;
}

/** Events from the saved results below to the runner, which owns every running queue on this page. */
type RunnerEvent = { kind: "setup"; setup: BenchSetup } | { kind: "continue"; id: string; setup: BenchSetup; cells: BenchCell[]; retryFailed: boolean };
const EVENT = "uji-model:runner";
const sendToRunner = (detail: RunnerEvent) => window.dispatchEvent(new CustomEvent<RunnerEvent>(EVENT, { detail }));

export function BenchmarkRunner({
  userId,
  bannedWords,
  hasRuns,
  costPerSvg,
  budgetLeftIdr,
}: {
  userId: string;
  bannedWords: string[];
  hasRuns: boolean;
  /** Average real cost of one SVG per paid Kenari model, from past calls. */
  costPerSvg: Record<string, number>;
  budgetLeftIdr: number;
}) {
  const router = useRouter();
  const [themes, setThemes] = useState(DEFAULT_THEMES);
  const [models, setModels] = useState<BenchModel[]>(DEFAULT_MODELS);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(DEFAULT_MODELS.map(key)));
  const [variations, setVariations] = useState(1);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [state, setState] = useState<BenchState | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(!hasRuns);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { models?: CatalogModel[]; geminiModels?: string[] } | null) => {
        if (cancelled) return;
        setCatalog(body?.models ?? []);
        setGeminiModels(body?.geminiModels ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The queue lives in this page: warn before the tab closes, and tick a clock for the elapsed time.
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    const timer = setInterval(() => setNow(clock()), 1000);
    return () => {
      window.removeEventListener("beforeunload", handler);
      clearInterval(timer);
    };
  }, [running]);

  useEffect(() => {
    const urls = urlsRef;
    return () => {
      abortRef.current?.abort();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const picked = models.filter((m) => checked.has(key(m)));
  const validThemes = themes.filter((t) => t.theme.trim().length >= 2);
  const perModel = validThemes.length * variations;
  const cellCount = perModel * picked.length;
  const paid = picked.filter(isPaid);
  const knownCost = paid.filter((m) => costPerSvg[m.model] !== undefined);
  const costEstimate = knownCost.reduce((sum, m) => sum + costPerSvg[m.model] * perModel, 0);
  const unknownPaid = paid.length - knownCost.length;

  async function execute(run: (signal: AbortSignal, onState: (s: BenchState) => void) => Promise<void>) {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setNotice(null);
    setStartedAt(clock());
    setNow(clock());
    let last: BenchState | null = null;
    await run(controller.signal, (next) => {
      for (const c of next.cells) if (c.previewUrl && !urlsRef.current.includes(c.previewUrl)) urlsRef.current.push(c.previewUrl);
      last = next;
      setState(next);
    });
    setRunning(false);
    setStartedAt(null);
    const final = last as BenchState | null;
    // The saved run below now shows everything; drop the live copy instead of showing the same run twice.
    if (final?.benchmarkId) {
      setNotice(
        final.phase === "selesai"
          ? { text: "Uji selesai. Hasilnya ada di bawah." }
          : { text: final.message ?? "Uji berhenti sebelum selesai. Lanjutkan dari hasil di bawah.", error: final.phase === "gagal" },
      );
      setState(null);
      router.push(`/uji-model?run=${final.benchmarkId}`, { scroll: false });
      router.refresh();
    } else if (final) {
      setNotice({ text: final.message ?? "Uji tidak bisa dimulai.", error: true });
      setState(null);
    }
  }

  function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running || cellCount === 0) return;
    const setup: BenchSetup = { themes: validThemes.map((t) => ({ theme: t.theme.trim(), style: t.style })), models: picked, variations };
    setState({ phase: "mulai", setup, cells: [] });
    void execute((signal, onState) => runBenchmark({ supabase: createClient(), userId, setup, bannedWords, signal, onState }));
  }

  // Requests from the saved results: refill the form, or continue a run in place.
  useEffect(() => {
    function onEvent(e: Event) {
      const detail = (e as CustomEvent<RunnerEvent>).detail;
      if (running) return;
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (detail.kind === "setup") {
        setThemes(detail.setup.themes.map((t) => ({ theme: t.theme, style: t.style })));
        setModels((prev) => [...detail.setup.models, ...prev.filter((m) => !detail.setup.models.some((x) => key(x) === key(m)))]);
        setChecked(new Set(detail.setup.models.map(key)));
        setVariations(detail.setup.variations);
        setOpen(true);
        return;
      }
      setState({ phase: "antrean", benchmarkId: detail.id, setup: detail.setup, cells: detail.cells });
      void execute((signal, onState) =>
        continueBenchmark({
          supabase: createClient(),
          userId,
          setup: detail.setup,
          bannedWords,
          signal,
          onState,
          benchmarkId: detail.id,
          cells: detail.cells,
          retryFailed: detail.retryFailed,
        }),
      );
    }
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  });

  function addExtra() {
    const [provider, ...rest] = extra.split("|");
    const model = rest.join("|");
    if ((provider !== "kenari" && provider !== "gemini") || !model) return;
    const m = { provider, model } as BenchModel;
    if (!models.some((x) => key(x) === key(m))) setModels([...models, m]);
    setChecked(new Set([...checked, key(m)]));
    setExtra("");
  }

  const finished = state?.cells.filter((c) => c.status === "selesai" || c.status === "gagal").length ?? 0;
  const total = state?.cells.length ?? 0;
  const remaining = state ? estimateRemainingMs(state.cells) : null;

  return (
    <section ref={sectionRef} className="scroll-mt-6 space-y-4" aria-labelledby="uji-baru-heading">
      {state ? (
        <div className="space-y-4 rounded-md border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 id="uji-baru-heading" className="text-lg font-bold" aria-live="polite">
                {state.phase === "mulai" && "Menyiapkan uji..."}
                {state.phase === "konsep" && "Menyusun konsep..."}
                {state.phase === "antrean" && `Menggambar ${finished} dari ${total} SVG`}
                {state.phase === "selesai" && `Selesai: ${finished} SVG dicoba`}
                {state.phase === "dihentikan" && `Dihentikan setelah ${finished} SVG`}
                {state.phase === "gagal" && "Uji berhenti"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {startedAt && `Berjalan ${minutes(Math.max(0, now - startedAt))}`}
                {remaining !== null && running && ` · sisa ${minutes(remaining)}`}
                {" · biarkan tab ini terbuka; di HP, layar jangan dikunci."}
              </p>
              {state.message && (
                <p role="status" className="text-sm">
                  {state.message}
                </p>
              )}
            </div>
            {running && (
              <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
                <Square />
                Hentikan
              </Button>
            )}
          </div>
          {total > 0 && <ProgressLine value={finished / total} label="Kemajuan uji" />}
          <BenchResults setup={state.setup} cells={state.cells} previews={{}} live />
        </div>
      ) : (
        <details
          className="group rounded-md border bg-card"
          open={open}
          onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className={cn("flex cursor-pointer list-none items-center justify-between gap-2 px-5", tapTarget, "min-h-13")}>
            <span id="uji-baru-heading" className="flex items-center gap-1 text-lg font-bold">
              Uji baru
            </span>
            <ChevronDown aria-hidden className="size-4 transition-transform duration-150 group-open:rotate-180" />
          </summary>

          <form onSubmit={start} className="space-y-6 px-5 pb-5">
            <p className="flex items-start gap-1 text-sm text-muted-foreground">
              Konsep dibuat sekali per tema, lalu tiap model menggambar konsep yang sama satu kali tanpa coba-ulang.
              <InfoTip align="start">
                Konsep memakai model teks dari Pengaturan. Timeout atau balasan rusak dihitung gagal. Siluet dan Line art tidak diuji di
                sini. Model gratis Kenari berbagi satu kuota per menit, jadi antrean kadang menunggu.
              </InfoTip>
            </p>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Tema (bahasa Inggris)</legend>
              {themes.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_16rem_auto]">
                  <Input
                    aria-label={`Tema ${i + 1}`}
                    value={t.theme}
                    maxLength={120}
                    onChange={(e) => setThemes(themes.map((x, j) => (j === i ? { ...x, theme: e.target.value } : x)))}
                    placeholder="mis. winter holiday ornaments"
                  />
                  <select
                    aria-label={`Gaya tema ${i + 1}`}
                    value={t.style}
                    onChange={(e) => setThemes(themes.map((x, j) => (j === i ? { ...x, style: e.target.value as StyleId } : x)))}
                    className={cn(selectClass, "max-sm:col-span-1 max-sm:row-start-2")}
                  >
                    {TEXT_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus tema ${i + 1}`}
                    disabled={themes.length <= 1}
                    onClick={() => setThemes(themes.filter((_, j) => j !== i))}
                    className="max-sm:row-span-2"
                  >
                    <X />
                  </Button>
                </div>
              ))}
              {themes.length < MAX_THEMES && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setThemes([...themes, { theme: "", style: "icon_set" }])}>
                  <Plus />
                  Tambah tema
                </Button>
              )}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Model yang dibandingkan</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {models.map((m) => (
                  <div key={key(m)} className="flex items-center gap-1">
                    <label className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm", tapTarget)}>
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-foreground"
                        checked={checked.has(key(m))}
                        onChange={(e) => {
                          const next = new Set(checked);
                          if (e.target.checked) next.add(key(m));
                          else next.delete(key(m));
                          setChecked(next);
                        }}
                      />
                      <span className="truncate font-mono text-xs">{m.model}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {m.provider === "gemini" ? "Gemini, gratis" : m.model.endsWith(":free") ? "Kenari, gratis" : "Kenari, berbayar"}
                      </span>
                    </label>
                    {!DEFAULT_MODELS.some((d) => key(d) === key(m)) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Buang ${m.model} dari daftar`}
                        onClick={() => {
                          setModels(models.filter((x) => key(x) !== key(m)));
                          const next = new Set(checked);
                          next.delete(key(m));
                          setChecked(next);
                        }}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {(catalog.length > 0 || geminiModels.length > 0) && (
                <div className="flex gap-2">
                  <select aria-label="Tambah model" value={extra} onChange={(e) => setExtra(e.target.value)} className={selectClass}>
                    <option value="">Tambah model lain...</option>
                    <optgroup label="Kenari gratis">
                      {catalog
                        .filter((m) => m.free)
                        .map((m) => (
                          <option key={m.id} value={`kenari|${m.id}`}>
                            {m.id}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Kenari berbayar">
                      {catalog
                        .filter((m) => !m.free)
                        .map((m) => (
                          <option key={m.id} value={`kenari|${m.id}`}>
                            {m.id}
                          </option>
                        ))}
                    </optgroup>
                    {geminiModels.length > 0 && (
                      <optgroup label="Gemini (free tier)">
                        {geminiModels.map((id) => (
                          <option key={id} value={`gemini|${id}`}>
                            {id}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <Button type="button" variant="outline" onClick={addExtra} disabled={!extra}>
                    Tambah
                  </Button>
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-1">
              <legend className="text-sm font-semibold">Konsep per tema</legend>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <label
                    key={n}
                    className={cn(
                      "inline-flex min-h-9 min-w-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm",
                      tapTarget,
                      variations === n ? "border-foreground bg-secondary font-semibold" : "hover:bg-muted/50",
                    )}
                  >
                    <input type="radio" name="variations" value={n} checked={variations === n} onChange={() => setVariations(n)} className="sr-only" />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="lg" disabled={running || cellCount === 0}>
                {running ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                Mulai uji
              </Button>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Shapes className="size-3.5" />
                {cellCount} SVG
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="size-3.5" />
                {minutes(cellCount * SECONDS_PER_SVG * 1000)}
              </span>
              {paid.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning-foreground">
                  <Wallet className="size-3.5" />
                  {paid.length * perModel} SVG berbayar
                  {knownCost.length > 0 && ` ≈ ${formatIdr(costEstimate)}`}
                  {unknownPaid > 0 && ` (${unknownPaid} model belum punya harga)`}
                  {` · sisa anggaran ${formatIdr(budgetLeftIdr)}`}
                </span>
              )}
            </div>
            {paid.length > 0 && costEstimate > budgetLeftIdr && (
              <p className="text-sm text-warning-foreground">
                Perkiraan biaya melebihi sisa anggaran Kenari bulan ini, jadi sebagian SVG berbayar akan ditolak.
              </p>
            )}
          </form>
        </details>
      )}

      {notice && (
        <p role={notice.error ? "alert" : "status"} className={cn("text-sm", notice.error ? "text-destructive" : "text-muted-foreground")}>
          {notice.text}
        </p>
      )}
    </section>
  );
}

const ERROR_LABEL: Record<string, string> = {
  timeout: "terlalu lama",
  bad_output: "balasan rusak",
  bad_svg: "SVG rusak",
  rate_limit: "kuota habis",
  model_unavailable: "model tidak ada",
  budget_exceeded: "batas biaya",
  upstream: "error provider",
  network: "koneksi",
};

function seconds(ms: number | null | undefined) {
  return ms === null || ms === undefined ? "–" : `${(ms / 1000).toFixed(1)} dtk`;
}

const errorsText = (r: ModelSummary) =>
  Object.entries(r.errors)
    .map(([code, n]) => `${n} ${ERROR_LABEL[code] ?? code}`)
    .join(", ") || "–";

type Current = { primary: string; backup: string };

function CurrentTag({ row, current }: { row: ModelSummary; current?: Current }) {
  if (!current) return null;
  const k = key(row);
  if (k === current.primary) return <span className="rounded-sm bg-secondary px-1.5 py-px font-sans text-xs font-semibold text-secondary-foreground">utama sekarang</span>;
  if (k === current.backup) return <span className="rounded-sm bg-secondary px-1.5 py-px font-sans text-xs font-semibold text-secondary-foreground">cadangan sekarang</span>;
  return null;
}

/** "Pakai sebagai utama / cadangan": writes the provider chain in Settings. */
function ApplyButtons({ row, current, compact }: { row: ModelSummary; current?: Current; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  if (!current) return null;
  const k = key(row);
  const apply = (slot: "utama" | "cadangan") =>
    startTransition(async () => {
      const result = await pakaiModel({ slot, provider: row.provider, model: row.model });
      setMessage(result.ok ? { text: result.message } : { text: result.error, error: true });
    });
  return (
    <span className={cn("flex flex-wrap items-center gap-1", compact && "justify-end")}>
      {k !== current.primary && (
        <Button type="button" size="sm" variant={compact ? "ghost" : "default"} onClick={() => apply("utama")} disabled={pending}>
          Jadikan utama
        </Button>
      )}
      {k !== current.backup && k !== current.primary && (
        <Button type="button" size="sm" variant={compact ? "ghost" : "outline"} onClick={() => apply("cadangan")} disabled={pending}>
          Jadikan cadangan
        </Button>
      )}
      {message && (
        <span role={message.error ? "alert" : "status"} className={cn("w-full text-xs", message.error ? "text-destructive" : "text-muted-foreground")}>
          {message.text}
        </span>
      )}
    </span>
  );
}

function Verdict({ rows, current }: { rows: ModelSummary[]; current?: Current }) {
  const { primary, backup } = suggest(rows);
  if (!primary) return <p className="text-sm text-muted-foreground">Belum ada model yang menghasilkan SVG yang bisa dipakai di uji ini.</p>;
  const line = (label: string, r: ModelSummary) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Anchor filled={label === "Utama"} />
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">Saran {label.toLowerCase()}</span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold break-all">{r.model}</span>
            <CurrentTag row={r} current={current} />
          </span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            {Math.round(r.score * 100)}% · {r.lolos}/{r.total} Lolos · {seconds(r.medianMs)} · {r.costIdr > 0 ? formatIdr(r.costIdr) : "Rp0"}
          </span>
        </span>
      </span>
      <ApplyButtons row={r} current={current} />
    </div>
  );
  return (
    <div className="divide-y rounded-md border bg-card px-4">
      {line("Utama", primary)}
      {backup && line("Cadangan", backup)}
      <p className="flex items-start gap-1 py-2 text-xs text-muted-foreground">
        Skor = (Lolos + ½ Perlu cek) ÷ percobaan. Skor tidak menilai bagus-jeleknya desain: lihat juga gambarnya di bawah.
        <InfoTip align="end">
          Dari QC visual saja; seri diurutkan dari yang tercepat. Cadangan dipilih dari kuota yang terpisah dari model utama, karena
          tugasnya mengambil alih saat utama kena limit. Rantai provider di Pengaturan harus memakai dua provider berbeda.
        </InfoTip>
      </p>
    </div>
  );
}

function SummaryTable({ rows, current }: { rows: ModelSummary[]; current?: Current }) {
  const totalCost = rows.reduce((sum, r) => sum + r.costIdr, 0);
  return (
    <div className="space-y-2">
      {/* Phones: one card per model instead of a wide table. */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <li key={key(r)} className="space-y-1 rounded-md border bg-card p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold break-all">{r.model}</span>
              <CurrentTag row={r} current={current} />
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              <strong className="text-foreground">{Math.round(r.score * 100)}%</strong> · {r.lolos} Lolos, {r.perluCek} Perlu cek, {r.gagalQc} Gagal QC dari{" "}
              {r.total} · {seconds(r.medianMs)} · {r.costIdr > 0 ? formatIdr(r.costIdr) : "Rp0"}
            </p>
            {r.made < r.total && <p className="text-xs text-muted-foreground">Gagal dibuat: {errorsText(r)}</p>}
            <ApplyButtons row={r} current={current} compact />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">Ringkasan per model, terbaik dulu</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Model
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Skor
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                SVG jadi
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Lolos / Perlu cek / Gagal QC
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Gagal dibuat
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Median waktu
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Rata-rata path
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Biaya
              </th>
              <th scope="col" className="py-2 font-semibold">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={key(r)} className="border-b align-top last:border-0">
                <th scope="row" className="min-w-44 py-2 pr-3 text-left font-normal">
                  <span className="block font-mono text-xs [overflow-wrap:anywhere]">{r.model}</span>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {r.provider === "gemini" ? "Gemini" : "Kenari"}
                    <CurrentTag row={r} current={current} />
                  </span>
                </th>
                <td className="py-2 pr-3 font-semibold">{Math.round(r.score * 100)}%</td>
                <td className="py-2 pr-3">
                  {r.made}/{r.total}
                </td>
                <td className="py-2 pr-3">
                  {r.lolos} / {r.perluCek} / {r.gagalQc}
                </td>
                <td className="py-2 pr-3 text-xs">{errorsText(r)}</td>
                <td className="py-2 pr-3">{seconds(r.medianMs)}</td>
                <td className="py-2 pr-3">{r.avgShapes ?? "–"}</td>
                <td className="py-2 pr-3">{r.costIdr > 0 ? formatIdr(r.costIdr) : "Rp0"}</td>
                <td className="py-2">
                  <ApplyButtons row={r} current={current} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Total biaya uji ini: {totalCost > 0 ? formatIdr(totalCost) : "Rp0"}.</p>
    </div>
  );
}

/** Actions on a saved run: continue it, redraw the failed cells, or refill the form with its setup. */
function SavedRunActions({ id, status, setup, cells }: { id: string; status: string; setup: BenchSetup; cells: BenchCell[] }) {
  const waiting = cellsToRedo(cells, false).length;
  const failed = cells.filter((c) => c.status === "gagal").length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {waiting > 0 && (
        <Button type="button" onClick={() => sendToRunner({ kind: "continue", id, setup, cells, retryFailed: false })}>
          Lanjutkan {waiting} SVG yang belum
        </Button>
      )}
      {failed > 0 && (
        <Button type="button" variant="outline" onClick={() => sendToRunner({ kind: "continue", id, setup, cells, retryFailed: true })}>
          <RotateCcw />
          Ulangi {failed} yang gagal{waiting > 0 ? " + yang belum" : ""}
        </Button>
      )}
      <Button type="button" variant="ghost" onClick={() => sendToRunner({ kind: "setup", setup })}>
        Uji baru dengan setup ini
      </Button>
      {status === "berjalan" && waiting > 0 && (
        <span className="text-xs text-muted-foreground">Uji ini terputus (tab tertutup atau layar terkunci).</span>
      )}
    </div>
  );
}

export function BenchResults({
  setup,
  cells,
  previews,
  current,
  saved,
  live,
}: {
  setup: BenchSetup;
  cells: BenchCell[];
  previews: Record<string, string>;
  current?: Current;
  /** A run read back from the database: offers continue / retry / reuse. */
  saved?: { id: string; status: string };
  /** The run being drawn right now: no verdict yet. */
  live?: boolean;
}) {
  if (cells.length === 0) return null;
  const rows = summarize(cells);
  const models = setup.models;
  // One row per concept, in the order they were drawn.
  const concepts: { theme: string; concept: string }[] = [];
  for (const c of cells) {
    if (!concepts.some((x) => x.theme === c.theme && x.concept === c.concept)) concepts.push({ theme: c.theme, concept: c.concept });
  }

  return (
    <div className="space-y-6">
      {!live && rows.length > 0 && <Verdict rows={rows} current={current} />}
      {saved && <SavedRunActions id={saved.id} status={saved.status} setup={setup} cells={cells} />}
      {rows.length > 0 && <SummaryTable rows={rows} current={live ? undefined : current} />}

      <div className="overflow-x-auto rounded-md border">
        <table className="text-xs">
          <caption className="sr-only">Gambar tiap model per konsep</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] w-36 bg-card p-2 text-left font-semibold text-muted-foreground">
                Konsep
              </th>
              {models.map((m) => (
                <th key={key(m)} scope="col" className="w-28 p-2 text-left font-mono font-normal break-all text-muted-foreground">
                  {m.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concepts.map((row) => {
              const job = setup.themes.find((t) => t.theme === row.theme)?.jobId;
              return (
                <tr key={`${row.theme}|${row.concept}`} className="border-t align-top">
                  <th scope="row" className="sticky left-0 z-[1] w-36 bg-card p-2 text-left font-normal">
                    <p className="font-semibold">{row.theme}</p>
                    <p className="line-clamp-3 text-muted-foreground">{row.concept}</p>
                    {job && (
                      <Link href={`/aset?job=${job}`} className={cn("inline-flex items-center underline underline-offset-4", tapTarget)}>
                        Lihat di Aset
                      </Link>
                    )}
                  </th>
                  {models.map((m) => {
                    const cell = cells.find(
                      (c) => c.theme === row.theme && c.concept === row.concept && c.provider === m.provider && c.model === m.model,
                    );
                    return (
                      <td key={key(m)} className="p-2">
                        {cell ? <CellView cell={cell} preview={cell.previewUrl ?? (cell.assetId ? previews[cell.assetId] : undefined)} /> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellView({ cell, preview }: { cell: BenchCell; preview?: string }) {
  const alt = `${cell.model}: ${cell.concept}${cell.qc ? ` (${QC_LABEL[cell.qc] ?? cell.qc})` : ""}`;
  const thumb = (
    <div className="bg-checker flex aspect-square w-28 items-center justify-center overflow-hidden rounded-sm border">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={alt} className="size-full object-contain" />
      ) : (
        <span className="px-1 text-center text-muted-foreground">
          {cell.status === "berjalan"
            ? "Dibuat..."
            : cell.status === "gagal"
              ? (ERROR_LABEL[cell.errorCode ?? ""] ?? "Gagal")
              : cell.status === "selesai"
                ? "Aset dihapus"
                : "Menunggu"}
        </span>
      )}
    </div>
  );
  return (
    <div className="space-y-1">
      {/* A finished cell without a preview means the asset was deleted from the gallery: no dead link. */}
      {cell.assetId && preview ? <Link href={`/aset/${cell.assetId}`}>{thumb}</Link> : thumb}
      <div className="flex flex-wrap items-center gap-1">
        {cell.qc && <QcBadge status={cell.qc} />}
        {cell.durationMs !== undefined && cell.status !== "berjalan" && <span className="text-muted-foreground">{seconds(cell.durationMs)}</span>}
      </div>
      {cell.status === "gagal" && cell.error && (
        <p className="line-clamp-3 text-destructive" title={cell.error}>
          {cell.error}
        </p>
      )}
    </div>
  );
}
