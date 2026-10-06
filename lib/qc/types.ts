import type { Json } from "@/lib/database.types";

export type NoteStatus = "ok" | "cek" | "gagal";

export type QcCheckId =
  | "validitas"
  | "sanitasi"
  | "teks"
  | "kerumitan"
  | "kanvas"
  | "kosong"
  | "latar"
  | "pola"
  | "kemiripan"
  | "metadata";

/** One line of QC feedback, stored as-is in assets.qc_notes. */
export type QcNote = { check: QcCheckId; status: NoteStatus; message: string };

/** Final verdict. An asset with no verdict yet keeps the database status "menunggu". */
export type QcStatus = "lolos" | "perlu_cek" | "gagal";

export type Box = { x: number; y: number; width: number; height: number };

/** RGBA pixels, row by row, as returned by canvas getImageData. */
export type Pixels = { data: Uint8ClampedArray | number[]; width: number; height: number };

export type MetadataFields = {
  title: string | null;
  keywords: string[];
  category: string | null;
  needsRelease: boolean;
};

export type HashPoolEntry = { id: string; phash: string | null };

const CHECK_IDS: QcCheckId[] = [
  "validitas",
  "sanitasi",
  "teks",
  "kerumitan",
  "kanvas",
  "kosong",
  "latar",
  "pola",
  "kemiripan",
  "metadata",
];

/** Reads assets.qc_notes back into typed notes, ignoring anything malformed. */
export function parseNotes(value: Json | undefined): QcNote[] {
  if (!Array.isArray(value)) return [];
  const notes: QcNote[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const { check, status, message } = item as Record<string, Json>;
      if (
        typeof check === "string" &&
        CHECK_IDS.includes(check as QcCheckId) &&
        (status === "ok" || status === "cek" || status === "gagal") &&
        typeof message === "string"
      ) {
        notes.push({ check: check as QcCheckId, status, message });
      }
    }
  }
  return notes;
}
