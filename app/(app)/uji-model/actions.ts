"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { providerOrderSchema, toProviderOrder, type ProviderEntry } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";

export type ApplyResult = { ok: true; message: string } | { ok: false; error: string };

const inputSchema = z.object({
  slot: z.enum(["utama", "cadangan"]),
  provider: z.enum(["kenari", "gemini"]),
  model: z.string().trim().min(1).max(120),
});

const label = (e: ProviderEntry) => `${e.provider === "gemini" ? "Gemini" : "Kenari"} ${e.model || "(model bawaan)"}`;

/** Puts a tested model into the provider chain in Settings, so it never has to be retyped. */
export async function pakaiModel(input: unknown): Promise<ApplyResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Model tidak valid." };
  const { slot, provider, model } = parsed.data;
  const chosen: ProviderEntry = { provider, model };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };
  const { data: settings, error: loadError } = await supabase.from("user_settings").select("provider_order").maybeSingle();
  if (loadError || !settings) return { ok: false, error: "Pengaturan tidak bisa dimuat. Coba lagi." };

  const [primary, backup] = toProviderOrder(settings.provider_order);
  let order: ProviderEntry[];
  let message: string;
  if (slot === "utama") {
    // The chain needs two different providers: a backup on the same provider makes way for the old primary.
    const nextBackup = backup && backup.provider !== provider ? backup : primary.provider !== provider ? primary : undefined;
    order = nextBackup ? [chosen, nextBackup] : [chosen];
    message = `Utama sekarang ${label(chosen)}${nextBackup ? `, cadangan ${label(nextBackup)}` : ", tanpa cadangan"}.`;
  } else {
    if (provider === primary.provider) {
      return {
        ok: false,
        error: `Cadangan harus dari provider lain dari utama (${label(primary)}), supaya tetap jalan saat utama kena limit.`,
      };
    }
    order = [primary, chosen];
    message = `Cadangan sekarang ${label(chosen)}.`;
  }

  const valid = providerOrderSchema.safeParse(order);
  if (!valid.success) return { ok: false, error: valid.error.issues[0]?.message ?? "Urutan provider tidak valid." };
  const { error } = await supabase
    .from("user_settings")
    .update({ provider_order: valid.data as unknown as Json })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Gagal menyimpan pengaturan. Coba lagi." };

  revalidatePath("/uji-model");
  revalidatePath("/pengaturan");
  revalidatePath("/generate");
  return { ok: true, message };
}
