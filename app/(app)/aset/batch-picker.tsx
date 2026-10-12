"use client";

import { Check, ChevronDown, Layers, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { daftarBatch, type BatchChoice } from "./actions";
import { withQuery } from "./filters";

const TZ = "Asia/Jakarta";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const dayLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: TZ });

function groupLabel(key: string, sample: string): string {
  const today = dayKey.format(new Date());
  const yesterday = dayKey.format(new Date(Date.now() - 86_400_000));
  const date = dayLabel.format(new Date(sample));
  if (key === today) return `Hari ini · ${date}`;
  if (key === yesterday) return `Kemarin · ${date}`;
  return date;
}

/**
 * Picks the batch the gallery shows. Opens a panel under the button (inline inside the phone filter sheet) with a
 * search field and the batches that still hold assets, grouped by day, each with a thumbnail and its counts.
 * `baseQuery` is the rest of the gallery filter, kept when switching batch; the page number is not part of it.
 */
export function BatchPicker({ job, currentLabel, baseQuery }: { job?: string; currentLabel?: string; baseQuery: string }) {
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<BatchChoice[] | null>(null);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const load = async () => {
    setError("");
    try {
      const result = await daftarBatch();
      if (result.ok) setBatches(result.batches);
      else setError(result.error);
    } catch {
      setError("Daftar batch tidak bisa dimuat. Periksa koneksi lalu coba lagi.");
    }
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onPointerDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Inside the phone filter sheet, Escape closes this panel first, not the whole sheet.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    rootRef.current?.addEventListener("keydown", onKey);
    const root = rootRef.current;
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      root?.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const shown = (batches ?? []).filter((b) => !needle || b.title.toLowerCase().includes(needle));
    const out: { key: string; label: string; items: BatchChoice[] }[] = [];
    for (const b of shown) {
      const key = dayKey.format(new Date(b.createdAt));
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(b);
      else out.push({ key, label: groupLabel(key, b.createdAt), items: [b] });
    }
    return out;
  }, [batches, term]);

  const hrefFor = (id?: string) => withQuery("/aset", [id && `job=${id}`, baseQuery].filter(Boolean).join("&"));

  // Arrow keys walk the field and the rows, like a list box.
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-row]") ?? [])];
    if (links.length === 0) return;
    e.preventDefault();
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") links[Math.min(at + 1, links.length - 1)].focus();
    else if (at <= 0) inputRef.current?.focus();
    else links[at - 1].focus();
  };

  return (
    <div ref={rootRef} className="relative max-sm:w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          // Refreshed on every open, so counts follow deletions; the last list shows meanwhile.
          if (!open) void load();
          setOpen(!open);
        }}
        className={cn(
          "inline-flex h-9 max-w-72 items-center gap-2 rounded-lg border px-3 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring max-sm:h-11 max-sm:w-full max-sm:max-w-none pointer-coarse:h-11",
          job ? "border-foreground bg-secondary font-semibold" : "border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-input/30",
        )}
      >
        <Layers className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">
          <span className={cn(job && "font-normal text-muted-foreground")}>Batch:</span> {job ? currentLabel : "Semua"}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={panelId}
          onKeyDown={onListKey}
          className="z-40 mt-1.5 flex w-full flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-[0_12px_32px_-8px_oklch(0.15_0.01_60/0.35)] sm:absolute sm:top-full sm:left-0 sm:w-[22rem]"
        >
          <label className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Cari tema batch</span>
            <input
              ref={inputRef}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Cari tema batch"
              className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </label>

          <div ref={listRef} className="max-h-[min(55dvh,26rem)] overflow-y-auto overscroll-contain p-1">
            <PickerRow href={hrefFor()} active={!job} onPick={() => setOpen(false)}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Layers className="size-4" />
              </span>
              <span className="min-w-0 flex-1 font-medium">Semua batch</span>
            </PickerRow>

            {error ? (
              <p role="alert" className="flex flex-wrap items-center gap-x-2 px-3 py-4 text-sm text-destructive">
                {error}
                <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-4">
                  Coba lagi
                </button>
              </p>
            ) : batches === null ? (
              <div aria-label="Memuat batch" className="space-y-1 px-2 py-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <span className="size-10 shrink-0 animate-pulse rounded-md bg-muted" />
                    <span className="flex-1 space-y-1.5">
                      <span className="block h-3 w-3/5 animate-pulse rounded bg-muted" />
                      <span className="block h-2.5 w-2/5 animate-pulse rounded bg-muted" />
                    </span>
                  </div>
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {term.trim() ? `Tidak ada batch dengan tema "${term.trim()}".` : "Belum ada batch yang masih punya aset."}
              </p>
            ) : (
              groups.map((g) => (
                <section key={g.key} aria-label={g.label}>
                  <h3 className="sticky top-0 z-10 -mx-1 bg-popover px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground">{g.label}</h3>
                  {g.items.map((b) => (
                    <PickerRow key={b.id} href={hrefFor(b.id)} active={b.id === job} onPick={() => setOpen(false)}>
                      <span className="size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                        {b.thumbUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; SVG previews are never inlined
                          <img src={b.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{b.title}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {b.total} aset
                          {b.lolos > 0 && <> · {b.lolos === b.total ? "semua Lolos" : `${b.lolos} Lolos`}</>}
                        </span>
                      </span>
                    </PickerRow>
                  ))}
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PickerRow({ href, active, onPick, children }: { href: string; active: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      data-row
      aria-current={active ? "true" : undefined}
      onClick={onPick}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-150 hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-secondary text-secondary-foreground",
      )}
    >
      {children}
      {active ? <Check className="size-4 shrink-0" aria-label="Dipilih" /> : <span className="size-4 shrink-0" />}
    </Link>
  );
}
