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
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Pengaturan</h1>
        <p className="text-muted-foreground">
          Urutan provider AI, daftar kata terlarang, gaya dan palet bawaan, serta batas biaya Recraft.
        </p>
      </div>

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
