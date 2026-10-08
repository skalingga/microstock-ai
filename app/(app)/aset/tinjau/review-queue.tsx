"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { PenPath, ProgressLine } from "@/components/pen-motif";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { simpanHasilAdobe } from "../actions";

export type ReviewItem = {
  id: string;
  title: string;
  keywordCount: number;
  svgUrl: string | null;
  exportedLabel: string;
};

type Decision = "diterima" | "ditolak";

const kbd = "rounded-sm border bg-muted px-1 font-mono text-[0.7rem] text-muted-foreground";

/** Adobe decisions one asset at a time: D accepts, T rejects (then type the reason and press Enter), L skips. */
export function ReviewQueue({ items, total, backHref }: { items: ReviewItem[]; total: number; backHref: string }) {
  const [index, setIndex] = useState(0);
  const [decided, setDecided] = useState<Map<string, Decision>>(new Map());
  const [history, setHistory] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonRef = useRef<HTMLInputElement>(null);

  const item = items[index];
  const done = decided.size;
  const finished = index >= items.length;

  const goTo = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(items.length, i)));
    setRejecting(false);
    setMessage(null);
  }, [items.length]);

  const save = useCallback(
    (decision: Decision) => {
      if (!item || pending) return;
      const id = item.id;
      startTransition(async () => {
        const result = await simpanHasilAdobe(id, { status: decision, reason: decision === "ditolak" ? reason : "" });
        if (!result.ok) {
          setMessage({ text: result.error, error: true });
          return;
        }
        setDecided((prev) => new Map(prev).set(id, decision));
        setHistory((prev) => [...prev, id]);
        // The reason is kept: rejections in one batch often share it.
        goTo(index + 1);
      });
    },
    [item, pending, reason, index, goTo],
  );

  function undo() {
    const id = history.at(-1);
    if (!id || pending) return;
    startTransition(async () => {
      const result = await simpanHasilAdobe(id, { status: "belum", reason: "" });
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      setDecided((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setHistory((prev) => prev.slice(0, -1));
      goTo(items.findIndex((i) => i.id === id));
      setMessage({ text: "Keputusan terakhir dibatalkan." });
    });
  }

  useEffect(() => {
    if (rejecting) reasonRef.current?.focus();
  }, [rejecting]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === "d") save("diterima");
      else if (key === "t") {
        e.preventDefault();
        setRejecting(true);
      } else if (key === "l" || e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, goTo, index]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-md border border-dashed p-10 text-center text-sm">
        <PenPath className="max-w-56" />
        <p className="font-semibold">Semua aset yang diekspor sudah punya keputusan Adobe.</p>
        <Link href="/ekspor" className="font-semibold underline underline-offset-4">
          Lihat tingkat penerimaan di Ekspor
        </Link>
      </div>
    );
  }

  const accepted = [...decided.values()].filter((d) => d === "diterima").length;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm" aria-live="polite">
          <span>
            <strong className="tabular-nums">{done}</strong> dari {items.length} dicatat
            {total > items.length && <span className="text-muted-foreground"> (dari {total} yang menunggu; sisanya dimuat berikutnya)</span>}
          </span>
          {history.length > 0 && (
            <button type="button" onClick={undo} disabled={pending} className="font-semibold underline underline-offset-4">
              Batalkan yang terakhir
            </button>
          )}
        </p>
        <ProgressLine value={items.length ? done / items.length : 0} label="Progres tinjauan" />
      </div>

      {finished ? (
        <div className="space-y-4 rounded-md border p-6">
          <h2 className="text-2xl font-extrabold tracking-tight">Selesai untuk sekarang</h2>
          <p className="text-sm">
            {done} keputusan dicatat: {accepted} diterima, {done - accepted} ditolak.
            {done < items.length && ` ${items.length - done} aset dilewati dan masih menunggu.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/ekspor" className={buttonVariants()}>
              Lihat tingkat penerimaan
            </Link>
            {done < items.length && (
              <Button type="button" variant="outline" onClick={() => goTo(items.findIndex((i) => !decided.has(i.id)))}>
                Tinjau yang dilewati
              </Button>
            )}
            <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
              Kembali ke galeri
            </Link>
          </div>
        </div>
      ) : (
        item && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="bg-checker flex aspect-square max-h-[60vh] items-center justify-center overflow-hidden rounded-md border max-sm:aspect-auto max-sm:h-[34vh]">
              {item.svgUrl ? (
                // Shown through <img>, never inline, so scripts in an SVG can never run.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.svgUrl} alt={item.title} className="size-full object-contain" />
              ) : (
                <span className="text-sm text-muted-foreground">File SVG tidak tersedia.</span>
              )}
            </div>

            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground tabular-nums">
                  Aset {index + 1} dari {items.length} · diekspor {item.exportedLabel}
                  {decided.has(item.id) && ` · sudah dicatat ${decided.get(item.id) === "diterima" ? "Diterima" : "Ditolak"}`}
                </p>
                <h2 className="text-2xl leading-tight font-extrabold tracking-tight">{item.title}</h2>
                <Link href={`/aset/${item.id}`} className="text-sm underline underline-offset-4" target="_blank">
                  Buka detail (tab baru)
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="lg" onClick={() => save("diterima")} disabled={pending} aria-keyshortcuts="D">
                  Diterima <kbd className={cn(kbd, "border-primary-foreground/30 bg-transparent text-primary-foreground/80")}>D</kbd>
                </Button>
                <Button size="lg" variant="outline" onClick={() => setRejecting(true)} disabled={pending} aria-keyshortcuts="T" aria-expanded={rejecting}>
                  Ditolak <kbd className={kbd}>T</kbd>
                </Button>
              </div>

              {rejecting && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save("ditolak");
                  }}
                >
                  <label className="min-w-48 flex-1 space-y-1">
                    <span className="block text-xs font-semibold text-muted-foreground">Alasan (opsional, salin dari email Adobe)</span>
                    <Input
                      ref={reasonRef}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                      placeholder="mis. Similar content, Quality"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRejecting(false);
                      }}
                    />
                  </label>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Menyimpan..." : "Simpan Ditolak"}
                  </Button>
                </form>
              )}

              {message && (
                <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                  {message.text}
                </p>
              )}

              <div className="flex items-center gap-2 border-t pt-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0 || pending}>
                  <ChevronLeft />
                  Sebelumnya
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => goTo(index + 1)} disabled={pending} aria-keyshortcuts="L ArrowRight">
                  Lewati
                  <ChevronRight />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground max-sm:hidden">
                Keyboard: <kbd className={kbd}>D</kbd> diterima, <kbd className={kbd}>T</kbd> ditolak lalu Enter, <kbd className={kbd}>L</kbd> atau{" "}
                <kbd className={kbd}>→</kbd> lewati, <kbd className={kbd}>←</kbd> sebelumnya.
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
