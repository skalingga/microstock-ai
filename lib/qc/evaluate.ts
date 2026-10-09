import type { StyleId } from "@/lib/settings/schema";
import type { SvgStats } from "@/lib/svg/stats";
import {
  checkBounds,
  checkComplexity,
  checkEmpty,
  checkOutline,
  checkSeamless,
  checkSimilarity,
  checkText,
  checkTransparentBackground,
} from "./checks";
import { STYLE_RULES, complexityFor } from "./config";
import { dHash } from "./hash";
import { checkMetadata } from "./metadata-checks";
import type { Box, HashPoolEntry, MetadataFields, Pixels, QcNote, QcStatus } from "./types";

export type VisualInput = {
  style: StyleId;
  stats: SvgStats;
  viewBox: Box;
  bbox: Box | null;
  pixels: Pixels;
  /** What the sanitizer removed when the SVG was created, e.g. "script dihapus". */
  sanitizeNotes: string[];
  /** Hashes of the user's other assets (this batch and history). */
  pool: HashPoolEntry[];
  selfId?: string;
  /** Looser limit between assets of this batch (one-subject variations); see checkSimilarity. */
  batchMaxHamming?: number;
};

/** The checks that need the SVG itself. Everything here is pure; measuring happens in lib/qc/measure.ts. */
export function evaluateVisual(input: VisualInput): { notes: QcNote[]; phash: string } {
  const rules = STYLE_RULES[input.style];
  const phash = dHash(input.pixels);
  const notes: QcNote[] = [{ check: "validitas", status: "ok", message: "SVG valid dan bisa dirender." }];

  if (input.sanitizeNotes.length > 0) {
    notes.push({ check: "sanitasi", status: "ok", message: `Dibersihkan otomatis: ${input.sanitizeNotes.join(", ")}.` });
  }
  notes.push(checkText(input.stats.hasText));
  notes.push(checkComplexity(input.stats, complexityFor(input.style)));
  notes.push(checkEmpty(input.pixels));
  if (rules.boundsCheck) notes.push(checkBounds(input.bbox, input.viewBox));
  if (rules.transparentBackground) notes.push(checkTransparentBackground(input.pixels));
  if (rules.seamless) notes.push(checkSeamless(input.pixels));
  if (rules.outline) notes.push(checkOutline(input.stats));
  notes.push(checkSimilarity(phash, input.pool, input.selfId, input.batchMaxHamming));

  return { notes, phash };
}

export function isMetadataNote(note: QcNote): boolean {
  return note.check === "metadata";
}

export type Verdict = { status: QcStatus | "menunggu"; notes: QcNote[] };

/**
 * Combines the visual notes with the metadata checks into the final verdict.
 *  - any failure fails the asset right away, metadata or not;
 *  - without metadata the asset keeps waiting: it cannot be exported yet anyway;
 *  - otherwise "perlu_cek" if anything needs a look, else "lolos".
 */
export function combine(notes: QcNote[], metadata: MetadataFields | null, bannedWords: string[]): Verdict {
  const visual = notes.filter((n) => !isMetadataNote(n));
  const all = metadata ? [...visual, ...checkMetadata(metadata, bannedWords)] : visual;

  if (all.some((n) => n.status === "gagal")) return { status: "gagal", notes: all };
  if (!metadata) return { status: "menunggu", notes: all };
  if (all.some((n) => n.status === "cek")) return { status: "perlu_cek", notes: all };
  return { status: "lolos", notes: all };
}
