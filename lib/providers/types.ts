import type { PhotoAspect, PhotoProblem } from "@/lib/photo/config";
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

// Stage 12: photos are made by hand in Google Flow; the AI only writes their prompts and their metadata.
export type PhotoPromptsInput = {
  theme: string;
  count: number;
  aspect: PhotoAspect;
  avoid?: string[];
  /** One subject shown many ways instead of a set of different scenes. */
  variations?: boolean;
};
export type PhotoPrompt = { subject: string; prompt: string };

export type PhotoMetadataInput = {
  theme: string;
  /** The prompt the photo was made from, when the user matched the file to one. */
  prompt?: string;
  /** Small JPEG copy of the photo as a data URL (data:image/jpeg;base64,...). */
  image: string;
};
export type PhotoMetadata = AssetMetadata & { hasPeople: boolean; problems: PhotoProblem[] };

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
  generatePhotoPrompts(
    input: PhotoPromptsInput,
  ): Promise<{ prompts: PhotoPrompt[]; model: string; costIdr?: number; rateLimit?: RateLimit }>;
  /** Needs a model that reads images (see visionOrder in lib/providers/index.ts). */
  generatePhotoMetadata(
    input: PhotoMetadataInput,
  ): Promise<{ metadata: PhotoMetadata; model: string; costIdr?: number; rateLimit?: RateLimit }>;
}
