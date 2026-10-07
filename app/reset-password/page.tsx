import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Buat password baru" description="Isi password baru untuk akunmu.">
      <ResetForm />
    </AuthShell>
  );
}
