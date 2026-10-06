import { QC } from "./config";
import type { Pixels } from "./types";

// Seamless-pattern test. Tiling the picture 2x2 puts its left edge next to its right edge and its top
// edge next to its bottom edge. The seam is fine when it looks like some edge that already exists
// inside the pattern, and broken when it is a stronger edge than anything the pattern itself draws.
//
// Example: a half circle cut off at the tile border makes a long straight edge exactly on the seam,
// longer than any edge inside the tile. A stripe or checkerboard pattern has the same strong edge
// inside the tile too, so its seam passes.
//
// This is a heuristic, tuned in stage 6. The asset page also shows the 2x2 tile for a human to judge.

const CHANNEL_DELTA = 48; // sum of |dR|+|dG|+|dB|+|dA| above which two pixels count as different

function differs(p: Pixels, i: number, j: number): boolean {
  const d =
    Math.abs(p.data[i * 4] - p.data[j * 4]) +
    Math.abs(p.data[i * 4 + 1] - p.data[j * 4 + 1]) +
    Math.abs(p.data[i * 4 + 2] - p.data[j * 4 + 2]) +
    Math.abs(p.data[i * 4 + 3] - p.data[j * 4 + 3]);
  return d > CHANNEL_DELTA;
}

export type SeamResult = {
  /** Worst share of mismatching pixel pairs on a seam (left-right or top-bottom). */
  wrapRate: number;
  /** Strongest ordinary edge inside the tile, measured the same way. */
  refRate: number;
  /** wrapRate relative to refRate, per axis, worst of the two. 1 means "as strong as the strongest inner edge". */
  score: number;
};

export function seamScore(p: Pixels): SeamResult {
  const { width: w, height: h } = p;

  let wrapH = 0;
  for (let y = 0; y < h; y++) if (differs(p, y * w, y * w + (w - 1))) wrapH += 1;
  wrapH /= h;

  let wrapV = 0;
  for (let x = 0; x < w; x++) if (differs(p, x, (h - 1) * w + x)) wrapV += 1;
  wrapV /= w;

  let maxRefH = 0;
  for (let x = 0; x < w - 1; x++) {
    let n = 0;
    for (let y = 0; y < h; y++) if (differs(p, y * w + x, y * w + x + 1)) n += 1;
    maxRefH = Math.max(maxRefH, n / h);
  }

  let maxRefV = 0;
  for (let y = 0; y < h - 1; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (differs(p, y * w + x, (y + 1) * w + x)) n += 1;
    maxRefV = Math.max(maxRefV, n / w);
  }

  const floor = 0.02;
  return {
    wrapRate: Math.max(wrapH, wrapV),
    refRate: Math.max(maxRefH, maxRefV),
    score: Math.max(wrapH / Math.max(maxRefH, floor), wrapV / Math.max(maxRefV, floor)),
  };
}

export function seamsOk(result: SeamResult): boolean {
  return result.wrapRate < QC.tile.minSeamRate || result.score <= QC.tile.maxSeamScore;
}
