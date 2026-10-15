import { ADOBE_PHOTO, FICTIONAL_LABEL } from "@/lib/adobe/rules";
import { PHOTO_PROBLEMS, type PhotoProblem, type PhotoVariant } from "@/lib/photo/config";
import { checkSimilarity } from "./checks";
import { QC } from "./config";
import type { HashPoolEntry, Pixels, QcNote } from "./types";

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
    return `Gambar ${f.width}×${f.height} = ${mp(pixels)}, di bawah minimum Adobe ${ADOBE_PHOTO.minMegapixels} MP. Unduh ulang dari Flow dengan pilihan 2K Upscale (hasil aplikasi Gemini biasanya juga terlalu kecil).`;
  }
  if (pixels > ADOBE_PHOTO.maxMegapixels * 1_000_000) {
    return `Foto ${mp(pixels)}, di atas maksimum Adobe ${ADOBE_PHOTO.maxMegapixels} MP.`;
  }
  if (f.bytes > ADOBE_PHOTO.maxFileBytes) {
    return `File ${mb(f.bytes)}, di atas batas Adobe ${mb(ADOBE_PHOTO.maxFileBytes)}.`;
  }
  return null;
}

export type BorderColor = { r: number; g: number; b: number };

/** Mean color of the outer ring of the picture (the "background" of a sheet that is meant to be plain white). */
export function borderColor(pixels: Pixels, fraction: number = QC.sheetBackground.borderFraction): BorderColor {
  const { data, width, height } = pixels;
  const ring = Math.max(1, Math.round(Math.min(width, height) * fraction));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    const edgeRow = y < ring || y >= height - ring;
    for (let x = 0; x < width; x++) {
      if (!edgeRow && x >= ring && x < width - ring) {
        // Inside the ring: jump to its right side.
        x = width - ring - 1;
        continue;
      }
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return n === 0 ? { r: 255, g: 255, b: 255 } : { r: r / n, g: g / n, b: b / n };
}

/** A note when the border of an icon sheet is not one plain white field (gray, tinted, or shadowed). */
export function sheetBackgroundNote(border: BorderColor): QcNote {
  const { minChannel, maxSpread } = QC.sheetBackground;
  const channels = [border.r, border.g, border.b];
  const dark = Math.min(...channels);
  const spread = Math.max(...channels) - dark;
  if (dark < minChannel || spread > maxSpread) {
    return {
      check: "latar",
      status: "cek",
      message: `Latar bukan putih polos (rata-rata tepi RGB ${channels.map((c) => Math.round(c)).join("/")}): abu-abu, tinted, atau ada bayangan dan garis panel. Adobe menolak ini; generate ulang dengan prompt yang sama.`,
    };
  }
  return { check: "latar", status: "ok", message: "Latar putih polos." };
}

/**
 * Notes for a photo that passed photoRejection: size and format, then similarity with the user's other photos.
 * `sheetBorder` is passed for icon sheets only, which must sit on plain white.
 */
export function photoTechNotes(
  f: PhotoFacts,
  phash: string,
  pool: HashPoolEntry[],
  selfId?: string,
  variant: PhotoVariant = "photo",
  sheetBorder?: BorderColor,
): QcNote[] {
  const maxHamming =
    variant === "background"
      ? QC.similarity.maxHammingBackground
      : variant === "illustration"
        ? QC.similarity.maxHammingIllustration
        : QC.similarity.maxHamming;
  return [
    ...(sheetBorder ? [sheetBackgroundNote(sheetBorder)] : []),
    { check: "resolusi", status: "ok", message: `${f.width}×${f.height} = ${mp(f.width * f.height)} (Adobe: ${ADOBE_PHOTO.minMegapixels}–${ADOBE_PHOTO.maxMegapixels} MP).` },
    {
      check: "berkas",
      status: "ok",
      message: f.converted ? `Diubah ke JPEG, ${mb(f.bytes)}.` : `JPEG asli dari Flow, ${mb(f.bytes)}, tidak diubah.`,
    },
    checkSimilarity(phash, pool, selfId, undefined, maxHamming),
  ];
}

/** What the vision model saw: each defect needs a human look; people are a reminder for the Adobe portal. */
export function photoContentNotes(problems: PhotoProblem[], hasPeople: boolean, variant: PhotoVariant = "photo"): QcNote[] {
  const clean =
    variant === "background"
      ? "AI tidak melihat teks, logo, atau cacat. Tetap periksa sendiri bagian tepi dan pola yang berulang."
      : variant === "illustration"
        ? "AI tidak melihat teks, logo, atau cacat. Tetap periksa sendiri tepi die-cut, bentuk yang meleleh, dan huruf acak."
        : "AI tidak melihat teks, logo, atau cacat. Tetap periksa wajah dan tangan sendiri.";
  const notes: QcNote[] =
    problems.length > 0
      ? problems.map((p) => ({ check: "isi" as const, status: "cek" as const, message: PHOTO_PROBLEMS[p] }))
      : [{ check: "isi", status: "ok", message: clean }];
  if (hasPeople && variant === "background") {
    notes.push({ check: "orang", status: "cek", message: "Ada orang di gambar yang seharusnya background tanpa subjek. Ganti, atau pastikan tidak mirip orang sungguhan." });
  } else if (hasPeople) {
    notes.push({ check: "orang", status: "ok", message: `Ada orang: centang "${FICTIONAL_LABEL}" saat unggah ke Adobe.` });
  }
  return notes;
}
