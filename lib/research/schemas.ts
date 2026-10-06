import { z } from "zod";
import { REGIONS } from "./calendar";

const regionValues = REGIONS.map((r) => r.value) as [string, ...string[]];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD.");

export const MAX_THEMES = 15;
export const MAX_PERIOD_DAYS = 366;

export const themesRequestSchema = z
  .object({
    region: z.enum(regionValues),
    periodStart: day,
    periodEnd: day,
    category: z.string().trim().max(60, "Kategori maksimal 60 karakter.").optional(),
    count: z.number().int().min(1).max(MAX_THEMES, `Jumlah tema maksimal ${MAX_THEMES}.`),
  })
  .refine((v) => v.periodEnd >= v.periodStart, { message: "Akhir periode harus setelah awal periode." })
  .refine(
    (v) => (Date.parse(v.periodEnd) - Date.parse(v.periodStart)) / 86_400_000 <= MAX_PERIOD_DAYS,
    { message: "Periode maksimal 12 bulan." },
  );

export const trendsRequestSchema = z.object({
  region: z.enum(regionValues),
  terms: z.array(z.string().trim().min(2).max(80)).min(1).max(4),
});

export type ThemesRequest = z.infer<typeof themesRequestSchema>;
