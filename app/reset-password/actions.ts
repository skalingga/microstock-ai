"use server";

import { redirect } from "next/navigation";
import { newPasswordSchema } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/server";

export type ResetState = { error?: string };

export async function ubahPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Password baru harus berbeda dari yang lama."
          : error.code === "weak_password"
            ? "Password terlalu lemah. Gunakan minimal 8 karakter."
            : "Gagal mengubah password. Minta tautan baru lewat halaman masuk.",
    };
  }
  redirect("/generate");
}
