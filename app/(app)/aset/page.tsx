import { ChevronLeft, ChevronRight, Spline } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PenPath } from "@/components/pen-motif";
import { buttonVariants } from "@/components/ui/button";
import { SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { countPending } from "@/lib/qc/batch";
import { createClient } from "@/lib/supabase/server";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { AssetGrid } from "./asset-grid";
import { AssetToolbar } from "./asset-toolbar";

const PAGE_SIZE = 24;

const FILTERS = [
  { value: "semua", label: "Semua" },
  { value: "menunggu", label: "Menunggu" },
  { value: "lolos", label: "Lolos" },
  { value: "perlu_cek", label: "Perlu cek" },
  { value: "gagal", label: "Gagal" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

export default async function HalamanAset({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; status?: string; page?: string; adobe?: string }>;
}) {
  const params = await searchParams;
  const job = params.job && UUID_RE.test(params.job) ? params.job : undefined;
  // Exported assets still waiting for Adobe's decision (link from the export page).
  const adobePending = params.adobe === "belum";
  const status = (FILTERS.find((f) => f.value === params.status)?.value ?? "semua") as FilterValue;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase
    .from("assets")
    .select("id, preview_path, title, concept, provider, qc_status, created_at, exported_at, adobe_status", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (job) query = query.eq("job_id", job);
  if (adobePending) query = query.not("exported_at", "is", null).is("adobe_status", null);
  if (status !== "semua") query = query.eq("qc_status", status);

  const countAdobePending = () => {
    let q = supabase.from("assets").select("id", { count: "exact", head: true }).not("exported_at", "is", null).is("adobe_status", null);
    if (job) q = q.eq("job_id", job);
    return q;
  };

  const countOf = (qc?: string) => {
    let q = supabase.from("assets").select("id", { count: "exact", head: true });
    if (job) q = q.eq("job_id", job);
    if (adobePending) q = q.not("exported_at", "is", null).is("adobe_status", null);
    if (qc) q = q.eq("qc_status", qc);
    return q;
  };

  const [{ data: assets, count, error }, all, menunggu, lolos, perluCek, gagal, pending, adobeCount, settings] = await Promise.all([
    query,
    countOf(),
    countOf("menunggu"),
    countOf("lolos"),
    countOf("perlu_cek"),
    countOf("gagal"),
    countPending(supabase, job),
    countAdobePending(),
    supabase.from("user_settings").select("banned_words").maybeSingle(),
  ]);
  const counts: Record<FilterValue, number> = {
    semua: all.count ?? 0,
    menunggu: menunggu.count ?? 0,
    lolos: lolos.count ?? 0,
    perlu_cek: perluCek.count ?? 0,
    gagal: gagal.count ?? 0,
  };

  // The bucket is private, so thumbnails need short-lived signed URLs.
  const paths = (assets ?? []).flatMap((a) => (a.preview_path ? [a.preview_path] : []));
  const signed = paths.length > 0 ? await supabase.storage.from("assets").createSignedUrls(paths, SIGNED_URL_TTL_SEC) : null;
  const urlByPath = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]));

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (over: { status?: FilterValue; page?: number; adobe?: boolean }) => {
    const qs = new URLSearchParams();
    if (job) qs.set("job", job);
    if (over.adobe ?? adobePending) qs.set("adobe", "belum");
    const s = over.status ?? status;
    if (s !== "semua") qs.set("status", s);
    if (over.page && over.page > 1) qs.set("page", String(over.page));
    const text = qs.toString();
    return text ? `/aset?${text}` : "/aset";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aset"
        description="Semua aset SVG beserta status QC."
        actions={
          <Link href="/generate" className={buttonVariants({ size: "lg" })}>
            <Spline />
            Generate baru
          </Link>
        }
      >
        {adobePending && (
          <p className="inline-flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground">
            Aset yang sudah diekspor tapi keputusan Adobe-nya belum dicatat.
            <Link href="/aset" className={cn("inline-flex items-center font-semibold underline underline-offset-4", tapTarget)}>
              Lihat semua aset
            </Link>
          </p>
        )}
        {job && (
          <p className="inline-flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground">
            Menampilkan hasil satu job.
            <Link href="/aset" className={cn("inline-flex items-center font-semibold underline underline-offset-4", tapTarget)}>
              Lihat semua aset
            </Link>
          </p>
        )}
      </PageHeader>

      <AssetToolbar pending={pending} bannedWords={settings.data?.banned_words ?? []} job={job} />

      <nav aria-label="Filter status" className="flex flex-wrap gap-1 rounded-xl border bg-card p-1 sm:inline-flex">
        {FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <Link
              key={f.value}
              href={href({ status: f.value, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150",
                tapTarget,
                active ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-sm px-1.5 py-px text-xs tabular-nums",
                  active ? "bg-primary-foreground text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[f.value]}
              </span>
            </Link>
          );
        })}
      </nav>

      <Link
        href={adobePending ? href({ adobe: false }) : href({ adobe: true, page: 1 })}
        aria-pressed={adobePending}
        className={cn(
          "ml-1 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline sm:ml-3",
          tapTarget,
          adobePending ? "font-semibold text-foreground underline" : "text-muted-foreground",
        )}
      >
        Diekspor, belum dicatat Adobe
        <span className="rounded-sm bg-muted px-1.5 py-px text-xs tabular-nums text-muted-foreground no-underline">{adobeCount.count ?? 0}</span>
      </Link>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Aset tidak bisa dimuat. Muat ulang halaman.
        </p>
      ) : assets && assets.length > 0 ? (
        <>
          <AssetGrid
            assets={assets.map((asset) => ({
              id: asset.id,
              previewUrl: (asset.preview_path && urlByPath.get(asset.preview_path)) || undefined,
              label: asset.title ?? asset.concept ?? "Aset SVG",
              qcStatus: asset.qc_status,
              exported: Boolean(asset.exported_at),
              adobeStatus: asset.adobe_status,
              exportable: Boolean(asset.title) && (asset.qc_status === "lolos" || asset.qc_status === "perlu_cek"),
            }))}
          />

          {lastPage > 1 && (
            <nav aria-label="Halaman" className="flex items-center justify-center gap-3 text-sm">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className={buttonVariants({ variant: "outline" })}>
                  <ChevronLeft />
                  Sebelumnya
                </Link>
              ) : (
                <span className={buttonVariants({ variant: "outline", className: "pointer-events-none opacity-50" })}>
                  <ChevronLeft />
                  Sebelumnya
                </span>
              )}
              <span className="px-2 text-muted-foreground tabular-nums">
                Halaman <span className="font-semibold text-foreground">{page}</span> dari {lastPage}
              </span>
              {page < lastPage ? (
                <Link href={href({ page: page + 1 })} className={buttonVariants({ variant: "outline" })}>
                  Berikutnya
                  <ChevronRight />
                </Link>
              ) : (
                <span className={buttonVariants({ variant: "outline", className: "pointer-events-none opacity-50" })}>
                  Berikutnya
                  <ChevronRight />
                </span>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
          <PenPath className="max-w-56" />
          {status === "semua" && !adobePending && !job ? (
            <>
              Belum ada aset.{" "}
              <Link href="/generate" className="font-medium text-foreground underline underline-offset-4">
                Buat yang pertama di Generate
              </Link>
              .
            </>
          ) : (
            <>
              Tidak ada aset di filter ini.{" "}
              <Link href="/aset" className="font-medium text-foreground underline underline-offset-4">
                Lihat semua aset
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
