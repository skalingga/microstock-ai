"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  parseBannedWords,
  parsePalettes,
  settingsSchema,
  type ProviderEntry,
} from "@/lib/settings/schema";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function simpanPengaturan(formData: FormData): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };

  const providerOrder: ProviderEntry[] = [];
  for (const slot of ["primary", "backup"] as const) {
    const provider = formData.get(`${slot}_provider`);
    if (provider === "kenari" || provider === "gemini") {
      providerOrder.push({
        provider,
        model: String(formData.get(`${slot}_model`) ?? "").trim(),
      });
    }
  }

  const parsed = settingsSchema.safeParse({
    provider_order: providerOrder,
    banned_words: parseBannedWords(String(formData.get("banned_words") ?? "")),
    default_style: formData.get("default_style"),
    palettes: parsePalettes(String(formData.get("palettes") ?? "")),
    kenari_text_model: String(formData.get("kenari_text_model") ?? ""),
    kenari_image_model: String(formData.get("kenari_image_model") ?? ""),
    kenari_monthly_budget_idr: Number(formData.get("kenari_monthly_budget_idr")),
    recraft_monthly_budget_usd: Number(formData.get("recraft_monthly_budget_usd")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("user_settings")
    .update(parsed.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Gagal menyimpan pengaturan. Coba lagi." };

  revalidatePath("/pengaturan");
  return { ok: true };
}
