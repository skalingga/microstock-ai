"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { CHECKLIST_STEPS, UploadChecklist } from "./upload-checklist";

export type HistoryRow = {
  id: string;
  dateLabel: string;
  count: number;
  zipUrl: string | null;
  csvUrl: string | null;
  /** Ticks stored on the export row: the same on every device. */
  checklistDone: string[];
};

function Row({ row, startOpen }: { row: HistoryRow; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  // Kept here, so closing and reopening the row shows this session's ticks too.
  const [doneIds, setDoneIds] = useState(row.checklistDone);
  const done = doneIds.length;

  const fileLink = cn("inline-flex items-center px-2 underline underline-offset-4 hover:decoration-2", tapTarget);
  const finished = done === CHECKLIST_STEPS;

  return (
    <li className="py-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`riwayat-${row.id}`}
          className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md text-left hover:bg-muted/50", tapTarget)}
        >
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform duration-150", open && "rotate-180")} />
          <span className="min-w-0">
            <span className="block">
              {row.dateLabel} · <strong className="tabular-nums">{row.count}</strong> aset
            </span>
            <span className={cn("block text-xs", finished ? "text-success-foreground" : "text-muted-foreground")}>
              {finished ? "Semua langkah unggah selesai" : `Checklist unggah: ${done}/${CHECKLIST_STEPS} langkah`}
            </span>
          </span>
        </button>
        <span className="flex gap-1">
          {!row.zipUrl && !row.csvUrl && <span className="text-muted-foreground">File tidak tersedia</span>}
          {row.zipUrl && (
            <a href={row.zipUrl} download aria-label={`Unduh ZIP ekspor ${row.dateLabel}`} className={fileLink}>
              ZIP
            </a>
          )}
          {row.csvUrl && (
            <a href={row.csvUrl} download aria-label={`Unduh CSV ekspor ${row.dateLabel}`} className={fileLink}>
              CSV
            </a>
          )}
        </span>
      </div>
      {open && (
        <div id={`riwayat-${row.id}`} className="pt-2 pb-3 sm:pl-6">
          <UploadChecklist
            storageId={row.id}
            persist
            initialDone={doneIds}
            zip={row.zipUrl ? { href: row.zipUrl } : undefined}
            csv={row.csvUrl ? { href: row.csvUrl } : undefined}
            onProgress={setDoneIds}
          />
        </div>
      )}
    </li>
  );
}

/** Past exports. Each keeps its own upload checklist, so the Adobe steps can be finished later, e.g. on a PC. */
export function ExportHistory({ rows, openId }: { rows: HistoryRow[]; openId?: string }) {
  return (
    <ul className="divide-y rounded-md border bg-card px-4 text-sm">
      {rows.map((row) => (
        <Row key={row.id} row={row} startOpen={row.id === openId} />
      ))}
    </ul>
  );
}
