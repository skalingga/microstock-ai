"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { processPending, type BatchProgress } from "@/lib/qc/batch";
import { createClient } from "@/lib/supabase/client";

/** Runs QC and metadata for assets that never got them (made before stage 3, or interrupted). */
export function AssetToolbar({ pending, bannedWords, job }: { pending: number; bannedWords: string[]; job?: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (pending === 0 && !running && !result) return null;

  async function start() {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResult(null);

    const outcome = await processPending({
      supabase: createClient(),
      bannedWords,
      job,
      signal: controller.signal,
      onProgress: setProgress,
    });

    setRunning(false);
    setProgress(null);
    setResult(
      outcome.stoppedBy
        ? `Berhenti: ${outcome.stoppedBy}`
        : controller.signal.aborted
          ? `Dihentikan setelah ${outcome.processed} aset.`
          : `Selesai: ${outcome.processed} aset diproses${outcome.failed > 0 ? `, ${outcome.failed} gagal` : ""}.`,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
      {!running && pending > 0 && (
        <>
          <span>{pending} aset belum selesai diperiksa atau belum punya metadata.</span>
          <Button size="sm" onClick={start}>
            Jalankan QC dan metadata
          </Button>
        </>
      )}
      {running && (
        <>
          <span role="status">
            Memproses {progress ? `${progress.done}/${progress.total}` : "..."}
            {progress?.message ? `: ${progress.message}` : ""}
          </span>
          <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>
            Hentikan
          </Button>
        </>
      )}
      {result && !running && <span role="status">{result}</span>}
    </div>
  );
}
