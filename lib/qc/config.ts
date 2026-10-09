// Starting thresholds for the automatic QC. Adobe publishes NO numeric complexity limit for AI vectors,
// so these are educated guesses. They get tuned on real accept/reject data in stage 6 (PRD).

import type { StyleId } from "@/lib/settings/schema";

export const QC = {
  complexity: {
    /** Fewer shapes than this is too bare to sell. */
    minShapes: 3,
    /** More shapes than this needs a human look. */
    warnShapes: 80,
    /** More than this is rejected outright. */
    failShapes: 200,
    /** Path commands (a rough count of points). */
    warnPoints: 2500,
  },
  bounds: {
    /** Content sticking out of the viewBox by this share of its size needs a look... */
    warnOverflow: 0.03,
    /** ...and by this share it is rejected (shape cut off by the canvas). */
    failOverflow: 0.15,
  },
  /** Share of opaque pixels below which the asset counts as empty. */
  emptyRatio: 0.005,
  /** Share of the border that may be opaque on a "transparent background" asset. */
  borderOpaqueMax: 0.02,
  similarity: {
    /** Perceptual hash (64 bit): at most this many differing bits counts as "looks the same". */
    maxHamming: 8,
    /** Same, between assets of one "one subject, many variations" batch: they are alike on purpose, so only near copies count. */
    maxHammingVariations: 3,
  },
  outline: {
    /** Share of shapes that may carry a fill on an outline icon (an eye or a dot) before it needs a look. */
    maxFilledShare: 0.25,
  },
  tile: {
    /** Seam mismatch relative to the strongest edge inside the tile; above this the tile does not join. */
    maxSeamScore: 1.5,
    /** Seam mismatch below this share of the edge is noise, whatever the score. */
    minSeamRate: 0.05,
  },
  /** Render size for pixel checks (long side). */
  renderSize: 256,
} as const;

/** Which checks apply to which style. */
export const STYLE_RULES: Record<StyleId, { transparentBackground: boolean; seamless: boolean; boundsCheck: boolean; outline?: boolean }> = {
  icon_set: { transparentBackground: true, seamless: false, boundsCheck: true },
  seamless_pattern: { transparentBackground: false, seamless: true, boundsCheck: false },
  flat_illustration: { transparentBackground: false, seamless: false, boundsCheck: true },
  badge_label: { transparentBackground: false, seamless: false, boundsCheck: true },
  abstract_background: { transparentBackground: false, seamless: false, boundsCheck: false },
  silhouette: { transparentBackground: true, seamless: false, boundsCheck: true },
  line_art: { transparentBackground: true, seamless: false, boundsCheck: true },
  // Stage 10. The tile is a full-canvas square, so it has a background of its own.
  line_icon: { transparentBackground: true, seamless: false, boundsCheck: true, outline: true },
  glyph_icon: { transparentBackground: true, seamless: false, boundsCheck: true },
  geometric_tile: { transparentBackground: false, seamless: false, boundsCheck: true },
};

export type ComplexityLimits = { minShapes: number; warnShapes: number; failShapes: number; warnPoints: number };

// Traced styles differ from hand-written SVG: one bat is a single shape, and line art has many small pieces.
// Starting guesses, to be tuned on Adobe's decisions like the rest (stage 6).
const COMPLEXITY_OVERRIDES: Partial<Record<StyleId, Partial<ComplexityLimits>>> = {
  silhouette: { minShapes: 1 },
  line_art: { warnShapes: 150, failShapes: 300, warnPoints: 4000 },
  // An icon is one symbol: a handful of shapes. Starting guesses, to be tuned on Adobe's decisions (stage 6).
  line_icon: { minShapes: 1, warnShapes: 40, failShapes: 100, warnPoints: 1200 },
  glyph_icon: { minShapes: 1, warnShapes: 40, failShapes: 100, warnPoints: 1200 },
};

export function complexityFor(style: StyleId): ComplexityLimits {
  return { ...QC.complexity, ...COMPLEXITY_OVERRIDES[style] };
}

// Titles must not imply a real news event (Adobe clarification). The AI is told too; this is the safety net.
export const NEWS_WORDS = [
  "breaking news",
  "news",
  "election",
  "protest",
  "riot",
  "war",
  "attack",
  "shooting",
  "pandemic",
  "covid",
  "lockdown",
  "terror",
  "crash",
  "earthquake",
  "hurricane",
  "flood",
];
