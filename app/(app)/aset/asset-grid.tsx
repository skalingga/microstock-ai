"use client";

import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
      setReason("");
      setAdobeStatus(null);
      const what = status === "belum" ? "Catatan Adobe dihapus" : `Dicatat ${status === "diterima" ? "Diterima" : "Ditolak"} Adobe`;
      setMessage({ text: `${what} untuk ${result.saved} aset.` });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "space-y-2 rounded-md border p-2 text-sm transition-colors duration-150",
          // Only pinned while something is picked, so it does not take phone screen space the rest of the time.
          // Phones: pinned to the bottom, within thumb reach. Larger screens: pinned under the header.
          picked.length > 0
            ? "z-20 border-foreground/30 bg-card shadow-md max-sm:fixed max-sm:inset-x-2 max-sm:bottom-2 sm:sticky sm:top-16 lg:top-3"
            : "bg-card/70",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {picked.length === 0 ? (
            <span className="px-1 text-muted-foreground">Centang aset untuk mengekspor, mencatat hasil Adobe, atau menghapus.</span>
          ) : (
            <span className="px-1 font-semibold tabular-nums">{picked.length} dipilih</span>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
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
          {offPage > 0 && <span className="px-1 text-xs text-muted-foreground">{offPage} dari halaman lain</span>}

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
                Catat hasil Adobe
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={pending}>
                Batal
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-destructive sm:ml-auto" onClick={() => setMode("hapus")}>
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
                <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-sm">
                  {asset.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.previewUrl} alt={asset.label} className="size-full object-contain" loading="lazy" />
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
