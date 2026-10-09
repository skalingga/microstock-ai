// Subjects Adobe refused as "similar content": Adobe compares with its whole collection, which we cannot see,
// so the only signal we have is our own rejections. Pure helpers; the database read is in ./fetch.ts.

/** Words that describe the style or phrasing, not the subject. */
const FILLER = new Set([
  "a", "an", "the", "of", "with", "and", "in", "on", "for", "to", "at", "by", "from", "its", "his", "her",
  "black", "white", "line", "lines", "art", "vector", "vectors", "illustration", "illustrations", "icon", "icons",
  "silhouette", "silhouettes", "set", "style", "styled", "simple", "flat", "single", "one", "two", "three", "outline",
  "drawing", "design", "graphic", "solid", "bold", "clean", "minimal", "minimalist", "stock", "clipart",
]);

/** Plural and simple endings: "cones" -> "cone", "berries" -> "berry". Good enough to match names, not a stemmer. */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** The words that identify the subject, sorted and without duplicates. */
export function subjectTokens(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 1)
    .map(singular)
    .filter((w) => !FILLER.has(w));
  return [...new Set(words)].sort();
}

/** assets.concept is "subject. composition." (see describeConcept); this is the subject part. */
export function subjectOf(concept: string | null | undefined): string {
  const text = (concept ?? "").trim();
  const end = text.indexOf(". ");
  return (end === -1 ? text : text.slice(0, end)).replace(/[\s.]+$/, "");
}

/** Same subject when one set of words contains the other ("horse" overlaps "galloping wild horse"). */
export function subjectsOverlap(a: string, b: string): boolean {
  const left = subjectTokens(a);
  const right = subjectTokens(b);
  if (left.length === 0 || right.length === 0) return false;
  const [small, large] = left.length <= right.length ? [left, right] : [right, left];
  return small.every((token) => large.includes(token));
}

export type SaturatedSubject = { subject: string; count: number };

/** An Adobe reason that means "too similar", whichever way it was copied or typed. */
export function isSimilarReason(reason: string | null | undefined): boolean {
  return /similar|serupa|mirip/i.test(reason ?? "");
}

/** Rejected-as-similar assets, grouped by subject, most often refused first. */
export function buildSaturated(rows: { concept: string | null; adobeReason: string | null }[]): SaturatedSubject[] {
  const groups = new Map<string, SaturatedSubject>();
  for (const row of rows) {
    if (!isSimilarReason(row.adobeReason)) continue;
    const subject = subjectOf(row.concept);
    const key = subjectTokens(subject).join(" ");
    if (!key) continue;
    const entry = groups.get(key) ?? { subject, count: 0 };
    entry.count += 1;
    groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
}

/** The saturated subjects a theme or concept text runs into. */
export function matchSaturated(text: string, saturated: SaturatedSubject[]): SaturatedSubject[] {
  return saturated.filter((s) => subjectsOverlap(text, s.subject));
}

/** Longest list sent to the model: more only dilutes the prompt. */
export const MAX_AVOID = 20;
