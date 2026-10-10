"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutGrid, RefreshCw } from "lucide-react";
import { ProgressLine } from "@/components/pen-motif";
import { QcBadge } from "@/components/qc-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { POLL_MS, fetchActiveJob, type ActiveJob } from "@/lib/generate/active-job";
import { STYLES } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/client";

/** Thumbnails of the newest assets in the card: enough to judge the batch from a phone. */
export const JOB_PREVIEWS = 6;

const TITLE: Record<ActiveJob["state"], string> = {
  berjalan: "Antrean sedang berjalan",
  terputus: "Antrean terputus",
  selesai: "Batch terakhir",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/**
 * Read-only view of the latest batch, for a device that is not running the queue (usually the HP).
 * Re-reads the database every POLL_MS while the batch is running.
 */
export function ActiveJobCard({ initial }: { initial: ActiveJob }) {
  const [job, setJob] = useState(initial);
  const [checking, setChecking] = useState(false);

  async function refresh() {
    setChecking(true);
    const next = await fetchActiveJob(createClient(), { previews: JOB_PREVIEWS }).catch(() => undefined);
    // undefined = the read failed: keep the last known state rather than hiding the card.
    if (next) setJob(next);
    setChecking(false);
  }

  useEffect(() => {
    if (job.state !== "berjalan") return;
    const timer = setInterval(() => {
      // A hidden tab does not need fresh numbers; it catches up when shown again.
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [job.state]);

  const style = STYLES.find((s) => s.value === job.style)?.label ?? job.style;
  const parts = [
    `${job.lolos} Lolos`,
    `${job.perluCek} Perlu cek`,
    `${job.gagal} Gagal`,
    ...(job.menunggu > 0 ? [`${job.menunggu} tanpa metadata`] : []),
  ];

  return (
    <section aria-labelledby="active-job-title" className="space-y-4 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="active-job-title" className="text-lg font-extrabold">
            {TITLE[job.state]}
          </h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{job.theme}</span> · {style}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} disabled={checking}>
          <RefreshCw className={checking ? "animate-spin" : undefined} />
          Perbarui
        </Button>
      </div>

      <ProgressLine value={job.count > 0 ? job.made / job.count : 0} label="Kemajuan batch" />

      {job.previews && job.previews.length > 0 && (
        <ul aria-label="Aset terbaru batch ini" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {job.previews.map((p) => (
            <li key={p.url} className="space-y-1">
              <span className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-sm border">
                {/* Shown through <img>, never inline, so scripts in an SVG can never run. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="size-full object-contain" loading="lazy" />
              </span>
              <QcBadge status={p.qcStatus} />
            </li>
          ))}
        </ul>
      )}

      <div role="status" className="space-y-1 text-sm">
        <p>
          <span className="font-semibold tabular-nums">
            {job.made}/{job.count} aset tersimpan
          </span>
          {" · "}
          {parts.join(" · ")}
        </p>
        <p className="text-muted-foreground">
          {job.state === "berjalan" &&
            `Berjalan di tab lain. Aset terakhir ${time(job.lastActivityAt)}, dicek ${time(job.checkedAt)}; diperbarui tiap ${POLL_MS / 1000} detik.`}
          {job.state === "terputus" &&
            `Tidak ada aset baru sejak ${time(job.lastActivityAt)}. Tab yang menjalankan antrean ini sepertinya ditutup atau tertidur. Aset yang sudah jadi tetap tersimpan.`}
          {job.state === "selesai" && `Selesai sekitar ${time(job.lastActivityAt)}.`}
        </p>
      </div>

      {job.made > 0 && (
        <Link href={`/aset?job=${job.id}`} className={buttonVariants({ variant: "secondary" })}>
          <LayoutGrid />
          Lihat di Aset
        </Link>
      )}
    </section>
  );
}
