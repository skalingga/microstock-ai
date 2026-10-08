"use client";

import { Check, ChevronRight, ExternalLink, RotateCcw, Spline, Square } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { InfoTip } from "@/components/info-tip";
import { Anchor, ProgressLine } from "@/components/pen-motif";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIdr } from "@/lib/budget";
import { postJson, type ThemesResponse, type TrendsResponse } from "@/lib/generate/client";
import { REGIONS } from "@/lib/research/calendar";
import { MAX_THEMES } from "@/lib/research/schemas";
import { competitionFromCount, daysUntil, deadlineStatus, provenanceOf, scoreTheme, type Provenance } from "@/lib/research/score";
import { isPaidEntry, orderLabel } from "@/lib/settings/provider-label";
import type { ProviderEntry } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/client";
import { selectClass, tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type ThemeRow = {
  id?: string;
  title: string;
  event: string;
  eventWeight: 1 | 2 | 3;
  uploadBy: string | null;
  keywords: string[];
  /** The model's own guesses, kept raw so a stored run re-scores the same way. */
  demandGuess: number;
  competitionGuess: number;
  /** From Google Trends; null when it was blocked or had no data. */
  trendScore: number | null;
  /** Adobe Stock result count typed in by the user; null until entered. */
  adobeCount: number | null;
};

/** How the shown run was made: printed above the list so an old run never passes for a new one. */
export type RunInfo = {
  createdAt: string;
  region: string;
  periodStart: string;
  periodEnd: string;
  trendsMissing: boolean;
  model: string | null;
  costIdr: number;
};

const TRENDS_BATCH = 4;
const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const daysLeftOf = (row: ThemeRow) => (row.uploadBy ? daysUntil(row.uploadBy) : null);
const keyOf = (row: ThemeRow, i: number) => row.id ?? `${row.title}-${i}`;
const regionLabel = (value: string) => REGIONS.find((r) => r.value === value)?.label ?? value;

/** "23 Nov 2026"; ISO dates are calendar days, so read them as UTC. */
function formatDate(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : undefined,
  });
}

function scoresOf(row: ThemeRow) {
  return scoreTheme({
    daysLeft: daysLeftOf(row),
    eventWeight: row.eventWeight,
    trendScore: row.trendScore,
    aiDemand: row.demandGuess,
    adobeResultCount: row.adobeCount,
    aiCompetition: row.competitionGuess,
  });
}

const PROVENANCE_RANK: Record<Provenance, number> = { data: 0, sebagian: 1, perkiraan: 2 };

/**
 * Rows with measured data first, then by opportunity. Rows made of AI guesses only have no
 * trustworthy score, so they are ordered by how soon their upload deadline comes.
 */
function rank(rows: ThemeRow[]): string[] {
  return rows
    .map((row, i) => ({ key: keyOf(row, i), s: scoresOf(row), days: daysLeftOf(row) }))
    .sort((a, b) => {
      const pa = PROVENANCE_RANK[provenanceOf(a.s)];
      const pb = PROVENANCE_RANK[provenanceOf(b.s)];
      if (pa !== pb) return pa - pb;
      if (pa < 2) return b.s.opportunity - a.s.opportunity;
      // Soonest deadline first; passed deadlines and evergreen themes go last.
      const soon = (d: number | null) => (d === null || d < 0 ? 1e9 : d);
      return soon(a.days) - soon(b.days);
    })
    .map((r) => r.key);
}

/** Restores the stored run's period while it is still current; otherwise today plus six months. */
function initialPeriod(run: RunInfo | null): [string, string] {
  if (run && run.periodEnd >= day(0)) return [run.periodStart < day(0) ? day(0) : run.periodStart, run.periodEnd];
  return [day(0), day(180)];
}

export function RisetForm({
  initialRows,
  initialRun,
  providerOrder,
  themeCostIdr,
  usedTitles,
}: {
  initialRows: ThemeRow[];
  initialRun: RunInfo | null;
  /** The provider order research calls use (Settings, with the text model and env defaults filled in). */
  providerOrder: ProviderEntry[];
  /** Average cost of one research call per paid model, from provider_usage. */
  themeCostIdr: Record<string, number>;
  /** Lowercased titles of themes already sent to Generate. */
  usedTitles: string[];
}) {
  const [region, setRegion] = useState(initialRun?.region ?? "global");
  const [periodStart, setPeriodStart] = useState(() => initialPeriod(initialRun)[0]);
  const [periodEnd, setPeriodEnd] = useState(() => initialPeriod(initialRun)[1]);
  const [category, setCategory] = useState("");
  const [countText, setCountText] = useState("10");
  const [rows, setRows] = useState<ThemeRow[]>(initialRows);
  const [order, setOrder] = useState<string[]>(() => rank(initialRows));
  const [run, setRun] = useState<RunInfo | null>(initialRun);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ value: number; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidePassed, setHidePassed] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const used = useMemo(() => new Set(usedTitles), [usedTitles]);

  const countNumber = /^\d+$/.test(countText) ? Number(countText) : NaN;
  const count = Math.min(MAX_THEMES, Math.max(1, countNumber || 1));

  const byKey = new Map(rows.map((row, i) => [keyOf(row, i), row]));
  const ordered = order.map((k) => byKey.get(k)).filter((r): r is ThemeRow => !!r);
  const visible = hidePassed ? ordered.filter((r) => deadlineStatus(daysLeftOf(r)) !== "terlewat") : ordered;
  const passedCount = ordered.length - ordered.filter((r) => deadlineStatus(daysLeftOf(r)) !== "terlewat").length;
  const outOfOrder = rank(rows).join("|") !== order.join("|");

  const primary = providerOrder[0];
  const paidBackup = providerOrder.slice(1).find(isPaidEntry);
  const runCost = !primary
    ? "biaya mengikuti model bawaan"
    : isPaidEntry(primary)
      ? themeCostIdr[primary.model] !== undefined
        ? `±${formatIdr(themeCostIdr[primary.model])} per riset`
        : "berbayar, biayanya tercatat setelah riset pertama"
      : `gratis${paidBackup ? `; cadangan ${paidBackup.model} berbayar bila model utama gagal` : ""}`;

  async function persist(list: ThemeRow[], meta: Omit<RunInfo, "createdAt" | "region" | "periodStart" | "periodEnd">) {
    const supabase = createClient();
    const { data: saved, error } = await supabase
      .from("research_runs")
      .insert({
        region,
        period_start: periodStart,
        period_end: periodEnd,
        trends_missing: meta.trendsMissing,
        provider: meta.model?.split(" · ")[0] ?? null,
        model: meta.model?.split(" · ")[1] ?? null,
        cost_idr: meta.costIdr,
      })
      .select("id, created_at")
      .single();
    if (error || !saved) throw new Error("Hasil riset tidak bisa disimpan.");

    const payload = list.map((row) => {
      const s = scoresOf(row);
      return {
        run_id: saved.id,
        title: row.title,
        country: region,
        event: row.event || null,
        event_weight: row.eventWeight,
        upload_by: row.uploadBy,
        ai_demand: row.demandGuess,
        ai_competition: row.competitionGuess,
        demand_score: s.demand,
        competition_score: s.competition,
        opportunity_score: s.opportunity,
        trend_score: row.trendScore,
        adobe_result_count: row.adobeCount,
        seed_keywords: row.keywords,
      };
    });
    const { data: savedThemes, error: themesError } = await supabase.from("themes").insert(payload).select("id");
    if (themesError || !savedThemes) throw new Error("Tema tidak bisa disimpan.");
    // Insert returns rows in the order sent, so ids line up with the list.
    return {
      rows: list.map((row, i) => ({ ...row, id: savedThemes[i]?.id })),
      run: { ...meta, createdAt: saved.created_at, region, periodStart, periodEnd },
    };
  }

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      setError("Akhir periode harus sesudah awal periode.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setProgress({ value: 0.05, text: "Menyusun ide tema..." });

    try {
      const result = await postJson<ThemesResponse>(
        "/api/research/themes",
        { region, periodStart, periodEnd, category: category.trim() || undefined, count },
        controller.signal,
      );

      let list: ThemeRow[] = result.themes.map((t) => ({
        title: t.title,
        event: t.event,
        eventWeight: t.eventWeight,
        uploadBy: t.uploadBy,
        keywords: [...new Set(t.keywords.map((k) => k.trim()).filter(Boolean))],
        demandGuess: t.demandGuess,
        competitionGuess: t.competitionGuess,
        trendScore: null,
        adobeCount: null,
      }));

      // Trends runs in small batches, one request each (CLAUDE.md rule 2). A failure only means
      // those themes keep the AI estimate.
      let missing = false;
      for (let i = 0; i < list.length; i += TRENDS_BATCH) {
        const done = Math.min(i + TRENDS_BATCH, list.length);
        setProgress({ value: 0.25 + 0.65 * (i / list.length), text: `Mengambil tren pencarian (${done}/${list.length})...` });
        const terms = list.slice(i, i + TRENDS_BATCH).map((t) => t.keywords[0] ?? t.title);
        // Google Trends fails now and then; one retry after a pause recovers most of those.
        let res: TrendsResponse | null = null;
        for (let attempt = 0; attempt < 2 && !res; attempt++) {
          if (attempt > 0) await wait(2500, controller.signal);
          try {
            const r = await postJson<TrendsResponse>("/api/research/trends", { region, terms }, controller.signal);
            if (!r.unavailable && Object.keys(r.scores).length > 0) res = r;
          } catch (err) {
            if (controller.signal.aborted) throw err;
            // try again, then fall back to the AI estimate
          }
        }
        if (!res) {
          missing = true;
        } else {
          const scores = res.scores;
          list = list.map((row) => {
            const term = row.keywords[0] ?? row.title;
            return term in scores ? { ...row, trendScore: scores[term] } : row;
          });
        }
        await wait(800, controller.signal); // gentle pacing between batches
      }
      if (list.every((r) => r.trendScore === null)) missing = true;

      setProgress({ value: 0.95, text: "Menyimpan hasil..." });
      const saved = await persist(list, {
        trendsMissing: missing,
        model: `${result.provider} · ${result.model}`,
        costIdr: result.costIdr ?? 0,
      });
      setRows(saved.rows);
      setOrder(rank(saved.rows));
      setRun(saved.run);
      toast.success(`${list.length} tema siap dibandingkan.`);
    } catch (err) {
      // The previous run stays on screen in both cases: nothing was replaced yet.
      if (controller.signal.aborted) toast("Riset dibatalkan. Hasil sebelumnya tetap ditampilkan.");
      else setError(err instanceof Error ? err.message : "Riset gagal.");
    } finally {
      setProgress(null);
      setRunning(false);
    }
  }

  async function saveAdobeCount(key: string, raw: string) {
    const row = byKey.get(key);
    if (!row) return;
    const digits = raw.replace(/\D/g, "");
    const adobeCount = digits === "" ? null : Number(digits);
    if (adobeCount === row.adobeCount) return; // unchanged: nothing to write
    const next = { ...row, adobeCount };
    setRows((prev) => prev.map((r) => (r === row ? next : r)));
    if (!row.id) return;
    const s = scoresOf(next);
    const { error } = await createClient()
      .from("themes")
      .update({ adobe_result_count: adobeCount, competition_score: s.competition, opportunity_score: s.opportunity })
      .eq("id", row.id);
    if (error) toast.error("Jumlah hasil tidak bisa disimpan.");
    else setSavedKey(key);
  }

  const summary = `${regionLabel(region)} · ${formatDate(periodStart)}–${formatDate(periodEnd)} · ${count} tema`;

  return (
    <div className="space-y-6">
      <section aria-labelledby="riset-baru" className="rounded-2xl border bg-card">
        <details className="group" open={rows.length === 0 ? true : undefined}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-5 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
            <h2 id="riset-baru" className="shrink-0 text-lg font-extrabold">
              Riset baru
            </h2>
            <span className="min-w-0 truncate text-sm text-muted-foreground group-open:hidden">{summary}</span>
          </summary>
          <form ref={formRef} onSubmit={start} noValidate className="space-y-4 border-t p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="region">Pasar</Label>
                <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} disabled={running} className={selectClass}>
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori (opsional)</Label>
                <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} disabled={running} placeholder="mis. food, travel, icons" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="start">Awal periode</Label>
                  <InfoTip align="start" label="Tentang periode">
                    Periode maksimal 12 bulan. Tanggal event bergerak (Ramadan, Diwali, Imlek, Paskah) hanya perkiraan: cek lagi
                    sebelum menentukan batas upload.
                  </InfoTip>
                </div>
                <Input id="start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} disabled={running} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Akhir periode</Label>
                <Input id="end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} disabled={running} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">Jumlah tema</Label>
                <Input
                  id="count"
                  inputMode="numeric"
                  value={countText}
                  onChange={(e) => setCountText(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  onBlur={() => setCountText(String(count))}
                  disabled={running}
                  aria-describedby="count-hint"
                />
                <p id="count-hint" className="text-sm text-muted-foreground">
                  1 sampai {MAX_THEMES}.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Model: {orderLabel(providerOrder)} · {runCost}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={running}>
                <Spline />
                {running ? "Sedang berjalan..." : "Mulai riset"}
              </Button>
              {running && (
                <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
                  <Square />
                  Batalkan
                </Button>
              )}
            </div>
          </form>
        </details>
      </section>

      {/* Always mounted, so screen readers hear each step instead of missing the first one. */}
      <div role="status" className={cn("space-y-2", !progress && "sr-only")}>
        {progress && (
          <>
            <ProgressLine value={progress.value} label="Kemajuan riset" />
            <p className="text-sm text-muted-foreground">{progress.text}</p>
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm">
          <p className="min-w-0 flex-1 font-medium text-destructive">
            {error}
            {rows.length > 0 && " Hasil sebelumnya tetap ditampilkan di bawah."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => formRef.current?.requestSubmit()}>
            <RotateCcw />
            Coba lagi
          </Button>
        </div>
      )}

      {ordered.length > 0 && (
        <section aria-labelledby="hasil-riset" className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <h2 id="hasil-riset" className="text-lg font-extrabold">
                Tema dan peluangnya
              </h2>
              <InfoTip align="start" label="Cara membaca peluang">
                Peluang = permintaan × (100 − persaingan) ÷ 100, dikali 0,85 bila batas upload kurang dari 14 hari dan 0,5 bila
                sudah lewat. Permintaan dari Google Trends; persaingan dari jumlah hasil Adobe (1.000 hasil = 0, 10 juta = 100).
                Tanpa keduanya, angka itu hanya tebakan AI, jadi tidak ditampilkan.
              </InfoTip>
            </div>
            {run && (
              <p className="text-sm text-muted-foreground">
                Riset {formatDate(run.createdAt)} · {regionLabel(run.region)} · {formatDate(run.periodStart)}–{formatDate(run.periodEnd)}
                {run.model ? ` · ${run.model}` : ""}
                {run.costIdr > 0 ? ` · ${formatIdr(run.costIdr)}` : ""}
              </p>
            )}
            {run?.trendsMissing && (
              <p className="text-sm text-warning-foreground">
                Google Trends tidak tersedia untuk sebagian tema: permintaannya memakai perkiraan AI.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {passedCount > 0 && (
              <label className={cn("inline-flex items-center gap-2 text-sm", tapTarget)}>
                <input type="checkbox" checked={hidePassed} onChange={(e) => setHidePassed(e.target.checked)} className="size-4 accent-foreground" />
                Sembunyikan {passedCount} tema yang lewat batas
              </label>
            )}
            {outOfOrder && (
              <Button type="button" variant="outline" size="sm" onClick={() => setOrder(rank(rows))}>
                Urutkan ulang
              </Button>
            )}
          </div>

          <ol className="divide-y rounded-2xl border bg-card">
            {visible.map((row) => {
              const key = keyOf(row, rows.indexOf(row));
              return (
                <ThemeItem
                  key={key}
                  row={row}
                  rowKey={key}
                  used={used.has(row.title.trim().toLowerCase())}
                  saved={savedKey === key}
                  onSave={(raw) => saveAdobeCount(key, raw)}
                />
              );
            })}
          </ol>
          {visible.length === 0 && <p className="text-sm text-muted-foreground">Semua tema di riset ini sudah lewat batas upload.</p>}
        </section>
      )}
    </div>
  );
}

const PROVENANCE_LABEL: Record<Provenance, string> = {
  data: "dari data",
  sebagian: "sebagian data",
  perkiraan: "belum ada data",
};

function ThemeItem({
  row,
  rowKey,
  used,
  saved,
  onSave,
}: {
  row: ThemeRow;
  rowKey: string;
  used: boolean;
  saved: boolean;
  onSave: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(row.adobeCount?.toLocaleString("id-ID") ?? "");
  const s = scoresOf(row);
  const provenance = provenanceOf(s);
  const days = daysLeftOf(row);
  const status = deadlineStatus(days);
  const query = row.keywords[0] ?? row.title;
  const generateHref = `/generate?${new URLSearchParams({ tema: row.title, ...(row.uploadBy ? { batas: row.uploadBy } : {}) })}`;
  const draftCount = Number(draft.replace(/\D/g, "")) || null;
  const inputId = `adobe-${rowKey}`;

  return (
    <li className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        {/* The score's anchor is filled only when both inputs were measured; the label says the same in words. */}
        <div className="flex shrink-0 items-center gap-3 sm:block sm:w-20 sm:space-y-1">
          <p className="flex items-center gap-2">
            <Anchor filled={provenance === "data"} className={cn("size-2.5", provenance === "perkiraan" ? "text-muted-foreground" : "text-foreground")} />
            <span className={cn("text-3xl leading-none font-extrabold tabular-nums", provenance === "perkiraan" && "text-muted-foreground")}>
              {provenance === "perkiraan" ? "–" : s.opportunity}
            </span>
          </p>
          <p className="text-xs font-semibold text-muted-foreground">
            {provenance === "perkiraan" ? "" : "peluang, "}
            {PROVENANCE_LABEL[provenance]}
          </p>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold capitalize">
            {row.title}
            {used && <span className="ml-2 align-middle text-xs font-semibold text-muted-foreground normal-case">· sudah di-generate</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {row.event || "Tema sepanjang tahun"}
            {row.uploadBy &&
              ` · upload sebelum ${formatDate(row.uploadBy)}${days !== null && days >= 0 ? ` (${days} hari lagi)` : ""}`}
          </p>
          {status === "terlewat" && (
            <p className="text-sm text-destructive">Batas upload sudah lewat; peluang dipotong separuh. Masih bisa dikejar bila kamu siap upload cepat.</p>
          )}
          {status === "mendesak" && <p className="text-sm font-medium text-warning-foreground">Batas upload kurang dari 14 hari lagi.</p>}
          <p className="text-sm text-muted-foreground">
            Permintaan <span className="font-medium text-foreground">{s.demand}</span> {s.demandKnown ? "(Google Trends)" : "(perkiraan AI)"} ·
            persaingan{" "}
            {s.competition === null ? (
              "belum diketahui"
            ) : (
              <>
                <span className="font-medium text-foreground">{s.competition}</span>{" "}
                {s.competitionKnown ? `(${row.adobeCount?.toLocaleString("id-ID")} hasil Adobe)` : "(perkiraan AI)"}
              </>
            )}
          </p>
          {row.keywords.length > 0 && (
            <p className="text-xs text-muted-foreground">Keyword: {[...new Set(row.keywords)].join(", ")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:pl-24">
        <Label htmlFor={inputId} className="text-sm">
          Hasil Adobe
        </Label>
        <Input
          id={inputId}
          inputMode="numeric"
          className="w-32"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => onSave(e.target.value)}
          placeholder="mis. 125000"
          aria-describedby={`${inputId}-hint`}
        />
        <span id={`${inputId}-hint`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          {draftCount !== null ? `→ persaingan ${competitionFromCount(draftCount)} dari 100` : "jumlah hasil pencarian di Adobe Stock"}
          {saved && (
            <span role="status" className="inline-flex items-center gap-1 text-success-foreground">
              <Check className="size-3.5" aria-hidden />
              tersimpan
            </span>
          )}
        </span>
        <a
          href={`https://stock.adobe.com/search?k=${encodeURIComponent(query)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4 hover:decoration-2", tapTarget)}
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Cari “{query}” di Adobe Stock
        </a>
        <Link href={generateHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "sm:ml-auto")} aria-label={`Generate dari tema ${row.title}`}>
          <Spline />
          Generate
        </Link>
      </div>
    </li>
  );
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Dibatalkan", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Dibatalkan", "AbortError"));
    }, { once: true });
  });
}
