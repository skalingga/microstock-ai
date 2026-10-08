"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { safeNextPath } from "@/lib/auth/next-path";
import { credentialsSchema, emailSchema } from "@/lib/auth/schema";
import { signupEnabled } from "@/lib/auth/signup";
import { createClient } from "@/lib/supabase/server";

export type AuthField = "email" | "password";

export type AuthState = {
  error?: string;
  /** Supabase error code, so the form can offer the right way out (e.g. reset after a wrong password). */
  code?: string;
  info?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
};

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

// First message per field, shown under that field.
function fieldErrorsOf(error: ZodError): AuthState {
  const fieldErrors: AuthState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as AuthField;
    fieldErrors[field] ??= issue.message;
  }
  return { fieldErrors };
}

function authErrorMessage(code: string | undefined) {
  switch (code) {
    case "invalid_credentials":
      return "Email atau password salah.";
    case "user_already_exists":
      return "Email ini sudah terdaftar. Silakan masuk.";
    case "weak_password":
      return "Password terlalu lemah. Gunakan minimal 8 karakter.";
    case "email_address_invalid":
      return "Alamat email ini tidak diterima. Gunakan email yang valid.";
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
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error.code), code: error.code };

  redirect(safeNextPath(formData.get("lanjut")));
}

export async function daftar(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!signupEnabled()) return { error: authErrorMessage("signup_disabled") };

  const parsed = parseCredentials(formData);
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: authErrorMessage(error.code), code: error.code };

  // With email confirmation off Supabase returns a session straight away.
  if (!data.session) return { info: "Akun dibuat. Cek emailmu untuk konfirmasi, lalu masuk." };

  redirect(safeNextPath(formData.get("lanjut")));
}

export async function lupaPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  const origin = (await headers()).get("origin");
  if (!origin) return { error: "Terjadi kesalahan. Coba lagi." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback`,
  });
  if (error && (error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit")) {
    return { error: authErrorMessage(error.code), code: error.code };
  }

  // The same answer whether or not the email has an account, so this cannot reveal who is registered.
  return { info: "Jika email itu terdaftar, tautan untuk membuat password baru sudah dikirim. Buka tautannya di browser ini." };
}
