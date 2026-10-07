import { ChevronLeft, ChevronRight, LayoutGrid, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { countPending } from "@/lib/qc/batch";
import { createClient } from "@/lib/supabase/server";
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
  searchParams: Promise<{ job?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const job = params.job && UUID_RE.test(params.job) ? params.job : undefined;
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
  if (status !== "semua") query = query.eq("qc_status", status);

  const countOf = (qc?: string) => {
    let q = supabase.from("assets").select("id", { count: "exact", head: true });
    if (job) q = q.eq("job_id", job);
    if (qc) q = q.eq("qc_status", qc);
    return q;
  };

  const [{ data: assets, count, error }, all, menunggu, lolos, perluCek, gagal, pending, settings] = await Promise.all([
    query,
    countOf(),
    countOf("menunggu"),
    countOf("lolos"),
    countOf("perlu_cek"),
    countOf("gagal"),
    countPending(supabase, job),
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
  const href = (over: { status?: FilterValue; page?: number }) => {
    const qs = new URLSearchParams();
    if (job) qs.set("job", job);
    const s = over.status ?? status;
    if (s !== "semua") qs.set("status", s);
    if (over.page && over.page > 1) qs.set("page", String(over.page));
    const text = qs.toString();
    return text ? `/aset?${text}` : "/aset";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutGrid}
        title="Aset"
        description="Semua aset SVG beserta status QC."
        actions={
          <Link href="/generate" className={buttonVariants({ size: "lg" })}>
            <Sparkles />
            Generate baru
          </Link>
        }
      >
        {job && (
          <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
            Menampilkan hasil satu job.
            <Link href="/aset" className="font-semibold underline underline-offset-4">
              Lihat semua aset
            </Link>
          </p>
        )}
      </PageHeader>

      <AssetToolbar pending={pending} bannedWords={settings.data?.banned_words ?? []} job={job} />

      <nav aria-label="Filter status" className="flex flex-wrap gap-1 rounded-2xl border bg-card p-1 shadow-xs sm:inline-flex">
        {FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <Link
              key={f.value}
              href={href({ status: f.value, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors duration-150",
                active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-xs tabular-nums",
                  active ? "bg-white/20" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[f.value]}
              </span>
            </Link>
          );
        })}
      </nav>

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
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <LayoutGrid className="size-6" />
          </span>
          {status === "semua" ? (
            <>
              Belum ada aset.{" "}
              <Link href="/generate" className="font-medium text-foreground underline underline-offset-4">
                Buat yang pertama di Generate
              </Link>
              .
            </>
          ) : (
            "Tidak ada aset dengan status ini."
          )}
        </div>
      )}
    </div>
  );
}
