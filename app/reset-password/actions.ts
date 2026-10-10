"use server";

import { redirect } from "next/navigation";
import { newPasswordSchema } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/server";

export type ResetField = "password" | "confirm";

export type ResetState = { error?: string; fieldErrors?: Partial<Record<ResetField, string>> };

export async function ubahPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    // First message per field, shown under that field.
    const fieldErrors: ResetState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as ResetField] ??= issue.message;
    return { fieldErrors };
  }

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
  redirect("/meja");
}
