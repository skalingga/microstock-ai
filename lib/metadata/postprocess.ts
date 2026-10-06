import { ADOBE, DEFAULT_CATEGORY, normalizeCategory } from "@/lib/adobe/rules";
import type { AssetMetadata } from "@/lib/providers/types";
import { findBannedWords } from "@/lib/settings/banned";

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

export function cleanKeywords(
  raw: string[],
  bannedWords: string[],
): { keywords: string[]; dropped: { banned: number; invalid: number; overLimit: number } } {
  const seen = new Set<string>();
  const keywords: string[] = [];
  const dropped = { banned: 0, invalid: 0, overLimit: 0 };

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
    if (keywords.length >= ADOBE.keywordsMax) {
      dropped.overLimit += 1;
      continue;
    }
    keywords.push(keyword);
  }
  return { keywords, dropped };
}

export type CleanMetadata = {
  title: string;
  keywords: string[];
  category: string;
  needsRelease: boolean;
};

export function normalizeMetadata(raw: AssetMetadata, bannedWords: string[]): { metadata: CleanMetadata; notes: string[] } {
  const notes: string[] = [];

  const title = cleanTitle(raw.title);
  if (title !== raw.title.trim()) notes.push("judul dirapikan");

  const { keywords, dropped } = cleanKeywords(raw.keywords, bannedWords);
  if (dropped.banned > 0) notes.push(`${dropped.banned} keyword terlarang dibuang`);
  if (dropped.invalid > 0) notes.push(`${dropped.invalid} keyword tidak valid dibuang`);
  if (dropped.overLimit > 0) notes.push(`${dropped.overLimit} keyword melebihi batas dibuang`);

  let category = normalizeCategory(raw.category);
  if (!category) {
    category = DEFAULT_CATEGORY;
    notes.push(`kategori "${raw.category}" tidak dikenal, diganti ${DEFAULT_CATEGORY}`);
  }

  return { metadata: { title, keywords, category, needsRelease: raw.needsRelease }, notes };
}
