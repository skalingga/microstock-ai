import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { redirect } from "next/navigation";
import { AI_LABEL_REMINDER } from "@/lib/adobe/rules";
import { SIGNED_URL_TTL_SEC } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";
import type { ReviewedAsset } from "@/lib/adobe/stats";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { AcceptanceReport } from "./acceptance-report";
import { ExportPanel, type Candidate } from "./export-panel";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const CHECKLIST = [
  "Ekstrak ZIP, lalu unggah file SVG-nya (Adobe tidak menerima ZIP untuk vektor).",
  "Di Contributor Portal: Upload, pilih semua file SVG.",
  `Centang "${AI_LABEL_REMINDER}" di setiap aset.`,
  "Upload CSV agar judul, keyword, dan kategori terisi. Jangan ubah baris header.",
  "Cek kategori dan peringatan ukuran artboard sebelum submit.",
  "Aset dengan orang atau properti nyata butuh release.",
];

function LoadError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}

export default async function HalamanEkspor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: assets, error: assetsError },
    { data: history, error: historyError },
    waiting,
    failed,
    { data: reviewed, error: reviewedError },
    awaiting,
  ] = await Promise.all([
    supabase
      .from("assets")
      .select("id, title, qc_status, exported_at, preview_path")
      .not("title", "is", null)
      .in("qc_status", ["lolos", "perlu_cek"])
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("exports").select("id, asset_count, created_at, zip_path, csv_path").order("created_at", { ascending: false }).limit(10),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("qc_status", "menunggu"),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("qc_status", "gagal"),
    supabase
      .from("assets")
      .select("provider, model, qc_status, path_count, adobe_status, adobe_reason, job_id")
      .not("adobe_status", "is", null)
      .limit(2000),
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .not("exported_at", "is", null)
      .is("adobe_status", null),
  ]);

  // Style lives on the job, not the asset.
  const jobIds = [...new Set((reviewed ?? []).map((r) => r.job_id))];
  const { data: jobs } = jobIds.length > 0 ? await supabase.from("generation_jobs").select("id, style").in("id", jobIds) : { data: [] };
  const styleByJob = new Map((jobs ?? []).map((j) => [j.id, j.style]));
  const reviewedRows: ReviewedAsset[] = (reviewed ?? []).flatMap((r) =>
    r.adobe_status === "diterima" || r.adobe_status === "ditolak"
      ? [
          {
            provider: r.provider,
            model: r.model,
            style: styleByJob.get(r.job_id) ?? "icon_set",
            qcStatus: r.qc_status,
            pathCount: r.path_count,
            adobeStatus: r.adobe_status,
            adobeReason: r.adobe_reason,
          },
        ]
      : [],
  );

  const storage = supabase.storage.from("assets");
  const thumbPaths = (assets ?? []).flatMap((a) => (a.preview_path ? [a.preview_path] : []));
  const historyPaths = (history ?? []).flatMap((h) => [h.zip_path, h.csv_path].filter((p): p is string => Boolean(p)));
  const [thumbs, files] = await Promise.all([
    thumbPaths.length > 0 ? storage.createSignedUrls(thumbPaths, SIGNED_URL_TTL_SEC) : null,
    historyPaths.length > 0 ? storage.createSignedUrls(historyPaths, SIGNED_URL_TTL_SEC) : null,
  ]);
  const thumbByPath = new Map((thumbs?.data ?? []).map((s) => [s.path, s.signedUrl]));
  const fileByPath = new Map((files?.data ?? []).map((s) => [s.path, s.signedUrl]));

  const candidates: Candidate[] = (assets ?? []).flatMap((a) =>
    a.title && (a.qc_status === "lolos" || a.qc_status === "perlu_cek")
      ? [
          {
            id: a.id,
            title: a.title,
            status: a.qc_status,
            exportedAt: a.exported_at,
            thumbUrl: a.preview_path ? (thumbByPath.get(a.preview_path) ?? null) : null,
          },
        ]
      : [],
  );

  const readyCount = candidates.filter((c) => c.status === "lolos" && !c.exportedAt).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ekspor"
        description="ZIP berisi SVG dan CSV metadata untuk Adobe Stock."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
          <StatCard label="Siap diekspor" value={assetsError ? "–" : readyCount} />
          <StatCard
            label="Menunggu QC"
            value={waiting.error ? "–" : (waiting.count ?? 0)}
            detail={
              <Link
                href="/aset?status=menunggu"
                className={cn("inline-flex items-center font-semibold text-foreground underline underline-offset-4 hover:decoration-2", tapTarget)}
              >
                Proses di Aset
              </Link>
            }
          />
          <StatCard label="Gagal QC" value={failed.error ? "–" : (failed.count ?? 0)} />
        </div>
      </PageHeader>

      {assetsError ? (
        <LoadError>Daftar aset untuk ekspor tidak bisa dimuat. Muat ulang halaman.</LoadError>
      ) : (
        <ExportPanel userId={user.id} candidates={candidates} />
      )}

      {reviewedError || awaiting.error ? (
        <LoadError>Data penerimaan Adobe tidak bisa dimuat. Muat ulang halaman.</LoadError>
      ) : (
        <AcceptanceReport rows={reviewedRows} awaiting={awaiting.count ?? 0} />
      )}

      <section className="space-y-4 rounded-2xl border bg-card p-5" aria-labelledby="checklist-heading">
        <h2 id="checklist-heading" className="text-lg font-bold">
          Checklist upload ke Adobe Stock
        </h2>
        <ol className="space-y-2.5 text-sm">
          {CHECKLIST.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span aria-hidden className="w-5 shrink-0 pt-0.5 text-right font-extrabold tabular-nums">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5" aria-labelledby="riwayat-heading">
        <h2 id="riwayat-heading" className="text-lg font-bold">
          Riwayat ekspor
        </h2>
        {historyError ? (
          <p role="alert" className="text-sm text-destructive">
            Riwayat ekspor tidak bisa dimuat. Muat ulang halaman.
          </p>
        ) : history && history.length > 0 ? (
          <ul className="divide-y text-sm">
            {history.map((h) => {
              const zip = h.zip_path ? fileByPath.get(h.zip_path) : undefined;
              const csv = h.csv_path ? fileByPath.get(h.csv_path) : undefined;
              return (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {dateFormat.format(new Date(h.created_at))} · {h.asset_count} aset
                  </span>
                  <span className="flex gap-1">
                    {zip && (
                      <a href={zip} className={cn("inline-flex items-center px-2 underline underline-offset-4", tapTarget)}>
                        ZIP
                      </a>
                    )}
                    {csv && (
                      <a href={csv} className={cn("inline-flex items-center px-2 underline underline-offset-4", tapTarget)}>
                        CSV
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada ekspor. File ZIP dan CSV yang kamu buat di atas akan muncul di sini.</p>
        )}
      </section>
    </div>
  );
}
