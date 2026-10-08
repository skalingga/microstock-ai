import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatIdr, startOfDayWib, startOfMonthWib } from "@/lib/budget";
import { fetchActiveJob } from "@/lib/generate/active-job";
import { parseCells, summarize } from "@/lib/generate/benchmark";
import { createClient } from "@/lib/supabase/server";
import { withPresetPalettes } from "@/lib/settings/palettes";
import { GEMINI_FALLBACK_MODEL } from "@/lib/providers/gemini";
import { KENARI_IMAGE_FALLBACK_MODEL } from "@/lib/providers/kenari-image-pricing";
import { STYLES, toPalettes, toProviderOrder, type StyleId } from "@/lib/settings/schema";
import { ActiveJobCard } from "./active-job-card";
import { GenerateForm, type TestedModel } from "./generate-form";

export const metadata: Metadata = { title: "Generate" };

/** PRODUCT.md: more than 1.000 Lolos SVGs a month, about 33 a day. */
const DAILY_LOLOS_TARGET = 33;

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

  const [
    { data: settings, error: settingsError },
    { data: kenariSpent, error: spentError },
    { count: lolosToday, error: lolosError },
    activeJob,
    { data: benchmarks },
    { data: svgCosts },
  ] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.rpc("provider_cost_since", { p_provider: "kenari", p_since: startOfMonthWib() }),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("qc_status", "lolos").gte("created_at", startOfDayWib()),
    fetchActiveJob(supabase),
    supabase.from("model_benchmarks").select("results").order("created_at", { ascending: false }).limit(5),
    // What paid SVG calls really cost, per model: the estimate shown before a batch.
    supabase.from("provider_usage").select("model, cost_idr").eq("kind", "svg").eq("provider", "kenari").gt("cost_idr", 0).order("created_at", { ascending: false }).limit(500),
  ]);

  const defaultStyle = (STYLES.find((s) => s.value === settings?.default_style)?.value ?? "icon_set") as StyleId;
  // Same order as the server's imageOrder(): settings, then env, then the built-in model.
  const defaultImageModel =
    settings?.kenari_image_model.trim() || process.env.KENARI_IMAGE_MODEL || KENARI_IMAGE_FALLBACK_MODEL;
  const budget = settings?.kenari_monthly_budget_idr ?? 0;
  const spent = Number(kenariSpent ?? 0);
  const kenariBudgetLeftIdr = Math.max(0, budget - spent);
  // An empty model means the server's env default (resolveProvider); name it, so the page can say which model and price.
  const providerOrder = (settings ? toProviderOrder(settings.provider_order) : []).map((e) => ({
    ...e,
    model:
      e.model ||
      (e.provider === "kenari" ? (process.env.KENARI_DEFAULT_MODEL ?? "") : process.env.GEMINI_DEFAULT_MODEL || GEMINI_FALLBACK_MODEL),
  }));

  // The latest benchmark run that has results: shown next to the models it tested.
  const cells = (benchmarks ?? []).map((b) => parseCells(b.results)).find((c) => c.length > 0) ?? [];
  const tested: TestedModel[] = summarize(cells).map((r) => ({
    key: `${r.provider}|${r.model}`,
    label: `${r.lolos}/${r.total} lolos${r.medianMs !== null ? ` · ${Math.round(r.medianMs / 1000)} dtk` : ""}`,
    score: r.score,
  }));

  const svgCostIdr: Record<string, number> = {};
  const costRuns: Record<string, number[]> = {};
  for (const row of svgCosts ?? []) (costRuns[row.model] ??= []).push(Number(row.cost_idr));
  for (const [model, costs] of Object.entries(costRuns)) svgCostIdr[model] = costs.reduce((a, b) => a + b, 0) / costs.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Generate" description="Biarkan tab ini terbuka selama antrean berjalan.">
        <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
          <StatCard
            label="Lolos hari ini"
            value={lolosError ? "–" : `${lolosToday ?? 0}/${DAILY_LOLOS_TARGET}`}
            progress={lolosError ? undefined : (lolosToday ?? 0) / DAILY_LOLOS_TARGET}
            tone="goal"
            detail={lolosError ? "Data aset tidak bisa dimuat" : "target harian"}
          />
          {settings && (
            <StatCard
              label="Sisa anggaran"
              value={spentError ? "–" : formatIdr(kenariBudgetLeftIdr)}
              progress={!spentError && budget > 0 ? spent / budget : undefined}
              detail={spentError ? "Biaya tidak bisa dimuat" : `Kenari: terpakai ${formatIdr(spent)} dari ${formatIdr(budget)}`}
            />
          )}
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
        kenariBudgetLeftIdr={spentError ? null : kenariBudgetLeftIdr}
        providerOrder={providerOrder}
        tested={tested}
        svgCostIdr={svgCostIdr}
        activeJob={activeJob ? <ActiveJobCard initial={activeJob} /> : null}
      />
    </div>
  );
}
