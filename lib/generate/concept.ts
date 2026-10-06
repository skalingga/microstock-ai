import type { Concept } from "@/lib/providers/types";

const trimEnd = (text: string) => text.trim().replace(/[\s.,;:!]+$/, "");

/** One-line description stored in assets.concept (reused for AI metadata in stage 3). */
export function describeConcept(concept: Pick<Concept, "subject" | "composition">): string {
  return `${trimEnd(concept.subject)}. ${trimEnd(concept.composition)}.`;
}
