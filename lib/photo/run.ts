import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { ApiError, postJson } from "@/lib/generate/client";
import { describeConcept } from "@/lib/generate/concept";
import { RateGate, callWithRetry, type AttemptContext } from "@/lib/generate/queue";
import type { RateLimit } from "@/lib/providers/types";
import { combine, type Verdict } from "@/lib/qc/evaluate";
import { photoContentNotes, photoTechNotes } from "@/lib/qc/photo";
import { applyMetadata } from "@/lib/qc/store";
import type { HashPoolEntry } from "@/lib/qc/types";
import type { PhotoAspect, PhotoProblem } from "./config";
import { PhotoReadError, readPhoto } from "./process";

// Stage 12, browser side. The prompts come from one AI call; every uploaded photo then gets one vision call for its
// metadata (CLAUDE.md rule 2). Google Flow itself is used by hand and never called.

type Client = SupabaseClient<Database>;
const BUCKET = "assets";

export type PhotoPromptItem = { subject: string; prompt: string };

/** What generation_jobs.photo_prompts holds. */
export type PhotoJobData = { aspect: PhotoAspect; prompts: PhotoPromptItem[]; model: string; provider: string };

type PromptsResponse = { prompts: PhotoPromptItem[]; model: string; provider: string; rateLimit?: RateLimit };
type PhotoMetadataResponse = {
  metadata: {
    title: string;
    keywords: string[];
    category: string;
    needsRelease: boolean;
    hasPeople: boolean;
    problems: PhotoProblem[];
  };
  notes: string[];
  model: string;
  provider: string;
  rateLimit?: RateLimit;
};

export function parsePhotoJob(value: Json | null | undefined): PhotoJobData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.prompts) || typeof v.aspect !== "string") return null;
  const prompts = v.prompts.filter(
    (p): p is PhotoPromptItem =>
      !!p && typeof p === "object" && typeof (p as PhotoPromptItem).subject === "string" && typeof (p as PhotoPromptItem).prompt === "string",
  );
  return {
    aspect: v.aspect as PhotoAspect,
    prompts,
    model: typeof v.model === "string" ? v.model : "",
    provider: typeof v.provider === "string" ? v.provider : "",
  };
}

function skip(ctx: AttemptContext) {
  return ctx.skipPrimary ? { skipPrimary: true } : {};
}

/** One AI call for the prompts, then the theme and job rows that keep them for later uploads. */
export async function writePhotoPrompts(p: {
  supabase: Client;
  theme: string;
  count: number;
  aspect: PhotoAspect;
  avoid: string[];
  variations: boolean;
  signal: AbortSignal;
  onStatus: (message: string) => void;
}): Promise<{ jobId: string; data: PhotoJobData }> {
  const gate = new RateGate();
  const res = await callWithRetry(
    (ctx) =>
      postJson<PromptsResponse>(
        "/api/generate/photo-prompts",
        { theme: p.theme, count: p.count, aspect: p.aspect, avoid: p.avoid, variations: p.variations, ...skip(ctx) },
        p.signal,
      ),
    { gate, signal: p.signal, onStatus: p.onStatus },
  );

  const data: PhotoJobData = { aspect: p.aspect, prompts: res.prompts, model: res.model, provider: res.provider };
  const theme = await p.supabase.from("themes").insert({ title: p.theme }).select("id").single();
  if (theme.error) throw new ApiError("internal", "Gagal menyimpan tema.");
  const job = await p.supabase
    .from("generation_jobs")
    .insert({
      theme_id: theme.data.id,
      style: "photo",
      count: res.prompts.length,
      status: "selesai",
      photo_prompts: data as unknown as Json,
    })
    .select("id")
    .single();
  if (job.error) throw new ApiError("internal", "Gagal menyimpan prompt foto.");
  return { jobId: job.data.id, data };
}

export type PhotoUploadParams = {
  supabase: Client;
  userId: string;
  jobId: string;
  theme: string;
  /** Label of the Flow model that made the photo (assets.model). */
  flowModel: string;
  prompt?: PhotoPromptItem;
  bannedWords: string[];
  pool: HashPoolEntry[];
  gate: RateGate;
  signal: AbortSignal;
  onStage: (stage: "membaca" | "mengunggah" | "metadata", message?: string) => void;
};

export type PhotoUploadResult = {
  assetId: string;
  previewUrl: string;
  verdict: Verdict;
  /** Set when the photo is stored but its metadata could not be made. */
  metadataError?: string;
};

/**
 * Reads, checks, stores one photo, then asks for its metadata. A photo Adobe would refuse outright (too small, too
 * big, not an image) throws a PhotoReadError before anything is stored.
 */
export async function uploadPhoto(file: File, p: PhotoUploadParams): Promise<PhotoUploadResult> {
  p.onStage("membaca");
  const read = await readPhoto(file);

  const assetId = crypto.randomUUID();
  const techNotes = photoTechNotes(
    { width: read.width, height: read.height, bytes: read.jpeg.size, converted: read.converted },
    read.phash,
    p.pool,
    assetId,
  );

  p.onStage("mengunggah");
  const imagePath = `${p.userId}/photo/${assetId}.jpg`;
  const previewPath = `${p.userId}/preview/${assetId}.jpg`;
  const storage = p.supabase.storage.from(BUCKET);

  const up = await storage.upload(imagePath, read.jpeg, { contentType: "image/jpeg" });
  if (up.error) throw new ApiError("storage", `Gagal menyimpan foto (${up.error.message}).`);
  const prev = await storage.upload(previewPath, read.preview, { contentType: "image/jpeg" });
  if (prev.error) {
    await storage.remove([imagePath]);
    throw new ApiError("storage", `Gagal menyimpan preview (${prev.error.message}).`);
  }

  const waiting = combine(techNotes, null, p.bannedWords);
  const insert = await p.supabase.from("assets").insert({
    id: assetId,
    job_id: p.jobId,
    kind: "photo",
    provider: "flow",
    model: p.flowModel,
    image_path: imagePath,
    preview_path: previewPath,
    width: read.width,
    height: read.height,
    file_bytes: read.jpeg.size,
    concept: p.prompt ? describeConcept({ subject: p.prompt.subject, composition: p.prompt.prompt }) : null,
    phash: read.phash,
    qc_status: waiting.status,
    qc_notes: waiting.notes as unknown as Json,
  });
  if (insert.error) {
    await storage.remove([imagePath, previewPath]);
    throw new ApiError("storage", `Gagal menyimpan data foto (${insert.error.message}).`);
  }
  p.pool.push({ id: assetId, phash: read.phash, batch: true });
  const previewUrl = URL.createObjectURL(read.preview);

  p.onStage("metadata");
  try {
    const res = await callWithRetry(
      (ctx) =>
        postJson<PhotoMetadataResponse>(
          "/api/generate/photo-metadata",
          { theme: p.theme, ...(p.prompt ? { prompt: p.prompt.prompt } : {}), image: read.visionImage, ...skip(ctx) },
          p.signal,
        ).then((r) => {
          p.gate.update(r.rateLimit);
          return r;
        }),
      { gate: p.gate, signal: p.signal, onStatus: (m) => p.onStage("metadata", m) },
    );

    const { hasPeople, problems, ...meta } = res.metadata;
    await p.supabase.from("assets").update({ fictional_people: hasPeople }).eq("id", assetId);
    const verdict = await applyMetadata(p.supabase, assetId, [...techNotes, ...photoContentNotes(problems, hasPeople)], meta, p.bannedWords);
    if (!verdict) throw new ApiError("storage", "Gagal menyimpan metadata.");
    return { assetId, previewUrl, verdict };
  } catch (err) {
    if (p.signal.aborted) throw err;
    const message = err instanceof ApiError ? err.message : "Terjadi kesalahan tak terduga.";
    return { assetId, previewUrl, verdict: waiting, metadataError: message };
  }
}

export { PhotoReadError };
