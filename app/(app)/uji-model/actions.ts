"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { providerOrderSchema, toProviderOrder, type ProviderEntry } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";

export type ChainResult = { ok: true; before: ProviderEntry[]; after: ProviderEntry[] } | { ok: false; error: string };

const entrySchema = z.object({ provider: z.enum(["kenari", "gemini"]), model: z.string().trim().max(120) });

async function writeChain(order: ProviderEntry[]): Promise<ChainResult> {
  const valid = providerOrderSchema.safeParse(order);
  if (!valid.success) return { ok: false, error: valid.error.issues[0]?.message ?? "Urutan provider tidak valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };
  const { data: settings, error: loadError } = await supabase.from("user_settings").select("provider_order").maybeSingle();
  if (loadError || !settings) return { ok: false, error: "Pengaturan tidak bisa dimuat. Coba lagi." };

  const before = toProviderOrder(settings.provider_order);
  const { error } = await supabase
    .from("user_settings")
    .update({ provider_order: valid.data as unknown as Json })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Gagal menyimpan pengaturan. Coba lagi." };

  revalidatePath("/uji-model");
  revalidatePath("/pengaturan");
  revalidatePath("/generate");
  return { ok: true, before, after: valid.data };
}

/** Puts the suggested pair into the provider chain in Settings in one step. Returns the old chain for "Urungkan". */
export async function pakaiSaran(input: unknown): Promise<ChainResult> {
  const parsed = z.object({ primary: entrySchema, backup: entrySchema.optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saran tidak valid." };
  const { primary, backup } = parsed.data;
  return writeChain(backup ? [primary, backup] : [primary]);
}

/** Puts a previous chain back (the "Urungkan" after pakaiSaran). */
export async function kembalikanRantai(input: unknown): Promise<ChainResult> {
  const parsed = z.array(entrySchema).min(1).max(2).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Rantai lama tidak valid." };
  return writeChain(parsed.data);
}
