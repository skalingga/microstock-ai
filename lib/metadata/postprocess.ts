import { ADOBE, DEFAULT_CATEGORY, normalizeCategory } from "@/lib/adobe/rules";
import type { AssetMetadata } from "@/lib/providers/types";
import { findBannedWords } from "@/lib/settings/banned";
import type { StyleId } from "@/lib/settings/schema";

// The AI is asked for clean metadata but does not always deliver it. This tidies what it can and
// reports what it had to drop. Anything left over is caught by the QC metadata check.

const MAX_KEYWORD_CHARS = 40;
const MAX_KEYWORD_WORDS = 4;

/** Plain text, no commas or special characters, cut to Adobe's limit at a word boundary. */
export function cleanTitle(raw: string): string {
  const plain = raw
    .replace(/[,;:"“”‘’<>|\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= ADOBE.titleMaxChars) return plain;

  const cut = plain.slice(0, ADOBE.titleMaxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > ADOBE.titleMaxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trim();
}

// Safety net for the prompt rule that forbids "icon" words. The app has no icon mode, and Adobe reserves the
// icon label for interface symbols, so these words in the metadata would mislead buyers.
const UI_WORD = /\b(icons?|pictograms?|glyphs?)\b/i;
const TRAILING_CONNECTOR = /\s+(a|an|the|with|and|for|of|in|on|to)$/i;

/** Removes interface-symbol words from a title and keeps it readable: "Halloween icon set with a bat" becomes "Halloween set with a bat". */
export function stripIconWords(title: string): string {
  const stripped = title
    .replace(/\bicon\s+sets?\b/gi, "set")
    .replace(/\b(icons?|pictograms?|glyphs?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_CONNECTOR, "")
    .trim();
  // A title that was nothing but the word itself is better left alone than emptied.
  return stripped || title;
}

export function cleanKeywords(
  raw: string[],
  bannedWords: string[],
): { keywords: string[]; dropped: { banned: number; invalid: number; overLimit: number; misleading: number } } {
  const seen = new Set<string>();
  const keywords: string[] = [];
  const dropped = { banned: 0, invalid: 0, overLimit: 0, misleading: 0 };

  for (const item of raw) {
    const keyword = String(item)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!keyword || keyword.length > MAX_KEYWORD_CHARS || keyword.split(" ").length > MAX_KEYWORD_WORDS) {
      if (keyword) dropped.invalid += 1;
      continue;
    }
    if (seen.has(keyword)) continue;
    seen.add(keyword);

    if (findBannedWords(keyword, bannedWords).length > 0) {
      dropped.banned += 1;
      continue;
    }
    if (UI_WORD.test(keyword)) {
      dropped.misleading += 1;
      continue;
    }
    if (keywords.length >= ADOBE.keywordsMax) {
      dropped.overLimit += 1;
      continue;
    }
    keywords.push(keyword);
  }
  return { keywords, dropped };
}

// Adobe files icons, patterns, backgrounds and badge/label sets under Graphic resources, whatever they depict.
const GRAPHIC_STYLES: StyleId[] = ["icon_set", "seamless_pattern", "abstract_background", "badge_label"];

export type CleanMetadata = {
  title: string;
  keywords: string[];
  category: string;
  needsRelease: boolean;
};

export function normalizeMetadata(
  raw: AssetMetadata,
  bannedWords: string[],
  style?: StyleId,
): { metadata: CleanMetadata; notes: string[] } {
  const notes: string[] = [];

  const cleaned = cleanTitle(raw.title);
  const title = cleanTitle(stripIconWords(cleaned));
  if (title !== raw.title.trim()) notes.push("judul dirapikan");
  if (title !== cleaned) notes.push("kata icon dibuang dari judul");

  const { keywords, dropped } = cleanKeywords(raw.keywords, bannedWords);
  if (dropped.banned > 0) notes.push(`${dropped.banned} keyword terlarang dibuang`);
  if (dropped.invalid > 0) notes.push(`${dropped.invalid} keyword tidak valid dibuang`);
  if (dropped.overLimit > 0) notes.push(`${dropped.overLimit} keyword melebihi batas dibuang`);
  if (dropped.misleading > 0) notes.push(`${dropped.misleading} keyword bertema icon dibuang`);

  let category = normalizeCategory(raw.category);
  if (style && GRAPHIC_STYLES.includes(style) && category !== DEFAULT_CATEGORY) {
    if (category) notes.push(`kategori ${category} diganti ${DEFAULT_CATEGORY} untuk gaya ini`);
    category = DEFAULT_CATEGORY;
  }
  if (!category) {
    category = DEFAULT_CATEGORY;
    notes.push(`kategori "${raw.category}" tidak dikenal, diganti ${DEFAULT_CATEGORY}`);
  }

  return { metadata: { title, keywords, category, needsRelease: raw.needsRelease }, notes };
}
