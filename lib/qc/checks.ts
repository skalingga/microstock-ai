import { QC, type ComplexityLimits } from "./config";
import { hammingHex } from "./hash";
import { seamScore, seamsOk } from "./tile";
import type { Box, HashPoolEntry, Pixels, QcNote } from "./types";

// Individual QC checks. Each is a pure function of measurements, so they can be tested without a browser.

export function checkComplexity(
  stats: { shapeCount: number; pointCount: number },
  c: ComplexityLimits = QC.complexity,
): QcNote {
  const { shapeCount, pointCount } = stats;
  if (shapeCount > c.failShapes) {
    return { check: "kerumitan", status: "gagal", message: `Terlalu rumit: ${shapeCount} bentuk (batas ${c.failShapes}).` };
  }
  if (shapeCount > c.warnShapes) {
    return { check: "kerumitan", status: "cek", message: `Cukup rumit: ${shapeCount} bentuk (disarankan di bawah ${c.warnShapes}).` };
  }
  if (pointCount > c.warnPoints) {
    return { check: "kerumitan", status: "cek", message: `Banyak titik path: ${pointCount} (disarankan di bawah ${c.warnPoints}).` };
  }
  if (shapeCount < c.minShapes) {
    return { check: "kerumitan", status: "cek", message: `Terlalu sederhana: hanya ${shapeCount} bentuk.` };
  }
  return { check: "kerumitan", status: "ok", message: `${shapeCount} bentuk, ${pointCount} titik path.` };
}

export function checkText(hasText: boolean): QcNote {
  return hasText
    ? { check: "teks", status: "gagal", message: "Ada elemen teks. Adobe meminta teks diubah jadi kurva, dan teks tertanam berisiko." }
    : { check: "teks", status: "ok", message: "Tidak ada elemen teks." };
}

/** How far the drawing sticks out of the viewBox, as a share of the canvas size (0 = fully inside). */
export function overflowRatio(bbox: Box, viewBox: Box): number {
  const left = Math.max(0, viewBox.x - bbox.x) / viewBox.width;
  const top = Math.max(0, viewBox.y - bbox.y) / viewBox.height;
  const right = Math.max(0, bbox.x + bbox.width - (viewBox.x + viewBox.width)) / viewBox.width;
  const bottom = Math.max(0, bbox.y + bbox.height - (viewBox.y + viewBox.height)) / viewBox.height;
  return Math.max(left, top, right, bottom);
}

export function checkBounds(bbox: Box | null, viewBox: Box): QcNote {
  if (!bbox) {
    return { check: "kanvas", status: "cek", message: "Posisi gambar tidak bisa diukur." };
  }
  const overflow = overflowRatio(bbox, viewBox);
  const percent = Math.round(overflow * 100);
  if (overflow > QC.bounds.failOverflow) {
    return { check: "kanvas", status: "gagal", message: `Gambar keluar dari kanvas sekitar ${percent}% dan terpotong.` };
  }
  if (overflow > QC.bounds.warnOverflow) {
    return { check: "kanvas", status: "cek", message: `Gambar sedikit keluar dari kanvas (sekitar ${percent}%).` };
  }
  return { check: "kanvas", status: "ok", message: "Semua bentuk berada di dalam kanvas." };
}

const OPAQUE_ALPHA = 16;

export function opaqueRatio(p: Pixels): number {
  const total = p.width * p.height;
  if (total === 0) return 0;
  let opaque = 0;
  for (let i = 0; i < total; i++) if (p.data[i * 4 + 3] > OPAQUE_ALPHA) opaque += 1;
  return opaque / total;
}

export function checkEmpty(p: Pixels): QcNote {
  const ratio = opaqueRatio(p);
  return ratio < QC.emptyRatio
    ? { check: "kosong", status: "gagal", message: "Gambar kosong atau hampir tidak terlihat." }
    : { check: "kosong", status: "ok", message: `Terisi ${(ratio * 100).toFixed(0)}% dari kanvas.` };
}

export function borderOpaqueShare(p: Pixels): number {
  const { width: w, height: h } = p;
  let opaque = 0;
  let total = 0;
  const visit = (x: number, y: number) => {
    total += 1;
    if (p.data[(y * w + x) * 4 + 3] > OPAQUE_ALPHA) opaque += 1;
  };
  for (let x = 0; x < w; x++) {
    visit(x, 0);
    visit(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    visit(0, y);
    visit(w - 1, y);
  }
  return total === 0 ? 0 : opaque / total;
}

/** Icons must sit on a transparent background (Adobe vector guidelines). */
export function checkTransparentBackground(p: Pixels): QcNote {
  const share = borderOpaqueShare(p);
  if (share > QC.borderOpaqueMax) {
    return {
      check: "latar",
      status: "cek",
      message: `Latar tidak transparan atau gambar menyentuh tepi kanvas (${Math.round(share * 100)}% tepi terisi).`,
    };
  }
  return { check: "latar", status: "ok", message: "Latar transparan." };
}

export function checkSeamless(p: Pixels): QcNote {
  const result = seamScore(p);
  if (!seamsOk(result)) {
    return {
      check: "pola",
      status: "gagal",
      message: `Pola tidak menyambung mulus saat di-tile (${(result.wrapRate * 100).toFixed(0)}% sambungan tidak cocok, lebih besar dari tepi manapun di dalam pola: ${(result.refRate * 100).toFixed(0)}%).`,
    };
  }
  return { check: "pola", status: "ok", message: "Uji tile 2x2: tepi menyambung." };
}

export function checkSimilarity(phash: string, pool: HashPoolEntry[], selfId?: string): QcNote {
  let nearest: { id: string; distance: number } | null = null;
  for (const entry of pool) {
    if (!entry.phash || entry.id === selfId) continue;
    const distance = hammingHex(phash, entry.phash);
    if (!nearest || distance < nearest.distance) nearest = { id: entry.id, distance };
  }
  if (nearest && nearest.distance <= QC.similarity.maxHamming) {
    return {
      check: "kemiripan",
      status: "cek",
      message: `Sangat mirip dengan aset lain (${nearest.id.slice(0, 8)}, selisih ${nearest.distance} dari 64 bit).`,
    };
  }
  return { check: "kemiripan", status: "ok", message: "Tidak ada aset lain yang sangat mirip." };
}
