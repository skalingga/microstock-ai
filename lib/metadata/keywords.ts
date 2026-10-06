/** Keywords are edited as free text: one per line or separated by commas. Lowercased, de-duplicated, in order. */
export function parseKeywordText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const keyword = raw.trim().toLowerCase();
    if (keyword && !seen.has(keyword)) {
      seen.add(keyword);
      out.push(keyword);
    }
  }
  return out.slice(0, 200);
}

export function formatKeywordText(keywords: string[]): string {
  return keywords.join("\n");
}
