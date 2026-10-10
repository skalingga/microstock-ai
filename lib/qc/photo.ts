import { ADOBE_PHOTO, FICTIONAL_LABEL } from "@/lib/adobe/rules";
import { PHOTO_PROBLEMS, type PhotoProblem } from "@/lib/photo/config";
import { checkSimilarity } from "./checks";
import type { HashPoolEntry, QcNote } from "./types";

// Stage 12: QC for photos uploaded from Google Flow. Pure functions; reading the file happens in lib/photo/process.ts.

export type PhotoFacts = { width: number; height: number; bytes: number; converted: boolean };

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
const mp = (px: number) => `${(px / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} MP`;

/**
 * Why Adobe would refuse the file outright, or null. Such a file is not stored at all: it only fills the Storage.
 * Adobe counts megapixels as millions of pixels (4 MP = 4,000,000).
 */
export function photoRejection(f: Pick<PhotoFacts, "width" | "height" | "bytes">): string | null {
  const pixels = f.width * f.height;
  if (pixels < ADOBE_PHOTO.minMegapixels * 1_000_000) {
    return `Foto ${f.width}×${f.height} = ${mp(pixels)}, di bawah minimum Adobe ${ADOBE_PHOTO.minMegapixels} MP. Unduh ulang dari Flow dengan pilihan 2K Upscale.`;
  }
  if (pixels > ADOBE_PHOTO.maxMegapixels * 1_000_000) {
    return `Foto ${mp(pixels)}, di atas maksimum Adobe ${ADOBE_PHOTO.maxMegapixels} MP.`;
  }
  if (f.bytes > ADOBE_PHOTO.maxFileBytes) {
    return `File ${mb(f.bytes)}, di atas batas Adobe ${mb(ADOBE_PHOTO.maxFileBytes)}.`;
  }
  return null;
}

/** Notes for a photo that passed photoRejection: size and format, then similarity with the user's other photos. */
export function photoTechNotes(f: PhotoFacts, phash: string, pool: HashPoolEntry[], selfId?: string): QcNote[] {
  return [
    { check: "resolusi", status: "ok", message: `${f.width}×${f.height} = ${mp(f.width * f.height)} (Adobe: ${ADOBE_PHOTO.minMegapixels}–${ADOBE_PHOTO.maxMegapixels} MP).` },
    {
      check: "berkas",
      status: "ok",
      message: f.converted ? `Diubah ke JPEG, ${mb(f.bytes)}.` : `JPEG asli dari Flow, ${mb(f.bytes)}, tidak diubah.`,
    },
    checkSimilarity(phash, pool, selfId),
  ];
}

/** What the vision model saw: each defect needs a human look; people are a reminder for the Adobe portal. */
export function photoContentNotes(problems: PhotoProblem[], hasPeople: boolean): QcNote[] {
  const notes: QcNote[] =
    problems.length > 0
      ? problems.map((p) => ({ check: "isi" as const, status: "cek" as const, message: PHOTO_PROBLEMS[p] }))
      : [{ check: "isi", status: "ok", message: "AI tidak melihat teks, logo, atau cacat. Tetap periksa wajah dan tangan sendiri." }];
  if (hasPeople) {
    notes.push({ check: "orang", status: "ok", message: `Ada orang: centang "${FICTIONAL_LABEL}" saat unggah ke Adobe.` });
  }
  return notes;
}
