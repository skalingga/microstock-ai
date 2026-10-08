"use client";

import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SelectionHandles } from "@/components/pen-motif";
import { QcBadge } from "@/components/qc-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { hapusBanyakAset, simpanHasilAdobeBanyak } from "./actions";

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

type Mode = "pilih" | "adobe" | "hapus";

const ADOBE_CHOICES = [
  { value: "diterima", label: "Diterima" },
  { value: "ditolak", label: "Ditolak" },
  { value: "belum", label: "Hapus catatan" },
] as const;

type AdobeChoice = (typeof ADOBE_CHOICES)[number]["value"];

/** The gallery grid. Ticking assets opens a bar to export them, record Adobe's decision, or delete them together. */
export function AssetGrid({ assets }: { assets: GridAsset[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("pilih");
  const [adobeStatus, setAdobeStatus] = useState<AdobeChoice>("diterima");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  // Ids of assets no longer on this page (deleted, or another page) drop out of the selection.
  const picked = assets.filter((a) => selected.has(a.id));
  const allPicked = picked.length === assets.length && assets.length > 0;
  const exportedCount = picked.filter((a) => a.exported || a.adobeStatus).length;
  const exportable = picked.filter((a) => a.exportable);
  const notExported = picked.filter((a) => !a.exported).length;

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

  function saveAdobe() {
    const ids = picked.map((a) => a.id);
    startTransition(async () => {
      const result = await simpanHasilAdobeBanyak(ids, { status: adobeStatus, reason });
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      setMode("pilih");
      setSelected(new Set());
      setReason("");
      const what =
        adobeStatus === "belum" ? "Catatan Adobe dihapus" : `Dicatat ${adobeStatus === "diterima" ? "Diterima" : "Ditolak"} Adobe`;
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
          picked.length > 0 ? "sticky top-16 z-20 border-foreground/30 bg-card shadow-md lg:top-3" : "bg-card/70",
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
              setSelected(allPicked ? new Set() : new Set(assets.map((a) => a.id)));
              setMode("pilih");
              setMessage(null);
            }}
            disabled={pending}
          >
            {allPicked ? "Batal pilih semua" : "Pilih semua di halaman ini"}
          </Button>

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

        {picked.length > 0 && mode === "pilih" && exportable.length < picked.length && (
          <p className="px-1 text-xs text-muted-foreground">
            {picked.length - exportable.length} aset tidak ikut ekspor: belum Lolos/Perlu cek atau belum punya metadata.
          </p>
        )}

        {picked.length > 0 && mode === "adobe" && (
          <div className="flex flex-wrap items-end gap-3 border-t pt-2">
            <fieldset className="space-y-1">
              <legend className="text-xs font-semibold text-muted-foreground">Keputusan Adobe untuk {picked.length} aset</legend>
              <div className="flex flex-wrap gap-1">
                {ADOBE_CHOICES.map((c) => (
                  <label
                    key={c.value}
                    className={cn(
                      "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3",
                      tapTarget,
                      adobeStatus === c.value ? "border-foreground bg-secondary font-semibold" : "hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="adobe-massal"
                      value={c.value}
                      checked={adobeStatus === c.value}
                      onChange={() => setAdobeStatus(c.value)}
                      className="accent-foreground"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {adobeStatus === "ditolak" && (
              <label className="min-w-48 flex-1 space-y-1">
                <span className="block text-xs font-semibold text-muted-foreground">Alasan (opsional, salin dari email Adobe)</span>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="mis. Quality issues" />
              </label>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={saveAdobe} disabled={pending}>
                {pending ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMode("pilih")} disabled={pending}>
                Batal
              </Button>
            </div>
            {notExported > 0 && adobeStatus !== "belum" && (
              <p className="w-full text-xs text-warning-foreground">
                {notExported} di antaranya belum pernah diekspor dari aplikasi ini. Pastikan memang sudah kamu unggah ke Adobe.
              </p>
            )}
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

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {assets.map((asset) => {
          const isPicked = selected.has(asset.id);
          return (
            <li
              key={asset.id}
              className={cn(
                "group relative flex flex-col gap-2 rounded-xl border bg-card p-2 text-xs transition-colors duration-150 hover:border-foreground/40",
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
              <Link href={`/aset/${asset.id}`} className="block">
                <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-lg">
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
