"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeCategory } from "@/lib/adobe/rules";
import { MAX_BULK_DELETE, UUID_RE } from "@/lib/assets";
import { galleryQuery, parseGalleryFilter, withQuery } from "./filters";
import type { Json } from "@/lib/database.types";
import { parseKeywordText } from "@/lib/metadata/keywords";
import { combine } from "@/lib/qc/evaluate";
import { parseNotes } from "@/lib/qc/types";
import { createClient } from "@/lib/supabase/server";

export type DeleteResult = { ok: false; error: string };

/**
 * Deletes one asset and returns to the gallery view it was opened from. `query` is the gallery filter's query string;
 * it is parsed and rebuilt, so only known filters survive. The page number is dropped: the last page may be gone now.
 */
export async function hapusAset(id: string, query = ""): Promise<DeleteResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: "ID aset tidak valid." };

  const supabase = await createClient();
  // Row Level Security means this only finds the caller's own asset.
  const { data: asset } = await supabase.from("assets").select("svg_path, preview_path, image_path").eq("id", id).maybeSingle();
  if (!asset) return { ok: false, error: "Aset tidak ditemukan." };

  const files = [asset.svg_path, asset.preview_path, asset.image_path].filter((p): p is string => Boolean(p));
  if (files.length > 0) {
    const removed = await supabase.storage.from("assets").remove(files);
    if (removed.error) return { ok: false, error: "Gagal menghapus file aset. Coba lagi." };
  }

  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return { ok: false, error: "Gagal menghapus data aset. Coba lagi." };

  revalidatePath("/aset");
  const params = Object.fromEntries(new URLSearchParams(typeof query === "string" ? query.slice(0, 200) : ""));
  redirect(withQuery("/aset", galleryQuery(parseGalleryFilter(params), { page: 1 })));
}

export type BulkDeleteResult = { ok: true; deleted: number; warning?: string } | { ok: false; error: string };

/** Deletes several of the caller's assets: rows first, then their files, so no row is left pointing at a lost file. */
export async function hapusBanyakAset(ids: string[]): Promise<BulkDeleteResult> {
  const unique = [...new Set(Array.isArray(ids) ? ids : [])];
  if (unique.length === 0) return { ok: false, error: "Belum ada aset yang dipilih." };
  if (unique.length > MAX_BULK_DELETE) return { ok: false, error: `Maksimal ${MAX_BULK_DELETE} aset sekali hapus.` };
  if (!unique.every((id) => typeof id === "string" && UUID_RE.test(id))) return { ok: false, error: "ID aset tidak valid." };

  const supabase = await createClient();
  // Row Level Security limits this to the caller's own assets; ids of other accounts simply match nothing.
  const { data: deleted, error } = await supabase
    .from("assets")
    .delete()
    .in("id", unique)
    .select("svg_path, preview_path, image_path");
  if (error) return { ok: false, error: "Gagal menghapus data aset. Coba lagi." };

  const files = (deleted ?? []).flatMap((a) => [a.svg_path, a.preview_path, a.image_path]).filter((p): p is string => Boolean(p));
  let warning: string | undefined;
  if (files.length > 0) {
    const removed = await supabase.storage.from("assets").remove(files);
    // The assets are already gone from the app; leftover files only take storage space.
    if (removed.error) warning = "Data aset terhapus, tapi sebagian file belum terhapus dari penyimpanan.";
  }

  revalidatePath("/aset");
  return { ok: true, deleted: deleted?.length ?? 0, warning };
}

export type SaveMetadataResult ={ ok: true; status: string } | { ok: false; error: string };

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

export type BulkAdobeResult = { ok: true; saved: number } | { ok: false; error: string };

/** Records one Adobe decision for several assets at once, e.g. a whole upload batch that was accepted. */
export async function simpanHasilAdobeBanyak(ids: string[], input: unknown): Promise<BulkAdobeResult> {
  const unique = [...new Set(Array.isArray(ids) ? ids : [])];
  if (unique.length === 0) return { ok: false, error: "Belum ada aset yang dipilih." };
  if (unique.length > MAX_BULK_DELETE) return { ok: false, error: `Maksimal ${MAX_BULK_DELETE} aset sekaligus.` };
  if (!unique.every((id) => typeof id === "string" && UUID_RE.test(id))) return { ok: false, error: "ID aset tidak valid." };
  const parsed = adobeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  const { status, reason } = parsed.data;

  const supabase = await createClient();
  // Row Level Security limits this to the caller's own assets.
  const { data, error } = await supabase
    .from("assets")
    .update({
      adobe_status: status === "belum" ? null : status,
      adobe_reason: status === "ditolak" && reason ? reason : null,
      adobe_reviewed_at: status === "belum" ? null : new Date().toISOString(),
    })
    .in("id", unique)
    .select("id");
  if (error) return { ok: false, error: "Gagal menyimpan hasil review. Coba lagi." };

  revalidatePath("/aset");
  revalidatePath("/ekspor");
  return { ok: true, saved: data?.length ?? 0 };
}

/** Stage 12: whether a photo shows people or property that do not exist (Adobe's "People and Property are fictional"). */
export async function ubahOrangFiktif(id: string, value: boolean): Promise<AdobeResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: "ID aset tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.from("assets").update({ fictional_people: value }).eq("id", id).eq("kind", "photo");
  if (error) return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  revalidatePath(`/aset/${id}`);
  return { ok: true };
}
