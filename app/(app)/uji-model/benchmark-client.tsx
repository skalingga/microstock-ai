"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Clock, FlaskConical, Loader2, Shapes, Square, Wallet } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { Anchor, ProgressLine } from "@/components/pen-motif";
import { QcBadge } from "@/components/qc-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIdr } from "@/lib/budget";
import {
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

const TEXT_STYLES = STYLES.filter((s) => !isImageStyle(s.value));

// One theme per text style, so every model is tried on every kind of asset.
const DEFAULT_THEMES: { theme: string; style: StyleId }[] = [
  { theme: "halloween pumpkin icons", style: "icon_set" },
  { theme: "autumn leaves", style: "seamless_pattern" },
  { theme: "cozy coffee shop", style: "flat_illustration" },
  { theme: "summer camping", style: "badge_label" },
  { theme: "soft geometric waves", style: "abstract_background" },
];

// Picked from a quick check on 2026-10-07: the fastest free models that returned an SVG, plus the current primary
// (deepseek-v4-flash, paid) and the Gemini backup as references.
const DEFAULT_MODELS: BenchModel[] = [
  { provider: "kenari", model: "agnes-3-0-flash:free" },
  { provider: "kenari", model: "agnes-2-0-flash:free" },
  { provider: "kenari", model: "nemotron-3-super-120b-a12b:free" },
  { provider: "kenari", model: "muse-spark-1-3-contributor:free" },
  { provider: "kenari", model: "qwen3-8-27b:free" },
  { provider: "kenari", model: "hy3:free" },
  { provider: "kenari", model: "deepseek-v4-flash" },
  { provider: "gemini", model: "gemini-3.5-flash-lite" },
];

const SECONDS_PER_SVG = 30; // rough: free models took 4-70s per SVG in the check, plus quota waits

const key = (m: BenchModel) => `${m.provider}|${m.model}`;

export function BenchmarkRunner({ userId, bannedWords }: { userId: string; bannedWords: string[] }) {
  const router = useRouter();
  const [themes, setThemes] = useState(DEFAULT_THEMES);
  const [models, setModels] = useState<BenchModel[]>(DEFAULT_MODELS);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(DEFAULT_MODELS.map(key)));
  const [variations, setVariations] = useState(1);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [state, setState] = useState<BenchState | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);

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

  // The queue lives in this page: warn before the tab closes.
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
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
  const cellCount = validThemes.length * variations * picked.length;
  const paidKenari = picked.filter((m) => m.provider === "kenari" && !m.model.endsWith(":free")).length;

  function addExtra() {
    const [provider, ...rest] = extra.split("|");
    const model = rest.join("|");
    if ((provider !== "kenari" && provider !== "gemini") || !model) return;
    const m = { provider, model } as BenchModel;
    if (!models.some((x) => key(x) === key(m))) setModels([...models, m]);
    setChecked(new Set([...checked, key(m)]));
    setExtra("");
  }

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running || cellCount === 0) return;
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    const setup: BenchSetup = {
      themes: validThemes.map((t) => ({ theme: t.theme.trim(), style: t.style })),
      models: picked,
      variations,
    };
    setState({ phase: "mulai", setup, cells: [] });

    await runBenchmark({
      supabase: createClient(),
      userId,
      setup,
      bannedWords,
      signal: controller.signal,
      onState: (next) => {
        for (const c of next.cells) if (c.previewUrl && !urlsRef.current.includes(c.previewUrl)) urlsRef.current.push(c.previewUrl);
        setState(next);
      },
    });
    setRunning(false);
    router.refresh(); // the saved run shows up in the list below
  }

  const finished = state?.cells.filter((c) => c.status === "selesai" || c.status === "gagal").length ?? 0;
  const total = state?.cells.length ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Uji baru
            <InfoTip align="start">
              Konsep dibuat sekali per tema (model teks dari Pengaturan), lalu tiap model menggambar konsep yang sama satu
              kali, tanpa coba-ulang: timeout atau balasan rusak dihitung gagal. Siluet dan Line art tidak diuji di sini.
              Model gratis Kenari berbagi satu kuota per menit, jadi antrean kadang menunggu.
            </InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={start} className="space-y-6">
            <fieldset className="space-y-2" disabled={running}>
              <legend className="text-sm font-medium">Tema (bahasa Inggris)</legend>
              {themes.map((t, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_16rem]">
                  <Input
                    aria-label={`Tema ${i + 1}`}
                    value={t.theme}
                    maxLength={120}
                    onChange={(e) => setThemes(themes.map((x, j) => (j === i ? { ...x, theme: e.target.value } : x)))}
                    placeholder="Kosongkan untuk melewati"
                  />
                  <select
                    aria-label={`Gaya tema ${i + 1}`}
                    value={t.style}
                    onChange={(e) => setThemes(themes.map((x, j) => (j === i ? { ...x, style: e.target.value as StyleId } : x)))}
                    className={selectClass}
                  >
                    {TEXT_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </fieldset>

            <fieldset className="space-y-2" disabled={running}>
              <legend className="text-sm font-medium">Model yang dibandingkan</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {models.map((m) => (
                  <label key={key(m)} className={cn("flex items-center gap-2 text-sm", tapTarget)}>
                    <input
                      type="checkbox"
                      checked={checked.has(key(m))}
                      onChange={(e) => {
                        const next = new Set(checked);
                        if (e.target.checked) next.add(key(m));
                        else next.delete(key(m));
                        setChecked(next);
                      }}
                    />
                    <span className="font-mono text-xs">{m.model}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.provider === "gemini" ? "Gemini" : m.model.endsWith(":free") ? "gratis" : "berbayar"}
                    </span>
                  </label>
                ))}
              </div>
              {(catalog.length > 0 || geminiModels.length > 0) && (
                <div className="flex gap-2">
                  <select
                    aria-label="Tambah model"
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Tambah model lain...</option>
                    <optgroup label="Kenari gratis">
                      {catalog.filter((m) => m.free).map((m) => (
                        <option key={m.id} value={`kenari|${m.id}`}>
                          {m.id}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Kenari berbayar">
                      {catalog.filter((m) => !m.free).map((m) => (
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

            <div className="max-w-48 space-y-2">
              <Label htmlFor="variations">Konsep per tema</Label>
              <Input
                id="variations"
                type="number"
                min={1}
                max={3}
                value={variations}
                disabled={running}
                onChange={(e) => setVariations(Math.min(3, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="lg" disabled={running || cellCount === 0}>
                {running ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                {running ? "Sedang berjalan..." : "Mulai uji"}
              </Button>
              {running && (
                <Button type="button" size="lg" variant="outline" onClick={() => abortRef.current?.abort()}>
                  <Square />
                  Hentikan
                </Button>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Shapes className="size-3.5" />
                {cellCount} SVG
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="size-3.5" />±{Math.max(1, Math.ceil((cellCount * SECONDS_PER_SVG) / 60))} menit
              </span>
              {paidKenari > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning-foreground">
                  <Wallet className="size-3.5" />
                  {paidKenari} model berbayar
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
              {state.phase === "mulai" && "Menyiapkan uji..."}
              {state.phase === "konsep" && "Menyusun konsep..."}
              {state.phase === "antrean" && `Menggambar (${finished}/${total})`}
              {state.phase === "selesai" && `Selesai: ${finished} SVG dicoba`}
              {state.phase === "dihentikan" && `Dihentikan setelah ${finished} SVG`}
              {state.phase === "gagal" && "Uji berhenti"}
            </CardTitle>
            {state.message && <CardDescription role="status">{state.message}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {total > 0 && (
              <ProgressLine value={finished / total} label="Kemajuan uji" />
            )}
            <BenchResults setup={state.setup} cells={state.cells} previews={{}} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const ERROR_LABEL: Record<string, string> = {
  timeout: "timeout",
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

function SummaryTable({ rows }: { rows: ModelSummary[] }) {
  const { primary, backup } = suggest(rows);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 font-medium">Skor</th>
              <th className="py-2 pr-3 font-medium">Jadi</th>
              <th className="py-2 pr-3 font-medium">Lolos</th>
              <th className="py-2 pr-3 font-medium">Perlu cek</th>
              <th className="py-2 pr-3 font-medium">Gagal QC</th>
              <th className="py-2 pr-3 font-medium">Gagal panggil</th>
              <th className="py-2 pr-3 font-medium">Median waktu</th>
              <th className="py-2 pr-3 font-medium">Rata-rata bentuk</th>
              <th className="py-2 font-medium">Biaya</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.provider}|${r.model}`} className="border-b last:border-0">
                <td className="py-2 pr-3 font-mono text-xs">
                  {r.model}
                  {r.provider === "gemini" && <span className="ml-1 font-sans text-muted-foreground">(Gemini)</span>}
                </td>
                <td className="py-2 pr-3 font-medium">{Math.round(r.score * 100)}%</td>
                <td className="py-2 pr-3">
                  {r.made}/{r.total}
                </td>
                <td className="py-2 pr-3">{r.lolos}</td>
                <td className="py-2 pr-3">{r.perluCek}</td>
                <td className="py-2 pr-3">{r.gagalQc}</td>
                <td className="py-2 pr-3 text-xs">
                  {Object.entries(r.errors)
                    .map(([code, n]) => `${n} ${ERROR_LABEL[code] ?? code}`)
                    .join(", ") || "0"}
                </td>
                <td className="py-2 pr-3">{seconds(r.medianMs)}</td>
                <td className="py-2 pr-3">{r.avgShapes ?? "–"}</td>
                <td className="py-2">{r.costIdr > 0 ? formatIdr(r.costIdr) : "Rp0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {primary && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          <Anchor filled />
          <span>
            Utama: <span className="font-mono font-semibold">{primary.model}</span>
            {backup && (
              <>
                {" "}
                · cadangan: <span className="font-mono font-semibold">{backup.model}</span>
              </>
            )}
          </span>
          <InfoTip align="end">
            Skor = (Lolos + ½ Perlu cek) ÷ percobaan, dari QC visual saja; seri diurutkan dari yang tercepat. Cadangan dipilih
            dari kuota yang terpisah dari model utama. Skor tidak menilai bagus-jeleknya desain: lihat juga gambarnya.
          </InfoTip>
          <Link href="/pengaturan" className={cn("ml-auto inline-flex items-center font-semibold underline underline-offset-4 hover:decoration-2", tapTarget)}>
            Atur di Pengaturan
          </Link>
        </div>
      )}
    </div>
  );
}

export function BenchResults({
  setup,
  cells,
  previews,
}: {
  setup: BenchSetup;
  cells: BenchCell[];
  previews: Record<string, string>;
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
      {rows.length > 0 && <SummaryTable rows={rows} />}

      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="w-40 p-1 text-left font-medium text-muted-foreground">Konsep</th>
              {models.map((m) => (
                <th key={key(m)} className="w-28 p-1 text-left font-mono font-normal break-all text-muted-foreground">
                  {m.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concepts.map((row) => {
              const job = setup.themes.find((t) => t.theme === row.theme)?.jobId;
              return (
                <tr key={`${row.theme}|${row.concept}`} className="align-top">
                  <td className="p-1">
                    <p className="font-medium">{row.theme}</p>
                    <p className="line-clamp-3 text-muted-foreground">{row.concept}</p>
                    {job && (
                      <Link href={`/aset?job=${job}`} className={cn("inline-flex items-center underline underline-offset-4", tapTarget)}>
                        Lihat di Aset
                      </Link>
                    )}
                  </td>
                  {models.map((m) => {
                    const cell = cells.find(
                      (c) => c.theme === row.theme && c.concept === row.concept && c.provider === m.provider && c.model === m.model,
                    );
                    return (
                      <td key={key(m)} className="p-1">
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
  const thumb = (
    <div className="bg-checker flex aspect-square w-28 items-center justify-center overflow-hidden rounded-md border">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={cell.concept} className="size-full object-contain" />
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
        {cell.durationMs !== undefined && cell.status !== "berjalan" && (
          <span className="text-muted-foreground">{seconds(cell.durationMs)}</span>
        )}
      </div>
      {cell.status === "gagal" && cell.error && <p className="line-clamp-3 text-destructive" title={cell.error}>{cell.error}</p>}
    </div>
  );
}
