import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STYLES, toPalettes, type StyleId } from "@/lib/settings/schema";
import { GenerateForm } from "./generate-form";

const DAY_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB (UTC+7): the "today" the user sees

function startOfTodayWib(now = new Date()) {
  const shifted = new Date(now.getTime() + DAY_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - DAY_OFFSET_MS).toISOString();
}

export default async function HalamanGenerate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: settings }, { data: usage }] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.from("provider_usage").select("provider, ok").gte("created_at", startOfTodayWib()).limit(1000),
  ]);

  const usageByProvider: Record<string, { total: number; failed: number }> = {};
  for (const row of usage ?? []) {
    const entry = (usageByProvider[row.provider] ??= { total: 0, failed: 0 });
    entry.total += 1;
    if (!row.ok) entry.failed += 1;
  }

  const defaultStyle = (STYLES.find((s) => s.value === settings?.default_style)?.value ?? "icon_set") as StyleId;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Generate</h1>
        <p className="text-muted-foreground">
          Masukkan satu tema, lalu aplikasi membuat variasi aset SVG satu per satu. Biarkan tab ini terbuka sampai
          selesai.
        </p>
        {Object.keys(usageByProvider).length > 0 && (
          <p className="text-sm text-muted-foreground">
            Panggilan hari ini:{" "}
            {Object.entries(usageByProvider)
              .map(([provider, u]) => `${provider} ${u.total}${u.failed > 0 ? ` (${u.failed} gagal)` : ""}`)
              .join(", ")}
          </p>
        )}
      </div>

      <GenerateForm
        userId={user.id}
        defaultStyle={defaultStyle}
        palettes={settings ? toPalettes(settings.palettes) : []}
      />
    </div>
  );
}
