import { ChevronLeft, ChevronRight, Search, Spline } from "lucide-react";
import Link from "next/link";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { PenPath } from "@/components/pen-motif";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_BULK_DELETE, SIGNED_URL_TTL_SEC } from "@/lib/assets";
import { countPending } from "@/lib/qc/batch";
import { createClient } from "@/lib/supabase/server";
import { selectClass, tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { AssetGrid } from "./asset-grid";
import { AssetToolbar } from "./asset-toolbar";
import { applyGalleryFilter, FILTERS, KINDS, galleryQuery, MAX_SEARCH_LENGTH, parseGalleryFilter, withQuery, type FilterValue, type GalleryParams } from "./filters";

const PAGE_SIZE = 24;
const BATCH_CHOICES = 50;
const dayFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

export default async function HalamanAset({ searchParams }: { searchParams: Promise<GalleryParams> }) {
  const filter = parseGalleryFilter(await searchParams);
  const { job, status, kind, adobePending, q, page } = filter;
  const from = (page - 1) * PAGE_SIZE;
  const href = (over: Partial<typeof filter>) => withQuery("/aset", galleryQuery(filter, over));

  const supabase = await createClient();

  const query = applyGalleryFilter(
    supabase
      .from("assets")
      .select("id, kind, preview_path, title, concept, provider, qc_status, created_at, exported_at, adobe_status", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    filter,
  );

  const countOf = (qc?: FilterValue) =>
    applyGalleryFilter(supabase.from("assets").select("id", { count: "exact", head: true }), { ...filter, status: qc ?? "semua" });

  // The first assets of the whole filter, so "select all in this filter" works across pages.
  const firstQuery = applyGalleryFilter(
    supabase
      .from("assets")
      .select("id, title, qc_status, exported_at, adobe_status")
      .order("created_at", { ascending: false })
      .range(0, MAX_BULK_DELETE - 1),
    filter,
  );

  const [{ data: assets, count, error }, all, menunggu, lolos, perluCek, gagal, pending, adobeCount, settings, jobInfo, { data: first }] = await Promise.all([
    query,
    countOf(),
    countOf("menunggu"),
    countOf("lolos"),
    countOf("perlu_cek"),
    countOf("gagal"),
    countPending(supabase, job),
    applyGalleryFilter(supabase.from("assets").select("id", { count: "exact", head: true }), { ...filter, status: "semua", adobePending: true }),
    supabase.from("user_settings").select("banned_words").maybeSingle(),
    job ? supabase.from("generation_jobs").select("themes(title)").eq("id", job).maybeSingle() : null,
    firstQuery,
  ]);

  // Batches to pick from: the newest ones, plus the current one even when it is older.
  const { data: jobRows } = await supabase
    .from("generation_jobs")
    .select("id, created_at, themes(title)")
    .order("created_at", { ascending: false })
    .limit(BATCH_CHOICES);
  const batches = (jobRows ?? []).map((j) => ({ id: j.id, label: `${j.themes?.title ?? "Tanpa tema"} · ${dayFormat.format(new Date(j.created_at))}` }));
  if (job && !batches.some((b) => b.id === job)) batches.push({ id: job, label: `${jobInfo?.data?.themes?.title ?? "Tanpa tema"} (batch ini)` });
  const counts: Record<FilterValue, number> = {
    semua: all.count ?? 0,
    menunggu: menunggu.count ?? 0,
    lolos: lolos.count ?? 0,
    perlu_cek: perluCek.count ?? 0,
    gagal: gagal.count ?? 0,
  };
  const adobeWaiting = adobeCount.count ?? 0;

  // The bucket is private, so thumbnails need short-lived signed URLs.
  const paths = (assets ?? []).flatMap((a) => (a.preview_path ? [a.preview_path] : []));
  const signed = paths.length > 0 ? await supabase.storage.from("assets").createSignedUrls(paths, SIGNED_URL_TTL_SEC) : null;
  const urlByPath = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]));

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const scope = [
    job && `batch "${jobInfo?.data?.themes?.title ?? "tanpa tema"}"`,
    adobePending && "sudah diekspor, keputusan Adobe belum dicatat",
    q && `judul memuat "${q}"`,
    kind !== "semua" && (kind === "foto" ? "foto" : "vektor"),
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aset"
        description="Semua aset SVG dan foto beserta status QC."
        actions={
          <Link href="/generate" className={buttonVariants({ size: "lg" })}>
            <Spline />
            Generate baru
          </Link>
        }
      >
        {scope.length > 0 && (
          <p className="inline-flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground">
            Hanya {scope.join(" dan ")}.
            <Link href="/aset" className={cn("inline-flex items-center font-semibold underline underline-offset-4", tapTarget)}>
              Lihat semua aset
            </Link>
          </p>
        )}
      </PageHeader>

      <AssetToolbar pending={pending} bannedWords={settings.data?.banned_words ?? []} job={job} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav aria-label="Filter status" className="flex flex-wrap gap-1 rounded-md border bg-card p-1 sm:inline-flex">
          {FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <Link
                key={f.value}
                href={href({ status: f.value, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-sm px-3.5 text-sm font-medium transition-colors duration-150",
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
        <nav aria-label="Filter jenis" className="flex flex-wrap gap-1">
          {KINDS.map((k) => {
            const active = kind === k.value;
            return (
              <Link
                key={k.value}
                href={href({ kind: k.value, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-md border px-3 text-sm",
                  tapTarget,
                  active ? "border-foreground bg-secondary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {k.label}
              </Link>
            );
          })}
        </nav>
        <InfoTip align="start" label="Arti status">
          Lolos: siap diekspor. Perlu cek: boleh diekspor setelah kamu periksa sendiri. Gagal: tidak bisa diekspor; jalankan QC ulang atau hapus.
          Menunggu: belum punya QC atau metadata.
        </InfoTip>
      </div>

      <form action="/aset" method="get" role="search" className="flex flex-wrap gap-2">
        {batches.length > 1 && (
          <select name="job" defaultValue={job ?? ""} aria-label="Batch" className={cn(selectClass, "w-auto max-w-56")}>
            <option value="">Semua batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        )}
        {batches.length <= 1 && job && <input type="hidden" name="job" value={job} />}
        {status !== "semua" && <input type="hidden" name="status" value={status} />}
        {kind !== "semua" && <input type="hidden" name="jenis" value={kind} />}
        {adobePending && <input type="hidden" name="adobe" value="belum" />}
        <Input type="search" name="q" defaultValue={q} maxLength={MAX_SEARCH_LENGTH} placeholder="Cari judul aset" aria-label="Cari judul aset" className="w-auto min-w-48 max-w-xs flex-1" />
        <Button type="submit" variant="outline">
          <Search />
          Terapkan
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link
          href={href({ adobePending: !adobePending, page: 1 })}
          aria-current={adobePending ? "true" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-3",
            tapTarget,
            "min-h-9",
            adobePending ? "border-foreground bg-secondary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Diekspor, belum dicatat Adobe
          <span className="rounded-sm bg-muted px-1.5 py-px text-xs text-muted-foreground tabular-nums">{adobeWaiting}</span>
        </Link>
        {adobeWaiting > 0 && (
          <Link href={withQuery("/aset/tinjau", job ? `job=${job}` : "")} className={cn("font-semibold underline underline-offset-4 hover:decoration-2", tapTarget, "inline-flex items-center")}>
            Tinjau satu per satu
          </Link>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Aset tidak bisa dimuat. Muat ulang halaman.
        </p>
      ) : assets && assets.length > 0 ? (
        <>
          <AssetGrid
            detailQuery={galleryQuery(filter)}
            filterTotal={total}
            filterFirst={(first ?? []).map((a) => ({
              id: a.id,
              exported: Boolean(a.exported_at),
              adobeStatus: a.adobe_status,
              exportable: Boolean(a.title) && (a.qc_status === "lolos" || a.qc_status === "perlu_cek"),
            }))}
            assets={assets.map((asset) => ({
              id: asset.id,
              previewUrl: (asset.preview_path && urlByPath.get(asset.preview_path)) || undefined,
              label: asset.title ?? asset.concept ?? (asset.kind === "photo" ? "Foto" : "Aset SVG"),
              photo: asset.kind === "photo",
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
                <span aria-disabled="true" className={buttonVariants({ variant: "outline", className: "pointer-events-none opacity-50" })}>
                  <ChevronLeft />
                  Sebelumnya
                </span>
              )}
              <span className="px-2 text-muted-foreground tabular-nums">
                Halaman <span className="font-semibold text-foreground">{page}</span> dari {lastPage}
              </span>
              <form action="/aset" method="get" className="flex items-center gap-1">
                {job && <input type="hidden" name="job" value={job} />}
                {status !== "semua" && <input type="hidden" name="status" value={status} />}
                {kind !== "semua" && <input type="hidden" name="jenis" value={kind} />}
                {adobePending && <input type="hidden" name="adobe" value="belum" />}
                {q && <input type="hidden" name="q" value={q} />}
                <Input type="number" name="page" min={1} max={lastPage} defaultValue={page} aria-label="Lompat ke halaman" className="w-16 tabular-nums" />
                <Button type="submit" variant="ghost" size="sm">
                  Buka
                </Button>
              </form>
              {page < lastPage ? (
                <Link href={href({ page: page + 1 })} className={buttonVariants({ variant: "outline" })}>
                  Berikutnya
                  <ChevronRight />
                </Link>
              ) : (
                <span aria-disabled="true" className={buttonVariants({ variant: "outline", className: "pointer-events-none opacity-50" })}>
                  Berikutnya
                  <ChevronRight />
                </span>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-md border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
          <PenPath className="max-w-56" />
          {status === "semua" && kind === "semua" && !adobePending && !job && !q ? (
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
