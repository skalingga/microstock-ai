import Link from "next/link";
import { QcBadge } from "@/components/qc-badge";
import { SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { countPending } from "@/lib/qc/batch";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
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
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Aset</h1>
        <p className="text-muted-foreground">
          Semua aset SVG hasil generate beserta status QC dan metadata. Hanya aset berstatus Lolos yang bisa diekspor
          tanpa konfirmasi.
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

      <AssetToolbar pending={pending} bannedWords={settings.data?.banned_words ?? []} job={job} />

      <nav aria-label="Filter status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href({ status: f.value, page: 1 })}
            aria-current={status === f.value ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1 text-sm transition-colors",
              status === f.value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {f.label} <span className="opacity-70">{counts[f.value]}</span>
          </Link>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Aset tidak bisa dimuat. Muat ulang halaman.
        </p>
      ) : assets && assets.length > 0 ? (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {assets.map((asset) => {
              const url = asset.preview_path ? urlByPath.get(asset.preview_path) : undefined;
              return (
                <li key={asset.id} className="space-y-1.5 text-xs">
                  <Link href={`/aset/${asset.id}`} className="block">
                    <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-md border transition-shadow hover:shadow-md">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={asset.title ?? asset.concept ?? "Aset SVG"} className="size-full object-contain" loading="lazy" />
                      ) : (
                        <span className="text-muted-foreground">Tanpa preview</span>
                      )}
                    </div>
                  </Link>
                  <p className="line-clamp-2 font-medium">{asset.title ?? asset.concept}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <QcBadge status={asset.qc_status} />
                    {asset.exported_at && <span className="text-muted-foreground">Diekspor</span>}
                    {asset.adobe_status === "diterima" && <span className="font-medium text-emerald-700">Diterima Adobe</span>}
                    {asset.adobe_status === "ditolak" && <span className="font-medium text-red-700">Ditolak Adobe</span>}
                  </p>
                </li>
              );
            })}
          </ul>

          {lastPage > 1 && (
            <nav aria-label="Halaman" className="flex items-center gap-4 text-sm">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className="underline underline-offset-4">
                  Sebelumnya
                </Link>
              ) : (
                <span className="text-muted-foreground">Sebelumnya</span>
              )}
              <span>
                Halaman {page} dari {lastPage}
              </span>
              {page < lastPage ? (
                <Link href={href({ page: page + 1 })} className="underline underline-offset-4">
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
