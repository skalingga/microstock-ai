export type SvgStats = {
  /** Number of <path> elements. */
  pathCount: number;
  /** Paths plus basic shapes; stored in assets.path_count for the stage 3 complexity check. */
  shapeCount: number;
  /** Path commands across all <path d>: a rough count of points, used by the complexity check. */
  pointCount: number;
  hasText: boolean;
};

const SHAPES = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line"]);

/** Browser only (uses DOMParser). Expects an already sanitized SVG. */
export function analyzeSvg(svg: string): SvgStats {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  let pathCount = 0;
  let shapeCount = 0;
  let pointCount = 0;
  let hasText = false;

  for (const el of Array.from(doc.getElementsByTagName("*"))) {
    const tag = el.localName.toLowerCase();
    if (tag === "path") {
      pathCount += 1;
      pointCount += (el.getAttribute("d")?.match(/[MmLlHhVvCcSsQqTtAaZz]/g) ?? []).length;
    }
    if (SHAPES.has(tag)) shapeCount += 1;
    if (tag === "text" || tag === "tspan" || tag === "textpath") hasText = true;
  }
  return { pathCount, shapeCount, pointCount, hasText };
}
