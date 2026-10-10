import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatIdr, startOfDayWib, startOfMonthWib } from "@/lib/budget";
import { fetchActiveJob } from "@/lib/generate/active-job";
import { parseCells, summarize } from "@/lib/generate/benchmark";
import { createClient } from "@/lib/supabase/server";
import { fetchSaturatedSubjects } from "@/lib/subjects/fetch";
import { withPresetPalettes } from "@/lib/settings/palettes";
import { KENARI_IMAGE_FALLBACK_MODEL } from "@/lib/providers/kenari-image-pricing";
import { withEnvDefaults } from "@/lib/settings/provider-defaults";
import { STYLES, toPalettes, toProviderOrder, type StyleId } from "@/lib/settings/schema";
import { ActiveJobCard, JOB_PREVIEWS } from "./active-job-card";
import { GenerateForm, type LastJob, type TestedModel } from "./generate-form";
import { PhotoForm, type OpenPhotoJob, type PhotoJobSummary } from "./photo-form";
import { parsePhotoJob } from "@/lib/photo/run";
import { UUID_RE } from "@/lib/assets";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Generate" };

/** PRODUCT.md: more than 1.000 Lolos SVGs a month, about 33 a day. */
const DAILY_LOLOS_TARGET = 33;

export default async function HalamanGenerate({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string; batas?: string; jenis?: string; job?: string }>;
}) {
  const { tema, batas, jenis, job } = await searchParams;
  const photo = jenis === "foto";
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
    saturated,
    { data: lastJobRow },
  ] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.rpc("provider_cost_since", { p_provider: "kenari", p_since: startOfMonthWib() }),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("qc_status", "lolos").gte("created_at", startOfDayWib()),
    fetchActiveJob(supabase, { previews: JOB_PREVIEWS }),
    supabase.from("model_benchmarks").select("results").order("created_at", { ascending: false }).limit(5),
    // What paid SVG calls really cost, per model: the estimate shown before a batch.
    supabase.from("provider_usage").select("model, cost_idr").eq("kind", "svg").eq("provider", "kenari").gt("cost_idr", 0).order("created_at", { ascending: false }).limit(500),
    fetchSaturatedSubjects(supabase),
    // The latest vector batch, offered as "Ulangi batch terakhir".
    supabase.from("generation_jobs").select("count, style, palette, themes(title)").neq("style", "photo").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const defaultStyle = (STYLES.find((s) => s.value === settings?.default_style)?.value ?? "icon_set") as StyleId;
  // Same order as the server's imageOrder(): settings, then env, then the built-in model.
  const defaultImageModel =
    settings?.kenari_image_model.trim() || process.env.KENARI_IMAGE_MODEL || KENARI_IMAGE_FALLBACK_MODEL;
  const budget = settings?.kenari_monthly_budget_idr ?? 0;
  const spent = Number(kenariSpent ?? 0);
  const kenariBudgetLeftIdr = Math.max(0, budget - spent);
  const providerOrder = withEnvDefaults(settings ? toProviderOrder(settings.provider_order) : []);

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

  const palettes = withPresetPalettes(settings ? toPalettes(settings.palettes) : []);
  const lastJob = toLastJob(lastJobRow, palettes);

  const initialTheme = tema?.slice(0, 120) ?? "";
  const uploadBy = batas && /^\d{4}-\d{2}-\d{2}$/.test(batas) ? batas : undefined;
  const photoData = photo ? await loadPhotoJobs(supabase, job) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Generate" description="Biarkan tab ini terbuka selama antrean berjalan.">
        <p className="flex flex-wrap gap-2 text-sm sm:hidden">
          <span className="rounded-md bg-muted px-2.5 py-1 font-semibold tabular-nums">
            Lolos hari ini {lolosError ? "–" : `${lolosToday ?? 0}/${DAILY_LOLOS_TARGET}`}
          </span>
          {settings && (
            <span className="rounded-md bg-muted px-2.5 py-1 font-semibold tabular-nums">
              Sisa {spentError ? "–" : formatIdr(kenariBudgetLeftIdr)}
            </span>
          )}
        </p>
        <div className="grid grid-cols-2 gap-3 max-sm:hidden sm:max-w-xl">
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

      <nav aria-label="Jenis aset" className="flex gap-1">
        {[
          { label: "Vektor (SVG)", href: `/generate${tema ? `?tema=${encodeURIComponent(tema)}` : ""}`, active: !photo },
          { label: "Foto (Google Flow)", href: `/generate?jenis=foto${tema ? `&tema=${encodeURIComponent(tema)}` : ""}`, active: photo },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-md border px-3 text-sm no-underline max-sm:min-h-11",
              tab.active ? "border-foreground bg-secondary font-semibold" : "hover:bg-muted/50",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {photo && photoData ? (
        <>
          {photoData.error && (
            <p role="alert" className="text-sm text-destructive">
              {photoData.error}
            </p>
          )}
          <PhotoForm
            key={photoData.openJob?.id ?? "baru"}
            userId={user.id}
            bannedWords={settings?.banned_words ?? []}
            saturated={saturated}
            initialTheme={initialTheme}
            uploadBy={uploadBy}
            recentJobs={photoData.recentJobs}
            openJob={photoData.openJob}
          />
        </>
      ) : (
      <GenerateForm
        userId={user.id}
        defaultStyle={defaultStyle}
        palettes={palettes}
        bannedWords={settings?.banned_words ?? []}
        initialTheme={initialTheme}
        uploadBy={uploadBy}
        defaultImageModel={defaultImageModel}
        kenariBudgetLeftIdr={spentError ? null : kenariBudgetLeftIdr}
        providerOrder={providerOrder}
        tested={tested}
        svgCostIdr={svgCostIdr}
        saturated={saturated}
        activeJob={activeJob ? <ActiveJobCard initial={activeJob} /> : null}
        lastJob={tema ? null : lastJob}
      />
      )}
    </div>
  );
}

/** The latest vector batch as form values; its palette is matched back to a palette in the picker by its colors. */
function toLastJob(
  row: { count: number; style: string; palette: unknown; themes: { title: string } | null } | null,
  palettes: { colors: string[] }[],
): LastJob | null {
  const style = STYLES.find((s) => s.value === row?.style)?.value;
  if (!row || !style || !row.themes?.title) return null;
  const colors = Array.isArray(row.palette) ? row.palette.map((c) => String(c).toLowerCase()) : [];
  const match = colors.length > 0 ? palettes.findIndex((p) => p.colors.map((c) => c.toLowerCase()).join() === colors.join()) : -1;
  return { theme: row.themes.title, style, count: row.count, paletteIndex: match >= 0 ? String(match) : "" };
}

/** Stage 12: the latest photo jobs (prompts for Google Flow), and the one opened with ?job= for uploads. */
async function loadPhotoJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string | undefined,
): Promise<{ recentJobs: PhotoJobSummary[]; openJob: OpenPhotoJob | null; error?: string }> {
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("id, created_at, photo_prompts, themes(title), assets(count)")
    .eq("style", "photo")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return { recentJobs: [], openJob: null, error: "Prompt foto sebelumnya tidak bisa dimuat." };

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    theme: row.themes?.title ?? "Tanpa tema",
    createdAt: row.created_at,
    data: parsePhotoJob(row.photo_prompts),
    uploaded: row.assets?.[0]?.count ?? 0,
  }));
  let open = jobId && UUID_RE.test(jobId) ? rows.find((r) => r.id === jobId) : undefined;
  if (jobId && UUID_RE.test(jobId) && !open) {
    // Older than the ten listed: read it on its own.
    const { data: one } = await supabase
      .from("generation_jobs")
      .select("id, created_at, photo_prompts, themes(title), assets(count)")
      .eq("style", "photo")
      .eq("id", jobId)
      .maybeSingle();
    if (one) {
      open = {
        id: one.id,
        theme: one.themes?.title ?? "Tanpa tema",
        createdAt: one.created_at,
        data: parsePhotoJob(one.photo_prompts),
        uploaded: one.assets?.[0]?.count ?? 0,
      };
    }
  }

  return {
    recentJobs: rows.map((r) => ({ id: r.id, theme: r.theme, createdAt: r.createdAt, prompts: r.data?.prompts.length ?? 0, uploaded: r.uploaded })),
    openJob: open?.data ? { id: open.id, theme: open.theme, data: open.data, uploaded: open.uploaded } : null,
    error: jobId && !open?.data ? "Prompt foto itu tidak ditemukan." : undefined,
  };
}
