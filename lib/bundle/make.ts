import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { ApiError, postJson, type MetadataResponse } from "@/lib/generate/client";
import { RateGate, callWithRetry } from "@/lib/generate/queue";
import { combine } from "@/lib/qc/evaluate";
import { applyMetadata, fetchHashPool, runVisualQc } from "@/lib/qc/store";
import type { QcStatus } from "@/lib/qc/types";
import type { StyleId } from "@/lib/settings/schema";
import { analyzeSvg } from "@/lib/svg/stats";
import { renderPreviewPng } from "@/lib/svg/preview";
import { sanitizeSvg } from "@/lib/svg/sanitize";
import { composeBundle, type GridOption } from "./compose";

type Client = SupabaseClient<Database>;

const BUCKET = "assets";
const DOWNLOAD_PARALLEL = 5;
const CONCEPT_MAX = 480;

export type MakeBundleParams = {
  supabase: Client;
  userId: string;
  /** Member ids in grid order: left to right, top to bottom. */
  memberIds: string[];
  grid: GridOption;
  bannedWords: string[];
  /** The user agreed to hold back members that were exported before. */
  allowExported?: boolean;
  signal?: AbortSignal;
  onStep?: (message: string) => void;
};

export type MakeBundleResult =
  | { ok: true; assetId: string; status: QcStatus | "menunggu"; note?: string }
  | { ok: false; error: string; exportedMembers?: number };

/** The first sentence of each member's concept, so the metadata writer knows what is in the set. */
export function bundleConcept(size: number, memberConcepts: (string | null)[]): string {
  const subjects = memberConcepts
    .map((c) => (c ?? "").split(/\.\s/)[0].trim().slice(0, 60))
    .filter((c) => c.length > 0);
  let text = `Bundle: ONE picture holding a grid of ${size} separate matching items of the same set.`;
  if (subjects.length > 0) text += ` Items: ${subjects.join("; ")}.`;
  return text.length > CONCEPT_MAX ? `${text.slice(0, CONCEPT_MAX - 1).trimEnd()}…` : text;
}

/**
 * Browser only. Builds a bundle from finished assets: downloads their SVGs, composes the grid, sanitizes, runs QC,
 * stores it as a new asset, holds the members back from export, and asks for the set's metadata.
 * Each step that can fail is undone, so a failed bundle leaves no half-made asset behind.
 */
export async function makeBundle(p: MakeBundleParams): Promise<MakeBundleResult> {
  const { supabase, userId, memberIds, grid } = p;
  const step = (message: string) => p.onStep?.(message);
  const storage = supabase.storage.from(BUCKET);

  step("Memeriksa anggota...");
  const { data: rows, error } = await supabase
    .from("assets")
    .select("id, job_id, kind, svg_path, qc_status, exported_at, bundled_in, concept")
    .in("id", memberIds);
  if (error || !rows) return { ok: false, error: "Data anggota tidak bisa dimuat. Coba lagi." };
  if (rows.length !== memberIds.length) return { ok: false, error: "Sebagian aset sudah tidak ada. Muat ulang galeri." };
  if (rows.some((r) => r.kind !== "vector")) return { ok: false, error: "Bundle hanya untuk aset vektor (bukan foto atau bundle lain)." };
  if (rows.some((r) => r.qc_status !== "lolos")) return { ok: false, error: "Semua anggota harus berstatus Lolos." };
  if (rows.some((r) => r.bundled_in)) return { ok: false, error: "Ada anggota yang sudah masuk bundle lain." };
  if (rows.some((r) => !r.svg_path)) return { ok: false, error: "Ada anggota tanpa file SVG." };

  const exportedMembers = rows.filter((r) => r.exported_at).length;
  if (exportedMembers > 0 && !p.allowExported) {
    return {
      ok: false,
      exportedMembers,
      error: `${exportedMembers} anggota sudah pernah diekspor. Satuannya mungkin sudah ada di Adobe, jadi bundle ini berisiko dianggap konten serupa.`,
    };
  }

  const jobIds = [...new Set(rows.map((r) => r.job_id))];
  const { data: jobs } = await supabase.from("generation_jobs").select("id, style, themes(title)").in("id", jobIds);
  const styles = [...new Set((jobs ?? []).map((j) => j.style))];
  if (styles.length !== 1) return { ok: false, error: "Anggota harus satu gaya dan satu set. Pilih aset dari tema dan gaya yang sama." };
  const style = styles[0] as StyleId;
  const theme = (jobs ?? []).find((j) => j.themes?.title)?.themes?.title ?? "stock vector set";

  // Grid order follows the order the caller gave.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = memberIds.map((id) => byId.get(id)!);

  const svgs: string[] = new Array(ordered.length);
  for (let start = 0; start < ordered.length; start += DOWNLOAD_PARALLEL) {
    if (p.signal?.aborted) return { ok: false, error: "Dibatalkan." };
    step(`Mengunduh SVG anggota (${Math.min(start + DOWNLOAD_PARALLEL, ordered.length)}/${ordered.length})...`);
    const chunk = ordered.slice(start, start + DOWNLOAD_PARALLEL);
    const files = await Promise.all(chunk.map((r) => storage.download(r.svg_path!)));
    for (const [i, file] of files.entries()) {
      if (file.error || !file.data) return { ok: false, error: `SVG anggota ke-${start + i + 1} tidak bisa diunduh.` };
      svgs[start + i] = await file.data.text();
    }
  }

  step("Menyusun grid...");
  const composed = composeBundle(
    ordered.map((r, i) => ({ id: r.id, svg: svgs[i] })),
    grid,
  );
  if (!composed.ok) return { ok: false, error: composed.reason };
  const clean = sanitizeSvg(composed.svg);
  if (!clean.ok) return { ok: false, error: `Bundle gagal disanitasi: ${clean.reason}` };

  step("Menjalankan QC...");
  const bundleId = crypto.randomUUID();
  const stats = analyzeSvg(clean.svg);
  let png: Blob;
  let qc: Awaited<ReturnType<typeof runVisualQc>>;
  try {
    png = await renderPreviewPng(clean.svg);
    // Bundles are compared with other bundles only; their members are single assets and never in this pool.
    const pool = await fetchHashPool(supabase, "bundle");
    qc = await runVisualQc({ svg: clean.svg, style, sanitizeNotes: clean.notes, pool, selfId: bundleId, members: memberIds.length });
  } catch {
    return { ok: false, error: "Bundle tidak bisa dirender." };
  }
  const verdict = combine(qc.notes, null, p.bannedWords);

  step("Menyimpan bundle...");
  const svgPath = `${userId}/svg/${bundleId}.svg`;
  const previewPath = `${userId}/preview/${bundleId}.png`;
  const svgUpload = await storage.upload(svgPath, new Blob([clean.svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml" });
  if (svgUpload.error) return { ok: false, error: `Gagal menyimpan file SVG (${svgUpload.error.message}).` };
  const pngUpload = await storage.upload(previewPath, png, { contentType: "image/png" });
  if (pngUpload.error) {
    await storage.remove([svgPath]);
    return { ok: false, error: `Gagal menyimpan preview PNG (${pngUpload.error.message}).` };
  }

  const concept = bundleConcept(memberIds.length, ordered.map((r) => r.concept));
  const insert = await supabase.from("assets").insert({
    id: bundleId,
    job_id: ordered[0].job_id,
    kind: "bundle",
    provider: "local",
    model: `grid-${grid.id}`,
    svg_path: svgPath,
    preview_path: previewPath,
    path_count: stats.shapeCount,
    concept,
    qc_status: verdict.status,
    qc_notes: verdict.notes as unknown as Json,
    phash: qc.phash,
    bundle_of: memberIds,
  });
  if (insert.error) {
    await storage.remove([svgPath, previewPath]);
    return { ok: false, error: `Gagal menyimpan data bundle (${insert.error.message}).` };
  }

  // Hold the members back from export. If this fails the bundle is removed again, so nothing is half done.
  const hold = await supabase.from("assets").update({ bundled_in: bundleId }).in("id", memberIds);
  if (hold.error) {
    await supabase.from("assets").delete().eq("id", bundleId);
    await storage.remove([svgPath, previewPath]);
    return { ok: false, error: `Anggota gagal ditahan (${hold.error.message}). Bundle dibatalkan.` };
  }

  if (verdict.status === "gagal") return { ok: true, assetId: bundleId, status: "gagal", note: "QC menggagalkan bundle; metadata tidak dibuat." };

  step("Membuat metadata set...");
  try {
    const gate = new RateGate();
    const res = await callWithRetry(
      () =>
        postJson<MetadataResponse>(
          "/api/generate/metadata",
          { theme, style, concept, setSize: memberIds.length },
          p.signal,
        ).then((r) => {
          gate.update(r.rateLimit);
          return r;
        }),
      { gate, signal: p.signal, onStatus: step },
    );
    const final = await applyMetadata(supabase, bundleId, qc.notes, res.metadata, p.bannedWords);
    if (!final) return { ok: true, assetId: bundleId, status: "menunggu", note: "Bundle jadi, tetapi metadata gagal disimpan. Buat metadata di halaman detail." };
    return { ok: true, assetId: bundleId, status: final.status };
  } catch (err) {
    const reason = err instanceof ApiError ? err.message : "kesalahan tak terduga";
    return { ok: true, assetId: bundleId, status: "menunggu", note: `Bundle jadi, tetapi metadata belum dibuat (${reason}). Buat dari halaman detail.` };
  }
}

/** Releases members from a bundle so they can be exported on their own again. */
export async function releaseMembers(supabase: Client, memberIds: string[]): Promise<boolean> {
  if (memberIds.length === 0) return true;
  const { error } = await supabase.from("assets").update({ bundled_in: null }).in("id", memberIds);
  return !error;
}
