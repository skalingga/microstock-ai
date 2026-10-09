import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PenPath } from "@/components/pen-motif";
import { SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { startOfMonthWib } from "@/lib/budget";
import { parseCells, suggest, summarize, type BenchSetup } from "@/lib/generate/benchmark";
import { withEnvDefaults } from "@/lib/settings/provider-defaults";
import { toProviderOrder } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { BenchmarkRunner, BenchResults, type Current } from "./benchmark-client";

export const metadata: Metadata = { title: "Uji model" };

const STATUS_LABEL: Record<string, string> = {
  berjalan: "terputus",
  selesai: "selesai",
  dihentikan: "kamu hentikan",
  gagal: "berhenti karena error",
};

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export default async function HalamanUjiModel({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: settings }, { data: runs, error: runsError }, { data: spent }, { data: svgCosts }] = await Promise.all([
    supabase.from("user_settings").select("banned_words, provider_order, kenari_monthly_budget_idr").maybeSingle(),
    supabase.from("model_benchmarks").select("id, status, setup, results, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.rpc("provider_cost_since", { p_provider: "kenari", p_since: startOfMonthWib() }),
    // What paid SVG calls really cost, per model: the estimate shown before a run.
    supabase.from("provider_usage").select("model, cost_idr").eq("kind", "svg").eq("provider", "kenari").gt("cost_idr", 0).order("created_at", { ascending: false }).limit(500),
  ]);

  const costRuns: Record<string, number[]> = {};
  for (const row of svgCosts ?? []) (costRuns[row.model] ??= []).push(Number(row.cost_idr));
  const costPerSvg: Record<string, number> = {};
  for (const [model, costs] of Object.entries(costRuns)) costPerSvg[model] = costs.reduce((a, b) => a + b, 0) / costs.length;
  const budgetLeftIdr = Math.max(0, (settings?.kenari_monthly_budget_idr ?? 0) - Number(spent ?? 0));

  // The chain as it runs today, with empty model fields resolved to their defaults.
  const chain = withEnvDefaults(settings ? toProviderOrder(settings.provider_order) : []);
  const current: Current = { primary: chain[0] ?? null, backup: chain[1] ?? null };

  // Median time per SVG per model, newest run first: the estimate shown before the next run.
  const msPerSvg: Record<string, number> = {};
  for (const r of runs ?? []) {
    for (const row of summarize(parseCells(r.results))) {
      const k = `${row.provider}|${row.model}`;
      if (row.medianMs !== null && msPerSvg[k] === undefined) msPerSvg[k] = row.medianMs;
    }
  }

  const selected = runs?.find((r) => r.id === (run && UUID_RE.test(run) ? run : undefined)) ?? runs?.[0];
  const cells = selected ? parseCells(selected.results) : [];

  // Previews of the selected run, signed like the gallery's.
  const previews: Record<string, string> = {};
  const ids = cells.map((c) => c.assetId).filter((id): id is string => !!id);
  if (ids.length > 0) {
    const { data: assets } = await supabase.from("assets").select("id, preview_path").in("id", ids);
    const paths = (assets ?? []).map((a) => a.preview_path).filter((p): p is string => !!p);
    const { data: signed } = paths.length ? await supabase.storage.from("assets").createSignedUrls(paths, SIGNED_URL_TTL_SEC) : { data: null };
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const a of assets ?? []) {
      const url = a.preview_path ? urlByPath.get(a.preview_path) : undefined;
      if (url) previews[a.id] = url;
    }
  }

  const hasRuns = Boolean(runs && runs.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Uji model" description="Konsep yang sama digambar beberapa model, lalu dinilai QC. Pemenangnya bisa langsung dipakai." />

      <BenchmarkRunner
        userId={user.id}
        bannedWords={settings?.banned_words ?? []}
        hasRuns={hasRuns}
        costPerSvg={costPerSvg}
        msPerSvg={msPerSvg}
        budgetLeftIdr={budgetLeftIdr}
      />

      {runsError && (
        <p role="alert" className="text-sm text-destructive">
          Hasil uji tersimpan tidak bisa dimuat. Muat ulang halaman.
        </p>
      )}

      {selected ? (
        <section className="space-y-4" aria-labelledby="hasil-heading">
          <div className="space-y-2">
            <h2 id="hasil-heading" className="text-2xl font-extrabold tracking-tight">
              Hasil uji
            </h2>
            <nav aria-label="Uji tersimpan" className="flex flex-wrap gap-2 text-sm">
              {runs!.map((r) => {
                const winner = suggest(summarize(parseCells(r.results))).primary;
                const active = r.id === selected.id;
                return (
                  <Link
                    key={r.id}
                    href={`/uji-model?run=${r.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex flex-col items-start rounded-md border bg-card px-3 py-1.5 text-left transition-colors duration-150",
                      tapTarget,
                      active ? "border-foreground bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span>
                      {dateFormat.format(new Date(r.created_at))} · {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    {winner && <span className="font-mono text-xs">{winner.model}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
          <BenchResults
            setup={selected.setup as unknown as BenchSetup}
            cells={cells}
            previews={previews}
            current={current}
            saved={{ id: selected.id, status: selected.status }}
          />
        </section>
      ) : (
        !runsError && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            <PenPath className="max-w-56" />
            <p>Belum ada uji. Mulai uji di atas untuk melihat model mana yang paling sering Lolos.</p>
          </div>
        )
      )}
    </div>
  );
}
