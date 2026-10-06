import { z } from "zod";
import type { Json } from "@/lib/database.types";

export const STYLES = [
  { value: "icon_set", label: "Set ikon flat" },
  { value: "seamless_pattern", label: "Pola seamless" },
  { value: "flat_illustration", label: "Ilustrasi flat sederhana" },
  { value: "badge_label", label: "Badge / label" },
  { value: "abstract_background", label: "Background geometris abstrak" },
] as const;

// Recraft is not listed: it only runs from an explicit button, never as automatic fallback.
export const AUTO_PROVIDERS = [
  { value: "kenari", label: "Kenari" },
  { value: "gemini", label: "Gemini" },
] as const;

export type StyleId = (typeof STYLES)[number]["value"];
export type ProviderEntry = { provider: "kenari" | "gemini"; model: string };
export type Palette = { name: string; colors: string[] };

const styleValues = STYLES.map((s) => s.value) as [string, ...string[]];
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const providerEntrySchema = z.object({
  provider: z.enum(["kenari", "gemini"]),
  model: z.string().trim().max(120, "Nama model terlalu panjang."),
});

export const providerOrderSchema = z
  .array(providerEntrySchema)
  .min(1, "Pilih minimal satu provider.")
  .max(2)
  .refine((list) => new Set(list.map((p) => p.provider)).size === list.length, {
    message: "Provider utama dan cadangan tidak boleh sama.",
  });

const palettesSchema = z
  .array(
    z.object({
      name: z.string().min(1, "Nama palet wajib diisi.").max(40, "Nama palet maksimal 40 karakter."),
      colors: z
        .array(z.string().regex(HEX, "Warna harus berformat hex, mis. #FF6B6B."))
        .min(1, "Setiap palet minimal punya satu warna.")
        .max(12, "Setiap palet maksimal 12 warna."),
    }),
  )
  .max(20, "Maksimal 20 palet.");

export const settingsSchema = z.object({
  provider_order: providerOrderSchema,
  banned_words: z
    .array(z.string().min(1).max(60, "Setiap kata terlarang maksimal 60 karakter."))
    .max(500, "Maksimal 500 kata terlarang."),
  default_style: z.enum(styleValues),
  palettes: palettesSchema,
  recraft_monthly_budget_usd: z
    .number({ error: "Batas biaya harus berupa angka." })
    .min(0, "Batas biaya tidak boleh negatif.")
    .max(10, "Batas biaya Recraft maksimal $10 per bulan."),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

// One word or phrase per line; commas also work. Lowercased and de-duplicated.
export function parseBannedWords(text: string): string[] {
  const words = text
    .split(/[\n,]/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(words)];
}

export function formatBannedWords(words: string[]): string {
  return words.join("\n");
}

// One palette per line: "Name: #AAAAAA, #BBBBBB". A line without a colon becomes a palette with
// no colors, which the schema then rejects with a readable message.
export function parsePalettes(text: string): Palette[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { name: line, colors: [] };
      const name = line.slice(0, idx).trim();
      const colors = line
        .slice(idx + 1)
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      return { name, colors };
    });
}

export function formatPalettes(palettes: Palette[]): string {
  return palettes.map((p) => `${p.name}: ${p.colors.join(", ")}`).join("\n");
}

export function toProviderOrder(value: Json): ProviderEntry[] {
  const parsed = providerOrderSchema.safeParse(value);
  return parsed.success ? parsed.data : [{ provider: "kenari", model: "" }];
}

export function toPalettes(value: Json): Palette[] {
  const parsed = palettesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
