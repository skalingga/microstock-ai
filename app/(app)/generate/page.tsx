import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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

  const [{ data: settings, error: settingsError }, { data: usage, error: usageError }, { data: kenariSpent, error: spentError }] = await Promise.all([
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

  const totalCalls = Object.values(usageByProvider).reduce((sum, u) => sum + u.total, 0);
  const totalFailed = Object.values(usageByProvider).reduce((sum, u) => sum + u.failed, 0);

  const defaultStyle = (STYLES.find((s) => s.value === settings?.default_style)?.value ?? "icon_set") as StyleId;
  // Same order as the server's imageOrder(): settings, then env, then the built-in model.
  const defaultImageModel =
    settings?.kenari_image_model.trim() || process.env.KENARI_IMAGE_MODEL || KENARI_IMAGE_FALLBACK_MODEL;
  const kenariBudgetLeftIdr = Math.max(0, (settings?.kenari_monthly_budget_idr ?? 0) - Number(kenariSpent ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generate"
        description="Biarkan tab ini terbuka selama antrean berjalan."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
          {settings && (
            <StatCard
              label="Biaya Kenari bulan ini"
              value={spentError ? "–" : formatIdr(Number(kenariSpent ?? 0))}
              progress={!spentError && settings.kenari_monthly_budget_idr > 0 ? Number(kenariSpent ?? 0) / settings.kenari_monthly_budget_idr : undefined}
              detail={spentError ? "Biaya tidak bisa dimuat" : `dari batas ${formatIdr(settings.kenari_monthly_budget_idr)}`}
            />
          )}
          <StatCard
            label="Panggilan AI hari ini"
            value={usageError ? "–" : totalCalls}
            detail={
              usageError
                ? "Data panggilan tidak bisa dimuat"
                : totalCalls === 0
                  ? "Belum ada panggilan hari ini"
                  : Object.entries(usageByProvider)
                      .map(([provider, u]) => `${provider} ${u.total}`)
                      .join(" · ")
            }
          />
          <StatCard
            label="Berhasil hari ini"
            value={usageError || totalCalls === 0 ? "–" : `${Math.round(((totalCalls - totalFailed) / totalCalls) * 100)}%`}
            detail={totalFailed > 0 ? `${totalFailed} gagal` : undefined}
          />
        </div>
      </PageHeader>

      {settingsError && (
        <p role="alert" className="text-sm text-destructive">
          Pengaturan tidak bisa dimuat, jadi form memakai nilai bawaan (palet, kata terlarang, batas biaya). Muat ulang halaman
          sebelum generate.
        </p>
      )}

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
