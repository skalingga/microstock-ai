import Jimp from "jimp";
import { Potrace } from "potrace";
import type { ImageStyleId } from "@/lib/settings/schema";

// Turns the black-on-white picture of an image model into an editable SVG (stage 7, styles silhouette and
// line_art). Server only: potrace is GPL-2.0, which is fine for code that runs on our server and is never
// shipped to the browser. Revisit before the app is ever distributed as software.

const INK = "#111111";
/** Pixels darker than this (0-255 luminance) are ink. The prompt asks for pure black on pure white. */
const INK_THRESHOLD = 128;
/** Margin around the drawing, as a share of its longer side. */
const MARGIN = 0.06;
/** Canvas shapes the drawing is padded to. Adobe needs 15 MP within 4800 px per side, so nothing wider than 3:2. */
const RATIOS = [1, 3 / 2, 2 / 3];
/** Specks smaller than this many pixels are dropped by potrace. */
const TURD_SIZE = 20;

export type Box = { x: number; y: number; width: number; height: number };
export type TraceResult = { svg: string; width: number; height: number; shapes: number };

export class TraceError extends Error {}

/** Ink mask (1 = dark pixel) of an RGBA bitmap, with transparent pixels treated as white. */
export function inkMask(data: Uint8Array | Buffer, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3] / 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
    mask[i] = lum < INK_THRESHOLD ? 1 : 0;
  }
  return mask;
}

/** Smallest box around the set pixels, or null when the mask is empty. */
export function maskBounds(mask: Uint8Array, width: number, height: number): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Canvas around the drawing: the bounds plus a margin, widened or heightened (centered) to the nearest of
 * 1:1, 3:2 or 2:3 so the export can reach Adobe's minimum artboard. May extend past the source picture.
 */
export function fitCanvas(bounds: Box): Box {
  const pad = Math.round(Math.max(bounds.width, bounds.height) * MARGIN);
  let width = bounds.width + 2 * pad;
  let height = bounds.height + 2 * pad;
  const ratio = width / height;
  const target = RATIOS.reduce((best, r) => (Math.abs(Math.log(ratio / r)) < Math.abs(Math.log(ratio / best)) ? r : best));
  if (ratio < target) width = Math.round(height * target);
  else height = Math.round(width / target);
  return {
    x: Math.round(bounds.x + bounds.width / 2 - width / 2),
    y: Math.round(bounds.y + bounds.height / 2 - height / 2),
    width,
    height,
  };
}

/** Pixels outside the drawing: everything not ink that the picture's border can reach without crossing ink. */
export function backgroundMask(ink: Uint8Array, width: number, height: number): Uint8Array {
  const bg = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!ink[i] && !bg[i]) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < width * (height - 1)) push(i + width);
  }
  return bg;
}

/** Copies the mask into the canvas box (areas outside the source stay empty). */
function cropMask(mask: Uint8Array, width: number, height: number, box: Box): Uint8Array {
  const out = new Uint8Array(box.width * box.height);
  for (let y = 0; y < box.height; y++) {
    const sy = y + box.y;
    if (sy < 0 || sy >= height) continue;
    for (let x = 0; x < box.width; x++) {
      const sx = x + box.x;
      if (sx >= 0 && sx < width) out[y * box.width + x] = mask[sy * width + sx];
    }
  }
  return out;
}

/** Path data of the set pixels, traced with potrace (one path, many subpaths, evenodd). */
async function traceMask(mask: Uint8Array, width: number, height: number): Promise<string> {
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 0;
  }
  const image = new Jimp({ data: rgba, width, height });
  const potrace = new Potrace({ threshold: INK_THRESHOLD, turdSize: TURD_SIZE, optTolerance: 0.4 });
  await new Promise<void>((resolve, reject) =>
    potrace.loadImage(image, (err: Error | null) => (err ? reject(err) : resolve())),
  );
  const tag = potrace.getPathTag(INK);
  return /\sd="([^"]*)"/.exec(tag)?.[1] ?? "";
}

type Subpath = { d: string; box: Box; area: number; polygon: [number, number][] };

/** Splits potrace path data into subpaths, each with its outline polygon (segment end points). */
export function parseSubpaths(d: string): Subpath[] {
  return d
    .split(/(?=M)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const polygon: [number, number][] = [];
      for (const cmd of part.match(/[MLC][^MLCZ]*/g) ?? []) {
        const nums = (cmd.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        // M and L list end points; C lists two control points before each end point.
        const step = cmd[0] === "C" ? 6 : 2;
        for (let i = step - 2; i + 1 < nums.length; i += step) polygon.push([nums[i], nums[i + 1]]);
      }
      const xs = polygon.map((p) => p[0]);
      const ys = polygon.map((p) => p[1]);
      const box = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
      let area = 0;
      for (let i = 0; i < polygon.length; i++) {
        const [x1, y1] = polygon[i];
        const [x2, y2] = polygon[(i + 1) % polygon.length];
        area += x1 * y2 - x2 * y1;
      }
      return { d: roundPath(part), box, area: Math.abs(area) / 2, polygon };
    })
    .filter((s) => s.polygon.length > 0);
}

function inside(point: [number, number], polygon: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function boxContains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Groups subpaths into separate shapes: every outline keeps the holes directly inside it, and an island inside a
 * hole becomes a shape of its own. One <path> per shape is what makes the traced file editable.
 */
export function groupShapes(subpaths: Subpath[]): string[] {
  const sorted = [...subpaths].sort((a, b) => b.area - a.area);
  const depth: number[] = [];
  const parent: number[] = [];
  sorted.forEach((sub, i) => {
    parent[i] = -1;
    // The smallest larger subpath that contains this one is its parent.
    for (let j = i - 1; j >= 0; j--) {
      if (boxContains(sorted[j].box, sub.box) && inside(sub.polygon[0], sorted[j].polygon)) {
        parent[i] = j;
        break;
      }
    }
    depth[i] = parent[i] < 0 ? 0 : depth[parent[i]] + 1;
  });

  const shapes = new Map<number, string[]>();
  sorted.forEach((sub, i) => {
    const owner = depth[i] % 2 === 0 ? i : parent[i];
    shapes.set(owner, [...(shapes.get(owner) ?? []), sub.d]);
  });
  return [...shapes.values()].map((parts) => parts.join(" "));
}

function roundPath(d: string): string {
  return d
    .replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10))
    .replace(/,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Picture (PNG/JPEG/WebP bytes) to SVG. Silhouettes become solid shapes; line art also gets a white fill
 * behind its lines, so the drawing does not turn see-through on a dark background.
 */
export async function traceImage(bytes: Buffer, style: ImageStyleId): Promise<TraceResult> {
  let image: Jimp;
  try {
    image = await Jimp.read(bytes);
  } catch {
    throw new TraceError("Gambar dari model tidak bisa dibaca.");
  }
  const { width, height, data } = image.bitmap;
  const ink = inkMask(data, width, height);
  const bounds = maskBounds(ink, width, height);
  if (!bounds) throw new TraceError("Gambar dari model kosong (tidak ada bagian gelap).");

  const canvas = fitCanvas(bounds);
  const inkPaths = groupShapes(parseSubpaths(await traceMask(cropMask(ink, width, height, canvas), canvas.width, canvas.height)));
  if (inkPaths.length === 0) throw new TraceError("Gambar dari model tidak menghasilkan bentuk vektor.");

  let fillPaths: string[] = [];
  if (style === "line_art") {
    const bg = backgroundMask(ink, width, height);
    const body = new Uint8Array(bg.length);
    for (let i = 0; i < bg.length; i++) body[i] = bg[i] ? 0 : 1;
    fillPaths = groupShapes(parseSubpaths(await traceMask(cropMask(body, width, height, canvas), canvas.width, canvas.height)));
  }

  const path = (d: string, fill: string) => `<path fill="${fill}" fill-rule="evenodd" d="${d}"/>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}">`,
    fillPaths.length > 0 ? `<g id="fill">${fillPaths.map((d) => path(d, "#FFFFFF")).join("")}</g>` : "",
    `<g id="${style === "line_art" ? "lines" : "silhouette"}">${inkPaths.map((d) => path(d, INK)).join("")}</g>`,
    "</svg>",
  ].join("");

  return { svg, width: canvas.width, height: canvas.height, shapes: inkPaths.length + fillPaths.length };
}
