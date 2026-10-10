// Adobe Stock rules enforced by the app, kept in one place because Adobe's policy can change
// (CLAUDE.md). Sources, checked 6 Oct 2026:
//   CSV requirements        https://helpx.adobe.com/stock/contributor/manage-your-portfolio/csv-requirements-content.html
//   Vector technical specs  https://helpx.adobe.com/stock/contributor/submit-your-content/submit-vectors/technical-requirements-for-vector-submissions.html
//   Vector design specs     https://helpx.adobe.com/stock/contributor/submit-your-content/submit-vectors/design-requirements-for-vector-submissions.html

export const ADOBE = {
  /** Title: 70 characters, plain text, no commas. */
  titleMaxChars: 70,
  /** Adobe's CSV page says 50, its content guidelines say 49. Stay on the safer number. */
  keywordsMax: 49,
  /** Filename including the extension. */
  filenameMaxChars: 30,
  csvMaxRows: 5000,
  csvMaxBytes: 1_000_000,
  csvHeader: ["Filename", "Title", "Keywords", "Category", "Releases"],
  artboard: {
    minMegapixels: 15,
    maxMegapixels: 65,
    /** Design elements and scenes may be at most 4800 x 4800 px. */
    maxSidePx: 4800,
  },
} as const;

// Photos (stage 12, docs/PLAN-mode-foto.md). Source, checked 10 Oct 2026:
//   Photo technical specs  https://helpx.adobe.com/stock/contributor/submit-your-content/submit-photos/technical-legal-requirements-photo-submission.html
// Filename, title and keyword limits are the same CSV rules as above.
export const ADOBE_PHOTO = {
  minMegapixels: 4,
  maxMegapixels: 100,
  maxFileBytes: 45 * 1024 * 1024,
  /** JPEG with an sRGB profile, no watermark, timestamp, branding, border or text overlay. */
  mimeType: "image/jpeg",
  extension: ".jpg",
} as const;

/** Second box Adobe's portal asks for on AI content showing people or property that do not exist (no CSV column). */
export const FICTIONAL_LABEL = "People and Property are fictional";

// Official category list, in Adobe's order. The page does not show numbers; 1..21 follows that order
// and matches community references, but is NOT confirmed by Adobe yet. Verify it against the
// category dropdown in the Contributor Portal's CSV dialog (stage 6 upload test).
export const ADOBE_CATEGORIES = [
  "Animals",
  "Buildings and architecture",
  "Business",
  "Drinks",
  "The environment",
  "States of mind",
  "Food",
  "Graphic resources",
  "Hobbies and leisure",
  "Industry",
  "Landscape",
  "Lifestyle",
  "People",
  "Plants and flowers",
  "Culture and religion",
  "Science",
  "Social issues",
  "Sports",
  "Technology",
  "Transport",
  "Travel",
] as const;

export type AdobeCategory = (typeof ADOBE_CATEGORIES)[number];

export function categoryNumber(name: string | null | undefined): number | null {
  if (!name) return null;
  const idx = ADOBE_CATEGORIES.findIndex((c) => c.toLowerCase() === name.trim().toLowerCase());
  return idx === -1 ? null : idx + 1;
}

export function normalizeCategory(name: string | null | undefined): AdobeCategory | null {
  const num = categoryNumber(name);
  return num === null ? null : ADOBE_CATEGORIES[num - 1];
}

/** Sensible default when the AI gives no usable category: icons, patterns and backgrounds are "Graphic resources". */
export const DEFAULT_CATEGORY: AdobeCategory = "Graphic resources";

export const AI_LABEL_REMINDER = "Created using generative AI tools";
