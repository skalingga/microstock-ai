"use client";

import { ChevronDown, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { InfoTip } from "@/components/info-tip";
import { PenPath, ProgressLine, SelectionHandles } from "@/components/pen-motif";
import { QcBadge } from "@/components/qc-badge";
import { Button } from "@/components/ui/button";
import { ADOBE } from "@/lib/adobe/rules";
import { buildExport, downloadBlob, exportStamp, saveExport, type ExportResult } from "@/lib/export/build";
import { createClient } from "@/lib/supabase/client";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { UploadChecklist } from "./upload-checklist";

export type Candidate = {
  id: string;
  title: string;
  status: "lolos" | "perlu_cek";
  exportedAt: string | null;
  thumbUrl: string | null;
  /** The generation job (batch) the asset came from; assets are grouped by it. */
  groupId: string;
  groupLabel: string;
  groupDetail: string;
};

type Props = { userId: string; candidates: Candidate[] };

type Group = { id: string; label: string; detail: string; items: Candidate[] };

const MAX_PER_EXPORT = 500;
const THUMB_STRIP = 6;

const linkClass = cn("inline-flex items-center font-semibold underline underline-offset-4 hover:decoration-2", tapTarget);

export function ExportPanel({ userId, candidates }: Props) {
  const router = useRouter();
  const [onlyNew, setOnlyNew] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => c.status === "lolos" && !c.exportedAt).map((c) => c.id)),
  );
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [confirmCek, setConfirmCek] = useState(false);
  const [building, setBuilding] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ data: ExportResult; stamp: string; saved: boolean | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const visible = useMemo(() => (onlyNew ? candidates.filter((c) => !c.exportedAt) : candidates), [candidates, onlyNew]);
  const groups = useMemo(() => {
    const byId = new Map<string, Group>();
    for (const c of visible) {
      const g = byId.get(c.groupId) ?? { id: c.groupId, label: c.groupLabel, detail: c.groupDetail, items: [] };
      g.items.push(c);
      byId.set(c.groupId, g);
    }
    // Candidates arrive newest first, so the Map keeps the newest batch on top.
    return [...byId.values()];
  }, [visible]);

  // Only what is on screen counts: assets hidden by the filter (already exported) are not part of the next export.
  const chosen = visible.filter((c) => selected.has(c.id));
  const hiddenPicked = selected.size - chosen.length;
  const cekCount = chosen.filter((c) => c.status === "perlu_cek").length;
  const tooMany = chosen.length > MAX_PER_EXPORT;
  const canExport = chosen.length > 0 && !tooMany && (cekCount === 0 || confirmCek) && !building;
  const blockedReason = building
    ? null
    : chosen.length === 0
      ? "Pilih minimal satu aset."
      : tooMany
        ? `Maksimal ${MAX_PER_EXPORT} aset per ekspor. Kurangi pilihanmu.`
        : cekCount > 0 && !confirmCek
          ? "Centang pernyataan Perlu Cek dulu."
          : null;

  function setMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleOpen(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function downloadZip() {
    if (result) downloadBlob(result.data.zip, `microstock_${result.stamp}.zip`);
  }

  function downloadCsv() {
    if (result) downloadBlob(new Blob([result.data.csv], { type: "text/csv;charset=utf-8" }), `microstock_${result.stamp}.csv`);
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
      if (fetchError || !rows) throw new Error("Data aset tidak bisa dimuat. Coba lagi.");

      const assets = rows.flatMap((r) => (r.title && r.svg_path ? [{ ...r, title: r.title, svg_path: r.svg_path }] : []));
      const data = await buildExport(supabase, assets, (done, total) => setBuilding({ done, total }));
      const stamp = exportStamp();
      if (data.included.length === 0) {
        setError("Tidak ada aset yang bisa diekspor. Lihat alasannya di atas.");
        setResult({ data, stamp, saved: null });
        return;
      }

      setResult({ data, stamp, saved: null });
      const saved = await saveExport(supabase, userId, data);
      setResult({ data, stamp, saved });
      if (saved) setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ekspor gagal. Coba lagi.");
    } finally {
      setBuilding(null);
      // The result replaces the list as the thing to look at: bring it into view and announce it.
      requestAnimationFrame(() => {
        resultHeading.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        resultHeading.current?.focus({ preventScroll: true });
      });
    }
  }

  return (
    <div className="space-y-8">
      {result && (
        <section className="space-y-5 rounded-md border bg-card p-5" aria-labelledby="hasil-heading">
          <div className="space-y-1">
            <h2 id="hasil-heading" ref={resultHeading} tabIndex={-1} className="text-2xl font-extrabold tracking-tight outline-none sm:text-3xl">
              {result.data.included.length > 0 ? `${result.data.included.length} aset siap diunggah` : "Belum ada yang bisa diunggah"}
            </h2>
            {result.data.included.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {result.data.included.length} file SVG · CSV {result.data.included.length} baris · sisi terpanjang {ADOBE.artboard.maxSidePx} px
              </p>
            )}
          </div>

          {result.saved === false && (
            <p role="alert" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
              File sudah dibuat, tapi riwayatnya gagal disimpan, jadi aset belum ditandai diekspor. Unduh sekarang; file ini tidak
              muncul di Riwayat.
            </p>
          )}
          {result.data.problems.map((p) => (
            <p key={p} role="alert" className="text-sm text-destructive">
              {p}
            </p>
          ))}
          {result.data.skipped.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{result.data.skipped.length} aset dilewati. Buka asetnya untuk memperbaiki:</p>
              <ul className="space-y-0.5">
                {result.data.skipped.map((s) => (
                  <li key={s.id}>
                    <Link href={`/aset/${s.id}`} className="underline underline-offset-4 hover:decoration-2">
                      {s.title}
                    </Link>
                    <span className="text-muted-foreground">: {s.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.data.included.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="flex items-center gap-1 font-bold">
                Unggah ke Adobe Stock
                <InfoTip align="start" label="Tentang unggah">
                  Ekstrak ZIP dan unggah ke portal paling mudah dari PC. Centangmu diingat di browser ini.
                </InfoTip>
              </h3>
              <UploadChecklist stamp={result.stamp} onDownloadZip={downloadZip} onDownloadCsv={downloadCsv} />
            </div>
          )}
          {result.saved === true && (
            <p className="text-sm text-muted-foreground">Tersimpan di Riwayat ekspor, jadi file bisa diunduh ulang nanti.</p>
          )}
        </section>
      )}

      <section aria-labelledby="pilih-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="pilih-heading" className="text-lg font-bold">
            {result ? "Ekspor lagi" : "Pilih aset"}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className={cn("flex cursor-pointer items-center gap-2", tapTarget)}>
              <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="size-4 accent-foreground" />
              Hanya yang belum diekspor
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set(visible.filter((c) => c.status === "lolos").map((c) => c.id)))}>
              Pilih semua yang Lolos
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              Kosongkan
            </Button>
          </div>
        </div>

        {hiddenPicked > 0 && (
          <p className="text-sm text-muted-foreground">
            {hiddenPicked} aset terpilih tersembunyi karena sudah diekspor, jadi tidak ikut.{" "}
            <button type="button" className="font-semibold text-foreground underline underline-offset-4" onClick={() => setOnlyNew(false)}>
              Tampilkan
            </button>
          </p>
        )}

        {visible.length === 0 ? (
          <div className="space-y-3 rounded-md border border-dashed p-6 text-center text-sm">
            <PenPath className="mx-auto max-w-56" />
            <p className="font-semibold">{onlyNew && candidates.length > 0 ? "Semua aset sudah diekspor." : "Belum ada aset yang siap diekspor."}</p>
            <p className="text-muted-foreground">Aset perlu metadata dan status Lolos atau Perlu Cek.</p>
            <p className="flex flex-wrap justify-center gap-x-4">
              <Link href="/aset?status=menunggu" className={linkClass}>
                Proses aset yang menunggu
              </Link>
              <Link href="/generate" className={linkClass}>
                Generate aset baru
              </Link>
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {groups.map((g) => {
              const picked = g.items.filter((c) => selected.has(c.id)).length;
              const cek = g.items.filter((c) => c.status === "perlu_cek").length;
              const isOpen = open.has(g.id);
              const all = picked === g.items.length;
              return (
                <li key={g.id}>
                  <div className="flex items-center gap-1 p-2 sm:gap-2">
                    <label className={cn("flex shrink-0 cursor-pointer items-center justify-center px-2", tapTarget, "min-w-11")}>
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-foreground pointer-coarse:size-5"
                        checked={all}
                        ref={(el) => {
                          if (el) el.indeterminate = picked > 0 && !all;
                        }}
                        onChange={() => setMany(g.items.map((c) => c.id), !all)}
                        aria-label={`Pilih semua di ${g.label}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleOpen(g.id)}
                      aria-expanded={isOpen}
                      aria-controls={`grup-${g.id}`}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-1 text-left hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{g.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {g.detail} · {picked}/{g.items.length} dipilih
                          {cek > 0 && ` · ${cek} Perlu Cek`}
                        </span>
                      </span>
                      <span aria-hidden className="hidden shrink-0 gap-1 sm:flex">
                        {g.items.slice(0, THUMB_STRIP).map((c) => (
                          <span key={c.id} className="bg-checker size-9 overflow-hidden rounded-sm border">
                            {c.thumbUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.thumbUrl} alt="" className="size-full object-contain" loading="lazy" />
                            )}
                          </span>
                        ))}
                      </span>
                      <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform duration-150", isOpen && "rotate-180")} />
                    </button>
                  </div>

                  {isOpen && (
                    <ul id={`grup-${g.id}`} className="grid gap-2 px-2 pb-3 sm:grid-cols-2 lg:grid-cols-3">
                      {g.items.map((c) => {
                        const isPicked = selected.has(c.id);
                        return (
                          <li key={c.id} className="relative">
                            {isPicked && <SelectionHandles />}
                            <label className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm hover:bg-muted/50">
                              <input
                                type="checkbox"
                                className="size-4 shrink-0 cursor-pointer accent-foreground pointer-coarse:size-5"
                                checked={isPicked}
                                onChange={() => setMany([c.id], !isPicked)}
                              />
                              <span className="bg-checker flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border">
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
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Pinned to the bottom while the list scrolls, so the main action is always one tap away. */}
        <div className="sticky bottom-0 z-20 -mx-1 space-y-3 rounded-md border border-foreground/30 bg-card p-3 shadow-md sm:mx-0">
          {cekCount > 0 && (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-warning-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-foreground pointer-coarse:size-5"
                checked={confirmCek}
                onChange={(e) => setConfirmCek(e.target.checked)}
              />
              <span>
                {cekCount} aset terpilih berstatus <strong>Perlu Cek</strong>. Saya sudah memeriksanya satu per satu dan bertanggung
                jawab mengekspornya.
              </span>
            </label>
          )}
          {building ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold" aria-live="polite">
                Menyiapkan {building.done} dari {building.total} SVG...
              </p>
              <ProgressLine value={building.total ? building.done / building.total : 0} label="Progres ekspor" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button size="lg" onClick={startExport} disabled={!canExport} aria-describedby={blockedReason ? "ekspor-alasan" : undefined}>
                <Download />
                Ekspor {chosen.length} aset
              </Button>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                {blockedReason ? (
                  <span id="ekspor-alasan" className={cn(tooMany && "text-destructive")} role={tooMany ? "alert" : undefined}>
                    {blockedReason}
                  </span>
                ) : (
                  <span>ZIP berisi SVG dan CSV metadata</span>
                )}
                <InfoTip align="start" label="Ukuran artboard">
                  Setiap SVG diberi ukuran artboard {ADOBE.artboard.maxSidePx} px (syarat Adobe: minimal {ADOBE.artboard.minMegapixels} MP).
                  Gambarnya tidak berubah.
                </InfoTip>
              </span>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </section>

      {!result && (
        <details className="group rounded-md border bg-card">
          <summary className={cn("flex cursor-pointer list-none items-center justify-between gap-2 px-5 font-bold", tapTarget, "min-h-13")}>
            Cara unggah ke Adobe Stock
            <ChevronDown aria-hidden className="size-4 transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5">
            <UploadChecklist />
          </div>
        </details>
      )}
    </div>
  );
}
