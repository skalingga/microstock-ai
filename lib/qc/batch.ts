import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ApiError, isFatal, postJson, type MetadataResponse } from "@/lib/generate/client";
import { RateGate, callWithRetry } from "@/lib/generate/queue";
import type { StyleId } from "@/lib/settings/schema";
import { applyMetadata, fetchHashPool, rerunQc } from "./store";
import { parseNotes } from "./types";

type Client = SupabaseClient<Database>;

export type BatchProgress = { done: number; total: number; message?: string };

/** Vector assets that still need QC (created before QC existed) or metadata. Photos redo theirs on the detail page. */
export async function countPending(supabase: Client, job?: string): Promise<number> {
  let q = supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("kind", "vector")
    .or("phash.is.null,and(title.is.null,qc_status.neq.gagal)");
  if (job) q = q.eq("job_id", job);
  const { count } = await q;
  return count ?? 0;
}

/**
 * Browser queue for existing assets: run QC where it never ran, then make metadata where it is missing.
 * Same rules as a new job: one AI call per asset, paced by the provider's rate limit.
 */
export async function processPending(args: {
  supabase: Client;
  bannedWords: string[];
  job?: string;
  signal: AbortSignal;
  onProgress: (p: BatchProgress) => void;
}): Promise<{ processed: number; failed: number; stoppedBy?: string }> {
  const { supabase, bannedWords, signal } = args;

  let q = supabase
    .from("assets")
    .select("id, job_id, svg_path, qc_notes, qc_status, phash, title, keywords, category, needs_release, concept")
    .eq("kind", "vector")
    .or("phash.is.null,and(title.is.null,qc_status.neq.gagal)")
    .order("created_at", { ascending: true })
    .limit(200);
  if (args.job) q = q.eq("job_id", args.job);
  const { data: assets } = await q;
  if (!assets || assets.length === 0) return { processed: 0, failed: 0 };

  // The style and theme of each asset come from its job.
  const jobIds = [...new Set(assets.map((a) => a.job_id))];
  const { data: jobs } = await supabase.from("generation_jobs").select("id, style, theme_id").in("id", jobIds);
  const themeIds = [...new Set((jobs ?? []).flatMap((j) => (j.theme_id ? [j.theme_id] : [])))];
  const { data: themes } = themeIds.length > 0 ? await supabase.from("themes").select("id, title").in("id", themeIds) : { data: [] };
  const themeTitle = new Map((themes ?? []).map((t) => [t.id, t.title]));
  const jobInfo = new Map((jobs ?? []).map((j) => [j.id, { style: j.style as StyleId, theme: j.theme_id ? (themeTitle.get(j.theme_id) ?? "") : "" }]));

  const pool = await fetchHashPool(supabase);
  const gate = new RateGate();
  let done = 0;
  let failed = 0;
  const total = assets.length;
  const report = (message?: string) => args.onProgress({ done, total, message });

  for (const asset of assets) {
    if (signal.aborted) break;
    report();
    const info = jobInfo.get(asset.job_id);
    if (!info) {
      failed += 1;
      done += 1;
      continue;
    }

    try {
      let notes = parseNotes(asset.qc_notes);
      let status = asset.qc_status;

      if (!asset.phash) {
        const verdict = await rerunQc(supabase, asset, info.style, pool, bannedWords);
        if (!verdict) throw new ApiError("storage", "QC gagal dijalankan.");
        notes = verdict.notes;
        status = verdict.status;
        const stored = await supabase.from("assets").select("phash").eq("id", asset.id).maybeSingle();
        pool.push({ id: asset.id, phash: stored.data?.phash ?? null });
      }

      if (!asset.title && status !== "gagal") {
        const meta = await callWithRetry(
          () =>
            postJson<MetadataResponse>(
              "/api/generate/metadata",
              { theme: info.theme || "stock vector", style: info.style, concept: asset.concept || "Stock vector asset." },
              signal,
            ).then((r) => {
              gate.update(r.rateLimit);
              return r;
            }),
          { gate, signal, onStatus: report },
        );
        const verdict = await applyMetadata(supabase, asset.id, notes, meta.metadata, bannedWords);
        if (!verdict) throw new ApiError("storage", "Metadata gagal disimpan.");
      }
    } catch (err) {
      if (signal.aborted) break;
      failed += 1;
      if (err instanceof ApiError && isFatal(err.code)) {
        return { processed: done, failed, stoppedBy: err.message };
      }
    }
    done += 1;
  }

  report();
  return { processed: done, failed };
}
