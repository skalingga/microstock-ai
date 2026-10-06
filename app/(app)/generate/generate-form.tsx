"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QcBadge } from "@/components/qc-badge";
import { Label } from "@/components/ui/label";
import { MAX_VARIATIONS } from "@/lib/generate/schemas";
import { runJob, type JobItem, type JobState } from "@/lib/generate/run-job";
import { STYLES, type Palette, type StyleId } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/client";
import { selectClass } from "@/lib/ui";

const REQUESTS_PER_MINUTE = 5; // observed on Kenari free models; the queue reads the real limit from headers

const STATUS_LABEL: Record<JobItem["status"], string> = {
  menunggu: "Menunggu",
  berjalan: "Dibuat...",
  selesai: "Selesai",
  gagal: "Gagal",
};

export function GenerateForm({
  userId,
  defaultStyle,
  palettes,
  bannedWords,
}: {
  userId: string;
  defaultStyle: StyleId;
  palettes: Palette[];
  bannedWords: string[];
}) {
  const [theme, setTheme] = useState("");
  const [style, setStyle] = useState<StyleId>(defaultStyle);
  const [paletteIndex, setPaletteIndex] = useState(palettes.length > 0 ? "0" : "");
  const [count, setCount] = useState(10);
  const [state, setState] = useState<JobState | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);

  // Warn before closing the tab: the queue lives in this page.
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  // Release preview object URLs when leaving the page.
  useEffect(() => {
    const urls = urlsRef;
    return () => {
      abortRef.current?.abort();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const palette = paletteIndex === "" ? [] : (palettes[Number(paletteIndex)]?.colors ?? []);
  const estimatedMinutes = Math.max(1, Math.ceil((count + 1) / REQUESTS_PER_MINUTE));

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;

    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setState({ phase: "mulai", items: [] });

    await runJob({
      supabase: createClient(),
      userId,
      theme: theme.trim(),
      style,
      palette,
      count,
      bannedWords,
      signal: controller.signal,
      onState: (next) => {
        for (const item of next.items) {
          if (item.previewUrl && !urlsRef.current.includes(item.previewUrl)) urlsRef.current.push(item.previewUrl);
        }
        setState(next);
      },
    });
    setRunning(false);
  }

  const done = state?.items.filter((i) => i.status === "selesai").length ?? 0;
  const failed = state?.items.filter((i) => i.status === "gagal").length ?? 0;
  const total = state?.items.length ?? 0;
  const finished = state && !running && state.phase !== "mulai";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tema baru</CardTitle>
          <CardDescription>
            Tulis tema dalam bahasa Inggris, mis. “autumn harvest icons”. Hindari nama merek, tokoh, atau karakter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={start} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Tema</Label>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                minLength={2}
                maxLength={120}
                required
                disabled={running}
                placeholder="autumn harvest icons"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="style">Gaya</Label>
                <select
                  id="style"
                  value={style}
                  onChange={(e) => setStyle(e.target.value as StyleId)}
                  disabled={running}
                  className={selectClass}
                >
                  {STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="palette">Palet warna</Label>
                <select
                  id="palette"
                  value={paletteIndex}
                  onChange={(e) => setPaletteIndex(e.target.value)}
                  disabled={running}
                  className={selectClass}
                >
                  <option value="">Bebas (dipilih AI)</option>
                  {palettes.map((p, i) => (
                    <option key={`${p.name}-${i}`} value={i}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {palette.length > 0 && (
                  <div className="flex gap-1" aria-hidden>
                    {palette.map((c) => (
                      <span key={c} className="size-4 rounded-full border" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">Jumlah variasi</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={MAX_VARIATIONS}
                  value={count}
                  onChange={(e) => setCount(Math.min(MAX_VARIATIONS, Math.max(1, Math.round(Number(e.target.value) || 1))))}
                  disabled={running}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Perkiraan waktu: sekitar {estimatedMinutes} menit bila batas model gratis 5 permintaan per menit.
            </p>

            <div className="flex gap-2">
              <Button type="submit" disabled={running || theme.trim().length < 2}>
                {running ? "Sedang berjalan..." : "Mulai generate"}
              </Button>
              {running && (
                <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
                  Hentikan
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {state && (
        <Card>
          <CardHeader>
            <CardTitle>
              {state.phase === "mulai" && "Menyiapkan job..."}
              {state.phase === "konsep" && "Menyusun konsep..."}
              {state.phase === "antrean" && `Membuat aset (${done + failed}/${total})`}
              {state.phase === "selesai" && `Selesai: ${done} aset jadi${failed > 0 ? `, ${failed} gagal` : ""}`}
              {state.phase === "dihentikan" && `Dihentikan: ${done} aset jadi`}
              {state.phase === "gagal" && "Job berhenti"}
            </CardTitle>
            {(state.message || state.providerNote) && (
              <CardDescription role="status">
                {state.message}
                {state.message && state.providerNote ? " " : ""}
                {state.providerNote && !state.message ? `Model terakhir: ${state.providerNote}` : ""}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {total > 0 && (
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(((done + failed) / total) * 100)}%` }}
                />
              </div>
            )}

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {state.items.map((item) => (
                <li key={item.index} className="space-y-1 text-xs">
                  <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-md border">
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt={item.concept.subject} className="size-full object-contain" />
                    ) : (
                      <span className="rounded bg-background/80 px-2 py-1 text-muted-foreground">
                        {STATUS_LABEL[item.status]}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">{item.concept.subject}</p>
                  {item.qc && <QcBadge status={item.qc} />}
                  {item.note && <p className="text-amber-700 dark:text-amber-400">{item.note}</p>}
                  {item.error && <p className="text-destructive">{item.error}</p>}
                </li>
              ))}
            </ul>

            {finished && state.jobId && done > 0 && (
              <Link
                href={`/aset?job=${state.jobId}`}
                className="inline-block text-sm font-medium underline underline-offset-4"
              >
                Lihat hasilnya di Aset
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
