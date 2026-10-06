import type { StyleId } from "@/lib/settings/schema";

export type ProviderId = "kenari" | "gemini" | "recraft";

export type RateLimit = {
  limit?: number;
  remaining?: number;
  /** Epoch milliseconds when the quota window resets. */
  resetAt?: number;
};

export type Concept = {
  subject: string;
  composition: string;
  /** Hex colors picked from the user's palette for this concept. */
  palette: string[];
};

export type ConceptInput = {
  theme: string;
  style: StyleId;
  palette: string[];
  count: number;
};

export type SvgInput = {
  theme: string;
  style: StyleId;
  concept: Concept;
  /** Set on the single automatic retry: what was wrong with the previous attempt. */
  feedback?: string;
};

export type MetadataInput = { theme: string; style: StyleId; concept: string };
/** Raw model output. lib/metadata/postprocess.ts cleans it before it is stored. */
export type AssetMetadata = { title: string; keywords: string[]; category: string; needsRelease: boolean };

export interface SvgProvider {
  id: ProviderId;
  generateConcepts(
    input: ConceptInput,
  ): Promise<{ concepts: Concept[]; model: string; costIdr?: number; rateLimit?: RateLimit }>;
  generateSvg(
    input: SvgInput,
  ): Promise<{ svg: string; model: string; costUsd?: number; costIdr?: number; rateLimit?: RateLimit }>;
  generateMetadata(
    input: MetadataInput,
  ): Promise<{ metadata: AssetMetadata; model: string; costIdr?: number; rateLimit?: RateLimit }>;
}
