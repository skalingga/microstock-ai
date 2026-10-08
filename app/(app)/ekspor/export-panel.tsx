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
  needsRelease: boolean;
  thumbUrl: string | null;
  /** The generation job (batch) the asset came from; assets are grouped by it. */
  groupId: string;
  groupLabel: string;
  groupDetail: string;
};

type Props = {
  userId: string;
  candidates: Candidate[];
  /** Asset ids picked in the gallery; replaces the default selection. */
  preselect?: string[];
};

type Group = { id: string; label: string; detail: string; items: Candidate[] };

type Result = {
  data: ExportResult;
  stamp: string;
  /** undefined while saving, null when saving failed, else the stored export's id. */
  exportId: string | null | undefined;
};

const MAX_PER_EXPORT = 500;
const THUMB_STRIP = 6;
/** Thumbnails shown on phones, where the strip has less room. */
const THUMB_STRIP_PHONE = 2;
const CEK_NAMES_SHOWN = 3;

const linkClass = cn("inline-flex items-center font-semibold underline underline-offset-4 hover:decoration-2", tapTarget);

export function ExportPanel({ userId, candidates, preselect }: Props) {
  const router = useRouter();
  const fromGallery = useMemo(() => (preselect ? candidates.filter((c) => preselect.includes(c.id)) : null), [candidates, preselect]);
  // Exported assets picked in the gallery stay visible: the user asked for them.
  const [onlyNew, setOnlyNew] = useState(() => !fromGallery?.some((c) => c.exportedAt));
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        fromGallery
          ? fromGallery.map((c) => c.id)
          : candidates.filter((c) => c.status === "lolos" && !c.exportedAt).map((c) => c.id),
      ),
  );
  const [cleared, setCleared] = useState<Set<string> | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => {
    // Gallery picks: show the batches they came from.
    if (fromGallery) return new Set(fromGallery.map((c) => c.groupId));
    // A single batch has nothing to hide behind: show it.
    const ids = new Set(candidates.filter((c) => !c.exportedAt).map((c) => c.groupId));
    return ids.size === 1 ? ids : new Set();
  });
  const [confirmedCek, setConfirmedCek] = useState("");
  const [building, setBuilding] = useState<{ phase: "build" | "save"; done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const abort = useRef<AbortController | null>(null);

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
  const cekChosen = chosen.filter((c) => c.status === "perlu_cek");
  // The statement covers exactly these assets: adding or removing one asks again.
  const cekKey = cekChosen.map((c) => c.id).sort().join(",");
  const cekConfirmed = cekKey !== "" && confirmedCek === cekKey;
  const tooMany = chosen.length > MAX_PER_EXPORT;
  const canExport = chosen.length > 0 && !tooMany && (cekChosen.length === 0 || cekConfirmed) && !building;
  const blockedReason =
    chosen.length === 0
      ? "Pilih minimal satu aset."
      : tooMany
        ? `Maksimal ${MAX_PER_EXPORT} aset per ekspor. Kurangi pilihanmu.`
        : cekChosen.length > 0 && !cekConfirmed
          ? "Centang pernyataan Perlu cek dulu."
          : null;
  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.id));

  function setMany(ids: string[], on: boolean) {
    setCleared(null);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function clearAll() {
    setCleared(selected);
    setSelected(new Set());
  }

  function toggleOpen(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function downloadZip(r: Result) {
    downloadBlob(r.data.zip, `microstock_${r.stamp}.zip`);
  }

  function downloadCsv(r: Result) {
    downloadBlob(new Blob([r.data.csv], { type: "text/csv;charset=utf-8" }), `microstock_${r.stamp}.csv`);
  }

  async function startExport() {
    setError(null);
    setResult(null);
    setCleared(null);
    const controller = new AbortController();
    abort.current = controller;
    setBuilding({ phase: "build", done: 0, total: chosen.length });
    try {
      const supabase = createClient();
      const { data: rows, error: fetchError } = await supabase
        .from("assets")
        .select("id, title, keywords, category, svg_path")
        .in("id", chosen.map((c) => c.id));
      if (fetchError || !rows) throw new Error("Data aset tidak bisa dimuat. Coba lagi.");

      const assets = rows.flatMap((r) => (r.title && r.svg_path ? [{ ...r, title: r.title, svg_path: r.svg_path }] : []));
      const data = await buildExport(supabase, assets, (done, total) => setBuilding({ phase: "build", done, total }), controller.signal);
      const next: Result = { data, stamp: exportStamp(), exportId: undefined };
      if (data.included.length === 0) {
        setError("Tidak ada aset yang bisa diekspor. Alasannya ada di kartu hasil.");
        setResult({ ...next, exportId: null });
        return;
      }

      // Files in hand first, then the server marks the assets exported.
      downloadZip(next);
      setResult(next);
      setBuilding({ phase: "save", done: data.included.length, total: data.included.length });
      const exportId = await saveExport(supabase, userId, data);
      setResult({ ...next, exportId });
      if (exportId) {
        setSelected(new Set());
        setConfirmedCek("");
      }
      router.refresh();
    } catch (err) {
      if (controller.signal.aborted) setError("Ekspor dibatalkan. Tidak ada yang diunduh atau ditandai.");
      else setError(err instanceof Error ? err.message : "Ekspor gagal. Coba lagi.");
    } finally {
      abort.current = null;
      setBuilding(null);
      // The result replaces the list as the thing to look at: bring it into view and announce it.
      requestAnimationFrame(() => {
        resultHeading.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        resultHeading.current?.focus({ preventScroll: true });
      });
    }
  }

  const included = result?.data.included ?? [];
  const releaseTitles = result
    ? candidates.filter((c) => c.needsRelease && included.some((i) => i.id === c.id)).map((c) => c.title)
    : undefined;

  return (
    <div className="space-y-8">
      {result && (
        <section className="space-y-5 rounded-md border bg-card p-5" aria-labelledby="hasil-heading">
          <div className="space-y-1">
            <h2 id="hasil-heading" ref={resultHeading} tabIndex={-1} className="text-2xl font-extrabold tracking-tight outline-none sm:text-3xl">
              {included.length > 0 ? `${included.length} aset siap diunggah` : "Belum ada yang bisa diunggah"}
            </h2>
            {included.length > 0 && (
              <p className="text-sm text-muted-foreground">
                ZIP sudah diunduh · {included.length} file SVG · CSV {included.length} baris · sisi terpanjang {ADOBE.artboard.maxSidePx} px
              </p>
            )}
          </div>

          {result.exportId === undefined && included.length > 0 && (
            <p className="text-sm" role="status">
              Menyimpan ke Riwayat...
            </p>
          )}
          {typeof result.exportId === "string" && (
            <p className="text-sm" role="status">
              {included.length} aset ditandai sudah diekspor, jadi tidak muncul lagi di daftar &ldquo;belum diekspor&rdquo;. File dan
              checklist ini tersimpan di Riwayat ekspor.
            </p>
          )}
          {result.exportId === null && included.length > 0 && (
            <p role="alert" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
              Riwayat gagal disimpan, jadi aset belum ditandai diekspor dan file ini tidak ada di Riwayat. Simpan ZIP dan CSV-nya
              sekarang.
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

          {included.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="flex items-center gap-1 font-bold">
                Unggah ke Adobe Stock
                <InfoTip align="start" label="Tentang unggah">
                  Ekstrak ZIP dan unggah ke portal paling mudah dari PC. Checklist ini bisa dibuka lagi dari Riwayat ekspor.
                </InfoTip>
              </h3>
              <UploadChecklist
                storageId={result.exportId ?? result.stamp}
                zip={{ onClick: () => downloadZip(result) }}
                zipLabel="Unduh ZIP lagi"
                csv={{ onClick: () => downloadCsv(result) }}
                releaseTitles={releaseTitles}
              />
              <details className="text-sm">
                <summary className={cn("cursor-pointer font-semibold", tapTarget, "inline-flex items-center")}>
                  Nama file ({included.length})
                </summary>
                <ul className="mt-1 columns-1 gap-6 font-mono text-xs sm:columns-2">
                  {included.map((i) => (
                    <li key={i.id} className="break-all">
                      {i.filename}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMany(visible.filter((c) => c.status === "lolos").map((c) => c.id), true)}
            >
              Pilih semua yang Lolos
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.id)))}>
              {allOpen ? "Tutup semua" : "Buka semua"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={selected.size === 0}>
              Kosongkan
            </Button>
          </div>
        </div>

        {fromGallery && !result && (
          <p className="text-sm" role="status">
            {fromGallery.length} aset dipilih dari galeri.
            {preselect && preselect.length > fromGallery.length &&
              ` ${preselect.length - fromGallery.length} lainnya tidak bisa diekspor (belum Lolos/Perlu cek atau tanpa metadata).`}{" "}
            <Link href="/aset" className="font-semibold underline underline-offset-4 hover:decoration-2">
              Kembali ke galeri
            </Link>
          </p>
        )}
        {cleared && cleared.size > 0 && (
          <p className="text-sm text-muted-foreground" role="status">
            {cleared.size} pilihan dikosongkan.{" "}
            <button
              type="button"
              className="font-semibold text-foreground underline underline-offset-4"
              onClick={() => {
                setSelected(cleared);
                setCleared(null);
              }}
            >
              Batalkan
            </button>
          </p>
        )}
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
            <p className="text-muted-foreground">Aset perlu metadata dan status Lolos atau Perlu cek.</p>
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
                          {cek > 0 && ` · ${cek} Perlu cek`}
                        </span>
                      </span>
                      <span aria-hidden className="flex shrink-0 gap-1">
                        {g.items.slice(0, THUMB_STRIP).map((c, i) => (
                          <span key={c.id} className={cn("bg-checker size-9 overflow-hidden rounded-sm border", i >= THUMB_STRIP_PHONE && "max-sm:hidden")}>
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
          {cekChosen.length > 0 && !building && (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-warning-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-foreground pointer-coarse:size-5"
                checked={cekConfirmed}
                onChange={(e) => setConfirmedCek(e.target.checked ? cekKey : "")}
              />
              <span>
                Aku sudah memeriksa {cekChosen.length} aset <strong>Perlu cek</strong>:{" "}
                {cekChosen
                  .slice(0, CEK_NAMES_SHOWN)
                  .map((c) => c.title)
                  .join("; ")}
                {cekChosen.length > CEK_NAMES_SHOWN && `; dan ${cekChosen.length - CEK_NAMES_SHOWN} lainnya`}.
              </span>
            </label>
          )}
          {building ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold" aria-live="polite">
                  {building.phase === "build"
                    ? `Menyiapkan ${building.done} dari ${building.total} SVG...`
                    : "ZIP terunduh. Menyimpan ke Riwayat..."}
                </p>
                {building.phase === "build" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => abort.current?.abort()}>
                    Batalkan
                  </Button>
                )}
              </div>
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
                  <span className="max-sm:hidden">ZIP langsung terunduh; CSV ada di langkah unggah</span>
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
