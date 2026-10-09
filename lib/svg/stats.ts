export type SvgStats = {
  /** Number of <path> elements. */
  pathCount: number;
  /** Paths plus basic shapes; stored in assets.path_count for the stage 3 complexity check. */
  shapeCount: number;
  /** Path commands across all <path d>: a rough count of points, used by the complexity check. */
  pointCount: number;
  hasText: boolean;
  /** Shapes that paint a fill (an outline icon should have almost none). Lines never count: they have no inside. */
  filledShapes: number;
};

const SHAPES = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line"]);

/** The fill a shape really paints: its own attribute or the nearest ancestor's, black when nobody says. */
function effectiveFill(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const own = node.getAttribute("fill");
    if (own) return own.trim().toLowerCase();
    const inline = /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(node.getAttribute("style") ?? "");
    if (inline) return inline[1].trim().toLowerCase();
  }
  return "black";
}

/** Browser only (uses DOMParser). Expects an already sanitized SVG. */
export function analyzeSvg(svg: string): SvgStats {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  let pathCount = 0;
  let shapeCount = 0;
  let pointCount = 0;
  let hasText = false;
  let filledShapes = 0;

  for (const el of Array.from(doc.getElementsByTagName("*"))) {
    const tag = el.localName.toLowerCase();
    if (tag === "path") {
      pathCount += 1;
      pointCount += (el.getAttribute("d")?.match(/[MmLlHhVvCcSsQqTtAaZz]/g) ?? []).length;
    }
    if (SHAPES.has(tag)) {
      shapeCount += 1;
      if (tag !== "line" && !["none", "transparent"].includes(effectiveFill(el))) filledShapes += 1;
    }
    if (tag === "text" || tag === "tspan" || tag === "textpath") hasText = true;
  }
  return { pathCount, shapeCount, pointCount, hasText, filledShapes };
}
