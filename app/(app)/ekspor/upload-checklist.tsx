"use client";

import { Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Anchor } from "@/components/pen-motif";
import { Button } from "@/components/ui/button";
import { AI_LABEL_REMINDER } from "@/lib/adobe/rules";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";

const PORTAL_URL = "https://contributor.stock.adobe.com/";

type Step = { id: string; text: React.ReactNode; required?: boolean; action?: "zip" | "csv" | "portal" };

const STEPS: Step[] = [
  { id: "zip", text: "Unduh ZIP, lalu ekstrak. Adobe tidak menerima ZIP untuk vektor, jadi yang diunggah file SVG-nya.", action: "zip" },
  { id: "upload", text: "Buka Contributor Portal, pilih Upload, lalu pilih semua file SVG.", action: "portal" },
  {
    id: "ai",
    text: (
      <>
        Centang <strong>&ldquo;{AI_LABEL_REMINDER}&rdquo;</strong> di setiap aset. Wajib: tanpa label ini aset bisa ditolak.
      </>
    ),
    required: true,
  },
  { id: "csv", text: "Unggah CSV agar judul, keyword, dan kategori terisi. Jangan ubah baris header.", action: "csv" },
  { id: "check", text: "Cek kategori dan peringatan ukuran artboard sebelum submit." },
  { id: "release", text: "Aset yang menampilkan orang atau properti nyata butuh release." },
];

function StepText({ step, checked }: { step: Step; checked: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-start gap-2", checked && "text-muted-foreground line-through decoration-1")}>
      {step.required && <Anchor filled className="mt-2" />}
      <span>{step.text}</span>
    </span>
  );
}

const storageKey =(stamp: string) => `ekspor-checklist:${stamp}`;

function readDone(stamp: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(stamp));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

type Props = {
  /** Export stamp; ticks are remembered per export in this browser. Without one the list is read-only guidance. */
  stamp?: string;
  onDownloadZip?: () => void;
  onDownloadCsv?: () => void;
};

/** The manual steps on Adobe's side, next to the files they need. */
export function UploadChecklist({ stamp, onDownloadZip, onDownloadCsv }: Props) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const interactive = Boolean(stamp);

  useEffect(() => {
    // Ticks live in localStorage, which only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stamp) setDone(readDone(stamp));
  }, [stamp]);

  function toggle(id: string) {
    if (!stamp) return;
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    try {
      localStorage.setItem(storageKey(stamp), JSON.stringify([...next]));
    } catch {
      // Private mode: ticks just are not remembered.
    }
  }

  const linkClass = cn("inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:decoration-2", tapTarget);

  return (
    <div className="space-y-3">
      {interactive && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {done.size} dari {STEPS.length} langkah selesai
        </p>
      )}
      <ol className="space-y-1">
        {STEPS.map((step, i) => {
          const checked = done.has(step.id);
          const action =
            step.action === "zip" && onDownloadZip ? (
              <Button type="button" size="sm" onClick={onDownloadZip}>
                <Download />
                Unduh ZIP (SVG)
              </Button>
            ) : step.action === "csv" && onDownloadCsv ? (
              <Button type="button" size="sm" variant="outline" onClick={onDownloadCsv}>
                <Download />
                Unduh CSV
              </Button>
            ) : step.action === "portal" ? (
              <a href={PORTAL_URL} target="_blank" rel="noreferrer" className={linkClass}>
                Buka Contributor Portal
                <ExternalLink aria-hidden className="size-3.5" />
                <span className="sr-only">(tab baru)</span>
              </a>
            ) : null;

          return (
            <li
              key={step.id}
              className={cn(
                "flex gap-3 rounded-md px-2 py-2 text-sm",
                step.required && "border border-foreground/25 bg-secondary",
              )}
            >
              <span className="min-w-0 flex-1 space-y-1">
                {interactive ? (
                  // The whole sentence is the hit area, so ticking is easy on a phone.
                  <label className="flex cursor-pointer items-start gap-3 leading-relaxed">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(step.id)}
                      className="mt-1 size-4 shrink-0 cursor-pointer accent-foreground pointer-coarse:size-5"
                    />
                    <StepText step={step} checked={checked} />
                  </label>
                ) : (
                  <span className="flex items-start gap-3 leading-relaxed">
                    <span aria-hidden className="w-4 shrink-0 text-right font-extrabold tabular-nums">
                      {i + 1}
                    </span>
                    <StepText step={step} checked={false} />
                  </span>
                )}
                {action && <span className="block pl-7">{action}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
