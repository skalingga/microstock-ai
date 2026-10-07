"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Clock, LayoutGrid, Loader2, Sparkles, Square, Wallet, Wand2 } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QcBadge } from "@/components/qc-badge";
import { StylePreview } from "@/components/style-preview";
import { Label } from "@/components/ui/label";
import { MAX_VARIATIONS } from "@/lib/generate/schemas";
import { runJob, type JobItem, type JobState } from "@/lib/generate/run-job";
import { formatIdr } from "@/lib/budget";
import { KENARI_IMAGE_PRICES_IDR, imagePriceIdr } from "@/lib/providers/kenari-image-pricing";
import { STYLES, isImageStyle, type Palette, type StyleId } from "@/lib/settings/schema";
import type { CatalogModel } from "@/lib/providers/kenari-pricing";
import { createClient } from "@/lib/supabase/client";
import { selectClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

const REQUESTS_PER_MINUTE = 5; // observed on Kenari free models; the queue reads the real limit from headers
const IMAGE_SECONDS_PER_ASSET = 45; // gpt-image-2 took 13-35s per picture in the Oktober 2026 test, plus metadata
const IMAGE_MODELS = Object.entries(KENARI_IMAGE_PRICES_IDR).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));

const STATUS_LABEL: Record<JobItem["status"], string> = {
  menunggu: "Menunggu",
  berjalan: "Dibuat...",
  selesai: "Selesai",
  gagal: "Gagal",
};

export function GenerateForm({
  userId,
  defaultStyle,
  palettes,
  bannedWords,
  initialTheme = "",
  defaultImageModel,
  kenariBudgetLeftIdr,
}: {
  userId: string;
  defaultStyle: StyleId;
  palettes: Palette[];
  bannedWords: string[];
  initialTheme?: string;
  /** Image model the server uses for the traced styles when none is picked here. */
  defaultImageModel: string;
  /** What is left of this month's Kenari budget, for the cost warning of the traced styles. */
  kenariBudgetLeftIdr: number;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [style, setStyle] = useState<StyleId>(defaultStyle);
  const [paletteIndex, setPaletteIndex] = useState(palettes.length > 0 ? "0" : "");
  const [count, setCount] = useState(10);
  // "" = the order from Settings; "kenari|<id>" or "gemini|<id>" from the picker; free text = a Kenari id.
  const [model, setModel] = useState("");
  const [imageModel, setImageModel] = useState(""); // "" = defaultImageModel
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [state, setState] = useState<JobState | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);

  // The model list comes from Kenari's catalog and the Gemini key; if Kenari's cannot be loaded the field becomes free text.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { models?: CatalogModel[]; geminiModels?: string[] } | null) => {
        if (cancelled) return;
        setCatalog(body?.models ?? []);
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

  // Release preview object URLs when leaving the page.
  useEffect(() => {
    const urls = urlsRef;
    return () => {
      abortRef.current?.abort();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const traced = isImageStyle(style);
  // Traced styles are always black: the palette is not sent.
  const palette = traced || paletteIndex === "" ? [] : (palettes[Number(paletteIndex)]?.colors ?? []);
  const estimatedMinutes = traced
    ? Math.max(1, Math.ceil((count * IMAGE_SECONDS_PER_ASSET) / 60))
    : Math.max(1, Math.ceil((count + 1) / REQUESTS_PER_MINUTE));
  const effectiveImageModel = imageModel || defaultImageModel;
  const imagePrice = imagePriceIdr(effectiveImageModel);
  const imageCost = imagePrice === undefined ? undefined : imagePrice * count;

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;

    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setState({ phase: "mulai", items: [] });

    await runJob({
      supabase: createClient(),
      userId,
      theme: theme.trim(),
      style,
      palette,
      count,
      model: traced ? (imageModel ? { provider: "kenari", model: imageModel } : undefined) : parseModelChoice(model),
      bannedWords,
      signal: controller.signal,
      onState: (next) => {
        for (const item of next.items) {
          if (item.previewUrl && !urlsRef.current.includes(item.previewUrl)) urlsRef.current.push(item.previewUrl);
        }
        setState(next);
      },
    });
    setRunning(false);
  }

  const done = state?.items.filter((i) => i.status === "selesai").length ?? 0;
  const failed = state?.items.filter((i) => i.status === "gagal").length ?? 0;
  const total = state?.items.length ?? 0;
  const finished = state && !running && state.phase !== "mulai";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" />
            Tema baru
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={start} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="theme">Tema (bahasa Inggris)</Label>
                <InfoTip align="start">Hindari nama merek, tokoh, atau karakter: Adobe menolaknya.</InfoTip>
              </div>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                minLength={2}
                maxLength={120}
                required
                disabled={running}
                placeholder="autumn harvest icons"
              />
            </div>

            {traced ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="image-model">Model gambar</Label>
                  <InfoTip align="start">
                    Berbayar dari saldo Kenari. Model menggambar hitam-putih, lalu server mengubahnya jadi SVG. Konsep dan
                    metadata tetap memakai model teks. Tanpa cadangan dan tanpa coba-ulang otomatis.
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
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                <Label htmlFor="model">Model SVG</Label>
                <InfoTip align="start">
                  Hanya untuk menggambar SVG; konsep dan metadata memakai model dari Pengaturan. Model yang dipilih jalan
                  sendiri tanpa cadangan. Model Kenari berbayar masuk batas biaya bulanan.
                </InfoTip>
              </div>
                {catalog && catalog.length > 0 ? (
                  <select
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={running}
                    className={selectClass}
                  >
                    <option value="">Sesuai Pengaturan (bawaan, dengan cadangan)</option>
                    <optgroup label="Kenari gratis">
                      {catalog
                        .filter((m) => m.free)
                        .map((m) => (
                          <option key={m.id} value={`kenari|${m.id}`}>
                            {m.id}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Kenari berbayar (perkiraan Rp per 1 juta token, masuk/keluar)">
                      {catalog
                        .filter((m) => !m.free)
                        .map((m) => (
                          <option key={m.id} value={`kenari|${m.id}`}>
                            {m.id}
                            {m.inPerMTokIdr !== null && m.outPerMTokIdr !== null
                              ? ` · Rp${Math.round(m.inPerMTokIdr).toLocaleString("id-ID")} / Rp${Math.round(m.outPerMTokIdr).toLocaleString("id-ID")}`
                              : ""}
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
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
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
              <div className="space-y-2">
                <Label htmlFor="palette">Palet warna</Label>
                <select
                  id="palette"
                  value={paletteIndex}
                  onChange={(e) => setPaletteIndex(e.target.value)}
                  disabled={running || traced}
                  className={selectClass}
                >
                  <option value="">Bebas (dipilih AI)</option>
                  {palettes.map((p, i) => (
                    <option key={`${p.name}-${i}`} value={i}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {traced && <p className="text-xs text-muted-foreground">Gaya ini selalu hitam.</p>}
                {palette.length > 0 && (
                  <div className="flex gap-1" aria-hidden>
                    {palette.map((c) => (
                      <span key={c} className="size-4 rounded-full border" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">Jumlah variasi</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={MAX_VARIATIONS}
                  value={count}
                  onChange={(e) => setCount(Math.min(MAX_VARIATIONS, Math.max(1, Math.round(Number(e.target.value) || 1))))}
                  disabled={running}
                />
              </div>
            </div>

            <StylePreview style={style} palette={palette} />

            {traced && imageCost !== undefined && imageCost > kenariBudgetLeftIdr && (
              <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-medium text-warning-foreground">
                Biaya melebihi sisa batas Kenari bulan ini ({formatIdr(kenariBudgetLeftIdr)}). Antrean berhenti saat batas
                tercapai.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="lg" disabled={running || theme.trim().length < 2}>
                {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {running ? "Sedang berjalan..." : "Mulai generate"}
              </Button>
              {running && (
                <Button type="button" size="lg" variant="outline" onClick={() => abortRef.current?.abort()}>
                  <Square />
                  Hentikan
                </Button>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="size-3.5" />±{estimatedMinutes} menit
              </span>
              {traced && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning-foreground"
                  title={imageCost === undefined ? undefined : `${count} × ${formatIdr(imagePrice!)}`}
                >
                  <Wallet className="size-3.5" />
                  {imageCost === undefined ? "Harga model belum diketahui" : formatIdr(imageCost)}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {state && (
        <Card>
          <CardHeader>
            <CardTitle>
              {state.phase === "mulai" && "Menyiapkan job..."}
              {state.phase === "konsep" && "Menyusun konsep..."}
              {state.phase === "antrean" && `Membuat aset (${done + failed}/${total})`}
              {state.phase === "selesai" && `Selesai: ${done} aset jadi${failed > 0 ? `, ${failed} gagal` : ""}`}
              {state.phase === "dihentikan" && `Dihentikan: ${done} aset jadi`}
              {state.phase === "gagal" && "Job berhenti"}
            </CardTitle>
            {(state.message || state.providerNote) && (
              <CardDescription role="status">
                {state.message}
                {state.message && state.providerNote ? " " : ""}
                {state.providerNote && !state.message ? `Model terakhir: ${state.providerNote}` : ""}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {total > 0 && (
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-300"
                  style={{ width: `${Math.round(((done + failed) / total) * 100)}%` }}
                />
              </div>
            )}

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {state.items.map((item) => (
                <li key={item.index} className="space-y-1.5 rounded-2xl border bg-card p-2 text-xs shadow-xs">
                  <div
                    className={cn(
                      "bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-xl",
                      item.status === "berjalan" && "animate-pulse ring-2 ring-primary/40",
                    )}
                  >
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt={item.concept.subject} className="size-full object-contain" />
                    ) : (
                      <span className="rounded-full bg-card/90 px-2.5 py-1 font-medium text-muted-foreground shadow-xs">
                        {STATUS_LABEL[item.status]}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">{item.concept.subject}</p>
                  {item.qc && <QcBadge status={item.qc} />}
                  {item.note && <p className="text-amber-700 dark:text-amber-400">{item.note}</p>}
                  {item.error && <p className="text-destructive">{item.error}</p>}
                </li>
              ))}
            </ul>

            {finished && state.jobId && done > 0 && (
              <Link href={`/aset?job=${state.jobId}`} className={buttonVariants({ variant: "secondary" })}>
                <LayoutGrid />
                Lihat hasilnya di Aset
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Picker value to the model sent with each SVG call. Typed text without a prefix is a Kenari id. */
function parseModelChoice(value: string): { provider: "kenari" | "gemini"; model: string } | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const [prefix, ...rest] = text.split("|");
  if (rest.length > 0 && (prefix === "kenari" || prefix === "gemini")) return { provider: prefix, model: rest.join("|") };
  return { provider: "kenari", model: text };
}
