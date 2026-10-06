import type { Pixels } from "./types";

// Perceptual "difference hash" (dHash): shrink the picture to 9x8 grey cells and record, for each cell,
// whether it is brighter than its right neighbour. Similar pictures give hashes a few bits apart.

/** Grey values 0..255, with transparency composited on white (an icon on transparent == an icon on white). */
export function grayOnWhite(p: Pixels): Float32Array {
  const out = new Float32Array(p.width * p.height);
  for (let i = 0; i < out.length; i++) {
    const a = p.data[i * 4 + 3] / 255;
    const r = p.data[i * 4] * a + 255 * (1 - a);
    const g = p.data[i * 4 + 1] * a + 255 * (1 - a);
    const b = p.data[i * 4 + 2] * a + 255 * (1 - a);
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

/** Box-average downscale. */
export function downscale(gray: Float32Array, width: number, height: number, tw: number, th: number): Float32Array {
  const out = new Float32Array(tw * th);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * height) / th);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * width) / tw);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / tw));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        for (let x = x0; x < x1 && x < width; x++) {
          sum += gray[y * width + x];
          n += 1;
        }
      }
      out[ty * tw + tx] = n > 0 ? sum / n : 255;
    }
  }
  return out;
}

/** 64-bit dHash as 16 hex characters. */
export function dHash(p: Pixels): string {
  const small = downscale(grayOnWhite(p), p.width, p.height, 9, 8);
  let hex = "";
  let nibble = 0;
  let bits = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      nibble = (nibble << 1) | (small[y * 9 + x] > small[y * 9 + x + 1] ? 1 : 0);
      bits += 1;
      if (bits === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }
  return hex;
}

const POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Number of differing bits between two hex hashes of equal length. */
export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    distance += POPCOUNT[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  }
  return distance;
}
