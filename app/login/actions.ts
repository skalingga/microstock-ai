"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string };

const credentialsSchema = z.object({
  email: z.string().trim().email("Format email tidak valid."),
  password: z.string().min(8, "Password minimal 8 karakter."),
});

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

function authErrorMessage(code: string | undefined) {
  switch (code) {
    case "invalid_credentials":
      return "Email atau password salah.";
    case "user_already_exists":
      return "Email ini sudah terdaftar. Silakan masuk.";
    case "weak_password":
      return "Password terlalu lemah. Gunakan minimal 8 karakter.";
    case "signup_disabled":
      return "Pendaftaran akun baru sedang ditutup.";
    case "email_not_confirmed":
      return "Email belum dikonfirmasi. Cek kotak masuk emailmu.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
    default:
      return "Terjadi kesalahan. Coba lagi.";
  }
}

export async function masuk(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error.code) };

  redirect("/generate");
}

export async function daftar(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: authErrorMessage(error.code) };

  // With email confirmation off Supabase returns a session straight away.
  if (!data.session) {
    return { info: "Akun dibuat. Cek emailmu untuk konfirmasi, lalu masuk." };
  }

  redirect("/generate");
}
