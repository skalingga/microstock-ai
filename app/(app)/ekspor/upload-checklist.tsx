"use client";

import { Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Anchor } from "@/components/pen-motif";
import { Button, buttonVariants } from "@/components/ui/button";
import { AI_LABEL_REMINDER, FICTIONAL_LABEL } from "@/lib/adobe/rules";
import { createClient } from "@/lib/supabase/client";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";

const PORTAL_URL = "https://contributor.stock.adobe.com/";

type StepId = "zip" | "upload" | "ai" | "csv" | "check" | "release";

const STEP_IDS: StepId[] = ["zip", "upload", "ai", "csv", "check", "release"];
export const CHECKLIST_STEPS = STEP_IDS.length;

/** A file action: a click handler for a file still in memory, or a link to the stored copy. */
export type FileAction = { onClick: () => void } | { href: string };

const storageKey = (id: string) => `ekspor-checklist:${id}`;

/** Steps ticked for one export in this browser (a cache; the export row holds the shared copy). */
export function readChecklistDone(id: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

type Props = {
  /** Export id (or a stamp before the export is saved). Without one the list is read-only guidance. */
  storageId?: string;
  /** Save ticks on the export row, so they follow the user to another device. Needs a real export id. */
  persist?: boolean;
  /** Ticks already stored on the export row. */
  initialDone?: string[];
  zip?: FileAction;
  csv?: FileAction;
  zipLabel?: string;
  /** Titles in this export that show real people or property. */
  releaseTitles?: string[];
  /** Stage 12: photo file names in this export that show fictional people or property. */
  fictionalFiles?: string[];
  /** The ticked step ids after each change. */
  onProgress?: (done: string[]) => void;
};

function FileButton({ action, label, primary }: { action: FileAction; label: string; primary?: boolean }) {
  const content = (
    <>
      <Download />
      {label}
    </>
  );
  if ("href" in action) {
    return (
      <a href={action.href} download className={buttonVariants({ size: "sm", variant: primary ? "default" : "outline" })}>
        {content}
      </a>
    );
  }
  return (
    <Button type="button" size="sm" variant={primary ? "default" : "outline"} onClick={action.onClick}>
      {content}
    </Button>
  );
}

/** The manual steps on Adobe's side, next to the files they need. */
export function UploadChecklist({
  storageId,
  persist,
  initialDone,
  zip,
  csv,
  zipLabel = "Unduh ZIP",
  releaseTitles,
  fictionalFiles,
  onProgress,
}: Props) {
  const [done, setDone] = useState<Set<string>>(() => new Set(initialDone ?? []));
  const [syncError, setSyncError] = useState(false);
  const interactive = Boolean(storageId);

  useEffect(() => {
    // The stored row wins; without it, fall back to this browser's copy (localStorage only exists in the browser).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storageId && !initialDone) setDone(readChecklistDone(storageId));
  }, [storageId, initialDone]);

  async function toggle(id: string) {
    if (!storageId) return;
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    onProgress?.([...next]);
    try {
      localStorage.setItem(storageKey(storageId), JSON.stringify([...next]));
    } catch {
      // Private mode: the row below still keeps them.
    }
    if (persist) {
      const { error } = await createClient()
        .from("exports")
        .update({ checklist_done: [...next] })
        .eq("id", storageId);
      setSyncError(Boolean(error));
    }
  }

  const linkClass = cn("inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:decoration-2", tapTarget);

  const steps: { id: StepId; text: React.ReactNode; required?: boolean; action?: React.ReactNode }[] = [
    {
      id: "zip",
      text: "Unduh ZIP, lalu ekstrak. Adobe tidak menerima ZIP, jadi yang diunggah file SVG atau JPEG-nya.",
      action: zip && <FileButton action={zip} label={zipLabel} primary />,
    },
    {
      id: "upload",
      text: "Buka Contributor Portal, pilih Unggah, lalu pilih semua file SVG dan JPEG.",
      action: (
        <a href={PORTAL_URL} target="_blank" rel="noreferrer" className={linkClass}>
          Buka Contributor Portal
          <ExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only">(tab baru)</span>
        </a>
      ),
    },
    {
      id: "ai",
      text: (
        <>
          Centang <strong>&ldquo;{AI_LABEL_REMINDER}&rdquo;</strong> di setiap aset. Wajib: tanpa label ini aset bisa ditolak.
          {fictionalFiles && fictionalFiles.length > 0 && (
            <>
              {" "}
              Untuk foto berorang, centang juga <strong>&ldquo;{FICTIONAL_LABEL}&rdquo;</strong>:{" "}
              <span className="font-mono text-xs break-all">{fictionalFiles.join(", ")}</span>.
            </>
          )}
        </>
      ),
      required: true,
    },
    {
      id: "csv",
      text: "Unggah CSV agar judul, keyword, dan kategori terisi. Jangan ubah baris header.",
      action: csv && <FileButton action={csv} label="Unduh CSV" />,
    },
    { id: "check", text: "Cek kategori dan peringatan ukuran artboard sebelum submit." },
    {
      id: "release",
      text:
        releaseTitles && releaseTitles.length > 0 ? (
          <>
            Butuh release (orang atau properti nyata): {releaseTitles.join(", ")}.
          </>
        ) : releaseTitles ? (
          "Tidak ada aset di ekspor ini yang ditandai butuh release."
        ) : (
          "Aset yang menampilkan orang atau properti nyata butuh release."
        ),
    },
  ];

  return (
    <div className="space-y-3">
      {interactive && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {done.size} dari {steps.length} langkah selesai
          {!persist && " · hanya tersimpan di browser ini"}
        </p>
      )}
      {syncError && (
        <p role="alert" className="text-sm text-destructive">
          Centang terakhir belum tersimpan ke Riwayat, jadi belum terlihat di perangkat lain. Periksa koneksi lalu centang lagi.
        </p>
      )}
      <ol className="space-y-1">
        {steps.map((step, i) => {
          const checked = done.has(step.id);
          const text = (
            <span className={cn("flex min-w-0 items-start gap-2", checked && "text-muted-foreground line-through decoration-1")}>
              {step.required && <Anchor filled className="mt-2" />}
              <span>{step.text}</span>
            </span>
          );
          return (
            <li key={step.id} className={cn("space-y-1 rounded-md px-2 py-2 text-sm", step.required && "border border-foreground/25 bg-secondary")}>
              {interactive ? (
                // The whole sentence is the hit area, so ticking is easy on a phone.
                <label className="flex cursor-pointer items-start gap-3 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(step.id)}
                    className="mt-1 size-4 shrink-0 cursor-pointer accent-foreground pointer-coarse:size-5"
                  />
                  {text}
                </label>
              ) : (
                <span className="flex items-start gap-3 leading-relaxed">
                  <span aria-hidden className="w-4 shrink-0 text-right font-extrabold tabular-nums">
                    {i + 1}
                  </span>
                  {text}
                </span>
              )}
              {step.action && <span className="block pl-7">{step.action}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
