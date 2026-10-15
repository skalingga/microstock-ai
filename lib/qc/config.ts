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
    /** Backgrounds (smooth gradients, bokeh, textures) have little structure, so unrelated ones hash close: only near copies count. */
    maxHammingBackground: 3,
    /**
     * Raster illustrations, mostly icon sheets: six icons on white in the same 3 by 2 layout hash 6 to 7 bits apart
     * though nothing alike (15 Oct 2026, 3 of 9 sheets flagged by mistake). A re-render of one sheet is within 2 bits.
     */
    maxHammingIllustration: 4,
    /**
     * Differing bits as a share of the bits set in either hash. A small object on an empty canvas sets only 10 to 25 of
     * the 64 bits, so unrelated pictures sit 4 to 8 bits apart (15 Oct 2026: an isometric solar farm "matched" a
     * retro car). Those are 0.25 to 0.5 of the set bits; a real near copy is well under 0.2.
     */
    maxRelative: 0.2,
  },
  /**
   * Icon sheets must sit on one white field. Flow sometimes returns light gray with floor shadows and panel seams
   * (15 Oct 2026, sheet "workshop tools", mean border about 239) that Adobe refuses and the vision model does not report.
   */
  sheetBackground: {
    /** Share of the image side, on every edge, that is sampled as "the background". */
    borderFraction: 0.02,
    /** Each channel of the mean border color must reach this (0-255). Flow's white comes back as 250 to 255. */
    minChannel: 244,
    /** Largest gap between the red, green and blue means (a bluish or warm tint). */
    maxSpread: 8,
  },
  outline: {
    /** Share of shapes that may carry a fill on an outline icon (an eye or a dot) before it needs a look. */
    maxFilledShare: 0.25,
  },
  frame: {
    /** Side of the central square (share of the canvas side) that a frame must leave empty. */
    centerFraction: 0.5,
    /** Share of that square that may be opaque (stray specks) before it needs a look... */
    centerOpaqueMax: 0.02,
    /** ...and above this share it is not a frame at all. */
    centerFailShare: 0.3,
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
export const STYLE_RULES: Record<
  StyleId,
  { transparentBackground: boolean; seamless: boolean; boundsCheck: boolean; outline?: boolean; copySpace?: boolean }
> = {
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
  // Stage 14 wave 1. A frame's decoration may sit right at the edge, so only its empty center is checked.
  sticker: { transparentBackground: true, seamless: false, boundsCheck: true },
  isometric: { transparentBackground: true, seamless: false, boundsCheck: true },
  frame: { transparentBackground: false, seamless: false, boundsCheck: true, copySpace: true },
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
  // Stage 14 wave 1: starting guesses, to be tuned on Adobe's decisions (stage 6).
  sticker: { warnShapes: 60, failShapes: 150, warnPoints: 2000 },
  isometric: { warnShapes: 100, failShapes: 220, warnPoints: 3500 },
  frame: { minShapes: 4, warnShapes: 110, failShapes: 240, warnPoints: 3500 },
};

export function complexityFor(style: StyleId): ComplexityLimits {
  return { ...QC.complexity, ...COMPLEXITY_OVERRIDES[style] };
}

/** A bundle holds many assets in one file: every limit grows with the number of members. */
export function scaleLimits(limits: ComplexityLimits, members: number): ComplexityLimits {
  const n = Math.max(1, members);
  return {
    minShapes: limits.minShapes * n,
    warnShapes: limits.warnShapes * n,
    failShapes: limits.failShapes * n,
    warnPoints: limits.warnPoints * n,
  };
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
