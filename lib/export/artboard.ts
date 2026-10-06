import { ADOBE } from "@/lib/adobe/rules";

export type Artboard = { width: number; height: number; megapixels: number; ok: boolean; reason?: string };

/**
 * Adobe wants an artboard of 15 to 65 megapixels, at most 4800 px per side. The SVG's viewBox has no pixel size
 * of its own, so the export gives the longer side 4800 px and scales the other by the aspect ratio.
 * Very wide or tall shapes cannot reach 15 MP within 4800 px and are reported instead of being exported wrong.
 */
export function artboardFor(viewBoxWidth: number, viewBoxHeight: number): Artboard {
  const { maxSidePx, minMegapixels, maxMegapixels } = ADOBE.artboard;
  const longer = Math.max(viewBoxWidth, viewBoxHeight);
  const width = Math.round((maxSidePx * viewBoxWidth) / longer);
  const height = Math.round((maxSidePx * viewBoxHeight) / longer);
  const megapixels = (width * height) / 1_000_000;

  if (megapixels < minMegapixels) {
    return {
      width,
      height,
      megapixels,
      ok: false,
      reason: `Rasio terlalu ${viewBoxWidth > viewBoxHeight ? "lebar" : "tinggi"}: hanya ${megapixels.toFixed(1)} MP pada sisi terpanjang ${maxSidePx} px (minimal ${minMegapixels} MP).`,
    };
  }
  if (megapixels > maxMegapixels) {
    return { width, height, megapixels, ok: false, reason: `Artboard ${megapixels.toFixed(1)} MP melebihi ${maxMegapixels} MP.` };
  }
  return { width, height, megapixels, ok: true };
}

/** Browser only (DOMParser). Sets width/height on the root element; the drawing itself is untouched. */
export function applyArtboard(svg: string): { svg: string; artboard: Artboard } | null {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  const parts = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n)) || parts[2] <= 0 || parts[3] <= 0) return null;

  const artboard = artboardFor(parts[2], parts[3]);
  root.setAttribute("width", String(artboard.width));
  root.setAttribute("height", String(artboard.height));
  return { svg: new XMLSerializer().serializeToString(root), artboard };
}
