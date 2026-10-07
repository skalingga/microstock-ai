import { Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function HalamanPengaturan() {
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("*")
    .maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Pengaturan"
        description="Urutan provider AI, batas biaya, daftar kata terlarang, serta gaya dan palet bawaan."
      />

      {error || !settings ? (
        <p role="alert" className="text-sm text-destructive">
          Pengaturan tidak bisa dimuat. Muat ulang halaman atau masuk kembali.
        </p>
      ) : (
        <SettingsForm settings={settings} />
      )}
    </div>
  );
}
