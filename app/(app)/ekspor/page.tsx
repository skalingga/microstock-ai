import Link from "next/link";
import { redirect } from "next/navigation";
import { AI_LABEL_REMINDER } from "@/lib/adobe/rules";
import { SIGNED_URL_TTL_SEC } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";
import type { ReviewedAsset } from "@/lib/adobe/stats";
import { AcceptanceReport } from "./acceptance-report";
import { ExportPanel, type Candidate } from "./export-panel";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const CHECKLIST = [
  "Ekstrak file ZIP lebih dulu. Adobe tidak menerima ZIP untuk vektor, jadi yang diunggah adalah file SVG-nya satu per satu.",
  "Buka Contributor Portal Adobe Stock, pilih Upload, lalu pilih semua file SVG hasil ekstrak.",
  `Untuk setiap aset, centang "${AI_LABEL_REMINDER}". Ini wajib untuk semua aset buatan AI.`,
  "Impor file CSV (Upload CSV) agar judul, keyword, dan kategori terisi. Jangan mengubah baris header.",
  "Periksa kategori di dialog CSV. Nomor kategori di aplikasi belum dikonfirmasi resmi oleh Adobe. Periksa juga peringatan ukuran artboard (minimal 15 MP).",
  "Lihat kembali setiap aset sebelum submit. Aset yang menggambarkan orang atau properti nyata butuh release.",
];

export default async function HalamanEkspor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: assets }, { data: history }, waiting, failed, { data: reviewed }, awaiting] = await Promise.all([
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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Ekspor</h1>
        <p className="text-muted-foreground">
          Unduh aset yang lolos QC sebagai ZIP (file SVG) dan CSV (judul, keyword, kategori) untuk diunggah ke Adobe Stock.
        </p>
        {((waiting.count ?? 0) > 0 || (failed.count ?? 0) > 0) && (
          <p className="text-sm text-muted-foreground">
            Belum bisa diekspor: {waiting.count ?? 0} aset menunggu QC atau metadata, {failed.count ?? 0} gagal QC.{" "}
            <Link href="/aset" className="font-medium underline underline-offset-4">
              Lihat di Aset
            </Link>
          </p>
        )}
      </div>

      <ExportPanel userId={user.id} candidates={candidates} />

      <AcceptanceReport rows={reviewedRows} awaiting={awaiting.count ?? 0} />

      <section className="space-y-3 rounded-lg border p-4" aria-labelledby="checklist-heading">
        <h2 id="checklist-heading" className="font-medium">
          Checklist upload ke Adobe Stock
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {CHECKLIST.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-3" aria-labelledby="riwayat-heading">
        <h2 id="riwayat-heading" className="font-medium">
          Riwayat ekspor
        </h2>
        {history && history.length > 0 ? (
          <ul className="divide-y rounded-lg border text-sm">
            {history.map((h) => {
              const zip = h.zip_path ? fileByPath.get(h.zip_path) : undefined;
              const csv = h.csv_path ? fileByPath.get(h.csv_path) : undefined;
              return (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    {dateFormat.format(new Date(h.created_at))} · {h.asset_count} aset
                  </span>
                  <span className="flex gap-3">
                    {zip && (
                      <a href={zip} className="underline underline-offset-4">
                        ZIP
                      </a>
                    )}
                    {csv && (
                      <a href={csv} className="underline underline-offset-4">
                        CSV
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada ekspor.</p>
        )}
      </section>
    </div>
  );
}
