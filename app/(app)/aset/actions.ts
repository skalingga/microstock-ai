"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UUID_RE } from "@/lib/assets";
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
