import Link from "next/link";
import { notFound } from "next/navigation";
import { QC_LABEL, SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "./delete-button";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export default async function HalamanDetailAset({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  if (!asset) notFound();

  const storage = supabase.storage.from("assets");
  const [view, download] = await Promise.all([
    asset.svg_path ? storage.createSignedUrl(asset.svg_path, SIGNED_URL_TTL_SEC) : null,
    asset.svg_path ? storage.createSignedUrl(asset.svg_path, SIGNED_URL_TTL_SEC, { download: `aset-${asset.id.slice(0, 8)}.svg` }) : null,
  ]);

  const rows: [string, string][] = [
    ["Status QC", QC_LABEL[asset.qc_status] ?? asset.qc_status],
    ["Provider", asset.provider],
    ["Model", asset.model],
    ["Jumlah bentuk", asset.path_count === null ? "-" : String(asset.path_count)],
    ["Dibuat", dateFormat.format(new Date(asset.created_at))],
  ];

  return (
    <div className="space-y-6">
      <Link href={`/aset?job=${asset.job_id}`} className="text-sm underline underline-offset-4">
        ← Kembali ke aset
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-lg border">
          {view?.data?.signedUrl ? (
            // Shown through <img>, never inline, so scripts in an SVG can never run.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.data.signedUrl} alt={asset.concept ?? "Aset SVG"} className="size-full object-contain" />
          ) : (
            <span className="text-sm text-muted-foreground">File SVG tidak tersedia.</span>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{asset.title ?? "Aset tanpa judul"}</h1>
            {asset.concept && <p className="text-muted-foreground">{asset.concept}</p>}
            {!asset.title && (
              <p className="text-sm text-muted-foreground">Judul dan keyword dibuat otomatis di Tahap 3.</p>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-start gap-3">
            {download?.data?.signedUrl && (
              <a
                href={download.data.signedUrl}
                className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
              >
                Unduh SVG
              </a>
            )}
            <DeleteButton id={asset.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
