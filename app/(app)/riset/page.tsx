import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { orderForKind } from "@/lib/providers";
import { withEnvDefaults } from "@/lib/settings/provider-defaults";
import { toProviderOrder } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SEC } from "@/lib/assets";
import { buildHistory, HISTORY_THUMBS } from "@/lib/research/history";
import { fetchSaturatedSubjects } from "@/lib/subjects/fetch";
import { RisetForm, type RunInfo, type ThemeRow } from "./riset-form";
import { RiwayatRiset } from "./riwayat-riset";

export const metadata: Metadata = { title: "Riset" };

/** Past runs shown in the history, and the most batches and assets read for them. */
const HISTORY_RUNS = 12;
const HISTORY_JOBS = 400;
const HISTORY_ASSETS = 1000;

export default async function HalamanRiset() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Show the most recent research run so a finished run is still there after a reload.
  const [{ data: run, error: runError }, { data: settings }, { data: themeCosts }, { data: usedJobs }, saturated] = await Promise.all([
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
    fetchSaturatedSubjects(supabase),
  ]);

  const loaded = await loadHistory(supabase);

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
        saturated={saturated}
      />
      {loaded && <RiwayatRiset history={loaded.history} urls={loaded.urls} />}
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Past runs and own themes with the assets made from them. A failed read hides the section instead of breaking the page. */
async function loadHistory(supabase: Supabase) {
  const { data: runs, error: runsError } = await supabase
    .from("research_runs")
    .select("id, created_at, region")
    .order("created_at", { ascending: false })
    .limit(HISTORY_RUNS);
  if (runsError || !runs) return null;
  const [{ data: themes }, { data: jobs }, { data: assets }] = await Promise.all([
    supabase.from("themes").select("id, run_id, title").in("run_id", runs.map((r) => r.id)).limit(1000),
    supabase
      .from("generation_jobs")
      .select("id, style, created_at, themes(title)")
      .order("created_at", { ascending: false })
      .limit(HISTORY_JOBS),
    supabase
      .from("assets")
      .select("id, job_id, preview_path, qc_status, adobe_status")
      .order("created_at", { ascending: false })
      .limit(HISTORY_ASSETS),
  ]);

  const built = buildHistory({
    runs: runs.map((r) => ({ id: r.id, createdAt: r.created_at, region: r.region })),
    themes: (themes ?? []).flatMap((t) => (t.run_id ? [{ id: t.id, runId: t.run_id, title: t.title }] : [])),
    jobs: (jobs ?? []).flatMap((j) => (j.themes?.title ? [{ id: j.id, themeTitle: j.themes.title, style: j.style, createdAt: j.created_at }] : [])),
    assets: (assets ?? []).map((a) => ({ id: a.id, jobId: a.job_id, previewPath: a.preview_path, qcStatus: a.qc_status, adobeStatus: a.adobe_status })),
  });

  // Only the thumbnails on screen need a signed link.
  const shown = [...built.runs.flatMap((r) => r.themes), ...built.own];
  const paths = [...new Set(shown.flatMap((t) => t.assets.slice(0, HISTORY_THUMBS).flatMap((a) => (a.previewPath ? [a.previewPath] : []))))];
  const { data: signed } = paths.length > 0 ? await supabase.storage.from("assets").createSignedUrls(paths, SIGNED_URL_TTL_SEC) : { data: [] };
  const urls = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return { history: built, urls };
}
