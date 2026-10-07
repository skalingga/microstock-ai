import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ tautan?: string }> }) {
  const { tautan } = await searchParams;
  return (
    <AuthShell title="Selamat datang" description="Masuk untuk membuat aset vektor untuk Adobe Stock.">
      <LoginForm
        notice={tautan === "kedaluwarsa" ? "Tautan reset password tidak valid atau sudah kedaluwarsa. Minta tautan baru." : undefined}
      />
    </AuthShell>
  );
}
