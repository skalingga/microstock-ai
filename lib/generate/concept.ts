import type { Concept } from "@/lib/providers/types";

const trimEnd = (text: string) => text.trim().replace(/[\s.,;:!]+$/, "");

/** One-line description stored in assets.concept (reused for AI metadata in stage 3). */
export function describeConcept(concept: Pick<Concept, "subject" | "composition">): string {
  return `${trimEnd(concept.subject)}. ${trimEnd(concept.composition)}.`;
}

/**
 * Keeps a batch visually one set: every concept may only use colors from the chosen palette. A concept that
 * kept fewer than two of them (the model went off palette) falls back to the whole palette.
 */
export function unifyPalettes(concepts: Concept[], available: string[]): Concept[] {
  if (available.length === 0) return concepts;
  const allowed = new Map(available.map((color) => [color.toLowerCase(), color]));
  return concepts.map((concept) => {
    const kept = [...new Set(concept.palette.map((c) => c.toLowerCase()))]
      .filter((c) => allowed.has(c))
      .map((c) => allowed.get(c)!);
    return { ...concept, palette: kept.length >= 2 ? kept : available.slice(0, 5) };
  });
}
