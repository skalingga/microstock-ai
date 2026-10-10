"use client";

import { Download, Ellipsis, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SelectionHandles } from "@/components/pen-motif";
import { QcBadge } from "@/components/qc-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapusBanyakAset, simpanHasilAdobeBanyak } from "./actions";
import { AdobeDecision, type AdobeDecisionValue } from "./adobe-decision";
import { withQuery } from "./filters";

export type GridAsset = {
  id: string;
  previewUrl?: string;
  label: string;
  /** Stage 12: a photo from Google Flow instead of an SVG. */
  photo?: boolean;
  qcStatus: string;
  exported: boolean;
  adobeStatus: string | null;
  /** Has metadata and is Lolos or Perlu cek, so the export page can take it. */
  exportable: boolean;
};

type Mode = "pilih" | "adobe" | "hapus" | "hapus-catatan";

/** What bulk actions need to know about an asset, including those not on the current page. */
export type PickableAsset = Pick<GridAsset, "id" | "exported" | "adobeStatus" | "exportable">;

/** The gallery grid. Ticking assets opens a bar to export them, record Adobe's decision, or delete them together. */
export function AssetGrid({
  assets,
  detailQuery,
  filterTotal,
  filterFirst,
}: {
  assets: GridAsset[];
  /** Gallery filter, carried into the detail page. */
  detailQuery: string;
  /** How many assets the whole filter holds, across pages. */
  filterTotal: number;
  /** The first assets of the whole filter (up to the bulk limit), so one tap can pick them across pages. */
  filterFirst: PickableAsset[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("pilih");
  const [adobeStatus, setAdobeStatus] = useState<AdobeDecisionValue | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  // Phones: the pinned bar keeps one row (count, Ekspor, Catat, ⋯); the rest opens behind ⋯.
  const [more, setMore] = useState(false);
  // Height of the bar while it sits in the page, so pinning it on phones leaves a spacer and the grid does not jump.
  const barRef = useRef<HTMLDivElement>(null);
  const [restHeight, setRestHeight] = useState(0);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(() => {
      if (!bar.dataset.pinned) setRestHeight(bar.offsetHeight);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // Picks made on other pages stay in the selection; ids that no longer exist (deleted) drop out.
  const known = new Map<string, PickableAsset>([...filterFirst, ...assets].map((a) => [a.id, a]));
  const picked = [...selected].flatMap((id) => known.get(id) ?? []);
  const offPage = picked.filter((a) => !assets.some((p) => p.id === a.id)).length;
  const firstCount = filterFirst.length;
  const allPicked = assets.length > 0 && assets.every((a) => selected.has(a.id));
  const exportedCount = picked.filter((a) => a.exported || a.adobeStatus).length;
  const exportable = picked.filter((a) => a.exportable);
  const notExported = picked.filter((a) => !a.exported).length;
  const exportedBefore = exportable.filter((a) => a.exported).length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setMode("pilih");
    setMessage(null);
    if (next.size === 0) setMore(false);
  }

  function remove() {
    const ids = picked.map((a) => a.id);
    startTransition(async () => {
      const result = await hapusBanyakAset(ids);
      setMode("pilih");
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      setSelected(new Set());
      setMore(false);
      setMessage({ text: `${result.deleted} aset dihapus.${result.warning ? ` ${result.warning}` : ""}`, error: !!result.warning });
      router.refresh();
    });
  }

  function saveAdobe(status: AdobeDecisionValue | "belum") {
    const ids = picked.map((a) => a.id);
    startTransition(async () => {
      const result = await simpanHasilAdobeBanyak(ids, { status, reason });
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      setMode("pilih");
      setSelected(new Set());
      setMore(false);
      setReason("");
      setAdobeStatus(null);
      const what = status === "belum" ? "Catatan Adobe dihapus" : `Dicatat ${status === "diterima" ? "Diterima" : "Ditolak"} Adobe`;
      setMessage({ text: `${what} untuk ${result.saved} aset.` });
      router.refresh();
    });
  }

  const pinned = picked.length > 0;
  // While pinned on a phone, secondary actions wait behind ⋯ so the bar stays one row wide; opened, they line up below the main row.
  const secondary = pinned ? (more ? "max-sm:order-1" : "max-sm:hidden") : undefined;
  // "Pick the first 100" is rarely the first move on a phone: it waits until something is picked (then behind ⋯).
  const filterPick = pinned ? secondary : "max-sm:hidden";

  return (
    <div className="space-y-4">
      {pinned && <div aria-hidden className="sm:hidden" style={{ height: restHeight }} />}
      <div
        ref={barRef}
        data-pinned={pinned || undefined}
        className={cn(
          "space-y-2 rounded-md border p-2 text-sm transition-colors duration-150",
          // Only pinned while something is picked, so it does not take phone screen space the rest of the time.
          // Phones: the shared full-width band above the tab bar (fixed, so it stays while the grid scrolls). Larger screens: pinned under the header.
          pinned
            ? "z-20 border-foreground/30 bg-card shadow-md max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[var(--tabbar-h)] max-sm:mb-0 max-sm:rounded-none max-sm:border-0 max-sm:border-t max-sm:px-4 max-sm:py-3 max-sm:shadow-none sm:sticky sm:top-16 lg:top-3"
            : "bg-card/70",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {picked.length === 0 ? (
            <span className="px-1 text-muted-foreground">
              Centang aset untuk mengekspor, mencatat hasil Adobe<span className="max-sm:hidden">, atau menghapus</span>.
            </span>
          ) : (
            <span className="px-1 font-semibold tabular-nums">{picked.length} dipilih</span>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={secondary}
            onClick={() => {
              setSelected(
                allPicked ? new Set([...selected].filter((id) => !assets.some((a) => a.id === id))) : new Set([...selected, ...assets.map((a) => a.id)]),
              );
              setMode("pilih");
              setMessage(null);
            }}
            disabled={pending}
          >
            {allPicked ? "Batal pilih halaman ini" : "Pilih semua di halaman ini"}
          </Button>
          {filterTotal > assets.length && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={filterPick}
              onClick={() => {
                setSelected(new Set([...selected, ...filterFirst.map((a) => a.id)]));
                setMode("pilih");
                setMessage(null);
              }}
              disabled={pending}
            >
              {filterTotal > firstCount ? `Pilih ${firstCount} pertama di filter ini (dari ${filterTotal})` : `Pilih semua ${filterTotal} di filter ini`}
            </Button>
          )}
          {offPage > 0 && <span className={cn("px-1 text-xs text-muted-foreground", secondary)}>{offPage} dari halaman lain</span>}

          {picked.length > 0 && mode === "pilih" && (
            <>
              {exportable.length > 0 ? (
                <Link href={`/ekspor?pilih=${exportable.map((a) => a.id).join(",")}`} className={buttonVariants({ size: "sm" })}>
                  <Download />
                  Ekspor {exportable.length}
                </Link>
              ) : (
                <Button type="button" size="sm" disabled>
                  <Download />
                  Ekspor 0
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => setMode("adobe")}>
                Catat <span className="max-sm:hidden">hasil</span> Adobe
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-w-11 sm:hidden"
                onClick={() => setMore(!more)}
                aria-expanded={more}
                aria-label={more ? "Sembunyikan aksi lain" : "Aksi lain: pilih semua, batal, hapus"}
              >
                <Ellipsis />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={secondary}
                onClick={() => {
                  setSelected(new Set());
                  setMore(false);
                }}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="button" size="sm" variant="ghost" className={cn("text-destructive sm:ml-auto", secondary)} onClick={() => setMode("hapus")}>
                <Trash2 />
                Hapus
              </Button>
            </>
          )}
        </div>

        {picked.length > 0 && mode === "pilih" && (exportable.length < picked.length || exportedBefore > 0) && (
          <p className="px-1 text-xs text-muted-foreground">
            {exportable.length < picked.length &&
              `${picked.length - exportable.length} aset tidak ikut ekspor: belum Lolos/Perlu cek atau belum punya metadata. `}
            {exportedBefore > 0 && `${exportedBefore} sudah pernah diekspor dan akan diekspor lagi.`}
          </p>
        )}

        {picked.length > 0 && mode === "adobe" && (
          <div className="space-y-2 border-t pt-2">
            <div className="flex flex-wrap items-end gap-3">
              <AdobeDecision
                name="adobe-massal"
                legend={`Keputusan Adobe untuk ${picked.length} aset`}
                value={adobeStatus}
                onChange={setAdobeStatus}
                reason={reason}
                onReasonChange={setReason}
                disabled={pending}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => adobeStatus && saveAdobe(adobeStatus)} disabled={pending || !adobeStatus}>
                  {pending ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setMode("pilih")} disabled={pending}>
                  Batal
                </Button>
              </div>
            </div>
            {notExported > 0 && adobeStatus && (
              <p className="text-xs text-warning-foreground">
                {notExported} di antaranya belum pernah diekspor dari aplikasi ini. Pastikan memang sudah kamu unggah ke Adobe.
              </p>
            )}
            {exportedCount > 0 && (
              <button
                type="button"
                onClick={() => setMode("hapus-catatan")}
                disabled={pending}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Hapus catatan Adobe dari aset terpilih
              </button>
            )}
          </div>
        )}

        {picked.length > 0 && mode === "hapus-catatan" && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <span>
              Hapus catatan Adobe dari {picked.length} aset? Keputusan Diterima atau Ditolak (dan alasannya) hilang; tingkat penerimaan di Ekspor ikut berubah.
            </span>
            <Button type="button" size="sm" variant="destructive" onClick={() => saveAdobe("belum")} disabled={pending}>
              {pending ? "Menghapus..." : "Ya, hapus catatan"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode("adobe")} disabled={pending}>
              Batal
            </Button>
          </div>
        )}

        {picked.length > 0 && mode === "hapus" && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <span>
              Hapus {picked.length} aset secara permanen?
              {exportedCount > 0 && ` ${exportedCount} di antaranya sudah diekspor atau punya keputusan Adobe; datanya ikut hilang.`}
            </span>
            <Button type="button" size="sm" variant="destructive" onClick={remove} disabled={pending}>
              {pending ? "Menghapus..." : "Ya, hapus"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode("pilih")} disabled={pending}>
              Batal
            </Button>
          </div>
        )}

        {message && (
          <p role={message.error ? "alert" : "status"} className={cn("px-1", message.error && "text-destructive")}>
            {message.text}
          </p>
        )}
      </div>

      {/* Room under the grid on phones so the fixed bar never hides the last row. */}
      <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6", picked.length > 0 && "max-sm:pb-40")}>
        {assets.map((asset) => {
          const isPicked = selected.has(asset.id);
          return (
            <li
              key={asset.id}
              className={cn(
                "group relative flex flex-col gap-2 rounded-md border bg-card p-2 text-xs transition-colors duration-150 hover:border-foreground/40",
              )}
            >
              {isPicked && <SelectionHandles />}
              <label
                className={cn(
                  "absolute top-3 left-3 z-[1] flex size-8 cursor-pointer max-sm:size-11 pointer-coarse:size-11 items-center justify-center rounded-md border bg-card transition-opacity duration-150",
                  // Hidden until hover on devices with a mouse, always shown when picked or on touch screens.
                  !isPicked && picked.length === 0 && "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100",
                )}
                title={isPicked ? "Batalkan pilihan" : "Pilih aset ini"}
              >
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-foreground"
                  checked={isPicked}
                  onChange={() => toggle(asset.id)}
                  disabled={pending}
                  aria-label={`Pilih ${asset.label}`}
                />
              </label>
              <Link href={withQuery(`/aset/${asset.id}`, detailQuery)} className="block" tabIndex={-1} aria-hidden>
                <div className={cn("flex aspect-square items-center justify-center overflow-hidden rounded-sm", asset.photo ? "bg-muted" : "bg-checker")}>
                  {asset.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.previewUrl} alt={asset.label} className={cn("size-full", asset.photo ? "object-cover" : "object-contain")} loading="lazy" />
                  ) : (
                    <span className="text-muted-foreground">Tanpa preview</span>
                  )}
                </div>
              </Link>
              <Link
                href={withQuery(`/aset/${asset.id}`, detailQuery)}
                className="line-clamp-2 min-h-8 px-1 leading-4 font-medium underline-offset-2 hover:underline"
              >
                {asset.label}
              </Link>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 pb-1">
                <QcBadge status={asset.qcStatus} />
                {asset.photo && <span className="rounded-sm border px-1.5 text-muted-foreground">Foto</span>}
                {asset.exported && <span className="text-muted-foreground">Diekspor</span>}
                {asset.adobeStatus === "diterima" && <span className="font-medium text-success-foreground">Diterima Adobe</span>}
                {asset.adobeStatus === "ditolak" && <span className="font-medium text-danger-foreground">Ditolak Adobe</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
