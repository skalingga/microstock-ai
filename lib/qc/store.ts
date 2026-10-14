import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { StyleId } from "@/lib/settings/schema";
import { combine, evaluateVisual, type Verdict } from "./evaluate";
import { measureSvg } from "./measure";
import { parseNotes, type HashPoolEntry, type MetadataFields, type QcNote } from "./types";

type Client = SupabaseClient<Database>;

/** Browser only: measure the SVG and run every visual check. */
export async function runVisualQc(args: {
  svg: string;
  style: StyleId;
  sanitizeNotes: string[];
  pool: HashPoolEntry[];
  selfId?: string;
  batchMaxHamming?: number;
  /** The SVG is a bundle of this many members. */
  members?: number;
}): Promise<{ notes: QcNote[]; phash: string }> {
  const measured = await measureSvg(args.svg);
  return evaluateVisual({
    style: args.style,
    stats: measured.stats,
    viewBox: measured.viewBox,
    bbox: measured.bbox,
    pixels: measured.pixels,
    sanitizeNotes: args.sanitizeNotes,
    pool: args.pool,
    selfId: args.selfId,
    batchMaxHamming: args.batchMaxHamming,
    members: args.members,
  });
}

/**
 * Hashes of every asset of one kind the user already has, for the similarity check. Photos, vectors and bundles never
 * compete: a 3x3 grid of drawings hashes like any other regular 3-column picture, so comparing it with single assets
 * only produces false alarms.
 */
export async function fetchHashPool(supabase: Client, kind: "vector" | "photo" | "bundle" = "vector"): Promise<HashPoolEntry[]> {
  const { data } = await supabase.from("assets").select("id, phash").eq("kind", kind).not("phash", "is", null).limit(5000);
  return data ?? [];
}

export async function saveVerdict(
  supabase: Client,
  assetId: string,
  verdict: Verdict,
  phash?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("assets")
    .update({
      qc_status: verdict.status,
      qc_notes: verdict.notes as unknown as Json,
      ...(phash ? { phash } : {}),
    })
    .eq("id", assetId);
  return !error;
}

export type StoredAsset = {
  id: string;
  svg_path: string | null;
  qc_notes: Json;
  title: string | null;
  keywords: string[];
  category: string | null;
  needs_release: boolean;
  /** Set on a bundle: its members, which are left out of the similarity check. */
  bundle_of?: string[];
};

export function metadataOf(asset: Pick<StoredAsset, "title" | "keywords" | "category" | "needs_release">): MetadataFields | null {
  return asset.title
    ? { title: asset.title, keywords: asset.keywords, category: asset.category, needsRelease: asset.needs_release }
    : null;
}

/**
 * Re-runs the visual QC on an asset that is already stored (new thresholds, assets from before QC
 * existed, or after the metadata changed) and saves the new verdict.
 */
export async function rerunQc(
  supabase: Client,
  asset: StoredAsset,
  style: StyleId,
  pool: HashPoolEntry[],
  bannedWords: string[],
): Promise<Verdict | null> {
  if (!asset.svg_path) return null;
  const file = await supabase.storage.from("assets").download(asset.svg_path);
  if (file.error || !file.data) return null;

  const svg = await file.data.text();
  const previous = parseNotes(asset.qc_notes);
  const members = asset.bundle_of && asset.bundle_of.length > 0 ? asset.bundle_of : undefined;
  const { notes, phash } = await runVisualQc({
    svg,
    style,
    sanitizeNotes: [],
    // A bundle is compared with other bundles only.
    pool: members ? await fetchHashPool(supabase, "bundle") : pool,
    selfId: asset.id,
    members: members?.length,
  });

  // The sanitizer ran when the asset was created; keep what it reported.
  const sanitized = previous.find((n) => n.check === "sanitasi");
  const visual = sanitized ? [notes[0], sanitized, ...notes.slice(1)] : notes;

  const verdict = combine(visual, metadataOf(asset), bannedWords);
  return (await saveVerdict(supabase, asset.id, verdict, phash)) ? verdict : null;
}

/** Stores metadata on an asset and re-judges it: visual notes stay, metadata notes are recomputed. */
export async function applyMetadata(
  supabase: Client,
  assetId: string,
  visualNotes: QcNote[],
  meta: { title: string; keywords: string[]; category: string; needsRelease: boolean },
  bannedWords: string[],
): Promise<Verdict | null> {
  const update = await supabase
    .from("assets")
    .update({ title: meta.title, keywords: meta.keywords, category: meta.category, needs_release: meta.needsRelease })
    .eq("id", assetId);
  if (update.error) return null;

  const verdict = combine(visualNotes, meta, bannedWords);
  return (await saveVerdict(supabase, assetId, verdict)) ? verdict : null;
}
