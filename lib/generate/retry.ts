import type { QcCheckId, QcNote } from "@/lib/qc/types";

// One automatic retry for an SVG that failed QC. The failing checks become short English instructions
// for the model (prompts to the AI are in English). Checks that a new drawing cannot fix, such as
// similarity or metadata, are not listed, and they never fail an asset on their own anyway.

const FEEDBACK: Partial<Record<QcCheckId, string>> = {
  teks: "It contained <text> elements; use only shapes, never text.",
  kerumitan: "It had far too many shapes; simplify to a few bold shapes (under 60 in total).",
  kanvas: "Shapes were cut off by the canvas; keep every shape fully inside the viewBox.",
  kosong: "It was empty or almost invisible; draw clearly visible filled shapes.",
  latar: "It had an opaque background; leave the background transparent with no full-size backdrop shape.",
  pola: "The tile did not join at the seams; every shape crossing an edge must be repeated exactly on the opposite edge (left and right, top and bottom), and corner shapes on all four corners.",
};

/** What to tell the model after a failed QC, or null when no failing check is something a retry can fix. */
export function retryFeedback(notes: QcNote[]): string | null {
  const lines = notes
    .filter((n) => n.status === "gagal")
    .map((n) => FEEDBACK[n.check])
    .filter((line): line is string => Boolean(line));
  return lines.length > 0 ? [...new Set(lines)].join(" ") : null;
}
