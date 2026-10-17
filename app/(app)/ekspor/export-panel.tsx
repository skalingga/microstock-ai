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
import { exportLabel } from "@/lib/export/label";
import { buildExport, downloadBlob, exportStamp, markExported, saveExport, type Agency, type ExportResult } from "@/lib/export/build";
import { findTwins, TWIN_LOOKBACK_DAYS, type SentAsset, type TwinGroup } from "@/lib/subjects/twins";
import { createClient } from "@/lib/supabase/client";
import { pinnedBar, tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { UploadChecklist } from "./upload-checklist";

export type Candidate = {
  id: string;
  title: string;
  status: "lolos" | "perlu_cek";
  exportedAt: string | null;
  needsRelease: boolean;
  /** Stage 12: a JPEG from Google Flow; fictional = shows people or property that do not exist. */
  photo?: boolean;
  fictional?: boolean;
  thumbUrl: string | null;
  /** Main subject (concept, else title) and medium, for the twin-subject warning. */
  subject: string;
  media: string;
  /** The generation job (batch) the asset came from; assets are grouped by it. */
  groupId: string;
  groupLabel: string;
  groupDetail: string;
};

type Props = {
  userId: string;
  candidates: Candidate[];
  /** Assets exported in the last TWIN_LOOKBACK_DAYS. */
  sent: SentAsset[];
  /** Asset ids picked in the gallery; replaces the default selection. */
  preselect?: string[];
};

type Group = { id: string; label: string; detail: string; items: Candidate[] };

type Result = {
  data: ExportResult;
  stamp: string;
  agency: Agency;
  /** undefined while saving, null when saving failed, else the stored export's id. */
  exportId: string | null | undefined;
  /** Whether the assets were marked exported; false offers a retry. */
  marked?: boolean;
  /** Why saving to the history failed, when it did. */
  saveError?: string;
  /** Why the ZIP is missing from the history although the export was saved. */
  zipError?: string;
};

const MAX_PER_EXPORT = 500;
const THUMB_STRIP = 6;
/** Thumbnails shown on phones, where the strip has less room. */
const THUMB_STRIP_PHONE = 2;
const CEK_NAMES_SHOWN = 3;

const linkClass = cn("inline-flex items-center font-semibold underline underline-offset-4 hover:decoration-2", tapTarget);

export function ExportPanel({ userId, candidates: allCandidates, sent, preselect }: Props) {
  const router = useRouter();
  const [agency, setAgency] = useState<Agency>("adobe");
  const isShutterstock = agency === "shutterstock";
  // Shutterstock takes photos only (vectors must be EPS); the rest of this panel works on this list.
  const candidates = useMemo(() => (isShutterstock ? allCandidates.filter((c) => c.photo) : allCandidates), [isShutterstock, allCandidates]);
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
  /** Twins just taken out of the selection, for the undo line. */
  const [untwinned, setUntwinned] = useState<string[] | null>(null);
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
  const [marking, setMarking] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const abort = useRef<AbortController | null>(null);

  // "Sudah diekspor" marks the Adobe export, so it does not hide photos from a Shutterstock export.
  const visible = useMemo(
    () => (onlyNew && !isShutterstock ? candidates.filter((c) => !c.exportedAt) : candidates),
    [candidates, onlyNew, isShutterstock],
  );
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
  // Same main object twice in one Adobe export, or again within weeks: Adobe's "Similar content" (18 of the first 20
  // rejections). Shutterstock is a photo-only trial without its own history, so it is not checked.
  const twins = useMemo(
    () =>
      isShutterstock
        ? []
        : findTwins(
            visible.filter((c) => selected.has(c.id)).map((c) => ({ id: c.id, subject: c.subject, title: c.title, lolos: c.status === "lolos", media: c.media })),
            sent,
          ),
    [visible, selected, isShutterstock, sent],
  );
  const twinDrop = twins.flatMap((g) => g.drop);
  const twinIds = new Set(twinDrop);
  const cekChosen = chosen.filter((c) => c.status === "perlu_cek");
  const releaseChosen = chosen.filter((c) => c.needsRelease);
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
    setUntwinned(null);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function dropTwins() {
    setMany(twinDrop, false);
    setUntwinned(twinDrop);
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
    downloadBlob(r.data.zip, `${filePrefix(r.agency)}_${r.stamp}.zip`);
  }

  function downloadCsv(r: Result) {
    downloadBlob(new Blob([r.data.csv], { type: "text/csv;charset=utf-8" }), `${filePrefix(r.agency)}_${r.stamp}.csv`);
  }

  function switchAgency(next: Agency) {
    if (next === agency || building) return;
    setAgency(next);
    setResult(null);
    setError(null);
    setCleared(null);
    setConfirmedCek("");
    const pool = next === "shutterstock" ? allCandidates.filter((c) => c.photo) : allCandidates;
    setSelected(new Set(pool.filter((c) => c.status === "lolos" && (next === "shutterstock" || !c.exportedAt)).map((c) => c.id)));
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
        .select("id, title, keywords, category, svg_path, kind, image_path, fictional_people")
        .in("id", chosen.map((c) => c.id));
      if (fetchError || !rows) throw new Error("Data aset tidak bisa dimuat. Coba lagi.");

      const assets = rows.flatMap((r) => (r.title && (r.svg_path || r.image_path) ? [{ ...r, title: r.title }] : []));
      const data = await buildExport(
        supabase,
        assets,
        (done, total) => setBuilding({ phase: "build", done, total }),
        controller.signal,
        agency,
      );
      const next: Result = { data, stamp: exportStamp(), agency, exportId: undefined };
      if (data.included.length === 0) {
        setError("Tidak ada aset yang bisa diekspor. Alasannya ada di kartu hasil.");
        setResult({ ...next, exportId: null });
        return;
      }

      // Shutterstock is a trial: download only. The history row and the "exported" mark belong to the Adobe flow.
      if (agency === "shutterstock") {
        setResult({ ...next, exportId: null });
        downloadZip(next);
        return;
      }

      // Save to the history first, then download. On iOS Safari the download (link click) stopped the save that came
      // right after it: the Supabase logs of 10 Oct 2026 show the photos fetched for the ZIP, then no upload request
      // at all. The files are in memory either way, and a stored export can be downloaded again from the history.
      setResult(next);
      setBuilding({ phase: "save", done: data.included.length, total: data.included.length });
      const { saved, saveError } = await storeExport(data);
      setResult({ ...next, exportId: saved?.exportId ?? null, marked: saved?.marked, saveError, zipError: saved?.zipError });
      downloadZip(next);
      if (saved?.marked) {
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

  /** Keeps the export in the history and marks its assets. Never throws: a failed save must not lose the files in hand. */
  async function storeExport(data: ExportResult) {
    const includedIds = new Set(data.included.map((i) => i.id));
    const exported = candidates.filter((c) => includedIds.has(c.id));
    let saveError: string | undefined;
    let saved: Awaited<ReturnType<typeof saveExport>> = null;
    try {
      saved = await saveExport(
        createClient(),
        userId,
        data,
        {
          label: exportLabel(exported.map((c) => c.groupLabel)),
          releaseTitles: exported.filter((c) => c.needsRelease).map((c) => c.title),
          fictionalFiles: fictionalFilesOf(data.included, candidates),
        },
        (reason) => (saveError = reason),
      );
    } catch (err) {
      saveError = err instanceof Error ? err.message : "kesalahan tak terduga";
    }
    return { saved, saveError };
  }

  async function retrySave() {
    if (!result) return;
    setResult({ ...result, exportId: undefined, saveError: undefined, zipError: undefined });
    const { saved, saveError } = await storeExport(result.data);
    setResult({ ...result, exportId: saved?.exportId ?? null, marked: saved?.marked, saveError, zipError: saved?.zipError });
    if (saved?.marked) {
      setSelected(new Set());
      setConfirmedCek("");
    }
    router.refresh();
  }

  async function retryMark() {
    if (!result) return;
    setMarking(true);
    const ok = await markExported(
      createClient(),
      result.data.included.map((i) => i.id),
    );
    setMarking(false);
    if (ok) {
      setResult({ ...result, marked: true });
      setSelected(new Set());
      setConfirmedCek("");
      router.refresh();
    }
  }

  const included = result?.data.included ?? [];
  const releaseTitles = result
    ? candidates.filter((c) => c.needsRelease && included.some((i) => i.id === c.id)).map((c) => c.title)
    : undefined;
  const fictionalFiles = result ? fictionalFilesOf(included, candidates) : undefined;
  const photoCount = included.filter((i) => i.photo).length;
  const svgCount = included.length - photoCount;

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
                ZIP sudah diunduh ·{" "}
                {[svgCount > 0 && `${svgCount} file SVG (sisi terpanjang ${ADOBE.artboard.maxSidePx} px)`, photoCount > 0 && `${photoCount} foto JPEG`]
                  .filter(Boolean)
                  .join(" · ")}
                . CSV tidak ada di dalam ZIP: unduh terpisah di bawah.
              </p>
            )}
          </div>

          {included.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => downloadCsv(result)}>
                <Download />
                Unduh CSV ({included.length} baris)
              </Button>
              <Button type="button" variant="outline" onClick={() => downloadZip(result)}>
                <Download />
                Unduh ZIP lagi
              </Button>
            </div>
          )}

          {result.agency === "shutterstock" && included.length > 0 && (
            <p className="text-sm" role="status">
              Ekspor Shutterstock tidak disimpan di Riwayat dan tidak menandai aset &ldquo;sudah diekspor&rdquo;. Simpan ZIP dan CSV-nya
              sampai selesai diunggah.
            </p>
          )}
          {result.agency === "adobe" && result.exportId === undefined && included.length > 0 && (
            <p className="text-sm" role="status">
              Menyimpan ke Riwayat...
            </p>
          )}
          {typeof result.exportId === "string" && result.marked && (
            <p className="text-sm" role="status">
              {included.length} aset ditandai sudah diekspor, jadi tidak muncul lagi di daftar &ldquo;belum diekspor&rdquo;. File dan
              checklist ini tersimpan di Riwayat ekspor.
            </p>
          )}
          {typeof result.exportId === "string" && result.zipError && (
            <p role="status" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
              ZIP tidak ikut tersimpan di Riwayat ({result.zipError}). Riwayat hanya menyimpan CSV-nya, jadi simpan ZIP yang sudah
              terunduh sampai selesai diunggah ke Adobe.
            </p>
          )}
          {typeof result.exportId === "string" && result.marked === false && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
              <span className="min-w-0 flex-1">
                File tersimpan di Riwayat, tapi {included.length} aset gagal ditandai diekspor. Tanpa tanda itu mereka muncul lagi di
                daftar &ldquo;belum diekspor&rdquo; dan bisa terunggah dua kali.
              </span>
              <Button type="button" size="sm" onClick={retryMark} disabled={marking}>
                {marking ? "Menandai..." : "Tandai lagi"}
              </Button>
            </div>
          )}
          {result.agency === "adobe" && result.exportId === null && included.length > 0 && (
            <p role="alert" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
              Riwayat gagal disimpan, jadi aset belum ditandai diekspor dan file ini tidak ada di Riwayat. Simpan ZIP dan CSV-nya
              sekarang, atau coba simpan lagi.
              {result.saveError && <span className="mt-1 block font-mono text-xs break-words">Sebab: {result.saveError}</span>}
              <Button type="button" size="sm" className="mt-2" onClick={retrySave}>
                Simpan ke Riwayat lagi
              </Button>
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

          {included.length > 0 && result.agency === "shutterstock" && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="font-bold">Unggah ke Shutterstock</h3>
              <ShutterstockSteps />
            </div>
          )}

          {included.length > 0 && result.agency === "adobe" && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="flex items-center gap-1 font-bold">
                Unggah ke Adobe Stock
                <InfoTip align="start" label="Tentang unggah">
                  {typeof result.exportId === "string"
                    ? "Ekstrak ZIP dan unggah ke portal paling mudah dari PC. Centangmu tersimpan di Riwayat ekspor, jadi bisa dilanjutkan di perangkat lain."
                    : "Ekstrak ZIP dan unggah ke portal paling mudah dari PC. Riwayat gagal disimpan, jadi centang ini hanya ada di browser ini."}
                </InfoTip>
              </h3>
              <UploadChecklist
                storageId={result.exportId ?? result.stamp}
                persist={typeof result.exportId === "string"}
                zip={{ onClick: () => downloadZip(result) }}
                zipLabel="Unduh ZIP lagi"
                csv={{ onClick: () => downloadCsv(result) }}
                releaseTitles={releaseTitles}
                fictionalFiles={fictionalFiles}
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
        <div className="space-y-2">
          <p id="agensi-label" className="text-sm font-semibold">
            Agensi tujuan
          </p>
          <div className="inline-flex flex-wrap gap-1 rounded-md border p-1" role="radiogroup" aria-labelledby="agensi-label">
            {AGENCIES.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={agency === a.id}
                onClick={() => switchAgency(a.id)}
                disabled={!!building}
                className={cn("rounded-sm px-3 text-sm font-semibold", tapTarget, agency === a.id ? "bg-foreground text-background" : "hover:bg-muted")}
              >
                {a.label}
              </button>
            ))}
          </div>
          {isShutterstock && (
            <p className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
              Uji coba. Shutterstock tidak menerima konten buatan AI dari kontributor, jadi kiriman ini bisa ditolak. Hanya foto JPEG
              yang ikut, karena vektor Shutterstock harus EPS. Kategori dipetakan otomatis dari kategori Adobe: cocokkan dulu dengan
              pilihan kategori di portal Shutterstock sebelum unggah CSV pertama.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="pilih-heading" className="text-lg font-bold">
            {result ? "Ekspor lagi" : "Pilih aset"}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className={cn("flex cursor-pointer items-center gap-2", tapTarget, isShutterstock && "hidden")}>
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

        {twins.length > 0 && <TwinWarning groups={twins} onDrop={dropTwins} />}
        {untwinned && untwinned.length > 0 && twins.length === 0 && (
          <p className="text-sm text-muted-foreground" role="status">
            {untwinned.length} aset kembar dikeluarkan dari pilihan. Simpan untuk kiriman berikutnya, setelah yang pertama diterima.{" "}
            <button
              type="button"
              className="font-semibold text-foreground underline underline-offset-4"
              onClick={() => {
                setMany(untwinned, true);
              }}
            >
              Batalkan
            </button>
          </p>
        )}

        {visible.length === 0 ? (
          <div className="space-y-3 rounded-md border border-dashed p-6 text-center text-sm">
            <PenPath className="mx-auto max-w-56" />
            <p className="font-semibold">
              {isShutterstock
                ? "Belum ada foto yang siap diekspor."
                : onlyNew && candidates.length > 0
                  ? "Semua aset sudah diekspor."
                  : "Belum ada aset yang siap diekspor."}
            </p>
            <p className="text-muted-foreground">
              {isShutterstock
                ? "Shutterstock hanya untuk foto dari Mode foto, dengan metadata dan status Lolos atau Perlu cek."
                : "Aset perlu metadata dan status Lolos atau Perlu cek."}
            </p>
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
                          {g.items.some((c) => twinIds.has(c.id)) && ` · ${g.items.filter((c) => twinIds.has(c.id)).length} kembar`}
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
                                  {c.photo && <span className="text-xs text-muted-foreground">Foto</span>}
                                  {c.needsRelease && <span className="text-xs font-semibold text-warning-foreground">Perlu Release</span>}
                                  {twinIds.has(c.id) && <span className="text-xs font-semibold text-warning-foreground">Kembar</span>}
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

        {/* Pinned to the bottom while the list scrolls, so the main action is always one tap away: the shared band above the
            phone tab bar, a floating card on PC (lifted above the iPad home indicator). */}
        <div
          className={cn(
            "space-y-3 lg:sticky lg:bottom-[max(0.5rem,env(safe-area-inset-bottom))] lg:z-20 lg:rounded-md lg:border lg:border-foreground/30 lg:bg-card lg:p-3 lg:shadow-md",
            pinnedBar,
          )}
        >
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
          {twinDrop.length > 0 && !building && (
            <p className="text-sm text-warning-foreground" role="status">
              <strong>{twinDrop.length} aset kembar</strong> ikut terpilih dan berisiko ditolak &ldquo;Similar content&rdquo;.{" "}
              <button type="button" className="font-semibold underline underline-offset-4" onClick={dropTwins}>
                Sisakan satu per subjek
              </button>
            </p>
          )}
          {releaseChosen.length > 0 && !building && (
            <p className="text-sm text-warning-foreground" role="status">
              <strong>{releaseChosen.length} aset Perlu Release</strong> (orang atau properti nyata): siapkan file release sebelum mengunggah ke {isShutterstock ? "Shutterstock" : "Adobe"}.{" "}
              {releaseChosen
                .slice(0, CEK_NAMES_SHOWN)
                .map((c) => c.title)
                .join("; ")}
              {releaseChosen.length > CEK_NAMES_SHOWN && `; dan ${releaseChosen.length - CEK_NAMES_SHOWN} lainnya`}.
            </p>
          )}
          {building ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold" aria-live="polite">
                  {building.phase === "build"
                    ? `Menyiapkan ${building.done} dari ${building.total} berkas...`
                    : "Menyimpan ke Riwayat. ZIP terunduh setelah ini..."}
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
                  <span>ZIP terunduh otomatis; CSV diunduh terpisah dari kartu hasil</span>
                )}
                {!isShutterstock && (
                  <InfoTip align="start" label="Ukuran artboard">
                    Setiap SVG diberi ukuran artboard {ADOBE.artboard.maxSidePx} px (syarat Adobe: minimal {ADOBE.artboard.minMegapixels} MP).
                    Gambarnya tidak berubah.
                  </InfoTip>
                )}
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
            {isShutterstock ? "Cara unggah ke Shutterstock" : "Cara unggah ke Adobe Stock"}
            <ChevronDown aria-hidden className="size-4 transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5">{isShutterstock ? <ShutterstockSteps /> : <UploadChecklist />}</div>
        </details>
      )}
    </div>
  );
}

const TWIN_GROUPS_SHOWN = 8;

/** The twin groups in the selection, with the one kept per subject and the one-click fix. Never blocks the export. */
function TwinWarning({ groups, onDrop }: { groups: TwinGroup[]; onDrop: () => void }) {
  const dropCount = groups.reduce((n, g) => n + g.drop.length, 0);
  return (
    <div role="status" className="space-y-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
      <p>
        <strong>{dropCount} aset bersubjek kembar</strong> dengan aset lain di ekspor ini atau kiriman {TWIN_LOOKBACK_DAYS} hari
        terakhir. Adobe sering menolak subjek yang sama sebagai &ldquo;Similar content&rdquo;, walau gambarnya berbeda. Kirim satu
        dulu, sisanya setelah yang pertama diterima.
      </p>
      <ul className="space-y-1">
        {groups.slice(0, TWIN_GROUPS_SHOWN).map((g) => (
          <li key={g.chosen[0].id}>
            <strong>{g.label}</strong>:{" "}
            {g.keep ? (
              <>
                kirim &ldquo;{g.chosen.find((c) => c.id === g.keep)?.title}&rdquo;, tahan {g.drop.length} lainnya
              </>
            ) : (
              <>
                sudah dikirim &ldquo;{g.sent[0].title}&rdquo;{g.sent.length > 1 && ` dan ${g.sent.length - 1} lainnya`}, tahan{" "}
                {g.drop.length} aset ini
              </>
            )}
          </li>
        ))}
        {groups.length > TWIN_GROUPS_SHOWN && <li>dan {groups.length - TWIN_GROUPS_SHOWN} subjek lainnya</li>}
      </ul>
      <Button type="button" size="sm" variant="outline" onClick={onDrop}>
        Sisakan satu per subjek
      </Button>
    </div>
  );
}

const AGENCIES: { id: Agency; label: string }[] = [
  { id: "adobe", label: "Adobe Stock" },
  { id: "shutterstock", label: "Shutterstock (foto, uji coba)" },
];

function filePrefix(agency: Agency): string {
  return agency === "shutterstock" ? "shutterstock" : "microstock";
}

/** Upload order from Shutterstock's CSV help page: files first, then the CSV through the "CSV" button on the Submit page. */
function ShutterstockSteps() {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      <li>Ekstrak ZIP, lalu unggah semua foto JPEG lewat halaman Upload di portal kontributor Shutterstock.</li>
      <li>Tunggu sampai semua foto muncul di halaman Submit.</li>
      <li>
        Klik tombol <strong>CSV</strong> di bagian atas halaman Submit, lalu pilih file CSV dari aplikasi. Jangan unggah CSV lewat
        halaman Upload atau FTPS.
      </li>
      <li>Periksa judul, keyword, dan kategori tiap foto. Bila ada kategori yang ditolak, catat nama yang benar dari pilihan di portal.</li>
      <li>Klik Submit sekali, lalu tunggu sampai prosesnya selesai.</li>
    </ol>
  );
}

/** File names of the exported photos that show fictional people (Adobe's "People and Property are fictional" box). */
function fictionalFilesOf(included: { id: string; filename: string }[], candidates: Candidate[]): string[] {
  const fictional = new Set(candidates.filter((c) => c.fictional).map((c) => c.id));
  return included.filter((i) => fictional.has(i.id)).map((i) => i.filename);
}
