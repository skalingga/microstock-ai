import { redirect } from "next/navigation";
import { formatIdr, startOfDayWib, startOfMonthWib } from "@/lib/budget";
import { createClient } from "@/lib/supabase/server";
import { withPresetPalettes } from "@/lib/settings/palettes";
import { KENARI_IMAGE_FALLBACK_MODEL } from "@/lib/providers/kenari-image-pricing";
import { STYLES, toPalettes, type StyleId } from "@/lib/settings/schema";
import { GenerateForm } from "./generate-form";

export default async function HalamanGenerate({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const { tema } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: settings }, { data: usage }, { data: kenariSpent }] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.from("provider_usage").select("provider, ok").gte("created_at", startOfDayWib()).limit(1000),
    supabase.rpc("provider_cost_since", { p_provider: "kenari", p_since: startOfMonthWib() }),
  ]);

  const usageByProvider: Record<string, { total: number; failed: number }> = {};
  for (const row of usage ?? []) {
    const entry = (usageByProvider[row.provider] ??= { total: 0, failed: 0 });
    entry.total += 1;
    if (!row.ok) entry.failed += 1;
  }

  const defaultStyle = (STYLES.find((s) => s.value === settings?.default_style)?.value ?? "icon_set") as StyleId;
  // Same order as the server's imageOrder(): settings, then env, then the built-in model.
  const defaultImageModel =
    settings?.kenari_image_model.trim() || process.env.KENARI_IMAGE_MODEL || KENARI_IMAGE_FALLBACK_MODEL;
  const kenariBudgetLeftIdr = Math.max(0, (settings?.kenari_monthly_budget_idr ?? 0) - Number(kenariSpent ?? 0));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Generate</h1>
        <p className="text-muted-foreground">
          Masukkan satu tema, lalu aplikasi membuat variasi aset SVG satu per satu. Biarkan tab ini terbuka sampai
          selesai.
        </p>
        {settings && (
          <p className="text-sm text-muted-foreground">
            Biaya Kenari bulan ini: {formatIdr(Number(kenariSpent ?? 0))} dari batas{" "}
            {formatIdr(settings.kenari_monthly_budget_idr)} (model gratis tidak dihitung).
          </p>
        )}
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
        palettes={withPresetPalettes(settings ? toPalettes(settings.palettes) : [])}
        bannedWords={settings?.banned_words ?? []}
        initialTheme={tema?.slice(0, 120) ?? ""}
        defaultImageModel={defaultImageModel}
        kenariBudgetLeftIdr={kenariBudgetLeftIdr}
      />
    </div>
  );
}
