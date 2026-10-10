import { z } from "zod";
import { MAX_PHOTO_PROMPTS, PHOTO_ASPECTS, VISION_MAX_DATA_URL } from "@/lib/photo/config";
import { STYLES } from "@/lib/settings/schema";

export const MAX_VARIATIONS = 30;

const styleValues = STYLES.map((s) => s.value) as [string, ...string[]];
const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Warna harus berformat hex.");

const theme = z.string().trim().min(2, "Tema minimal 2 karakter.").max(120, "Tema maksimal 120 karakter.");
const style = z.enum(styleValues);

export const conceptsRequestSchema = z.object({
  theme,
  style,
  palette: z.array(hex).max(12).default([]),
  count: z.number().int().min(1, "Jumlah variasi minimal 1.").max(MAX_VARIATIONS, `Jumlah variasi maksimal ${MAX_VARIATIONS}.`),
  avoid: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  /** One subject drawn many ways (pose, detail, pattern) instead of a set of different subjects. */
  variations: z.boolean().default(false),
});

// Model ids look like "deepseek-v4-flash", "vendor/model:free" (Kenari) or "gemini-3.5-flash".
export const modelId = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/, "Nama model tidak valid.");

export const svgRequestSchema = z.object({
  theme,
  style,
  concept: z.object({
    subject: z.string().trim().min(1).max(200),
    composition: z.string().trim().min(1).max(300),
    palette: z.array(hex).max(5),
  }),
  feedback: z.string().trim().max(600).optional(),
  /** Model picked on the Generate page; when set it is used alone, with no silent fallback. */
  model: modelId.optional(),
  /** Which provider the picked model belongs to; Kenari when left out. */
  modelProvider: z.enum(["kenari", "gemini"]).optional(),
});

export type ConceptsRequest = z.infer<typeof conceptsRequestSchema>;
export type SvgRequest = z.infer<typeof svgRequestSchema>;

export const metadataRequestSchema = z.object({
  theme,
  style,
  concept: z.string().trim().min(1, "Deskripsi konsep kosong.").max(500, "Deskripsi konsep terlalu panjang."),
});

export type MetadataRequest = z.infer<typeof metadataRequestSchema>;

// Stage 12: photos made by hand in Google Flow.
export const photoPromptsRequestSchema = z.object({
  theme,
  count: z.number().int().min(1, "Jumlah prompt minimal 1.").max(MAX_PHOTO_PROMPTS, `Jumlah prompt maksimal ${MAX_PHOTO_PROMPTS}.`),
  aspect: z.enum(PHOTO_ASPECTS),
  avoid: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  variations: z.boolean().default(false),
});

export const photoMetadataRequestSchema = z.object({
  theme,
  prompt: z.string().trim().max(1500, "Prompt terlalu panjang.").optional(),
  image: z
    .string()
    .max(VISION_MAX_DATA_URL, "Gambar untuk metadata terlalu besar.")
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, "Gambar untuk metadata harus JPEG base64."),
});

export type PhotoPromptsRequest = z.infer<typeof photoPromptsRequestSchema>;
export type PhotoMetadataRequest = z.infer<typeof photoMetadataRequestSchema>;
