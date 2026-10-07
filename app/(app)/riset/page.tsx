import { Telescope } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RisetForm, type ThemeRow } from "./riset-form";

export default async function HalamanRiset() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Show the most recent research run so a finished run is still there after a reload.
  const { data: run } = await supabase
    .from("research_runs")
    .select("id, region, period_start, period_end")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: themes } = run
    ? await supabase.from("themes").select("*").eq("run_id", run.id).limit(50)
    : { data: [] };

  const initialRows: ThemeRow[] = (themes ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    event: t.event ?? "",
    eventWeight: 2,
    uploadBy: t.upload_by,
    keywords: t.seed_keywords,
    demandGuess: t.demand_score ?? 50,
    competitionGuess: t.competition_score ?? 50,
    trendScore: t.trend_score,
    adobeCount: t.adobe_result_count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Telescope}
        title="Riset tema"
        description="Pilih pasar dan periode. Aplikasi mencari event dan musim di periode itu, lalu menyusun ide tema dan mengurutkannya berdasarkan peluang."
      />
      <RisetForm initialRows={initialRows} initialRun={run ? { region: run.region } : null} />
    </div>
  );
}
