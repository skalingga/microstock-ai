import Link from "next/link";
import { QC_LABEL, SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 24;

export default async function HalamanAset({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; page?: string }>;
}) {
  const params = await searchParams;
  const job = params.job && UUID_RE.test(params.job) ? params.job : undefined;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("assets")
    .select("id, preview_path, concept, provider, model, qc_status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (job) query = query.eq("job_id", job);

  const { data: assets, count, error } = await query;

  // The bucket is private, so thumbnails need short-lived signed URLs.
  const paths = (assets ?? []).flatMap((a) => (a.preview_path ? [a.preview_path] : []));
  const signed = paths.length > 0 ? await supabase.storage.from("assets").createSignedUrls(paths, SIGNED_URL_TTL_SEC) : null;
  const urlByPath = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]));

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `/aset?${new URLSearchParams({ ...(job ? { job } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Aset</h1>
        <p className="text-muted-foreground">
          Semua aset SVG hasil generate. Pemeriksaan QC otomatis dan metadata AI dikerjakan di Tahap 3, jadi semua
          aset masih berstatus “Menunggu QC”.
        </p>
        {job && (
          <p className="text-sm">
            Menampilkan hasil satu job.{" "}
            <Link href="/aset" className="font-medium underline underline-offset-4">
              Lihat semua aset
            </Link>
          </p>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Aset tidak bisa dimuat. Muat ulang halaman.
        </p>
      ) : assets && assets.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">{total} aset</p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {assets.map((asset) => {
              const url = asset.preview_path ? urlByPath.get(asset.preview_path) : undefined;
              return (
                <li key={asset.id} className="space-y-1.5 text-xs">
                  <Link href={`/aset/${asset.id}`} className="block">
                    <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-md border transition-shadow hover:shadow-md">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={asset.concept ?? "Aset SVG"} className="size-full object-contain" loading="lazy" />
                      ) : (
                        <span className="text-muted-foreground">Tanpa preview</span>
                      )}
                    </div>
                  </Link>
                  <p className="line-clamp-2 text-muted-foreground">{asset.concept}</p>
                  <p className="flex flex-wrap items-center gap-x-2">
                    <span className="rounded bg-muted px-1.5 py-0.5">{QC_LABEL[asset.qc_status] ?? asset.qc_status}</span>
                    <span className="text-muted-foreground">{asset.provider}</span>
                  </p>
                </li>
              );
            })}
          </ul>

          {lastPage > 1 && (
            <nav aria-label="Halaman" className="flex items-center gap-4 text-sm">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="underline underline-offset-4">
                  Sebelumnya
                </Link>
              ) : (
                <span className="text-muted-foreground">Sebelumnya</span>
              )}
              <span>
                Halaman {page} dari {lastPage}
              </span>
              {page < lastPage ? (
                <Link href={pageHref(page + 1)} className="underline underline-offset-4">
                  Berikutnya
                </Link>
              ) : (
                <span className="text-muted-foreground">Berikutnya</span>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada aset.{" "}
          <Link href="/generate" className="font-medium text-foreground underline underline-offset-4">
            Buat yang pertama di Generate
          </Link>
          .
        </div>
      )}
    </div>
  );
}
