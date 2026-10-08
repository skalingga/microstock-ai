import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { safeNextPath } from "@/lib/auth/next-path";
import { signupEnabled } from "@/lib/auth/signup";
import { LoginForm, type LoginNotice } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

type Params = { tautan?: string; sesi?: string; lanjut?: string };

function noticeFor({ tautan, sesi }: Params): LoginNotice | undefined {
  if (tautan === "kedaluwarsa") {
    return { tone: "error", text: "Tautan reset password tidak valid atau sudah kedaluwarsa. Minta tautan baru lewat Lupa password." };
  }
  if (sesi === "berakhir") return { tone: "info", text: "Sesimu berakhir. Masuk lagi untuk kembali ke halaman tadi." };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return (
    <AuthShell>
      <LoginForm
        notice={noticeFor(params)}
        next={params.lanjut ? safeNextPath(params.lanjut) : undefined}
        signup={signupEnabled()}
      />
    </AuthShell>
  );
}
