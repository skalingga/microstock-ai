"use client";

import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { tapTarget } from "@/lib/ui";
import { confirmLeave } from "@/lib/use-unsaved-guard";
import { cn } from "@/lib/utils";

const navLink = cn(
  "inline-flex items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
  tapTarget,
  "min-h-9",
);

/** Back to the gallery view the user came from, plus the previous/next asset in it. J/K or the arrow keys step through. */
export function DetailNav({ backHref, prevHref, nextHref, position }: { backHref: string; prevHref?: string; nextHref?: string; position?: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const target = (e.key === "j" || e.key === "ArrowRight") ? nextHref : (e.key === "k" || e.key === "ArrowLeft") ? prevHref : undefined;
      if (target && confirmLeave()) router.push(target);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prevHref, nextHref]);

  return (
    <nav aria-label="Navigasi aset" aria-describedby="detail-nav-keys" className="flex flex-wrap items-center justify-between gap-2">
      <span id="detail-nav-keys" className="sr-only">
        Tombol J atau panah kanan: aset berikutnya. K atau panah kiri: sebelumnya.
      </span>
      <Link href={backHref} className={cn(navLink, "pl-0")}>
        <ArrowLeft className="size-4" />
        Kembali ke galeri
      </Link>
      <span className="flex items-center gap-1">
        {position && <span className="px-1 text-xs text-muted-foreground tabular-nums">{position}</span>}
        {prevHref ? (
          <Link href={prevHref} className={navLink} aria-keyshortcuts="K ArrowLeft" title="Sebelumnya (K)">
            <ChevronLeft className="size-4" />
            Sebelumnya
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(navLink, "opacity-40")}>
            <ChevronLeft className="size-4" />
            Sebelumnya
          </span>
        )}
        {nextHref ? (
          <Link href={nextHref} className={navLink} aria-keyshortcuts="J ArrowRight" title="Berikutnya (J)">
            Berikutnya
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(navLink, "opacity-40")}>
            Berikutnya
            <ChevronRight className="size-4" />
          </span>
        )}
      </span>
    </nav>
  );
}
