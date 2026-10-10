"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";

/**
 * The secondary gallery filters (type, batch, search, Adobe). Shown in the page on larger screens; on phones they wait
 * behind one Filter button in a bottom sheet, so the first thumbnails are on the first screen.
 */
export function FilterSheet({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="max-sm:hidden">{children}</div>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} aria-haspopup="dialog" className="sm:hidden">
        <SlidersHorizontal />
        Filter{activeCount > 0 && <span className="tabular-nums"> · {activeCount}</span>}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filter aset" className="sm:hidden">
        {/* Picking a filter link or applying the search leaves the sheet: the gallery behind has already changed. */}
        <div onClickCapture={(e) => (e.target as HTMLElement).closest("a, button[type=submit]") && setOpen(false)}>{children}</div>
      </Sheet>
    </>
  );
}
