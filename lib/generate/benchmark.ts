import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { Concept } from "@/lib/providers/types";
import { fetchHashPool } from "@/lib/qc/store";
import type { QcNote, QcStatus } from "@/lib/qc/types";
import type { StyleId } from "@/lib/settings/schema";
import { ApiError, isFatal, postJson, type ConceptsResponse } from "./client";
import { RateGate, callWithRetry } from "./queue";
import { draftSvg, storeDraft } from "./run-job";

// Stage 4: draw the same concepts with several SVG models and compare them. Runs in the browser like a normal job,
// one SVG call at a time (CLAUDE.md rule 2). Concepts come from the text model in Settings, once per theme, so every
// model gets exactly the same input. No metadata is made: it does not depend on the SVG model.

export type BenchModel = { provider: "kenari" | "gemini"; model: string };
export type BenchTheme = { theme: string; style: StyleId; jobId?: string };
export type BenchSetup = { themes: BenchTheme[]; models: BenchModel[]; variations: number };

export type CellStatus = "menunggu" | "berjalan" | "selesai" | "gagal";

export type BenchCell = {
  theme: string;
  style: StyleId;
  concept: string;
  /** The rest of the concept, so a continued run draws the same input. Missing on runs before 2026-10-09. */
  composition?: string;
  palette?: string[];
  provider: BenchModel["provider"];
  model: string;
  status: CellStatus;
  assetId?: string;
  /** Verdict of the visual checks alone: metadata is not part of the comparison. */
  qc?: QcStatus;
  /** Time of the SVG call plus sanitize and QC, without waiting for quota. */
  durationMs?: number;
  costIdr?: number;
  shapes?: number;
  errorCode?: string;
  error?: string;
  /** Local object URL of the preview, only during the run. Never stored. */
  previewUrl?: string;
};

export type BenchPhase = "mulai" | "konsep" | "antrean" | "selesai" | "dihentikan" | "gagal";

export type BenchState = { phase: BenchPhase; benchmarkId?: string; message?: string; setup: BenchSetup; cells: BenchCell[] };

/** The three-way verdict from the visual notes only (combine() would say "menunggu" without metadata). */
export function visualStatus(notes: QcNote[]): QcStatus {
  if (notes.some((n) => n.status === "gagal")) return "gagal";
  if (notes.some((n) => n.status === "cek")) return "perlu_cek";
  return "lolos";
}

/** Free Kenari models share one account-wide quota; every other model has its own. */
export function quotaGroup(m: BenchModel): string {
  return m.provider === "kenari" && m.model.endsWith(":free") ? "kenari:free" : `${m.provider}:${m.model}`;
}

export type ModelSummary = {
  provider: BenchModel["provider"];
  model: string;
  total: number;
  made: number;
  lolos: number;
  perluCek: number;
  gagalQc: number;
  /** Calls that produced no asset, by error code (timeout, bad_output, ...). */
  errors: Record<string, number>;
  medianMs: number | null;
  costIdr: number;
  avgShapes: number | null;
  /** 0..1: Lolos counts fully, Perlu cek half, everything else nothing. */
  score: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** One row per model, best first: by score, then the faster model. Cells still waiting are left out. */
export function summarize(cells: BenchCell[]): ModelSummary[] {
  const byModel = new Map<string, BenchCell[]>();
  for (const cell of cells) {
    if (cell.status !== "selesai" && cell.status !== "gagal") continue;
    const key = `${cell.provider}|${cell.model}`;
    byModel.set(key, [...(byModel.get(key) ?? []), cell]);
  }

  const rows: ModelSummary[] = [];
  for (const group of byModel.values()) {
    const made = group.filter((c) => c.status === "selesai");
    const errors: Record<string, number> = {};
    for (const c of group) if (c.status === "gagal") errors[c.errorCode ?? "lain"] = (errors[c.errorCode ?? "lain"] ?? 0) + 1;
    const lolos = made.filter((c) => c.qc === "lolos").length;
    const perluCek = made.filter((c) => c.qc === "perlu_cek").length;
    const shapes = made.map((c) => c.shapes).filter((n): n is number => n !== undefined);
    rows.push({
      provider: group[0].provider,
      model: group[0].model,
      total: group.length,
      made: made.length,
      lolos,
      perluCek,
      gagalQc: made.filter((c) => c.qc === "gagal").length,
      errors,
      medianMs: median(made.map((c) => c.durationMs).filter((n): n is number => n !== undefined)),
      costIdr: Math.round(group.reduce((sum, c) => sum + (c.costIdr ?? 0), 0) * 100) / 100,
      avgShapes: shapes.length ? Math.round(shapes.reduce((a, b) => a + b, 0) / shapes.length) : null,
      score: (lolos + perluCek / 2) / group.length,
    });
  }
  return rows.sort((a, b) => b.score - a.score || (a.medianMs ?? Infinity) - (b.medianMs ?? Infinity));
}

/**
 * Suggested primary and backup. The backup comes from the other provider: the provider chain in Settings needs two
 * different providers, and a separate provider also has its own quota when the primary hits its limit.
 */
export function suggest(rows: ModelSummary[]): { primary?: ModelSummary; backup?: ModelSummary } {
  const usable = rows.filter((r) => r.score > 0);
  const primary = usable[0];
  if (!primary) return {};
  const backup = usable.find((r) => r.provider !== primary.provider);
  return { primary, backup };
}

/** Below this many attempts per model a score is mostly noise. */
export const SMALL_SAMPLE = 10;

/** How settled a run's numbers are: cells still waiting, and the fewest attempts any model has. */
export function confidence(cells: BenchCell[], rows: ModelSummary[]): { waiting: number; total: number; minAttempts: number } {
  const waiting = cells.filter((c) => c.status === "menunggu" || c.status === "berjalan").length;
  return { waiting, total: cells.length, minAttempts: rows.length ? Math.min(...rows.map((r) => r.total)) : 0 };
}

export type RunBenchmarkParams = {
  supabase: SupabaseClient<Database>;
  userId: string;
  setup: BenchSetup;
  bannedWords: string[];
  signal: AbortSignal;
  onState: (state: BenchState) => void;
};

/** Errors after which no later call can succeed, for any model. */
function stopsEverything(code: string): boolean {
  return code === "unauthenticated" || code === "storage";
}

/** Cells to draw again when a saved run continues: never finished, and with `retryFailed` the failed ones too. */
export function cellsToRedo(cells: BenchCell[], retryFailed: boolean): number[] {
  return cells.flatMap((c, i) =>
    c.status === "menunggu" || c.status === "berjalan" || (retryFailed && c.status === "gagal") ? [i] : [],
  );
}

/** Rough time left: the median time per finished cell times the cells still waiting. Null until one cell is done. */
export function estimateRemainingMs(cells: BenchCell[]): number | null {
  const times = cells.filter((c) => c.status === "selesai" && c.durationMs !== undefined).map((c) => c.durationMs!);
  const left = cells.filter((c) => c.status === "menunggu" || c.status === "berjalan").length;
  const m = median(times);
  return m === null ? null : m * left;
}

/** The concept a cell was drawn from. Older runs stored the subject only. */
function conceptOf(cell: BenchCell): Concept {
  return { subject: cell.concept, composition: cell.composition ?? "", palette: cell.palette ?? [] };
}

/** State, saving and the per-cell drawing shared by a new run and a continued one. */
function createRunner(p: RunBenchmarkParams, initial: BenchState) {
  let state = initial;
  const emit = (patch: Partial<BenchState>) => {
    state = { ...state, ...patch };
    p.onState(state);
  };
  const patchCell = (index: number, patch: Partial<BenchCell>) => {
    emit({ cells: state.cells.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  };

  // Saved after every cell, so a closed tab keeps what was done. Preview URLs are local and never stored.
  const save = async (status?: string) => {
    if (!state.benchmarkId) return;
    const results = state.cells.map((c) => ({ ...c, previewUrl: undefined }));
    await p.supabase
      .from("model_benchmarks")
      .update({ results: results as unknown as Json, setup: state.setup as unknown as Json, ...(status ? { status } : {}) })
      .eq("id", state.benchmarkId)
      .then(() => undefined, () => undefined);
  };

  const gates = new Map<string, RateGate>();
  const gateFor = (key: string) => {
    let gate = gates.get(key);
    if (!gate) gates.set(key, (gate = new RateGate()));
    return gate;
  };

  /** One SVG call for one cell. Returns false when nothing else can succeed (stop the run). */
  async function drawCell(cellIndex: number, pool: Awaited<ReturnType<typeof fetchHashPool>>): Promise<boolean> {
    const cell = state.cells[cellIndex];
    const t = state.setup.themes.find((x) => x.theme === cell.theme);
    if (!t?.jobId) {
      patchCell(cellIndex, { status: "gagal", errorCode: "internal", error: "Job tema tidak ditemukan." });
      return true;
    }
    const m: BenchModel = { provider: cell.provider, model: cell.model };
    patchCell(cellIndex, { status: "berjalan", errorCode: undefined, error: undefined });

    const assetId = crypto.randomUUID();
    let durationMs = 0;
    try {
      const draw = { ...p, theme: t.theme, style: t.style, model: m };
      const gate = gateFor(quotaGroup(m));
      const concept = conceptOf(cell);
      // One attempt: a timeout or unusable reply counts against the model. Only quota waits are retried.
      const draft = await callWithRetry(
        async (ctx) => {
          const started = performance.now();
          try {
            return await draftSvg(draw, concept, gate, pool, assetId, ctx);
          } finally {
            durationMs = Math.round(performance.now() - started);
          }
        },
        { gate, signal: p.signal, maxAttempts: 1, onStatus: (message) => emit({ message }) },
      );
      const made = await storeDraft(draw, t.jobId, concept, assetId, draft);
      patchCell(cellIndex, {
        status: "selesai",
        assetId: made.assetId,
        qc: visualStatus(draft.qc.notes),
        durationMs,
        costIdr: draft.res.costIdr,
        shapes: draft.stats.shapeCount,
        previewUrl: made.previewUrl,
      });
      emit({ message: undefined });
    } catch (err) {
      if (p.signal.aborted) throw err;
      const apiErr = err instanceof ApiError ? err : new ApiError("internal", "Terjadi kesalahan tak terduga.");
      patchCell(cellIndex, { status: "gagal", errorCode: apiErr.code, error: apiErr.message, durationMs });
      if (stopsEverything(apiErr.code)) {
        emit({ message: apiErr.message });
        return false;
      }
    }
    await save();
    return true;
  }

  async function closeJobs() {
    for (const t of state.setup.themes) {
      if (!t.jobId) continue;
      const made = state.cells.some((c) => c.theme === t.theme && c.status === "selesai");
      await p.supabase
        .from("generation_jobs")
        .update({ status: made ? "selesai" : "gagal" })
        .eq("id", t.jobId)
        .then(() => undefined, () => undefined);
    }
  }

  async function finish() {
    const stopped = p.signal.aborted;
    const leftover = state.cells.some((c) => c.status === "menunggu" || c.status === "berjalan");
    emit({
      phase: stopped ? "dihentikan" : leftover ? "gagal" : "selesai",
      message: stopped ? "Dihentikan. Hasil yang sudah jadi tetap tersimpan." : state.message,
      cells: state.cells.map((c) => (c.status === "berjalan" ? { ...c, status: "menunggu" as const } : c)),
    });
    await save(stopped ? "dihentikan" : leftover ? "gagal" : "selesai");
    await closeJobs();
  }

  async function fail(err: unknown) {
    const message = p.signal.aborted
      ? "Dihentikan. Hasil yang sudah jadi tetap tersimpan."
      : err instanceof ApiError
        ? err.message
        : "Terjadi kesalahan tak terduga.";
    emit({
      phase: p.signal.aborted ? "dihentikan" : "gagal",
      message,
      cells: state.cells.map((c) => (c.status === "berjalan" ? { ...c, status: "menunggu" as const } : c)),
    });
    await save(p.signal.aborted ? "dihentikan" : "gagal");
    await closeJobs();
  }

  /** Draws the given cells in order, then records how the run ended and closes the theme jobs. */
  async function drawAll(indices: number[]) {
    try {
      // Same similarity pool for every model: compared with the history only, not with each other's drawing of the
      // same concept (that would punish whichever model runs later).
      const pool = await fetchHashPool(p.supabase);
      emit({ phase: "antrean" });
      for (const i of indices) {
        if (p.signal.aborted) break;
        if (!(await drawCell(i, pool))) break;
      }
      await finish();
    } catch (err) {
      await fail(err);
    }
  }

  return {
    emit,
    save,
    gateFor,
    drawAll,
    fail,
    get state() {
      return state;
    },
  };
}

export async function runBenchmark(p: RunBenchmarkParams): Promise<void> {
  const runner = createRunner(p, { phase: "mulai", setup: p.setup, cells: [] });
  const { emit } = runner;

  try {
    const row = await p.supabase
      .from("model_benchmarks")
      .insert({ setup: p.setup as unknown as Json })
      .select("id")
      .single();
    if (row.error) throw new ApiError("storage", "Gagal menyimpan uji model.");
    emit({ benchmarkId: row.data.id });

    // 1. Concepts and a job per theme, before any SVG call.
    const themes: BenchTheme[] = [];
    const cells: BenchCell[] = [];
    const skipped: string[] = [];
    for (const [i, t] of p.setup.themes.entries()) {
      if (p.signal.aborted) break;
      emit({ phase: "konsep", message: `Menyusun konsep tema ${i + 1}/${p.setup.themes.length}: ${t.theme}` });
      let res: ConceptsResponse;
      try {
        res = await callWithRetry(
          (ctx) =>
            postJson<ConceptsResponse>(
              "/api/generate/concepts",
              {
                theme: t.theme,
                style: t.style,
                palette: [],
                count: p.setup.variations,
                // After a timeout the server starts at the backup provider, like a normal job.
                ...(ctx.skipPrimary ? { skipPrimary: true } : {}),
              },
              p.signal,
            ),
          { gate: runner.gateFor("concepts"), signal: p.signal, onStatus: (message) => emit({ message }) },
        );
      } catch (err) {
        // A theme without concepts is skipped; the other themes still compare the models.
        if (p.signal.aborted || !(err instanceof ApiError) || isFatal(err.code)) throw err;
        skipped.push(`${t.theme} (${err.message})`);
        continue;
      }

      const theme = await p.supabase.from("themes").insert({ title: t.theme }).select("id").single();
      if (theme.error) throw new ApiError("storage", "Gagal menyimpan tema.");
      const job = await p.supabase
        .from("generation_jobs")
        .insert({
          theme_id: theme.data.id,
          style: t.style,
          palette: [],
          count: res.concepts.length * p.setup.models.length,
          status: "berjalan",
        })
        .select("id")
        .single();
      if (job.error) throw new ApiError("storage", "Gagal membuat job generate.");

      themes.push({ ...t, jobId: job.data.id });
      for (const concept of res.concepts) {
        for (const m of p.setup.models) {
          // The whole concept is kept, so a continued run draws exactly the same input.
          cells.push({
            theme: t.theme,
            style: t.style,
            concept: concept.subject,
            composition: concept.composition,
            palette: concept.palette,
            ...m,
            status: "menunggu",
          });
        }
      }
    }
    if (themes.length === 0) throw new ApiError("bad_output", `Konsep tidak bisa dibuat untuk tema mana pun: ${skipped.join("; ")}`);
    emit({
      message: skipped.length > 0 ? `Dilewati karena konsep gagal: ${skipped.join("; ")}` : undefined,
      setup: { ...p.setup, themes },
      cells,
    });
    await runner.save();
  } catch (err) {
    await runner.fail(err);
    return;
  }

  // 2. One SVG call per cell, in order. Models take turns, so the free models' shared quota gets breathing room.
  await runner.drawAll(runner.state.cells.map((_, i) => i));
}

/**
 * Continues a saved run in place: cells that never finished, and with `retryFailed` the failed ones, are drawn again
 * with the same concepts and the same theme jobs. Finished cells keep their result.
 */
export async function continueBenchmark(
  p: RunBenchmarkParams & { benchmarkId: string; cells: BenchCell[]; retryFailed: boolean },
): Promise<void> {
  const indices = cellsToRedo(p.cells, p.retryFailed);
  const cells = p.cells.map((c, i) => (indices.includes(i) ? { ...c, status: "menunggu" as const } : c));
  const runner = createRunner(p, { phase: "mulai", benchmarkId: p.benchmarkId, setup: p.setup, cells });
  runner.emit({ phase: "antrean" });
  for (const t of p.setup.themes) {
    if (!t.jobId) continue;
    await p.supabase
      .from("generation_jobs")
      .update({ status: "berjalan" })
      .eq("id", t.jobId)
      .then(() => undefined, () => undefined);
  }
  await runner.save("berjalan");
  await runner.drawAll(indices);
}

/** Results read back from the database. Unknown shapes are dropped rather than trusted. */
export function parseCells(value: Json): BenchCell[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is BenchCell & Json => {
    const o = c as Record<string, unknown> | null;
    return !!o && typeof o.model === "string" && typeof o.theme === "string" && typeof o.status === "string";
  }) as unknown as BenchCell[];
}
