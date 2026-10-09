"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  parseBannedWords,
  parsePalettes,
  settingsSchema,
  type ProviderEntry,
} from "@/lib/settings/schema";

/** Field names as the form uses them, so each message lands under its own input. */
export type SettingsField =
  | "kenari_monthly_budget_idr"
  | "kenari_image_model"
  | "primary_model"
  | "backup_provider"
  | "backup_model"
  | "kenari_text_model"
  | "default_style"
  | "palettes"
  | "banned_words";

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string; fields: Partial<Record<SettingsField, string>> };

export async function simpanPengaturan(formData: FormData): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi.", fields: {} };

  // An emptied field would read as 0 and silently switch paid models off.
  const budgetRaw = String(formData.get("kenari_monthly_budget_idr") ?? "").trim();
  if (budgetRaw === "") {
    const message = "Isi batas biaya. Tulis 0 bila model berbayar memang mau dimatikan.";
    return { ok: false, error: message, fields: { kenari_monthly_budget_idr: message } };
  }

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

  const palettesText = String(formData.get("palettes") ?? "");
  const parsed = settingsSchema.safeParse({
    provider_order: providerOrder,
    banned_words: parseBannedWords(String(formData.get("banned_words") ?? "")),
    default_style: formData.get("default_style"),
    palettes: parsePalettes(palettesText),
    kenari_text_model: String(formData.get("kenari_text_model") ?? ""),
    kenari_image_model: String(formData.get("kenari_image_model") ?? ""),
    kenari_monthly_budget_idr: Number(budgetRaw),
    recraft_monthly_budget_usd: Number(formData.get("recraft_monthly_budget_usd")),
  });
  if (!parsed.success) {
    const fields: Partial<Record<SettingsField, string>> = {};
    for (const issue of parsed.error.issues) {
      const [root, index] = issue.path;
      let field: SettingsField | null = null;
      let message = issue.message;
      if (root === "provider_order") {
        if (issue.code === "custom") field = "backup_provider"; // same provider twice
        else field = index === 1 ? "backup_model" : "primary_model";
      }
      else if (root === "palettes") {
        field = "palettes";
        // Name the line: a list of palettes is hard to scan for the one bad colour.
        if (typeof index === "number") message = `Baris ${index + 1}: ${issue.message}`;
      } else if (typeof root === "string" && root !== "recraft_monthly_budget_usd") field = root as SettingsField;
      if (field && !fields[field]) fields[field] = message;
    }
    const count = Object.keys(fields).length;
    return {
      ok: false,
      error: count > 1 ? `Ada ${count} isian yang perlu diperbaiki.` : (Object.values(fields)[0] ?? parsed.error.issues[0].message),
      fields,
    };
  }

  const { error } = await supabase
    .from("user_settings")
    .update(parsed.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Gagal menyimpan pengaturan. Coba lagi.", fields: {} };

  revalidatePath("/pengaturan");
  revalidatePath("/generate");
  return { ok: true, savedAt: new Date().toISOString() };
}
