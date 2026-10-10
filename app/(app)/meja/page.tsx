import { ChevronRight, Spline } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Anchor, PenPath } from "@/components/pen-motif";
import { QcBadge } from "@/components/qc-badge";
import { buttonVariants } from "@/components/ui/button";
import { SIGNED_URL_TTL_SEC } from "@/lib/assets";
import { formatIdr, startOfDayWib, startOfMonthWib } from "@/lib/budget";
import { acceptanceRate, fetchDeskSummary, type Deadline } from "@/lib/dashboard/summary";
import { fetchActiveJob } from "@/lib/generate/active-job";
import { createClient } from "@/lib/supabase/server";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { ActiveJobCard, JOB_PREVIEWS } from "../generate/active-job-card";

export const metadata: Metadata = { title: "Meja" };

/** PRODUCT.md: more than 1.000 Lolos SVGs a month, about 33 a day (same target as Generate). */
const DAILY_LOLOS_TARGET = 33;
const RECENT = 8;

const todayFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jakarta" });
/** ISO dates are calendar days, so read them as UTC. */
const deadlineFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

/** The home page: what is running, what waits for the user, and the nearest research deadlines. */
export default async function HalamanMeja() {
  const supabase = await createClient();
  const [summary, activeJob, { data: settings }, { data: spent, error: spentError }, { count: lolosToday, error: lolosError }, recent] =
    await Promise.all([
      fetchDeskSummary(supabase),
      fetchActiveJob(supabase, { previews: JOB_PREVIEWS }),
      supabase.from("user_settings").select("kenari_monthly_budget_idr").maybeSingle(),
      supabase.rpc("provider_cost_since", { p_provider: "kenari", p_since: startOfMonthWib() }),
      supabase.from("assets").select("id", { count: "exact", head: true }).eq("qc_status", "lolos").gte("created_at", startOfDayWib()),
      supabase.from("assets").select("id, title, concept, kind, qc_status, preview_path").order("created_at", { ascending: false }).limit(RECENT),
    ]);

  const recentAssets = recent.data ?? [];
  const paths = recentAssets.flatMap((a) => (a.preview_path ? [a.preview_path] : []));
  const signed = paths.length > 0 ? await supabase.storage.from("assets").createSignedUrls(paths, SIGNED_URL_TTL_SEC) : null;
  const urlByPath = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]));

  const budgetLeft = settings ? Math.max(0, settings.kenari_monthly_budget_idr - Number(spent ?? 0)) : null;
  const rate = acceptanceRate(summary.accepted, summary.rejected);
  const waiting = [
    {
      count: summary.adobePending,
      label: "Catat keputusan Adobe",
      hint: "Sudah diekspor, belum dicatat",
      href: "/aset/tinjau",
    },
    // Only listed while something is open: the Adobe AI label is the step that must never be skipped.
    ...(summary.unfinishedUploads > 0
      ? [
          {
            count: summary.unfinishedUploads,
            label: "Selesaikan unggahan",
            hint:
              summary.missingAiLabel > 0
                ? `${summary.missingAiLabel} ekspor belum dicentang label AI Adobe`
                : "Checklist unggah belum selesai",
            href: "/ekspor#riwayat-heading",
          },
        ]
      : []),
    { count: summary.readyToExport, label: "Siap diekspor", hint: "Lolos dengan metadata, belum diekspor", href: "/ekspor" },
    { count: summary.needsCheck, label: "Cek manual", hint: "Perlu cek sebelum diekspor", href: "/aset?status=perlu_cek" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meja"
        description={todayFormat.format(new Date())}
        actions={
          <Link href="/generate" className={buttonVariants()}>
            <Spline />
            Generate baru
          </Link>
        }
      >
        <p className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-md bg-muted px-2.5 py-1 font-semibold tabular-nums">
            Lolos hari ini {lolosError ? "–" : `${lolosToday ?? 0}/${DAILY_LOLOS_TARGET}`}
          </span>
          {budgetLeft !== null && (
            <span className="rounded-md bg-muted px-2.5 py-1 font-semibold tabular-nums">
              Sisa anggaran {spentError ? "–" : formatIdr(budgetLeft)}
            </span>
          )}
        </p>
      </PageHeader>

      {summary.failed && (
        <p role="alert" className="text-sm text-destructive">
          Sebagian angka tidak bisa dimuat. Muat ulang halaman; angka yang tampil mungkin kurang.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {activeJob ? (
          <ActiveJobCard initial={activeJob} />
        ) : (
          // Phones: one compact row, so the waiting work stays on the first screen.
          <section aria-labelledby="idle-title" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-card p-4 sm:flex-col sm:items-start sm:p-5">
            <h2 id="idle-title" className="flex-1 text-lg font-extrabold">
              Tidak ada batch berjalan
            </h2>
            <PenPath className="max-w-48 max-sm:hidden sm:my-auto" />
            <p className="text-sm text-muted-foreground max-sm:hidden">Batch yang dimulai di PC atau HP muncul di sini, lengkap dengan kemajuannya.</p>
            <Link href="/generate" className={buttonVariants({ variant: "outline" })}>
              Mulai batch
            </Link>
          </section>
        )}

        <section aria-labelledby="waiting-title" className="rounded-lg border bg-card px-5 py-3">
          <h2 id="waiting-title" className="py-2 text-lg font-extrabold">
            Menunggu kamu
          </h2>
          <ul>
            {waiting.map((item) => (
              <li key={item.href} className="border-t first:border-t-0">
                <WaitingRow {...item} />
              </li>
            ))}
            {rate !== null && (
              <li className="border-t">
                <WaitingRow
                  count={`${rate}%`}
                  label="Diterima Adobe"
                  hint={`${summary.accepted} dari ${summary.accepted + summary.rejected} keputusan · laporan di Ekspor`}
                  href="/ekspor"
                  muted={false}
                />
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="deadline-title" className="rounded-lg border bg-card px-5 py-3 lg:col-span-2 xl:col-span-1">
          <h2 id="deadline-title" className="py-2 text-lg font-extrabold">
            Tenggat riset
          </h2>
          {summary.deadlines.length > 0 ? (
            <ul>
              {summary.deadlines.map((d) => (
                <li key={`${d.title}-${d.uploadBy}`} className="border-t first:border-t-0">
                  <DeadlineRow deadline={d} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="pb-2 text-sm text-muted-foreground">Tidak ada batas upload dalam 30 hari dari riset terakhir.</p>
          )}
          <Link href="/riset" className={cn(buttonVariants({ variant: "outline" }), "my-3 w-full")}>
            Buka Riset
          </Link>
        </section>
      </div>

      {recentAssets.length > 0 && (
        <section aria-labelledby="recent-title" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="recent-title" className="text-lg font-extrabold">
              Aset terbaru
            </h2>
            <Link href="/aset" className={cn("inline-flex items-center text-sm font-semibold underline underline-offset-4", tapTarget)}>
              Lihat semua di Aset
            </Link>
          </div>
          <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
            {recentAssets.map((asset) => {
              const label = asset.title ?? asset.concept ?? (asset.kind === "photo" ? "Foto" : "Aset SVG");
              const url = asset.preview_path ? urlByPath.get(asset.preview_path) : undefined;
              return (
                <li key={asset.id}>
                  <Link href={`/aset/${asset.id}`} className="block space-y-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span
                      className={cn(
                        "flex aspect-square items-center justify-center overflow-hidden rounded-sm border",
                        asset.kind === "photo" ? "bg-muted" : "bg-checker",
                      )}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={label} className={cn("size-full", asset.kind === "photo" ? "object-cover" : "object-contain")} loading="lazy" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Tanpa preview</span>
                      )}
                    </span>
                    <QcBadge status={asset.qc_status} className="max-sm:px-1" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function WaitingRow({
  count,
  label,
  hint,
  href,
  muted,
}: {
  count: number | string;
  label: string;
  hint: string;
  href: string;
  /** Defaults to "nothing to do" when the count is zero. */
  muted?: boolean;
}) {
  const quiet = muted ?? count === 0;
  return (
    <Link href={href} className="group flex min-h-16 items-center gap-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className={cn("w-14 shrink-0 text-2xl font-extrabold tabular-nums", quiet && "text-muted-foreground")}>{count}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold group-hover:underline group-hover:underline-offset-4">{label}</span>
        <span className="block text-sm text-muted-foreground">{quiet ? "Beres untuk sekarang" : hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function DeadlineRow({ deadline }: { deadline: Deadline }) {
  const urgent = deadline.status === "mendesak";
  const when = deadline.daysLeft === 0 ? "hari ini" : `${deadline.daysLeft} hari lagi`;
  return (
    <Link
      href={`/generate?tema=${encodeURIComponent(deadline.title)}&batas=${deadline.uploadBy}`}
      className="group flex min-h-14 items-center gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Vermilion only for the deadlines that are close: the one key moment on this card. */}
      <Anchor filled={urgent} className={urgent ? undefined : "text-muted-foreground"} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold group-hover:underline group-hover:underline-offset-4">{deadline.title}</span>
        <span className={cn("block text-sm", urgent ? "font-medium text-foreground" : "text-muted-foreground")}>
          Upload sebelum {deadlineFormat.format(new Date(`${deadline.uploadBy}T00:00:00Z`))} · {when}
        </span>
      </span>
      <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground">Generate</span>
    </Link>
  );
}
