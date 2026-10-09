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
  /** Subjects Adobe refused as similar content: the model must not propose them or close variants. */
  avoid?: string[];
  /** One subject drawn many ways instead of a set of different subjects. */
  variations?: boolean;
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

export type ThemeEventInput = { name: string; date: string; weight: number };

export type ThemesInput = {
  /** Human-readable market, e.g. "Indonesia". */
  region: string;
  events: ThemeEventInput[];
  /** Optional focus, e.g. "icons" or "food". */
  category?: string;
  count: number;
};

export type ThemeIdea = {
  title: string;
  /** Name of one of the supplied events, or "" for an evergreen theme. */
  event: string;
  keywords: string[];
  /** The model's rough guess, 0-100. Real data (Trends, Adobe counts) replaces it when available. */
  demandGuess: number;
  competitionGuess: number;
};

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
  generateThemes(
    input: ThemesInput,
  ): Promise<{ themes: ThemeIdea[]; model: string; costIdr?: number; rateLimit?: RateLimit }>;
}
