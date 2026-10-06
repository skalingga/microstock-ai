import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Concept } from "@/lib/providers/types";
import type { StyleId } from "@/lib/settings/schema";
import { renderPreviewPng } from "@/lib/svg/preview";
import { sanitizeSvg } from "@/lib/svg/sanitize";
import { analyzeSvg } from "@/lib/svg/stats";
import { ApiError, isFatal, postJson, type ConceptsResponse, type SvgResponse } from "./client";
import { RateGate, callWithRetry } from "./queue";

// The whole job runs in the browser, one asset at a time (CLAUDE.md rule 2).

export type ItemStatus = "menunggu" | "berjalan" | "selesai" | "gagal";

export type JobItem = {
  index: number;
  concept: Concept;
  status: ItemStatus;
  error?: string;
  assetId?: string;
  previewUrl?: string; // local object URL, revoked by the page
};

export type JobPhase = "mulai" | "konsep" | "antrean" | "selesai" | "dihentikan" | "gagal";

export type JobState = {
  phase: JobPhase;
  jobId?: string;
  message?: string;
  providerNote?: string;
  items: JobItem[];
};

export type RunJobParams = {
  supabase: SupabaseClient<Database>;
  userId: string;
  theme: string;
  style: StyleId;
  palette: string[];
  count: number;
  signal: AbortSignal;
  onState: (state: JobState) => void;
};

const BUCKET = "assets";

export async function runJob(p: RunJobParams): Promise<void> {
  let state: JobState = { phase: "mulai", items: [] };
  const emit = (patch: Partial<JobState>) => {
    state = { ...state, ...patch };
    p.onState(state);
  };
  const patchItem = (index: number, patch: Partial<JobItem>) => {
    emit({ items: state.items.map((it) => (it.index === index ? { ...it, ...patch } : it)) });
  };

  const gate = new RateGate();
  const retryOpts = (onStatus?: (m: string) => void) => ({ gate, signal: p.signal, onStatus });

  let jobId: string | undefined;
  let created = 0;

  try {
    // A typed theme becomes a theme row without a research run.
    const theme = await p.supabase.from("themes").insert({ title: p.theme }).select("id").single();
    if (theme.error) throw new ApiError("internal", "Gagal menyimpan tema.");

    const job = await p.supabase
      .from("generation_jobs")
      .insert({ theme_id: theme.data.id, style: p.style, palette: p.palette, count: p.count, status: "berjalan" })
      .select("id")
      .single();
    if (job.error) throw new ApiError("internal", "Gagal membuat job generate.");
    jobId = job.data.id;
    emit({ phase: "konsep", jobId, message: "Menyusun konsep variasi..." });

    const conceptsRes = await callWithRetry(
      () =>
        postJson<ConceptsResponse>(
          "/api/generate/concepts",
          { theme: p.theme, style: p.style, palette: p.palette, count: p.count },
          p.signal,
        ).then((r) => {
          gate.update(r.rateLimit);
          return r;
        }),
      retryOpts((message) => emit({ message })),
    );

    emit({
      phase: "antrean",
      message: undefined,
      items: conceptsRes.concepts.map((concept, index) => ({ index, concept, status: "menunggu" as const })),
    });

    for (const item of state.items) {
      if (p.signal.aborted) break;
      patchItem(item.index, { status: "berjalan" });

      try {
        const made = await callWithRetry(
          () => makeAsset(p, jobId!, item.concept, gate),
          retryOpts((message) => emit({ message })),
        );
        created += 1;
        emit({ message: undefined, providerNote: `${made.provider} · ${made.model}` });
        patchItem(item.index, { status: "selesai", assetId: made.assetId, previewUrl: made.previewUrl });
      } catch (err) {
        if (p.signal.aborted) break;
        const apiErr = err instanceof ApiError ? err : new ApiError("internal", "Terjadi kesalahan tak terduga.");
        patchItem(item.index, { status: "gagal", error: apiErr.message });
        if (isFatal(apiErr.code)) {
          emit({ message: apiErr.message });
          break; // every later call would fail the same way
        }
      }
    }

    emit({
      phase: p.signal.aborted ? "dihentikan" : state.items.some((i) => i.status === "menunggu") ? "gagal" : "selesai",
      message: p.signal.aborted ? "Dihentikan. Aset yang sudah jadi tetap tersimpan." : state.message,
    });
  } catch (err) {
    if (p.signal.aborted) {
      emit({ phase: "dihentikan", message: "Dihentikan. Aset yang sudah jadi tetap tersimpan." });
    } else {
      const message = err instanceof ApiError ? err.message : "Terjadi kesalahan tak terduga.";
      emit({ phase: "gagal", message });
    }
  } finally {
    if (jobId) {
      await p.supabase
        .from("generation_jobs")
        .update({ status: created > 0 ? "selesai" : "gagal" })
        .eq("id", jobId)
        .then(() => undefined, () => undefined);
    }
  }
}

async function makeAsset(p: RunJobParams, jobId: string, concept: Concept, gate: RateGate) {
  const res = await postJson<SvgResponse>("/api/generate/svg", { theme: p.theme, style: p.style, concept }, p.signal);
  gate.update(res.rateLimit);

  // Never trust the model output: sanitize before it is rendered, stored, or shown.
  const clean = sanitizeSvg(res.svg);
  if (!clean.ok) throw new ApiError("bad_svg", clean.reason);

  const stats = analyzeSvg(clean.svg);
  let png: Blob;
  try {
    png = await renderPreviewPng(clean.svg);
  } catch {
    throw new ApiError("bad_svg", "SVG tidak bisa dirender.");
  }

  const assetId = crypto.randomUUID();
  const svgPath = `${p.userId}/svg/${assetId}.svg`;
  const previewPath = `${p.userId}/preview/${assetId}.png`;
  const storage = p.supabase.storage.from(BUCKET);

  const svgUpload = await storage.upload(svgPath, new Blob([clean.svg], { type: "image/svg+xml" }), {
    contentType: "image/svg+xml",
  });
  if (svgUpload.error) throw new ApiError("storage", "Gagal menyimpan file SVG.");

  const pngUpload = await storage.upload(previewPath, png, { contentType: "image/png" });
  if (pngUpload.error) {
    await storage.remove([svgPath]);
    throw new ApiError("storage", "Gagal menyimpan preview PNG.");
  }

  const insert = await p.supabase.from("assets").insert({
    id: assetId,
    job_id: jobId,
    provider: res.provider,
    model: res.model,
    svg_path: svgPath,
    preview_path: previewPath,
    path_count: stats.pathCount,
    concept: `${concept.subject}. ${concept.composition}`,
    qc_status: "menunggu",
  });
  if (insert.error) {
    await storage.remove([svgPath, previewPath]);
    throw new ApiError("storage", "Gagal menyimpan data aset.");
  }

  return { assetId, provider: res.provider, model: res.model, previewUrl: URL.createObjectURL(png) };
}
