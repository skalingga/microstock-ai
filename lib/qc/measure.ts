import { rasterizeSvg } from "@/lib/svg/preview";
import { analyzeSvg, type SvgStats } from "@/lib/svg/stats";
import { QC } from "./config";
import type { Box, Pixels } from "./types";

// Browser only: everything that needs a real renderer. The judging itself is in evaluate.ts.

export type Measurements = {
  stats: SvgStats;
  viewBox: Box;
  /** Bounding box of everything drawn, in the SVG's own coordinates. null when it cannot be measured. */
  bbox: Box | null;
  pixels: Pixels;
};

function parseViewBox(root: Element): Box | null {
  const parts = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n)) || parts[2] <= 0 || parts[3] <= 0) return null;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

function measureBBox(root: Element): Box | null {
  // getBBox needs the element to be in the document. Park it far off screen, then remove it again.
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;width:0;height:0;overflow:hidden;visibility:hidden";
  const el = document.importNode(root, true) as unknown as SVGSVGElement;
  el.setAttribute("width", "100");
  el.setAttribute("height", "100");
  host.appendChild(el);
  document.body.appendChild(host);
  try {
    const b = el.getBBox();
    if (b.width === 0 && b.height === 0) return null;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  } catch {
    return null;
  } finally {
    host.remove();
  }
}

export async function measureSvg(svg: string, size: number = QC.renderSize): Promise<Measurements> {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  const viewBox = parseViewBox(root);
  if (!viewBox) throw new Error("SVG tidak punya viewBox yang valid.");

  const canvas = await rasterizeSvg(svg, size);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas tidak tersedia.");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    stats: analyzeSvg(svg),
    viewBox,
    bbox: measureBBox(root),
    pixels: { data: image.data, width: image.width, height: image.height },
  };
}
