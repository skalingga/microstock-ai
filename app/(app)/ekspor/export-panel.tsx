"use client";

import { Download, Loader2 } from "lucide-react";
import { InfoTip } from "@/components/info-tip";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QcBadge } from "@/components/qc-badge";
import { Button } from "@/components/ui/button";
import { ADOBE } from "@/lib/adobe/rules";
import { buildExport, downloadBlob, exportStamp, saveExport, type ExportResult } from "@/lib/export/build";
import { createClient } from "@/lib/supabase/client";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type Candidate = {
  id: string;
  title: string;
  status: "lolos" | "perlu_cek";
  exportedAt: string | null;
  thumbUrl: string | null;
};

type Props = { userId: string; candidates: Candidate[] };

const MAX_PER_EXPORT = 500;

export function ExportPanel({ userId, candidates }: Props) {
  const router = useRouter();
  const [onlyNew, setOnlyNew] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => c.status === "lolos" && !c.exportedAt).map((c) => c.id)),
  );
  const [confirmCek, setConfirmCek] = useState(false);
  const [building, setBuilding] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ data: ExportResult; stamp: string; saved: boolean | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => (onlyNew ? candidates.filter((c) => !c.exportedAt) : candidates), [candidates, onlyNew]);
  // Only what is on screen counts: assets hidden by the filter (already exported) are not part of the next export.
  const chosen = visible.filter((c) => selected.has(c.id));
  const cekCount = chosen.filter((c) => c.status === "perlu_cek").length;
  const tooMany = chosen.length > MAX_PER_EXPORT;
  const canExport = chosen.length > 0 && !tooMany && (cekCount === 0 || confirmCek) && !building;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllPassed() {
    setSelected(new Set(visible.filter((c) => c.status === "lolos").map((c) => c.id)));
  }

  async function startExport() {
    setError(null);
    setResult(null);
    setBuilding({ done: 0, total: chosen.length });
    try {
      const supabase = createClient();
      const { data: rows, error: fetchError } = await supabase
        .from("assets")
        .select("id, title, keywords, category, svg_path")
        .in("id", chosen.map((c) => c.id));
      if (fetchError || !rows) throw new Error("Data aset tidak bisa dimuat.");

      const assets = rows.flatMap((r) => (r.title && r.svg_path ? [{ ...r, title: r.title, svg_path: r.svg_path }] : []));
      const data = await buildExport(supabase, assets, (done, total) => setBuilding({ done, total }));
      if (data.included.length === 0) {
        setError("Tidak ada aset yang bisa diekspor. Lihat alasan di bawah.");
        setResult({ data, stamp: exportStamp(), saved: null });
        return;
      }

      const stamp = exportStamp();
      setResult({ data, stamp, saved: null });
      const saved = await saveExport(supabase, userId, data);
      setResult({ data, stamp, saved });
      if (saved) setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ekspor gagal.");
    } finally {
      setBuilding(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border bg-card p-5" aria-labelledby="pilih-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pilih-heading" className="text-lg font-bold">
            Pilih aset ({chosen.length} dipilih)
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className={cn("flex items-center gap-2", tapTarget)}>
              <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
              Hanya yang belum diekspor
            </label>
            <Button type="button" variant="outline" size="sm" onClick={selectAllPassed}>
              Pilih semua yang Lolos
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Kosongkan
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Belum ada aset yang siap diekspor. Aset harus punya metadata dan berstatus Lolos atau Perlu Cek.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-2 text-sm hover:bg-muted/50">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="bg-checker flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                    {c.thumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbUrl} alt="" className="size-full object-contain" loading="lazy" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{c.title}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <QcBadge status={c.status} />
                      {c.exportedAt && <span className="text-xs text-muted-foreground">Sudah diekspor</span>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {cekCount > 0 && (
          <label className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
            <input type="checkbox" className="mt-1" checked={confirmCek} onChange={(e) => setConfirmCek(e.target.checked)} />
            <span>
              {cekCount} aset yang dipilih berstatus <strong>Perlu Cek</strong>. Saya sudah memeriksanya satu per satu dan
              bertanggung jawab mengekspornya.
            </span>
          </label>
        )}
        {tooMany && (
          <p role="alert" className="text-sm text-destructive">
            Maksimal {MAX_PER_EXPORT} aset per ekspor. Kurangi pilihanmu.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={startExport} disabled={!canExport}>
            {building ? <Loader2 className="animate-spin" /> : <Download />}
            {building ? `Menyiapkan ${building.done}/${building.total}...` : `Ekspor ${chosen.length} aset`}
          </Button>
          <InfoTip align="start">
            Setiap SVG diberi ukuran artboard {ADOBE.artboard.maxSidePx} px (syarat Adobe: minimal {ADOBE.artboard.minMegapixels} MP).
            Gambarnya tidak berubah.
          </InfoTip>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <section className="space-y-3 rounded-2xl border bg-card p-5" aria-labelledby="hasil-heading">
          <h2 id="hasil-heading" className="text-lg font-bold">
            {result.data.included.length} aset siap diunduh
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={result.data.included.length === 0}
              onClick={() => downloadBlob(result.data.zip, `microstock_${result.stamp}.zip`)}
            >
              Unduh ZIP (SVG)
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={result.data.included.length === 0}
              onClick={() => downloadBlob(new Blob([result.data.csv], { type: "text/csv;charset=utf-8" }), `microstock_${result.stamp}.csv`)}
            >
              Unduh CSV
            </Button>
          </div>
          {result.saved === true && <p className="text-sm text-muted-foreground">Riwayat ekspor tersimpan. File bisa diunduh ulang dari daftar di bawah.</p>}
          {result.saved === false && (
            <p role="alert" className="text-sm text-warning-foreground">
              File berhasil dibuat tetapi riwayatnya gagal disimpan. Unduh sekarang; aset belum ditandai sebagai diekspor.
            </p>
          )}
          {result.data.problems.map((p) => (
            <p key={p} role="alert" className="text-sm text-destructive">
              {p}
            </p>
          ))}
          {result.data.skipped.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{result.data.skipped.length} aset dilewati:</p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                {result.data.skipped.map((s) => (
                  <li key={s.id}>
                    {s.title}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
