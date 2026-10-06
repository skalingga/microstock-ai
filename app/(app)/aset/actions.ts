"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeCategory } from "@/lib/adobe/rules";
import { UUID_RE } from "@/lib/assets";
import type { Json } from "@/lib/database.types";
import { parseKeywordText } from "@/lib/metadata/keywords";
import { combine } from "@/lib/qc/evaluate";
import { parseNotes } from "@/lib/qc/types";
import { createClient } from "@/lib/supabase/server";

export type DeleteResult = { ok: false; error: string };

export async function hapusAset(id: string): Promise<DeleteResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: "ID aset tidak valid." };

  const supabase = await createClient();
  // Row Level Security means this only finds the caller's own asset.
  const { data: asset } = await supabase.from("assets").select("svg_path, preview_path").eq("id", id).maybeSingle();
  if (!asset) return { ok: false, error: "Aset tidak ditemukan." };

  const files = [asset.svg_path, asset.preview_path].filter((p): p is string => Boolean(p));
  if (files.length > 0) {
    const removed = await supabase.storage.from("assets").remove(files);
    if (removed.error) return { ok: false, error: "Gagal menghapus file aset. Coba lagi." };
  }

  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return { ok: false, error: "Gagal menghapus data aset. Coba lagi." };

  revalidatePath("/aset");
  redirect("/aset");
}

export type SaveMetadataResult = { ok: true; status: string } | { ok: false; error: string };

const metadataSchema = z.object({
  title: z.string().trim().max(300, "Judul terlalu panjang."),
  keywords: z.string().max(10_000, "Daftar keyword terlalu panjang."),
  category: z.string().trim().max(60),
  needsRelease: z.boolean(),
});

export async function simpanMetadata(id: string, input: unknown): Promise<SaveMetadataResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: "ID aset tidak valid." };
  const parsed = metadataSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };

  const supabase = await createClient();
  const [{ data: asset }, { data: settings }] = await Promise.all([
    supabase.from("assets").select("qc_notes").eq("id", id).maybeSingle(),
    supabase.from("user_settings").select("banned_words").maybeSingle(),
  ]);
  if (!asset) return { ok: false, error: "Aset tidak ditemukan." };

  const keywords = parseKeywordText(parsed.data.keywords);
  const category = normalizeCategory(parsed.data.category);
  const title = parsed.data.title;

  // Without a title the asset goes back to waiting for metadata; otherwise every metadata check runs again.
  const verdict = combine(
    parseNotes(asset.qc_notes),
    title ? { title, keywords, category: category ?? parsed.data.category, needsRelease: parsed.data.needsRelease } : null,
    settings?.banned_words ?? [],
  );

  const { error } = await supabase
    .from("assets")
    .update({
      title: title || null,
      keywords,
      category: category ?? (parsed.data.category || null),
      needs_release: parsed.data.needsRelease,
      qc_status: verdict.status,
      qc_notes: verdict.notes as unknown as Json,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Gagal menyimpan metadata. Coba lagi." };

  revalidatePath(`/aset/${id}`);
  revalidatePath("/aset");
  return { ok: true, status: verdict.status };
}

export type AdobeResult = { ok: true } | { ok: false; error: string };

const adobeSchema = z.object({
  status: z.enum(["belum", "diterima", "ditolak"]),
  reason: z.string().trim().max(500, "Alasan maksimal 500 karakter."),
});

/** Records Adobe Stock's decision for one asset (stage 6). "belum" clears it. */
export async function simpanHasilAdobe(id: string, input: unknown): Promise<AdobeResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: "ID aset tidak valid." };
  const parsed = adobeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  const { status, reason } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({
      adobe_status: status === "belum" ? null : status,
      adobe_reason: status === "ditolak" && reason ? reason : null,
      adobe_reviewed_at: status === "belum" ? null : new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "Gagal menyimpan hasil review. Coba lagi." };
  if (!data || data.length === 0) return { ok: false, error: "Aset tidak ditemukan." };

  revalidatePath(`/aset/${id}`);
  revalidatePath("/aset");
  revalidatePath("/ekspor");
  return { ok: true };
}
