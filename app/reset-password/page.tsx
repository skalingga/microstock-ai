import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Password baru" };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetForm />
    </AuthShell>
  );
}
