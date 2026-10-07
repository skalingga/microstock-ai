"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { QcBadge } from "@/components/qc-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapusBanyakAset } from "./actions";

export type GridAsset = {
  id: string;
  previewUrl?: string;
  label: string;
  qcStatus: string;
  exported: boolean;
  adobeStatus: string | null;
};

/** The gallery grid. Ticking assets opens a bar to delete them together. */
export function AssetGrid({ assets }: { assets: GridAsset[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  // Ids of assets no longer on this page (deleted, or another page) drop out of the selection.
  const picked = assets.filter((a) => selected.has(a.id));
  const allPicked = picked.length === assets.length && assets.length > 0;
  const exportedCount = picked.filter((a) => a.exported || a.adobeStatus).length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setConfirming(false);
    setMessage(null);
  }

  function remove() {
    const ids = picked.map((a) => a.id);
    startTransition(async () => {
      const result = await hapusBanyakAset(ids);
      setConfirming(false);
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      setSelected(new Set());
      setMessage({ text: `${result.deleted} aset dihapus.${result.warning ? ` ${result.warning}` : ""}`, error: !!result.warning });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "sticky top-16 z-20 flex min-h-13 flex-wrap items-center gap-2 rounded-2xl border p-2 text-sm transition-colors duration-150 lg:top-3",
          picked.length > 0 ? "border-primary/30 bg-card shadow-lg shadow-primary/10" : "bg-card/70",
        )}
      >
        {picked.length === 0 ? (
          <span className="px-1 text-muted-foreground">Pilih aset untuk dihapus</span>
        ) : (
          <span className="px-1 font-medium">{picked.length} dipilih</span>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setSelected(allPicked ? new Set() : new Set(assets.map((a) => a.id)));
            setConfirming(false);
            setMessage(null);
          }}
          disabled={pending}
        >
          {allPicked ? "Batal pilih semua" : "Pilih semua di halaman ini"}
        </Button>
        {picked.length > 0 && !confirming && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={pending}>
              Batal
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => setConfirming(true)}>
              Hapus {picked.length} aset
            </Button>
          </>
        )}
        {confirming && (
          <>
            <span>
              Hapus {picked.length} aset secara permanen?
              {exportedCount > 0 && ` ${exportedCount} di antaranya sudah diekspor atau punya keputusan Adobe; datanya ikut hilang.`}
            </span>
            <Button type="button" size="sm" variant="destructive" onClick={remove} disabled={pending}>
              {pending ? "Menghapus..." : "Ya, hapus"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Batal
            </Button>
          </>
        )}
        {message && (
          <span role={message.error ? "alert" : "status"} className={cn("px-1", message.error && "text-destructive")}>
            {message.text}
          </span>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {assets.map((asset) => {
          const isPicked = selected.has(asset.id);
          return (
            <li
              key={asset.id}
              className={cn(
                "group relative flex flex-col gap-2 rounded-2xl border bg-card p-2 text-xs shadow-xs transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-md",
                isPicked && "border-primary ring-2 ring-primary/30",
              )}
            >
              <label
                className={cn(
                  "absolute top-3 left-3 z-[1] flex size-8 cursor-pointer items-center justify-center rounded-lg border bg-card/95 shadow-sm transition-opacity duration-150",
                  // Hidden until hover on devices with a mouse, always shown when picked or on touch screens.
                  !isPicked && picked.length === 0 && "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100",
                )}
                title={isPicked ? "Batalkan pilihan" : "Pilih aset ini"}
              >
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer"
                  checked={isPicked}
                  onChange={() => toggle(asset.id)}
                  disabled={pending}
                  aria-label={`Pilih ${asset.label}`}
                />
              </label>
              <Link href={`/aset/${asset.id}`} className="block">
                <div
                  className={cn(
                    "bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-xl",
                  )}
                >
                  {asset.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.previewUrl} alt={asset.label} className="size-full object-contain" loading="lazy" />
                  ) : (
                    <span className="text-muted-foreground">Tanpa preview</span>
                  )}
                </div>
              </Link>
              <p className="line-clamp-2 min-h-8 px-1 font-medium leading-4">{asset.label}</p>
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
