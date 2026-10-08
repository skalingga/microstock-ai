import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { orderForKind } from "@/lib/providers";
import { withEnvDefaults } from "@/lib/settings/provider-defaults";
import { toProviderOrder } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";
import { RisetForm, type RunInfo, type ThemeRow } from "./riset-form";

export const metadata: Metadata = { title: "Riset" };

export default async function HalamanRiset() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Show the most recent research run so a finished run is still there after a reload.
  const [{ data: run, error: runError }, { data: settings }, { data: themeCosts }, { data: usedJobs }] = await Promise.all([
    supabase
      .from("research_runs")
      .select("id, region, period_start, period_end, created_at, trends_missing, provider, model, cost_idr")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("user_settings").select("provider_order, kenari_text_model").maybeSingle(),
    // What earlier paid research calls cost per model: the estimate shown before a run.
    supabase.from("provider_usage").select("model, cost_idr").eq("kind", "themes").gt("cost_idr", 0).order("created_at", { ascending: false }).limit(100),
    // Themes already sent to Generate, to mark them in the list.
    supabase.from("generation_jobs").select("themes(title)").order("created_at", { ascending: false }).limit(300),
  ]);

  const { data: themes, error: themesError } = run
    ? await supabase.from("themes").select("*").eq("run_id", run.id).limit(50)
    : { data: [], error: null };

  const initialRows: ThemeRow[] = (themes ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    event: t.event ?? "",
    eventWeight: (t.event_weight >= 1 && t.event_weight <= 3 ? t.event_weight : 2) as 1 | 2 | 3,
    uploadBy: t.upload_by,
    keywords: t.seed_keywords,
    // Runs made before the raw guesses were stored only have the final scores; close enough for old rows.
    demandGuess: t.ai_demand ?? t.demand_score ?? 50,
    competitionGuess: t.ai_competition ?? (t.adobe_result_count === null ? t.competition_score : null) ?? 50,
    trendScore: t.trend_score,
    adobeCount: t.adobe_result_count,
  }));

  const runInfo: RunInfo | null = run
    ? {
        createdAt: run.created_at,
        region: run.region,
        periodStart: run.period_start,
        periodEnd: run.period_end,
        trendsMissing: run.trends_missing,
        model: run.model ? `${run.provider ?? ""} · ${run.model}` : null,
        costIdr: Number(run.cost_idr),
      }
    : null;

  // Research uses the text model order, like concepts and metadata.
  const order = withEnvDefaults(
    orderForKind(toProviderOrder(settings?.provider_order ?? []), "themes", settings?.kenari_text_model ?? ""),
  );
  const costRuns: Record<string, number[]> = {};
  for (const row of themeCosts ?? []) (costRuns[row.model] ??= []).push(Number(row.cost_idr));
  const themeCostIdr = Object.fromEntries(
    Object.entries(costRuns).map(([model, costs]) => [model, costs.reduce((a, b) => a + b, 0) / costs.length]),
  );

  const usedTitles = [
    ...new Set((usedJobs ?? []).map((j) => j.themes?.title?.trim().toLowerCase()).filter((t): t is string => !!t)),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Riset tema" description="Ide tema dari event dan musim, lengkap dengan batas upload." />
      {(runError || themesError) && (
        <p role="alert" className="text-sm text-destructive">
          Riset terakhir tidak bisa dimuat. Muat ulang halaman, atau mulai riset baru.
        </p>
      )}
      <RisetForm
        initialRows={initialRows}
        initialRun={runInfo}
        providerOrder={order}
        themeCostIdr={themeCostIdr}
        usedTitles={usedTitles}
      />
    </div>
  );
}
