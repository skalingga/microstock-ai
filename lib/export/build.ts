import type { SupabaseClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { ADOBE_PHOTO, categoryNumber } from "@/lib/adobe/rules";
import type { Database } from "@/lib/database.types";
import { applyArtboard } from "./artboard";
import { buildAdobeCsv, csvProblems, type CsvRow } from "./csv";
import { makeFilename } from "./slug";

type Client = SupabaseClient<Database>;

export type ExportAsset = {
  id: string;
  title: string;
  keywords: string[];
  category: string | null;
  svg_path: string | null;
  /** Stage 12: a photo exports its stored JPEG unchanged. */
  kind?: string;
  image_path?: string | null;
};

export type ExportResult = {
  zip: Blob;
  csv: string;
  included: { id: string; filename: string; photo?: boolean }[];
  skipped: { id: string; title: string; reason: string }[];
  problems: string[];
};

/**
 * Browser only. Downloads each SVG, gives it Adobe's artboard size (photos: the JPEG as it is), and packs the files into a ZIP plus the
 * upload CSV. Assets that cannot be exported are skipped with a reason instead of failing the whole batch.
 */
export async function buildExport(
  supabase: Client,
  assets: ExportAsset[],
  onProgress?: (done: number, total: number) => void,
  /** Aborting stops between files; nothing is saved or marked. */
  signal?: AbortSignal,
): Promise<ExportResult> {
  const zip = new JSZip();
  const used = new Set<string>();
  const rows: CsvRow[] = [];
  const included: ExportResult["included"] = [];
  const skipped: ExportResult["skipped"] = [];

  for (const [i, asset] of assets.entries()) {
    signal?.throwIfAborted();
    onProgress?.(i, assets.length);

    if (asset.kind === "photo") {
      const photo = asset.image_path ? await supabase.storage.from("assets").download(asset.image_path) : null;
      if (!photo || photo.error || !photo.data) {
        skipped.push({ id: asset.id, title: asset.title, reason: "File foto tidak bisa diunduh dari penyimpanan." });
        continue;
      }
      // The JPEG goes out exactly as uploaded: no artboard, no re-encoding.
      const filename = makeFilename(asset.title, asset.id, used, ADOBE_PHOTO.extension);
      zip.file(filename, photo.data);
      included.push({ id: asset.id, filename, photo: true });
      rows.push({ filename, title: asset.title, keywords: asset.keywords, categoryNumber: categoryNumber(asset.category) });
      continue;
    }

    const file = asset.svg_path ? await supabase.storage.from("assets").download(asset.svg_path) : null;
    if (!file || file.error || !file.data) {
      skipped.push({ id: asset.id, title: asset.title, reason: "File SVG tidak bisa diunduh dari penyimpanan." });
      continue;
    }

    const prepared = applyArtboard(await file.data.text());
    if (!prepared) {
      skipped.push({ id: asset.id, title: asset.title, reason: "SVG tidak punya viewBox yang valid." });
      continue;
    }
    if (!prepared.artboard.ok) {
      skipped.push({ id: asset.id, title: asset.title, reason: prepared.artboard.reason ?? "Ukuran artboard tidak memenuhi syarat." });
      continue;
    }

    const filename = makeFilename(asset.title, asset.id, used);
    zip.file(filename, prepared.svg);
    included.push({ id: asset.id, filename });
    rows.push({ filename, title: asset.title, keywords: asset.keywords, categoryNumber: categoryNumber(asset.category) });
  }
  onProgress?.(assets.length, assets.length);

  const csv = buildAdobeCsv(rows);
  return {
    zip: await zip.generateAsync({ type: "blob", compression: "DEFLATE" }),
    csv,
    included,
    skipped,
    problems: csvProblems(csv, rows.length),
  };
}

/** Local time as YYYY-MM-DD_HHmm, for file names without spaces (Adobe asks for that). */
export function exportStamp(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type SavedExport = {
  exportId: string;
  /** False when the history was saved but the assets could not be marked exported (retry with markExported). */
  marked: boolean;
};

/** Marks assets as exported. Returns false when the update failed, so the caller can say so and offer a retry. */
export async function markExported(supabase: Client, assetIds: string[]): Promise<boolean> {
  const { error } = await supabase.from("assets").update({ exported_at: new Date().toISOString() }).in("id", assetIds);
  return !error;
}

/** What the history row records besides the files: how to name the export, which assets need a release, and which photos show fictional people. */
export type ExportSummary = { label: string; releaseTitles: string[]; fictionalFiles?: string[] };

/** Keeps the files for the export history and marks the assets as exported. Returns null when the history could not be saved. */
export async function saveExport(
  supabase: Client,
  userId: string,
  result: ExportResult,
  summary: ExportSummary = { label: "", releaseTitles: [] },
): Promise<SavedExport | null> {
  const exportId = crypto.randomUUID();
  const zipPath = `${userId}/exports/${exportId}.zip`;
  const csvPath = `${userId}/exports/${exportId}.csv`;
  const storage = supabase.storage.from("assets");

  const zipUpload = await storage.upload(zipPath, result.zip, { contentType: "application/zip" });
  if (zipUpload.error) return null;
  const csvUpload = await storage.upload(csvPath, new Blob([result.csv], { type: "text/csv" }), { contentType: "text/csv" });
  if (csvUpload.error) {
    await storage.remove([zipPath]);
    return null;
  }

  const insert = await supabase
    .from("exports")
    .insert({
      id: exportId,
      zip_path: zipPath,
      csv_path: csvPath,
      asset_count: result.included.length,
      asset_ids: result.included.map((i) => i.id),
      filenames: result.included.map((i) => i.filename),
      label: summary.label,
      release_titles: summary.releaseTitles,
      fictional_files: summary.fictionalFiles ?? [],
    });
  if (insert.error) {
    await storage.remove([zipPath, csvPath]);
    return null;
  }

  // Checked, not assumed: an unmarked asset shows up again as "not exported" and could be uploaded twice.
  const marked = await markExported(
    supabase,
    result.included.map((i) => i.id),
  );
  return { exportId, marked };
}
