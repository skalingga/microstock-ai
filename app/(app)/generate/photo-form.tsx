"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, FileDown, LayoutGrid, Loader2, Square, Upload } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { ProgressLine } from "@/components/pen-motif";
import { QcBadge } from "@/components/qc-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FICTIONAL_LABEL } from "@/lib/adobe/rules";
import { ApiError } from "@/lib/generate/client";
import { RateGate } from "@/lib/generate/queue";
import {
  DEFAULT_FLOW_MODEL,
  DEFAULT_PHOTO_ASPECT,
  FLOW_MODELS,
  FLOW_URL,
  MAX_PHOTO_PROMPTS,
  PHOTO_ASPECTS,
  PHOTO_INPUT_TYPES,
  type PhotoAspect,
} from "@/lib/photo/config";
import { PhotoReadError, uploadPhoto, writePhotoPrompts, type PhotoJobData, type PhotoPromptItem } from "@/lib/photo/run";
import { fetchHashPool } from "@/lib/qc/store";
import type { HashPoolEntry, QcStatus } from "@/lib/qc/types";
import { findBannedWords } from "@/lib/settings/banned";
import { MAX_AVOID, matchSaturated, type SaturatedSubject } from "@/lib/subjects/saturation";
import { createClient } from "@/lib/supabase/client";
import { selectClass, tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type PhotoJobSummary = { id: string; theme: string; createdAt: string; prompts: number; uploaded: number };
export type OpenPhotoJob = { id: string; theme: string; data: PhotoJobData; uploaded: number };

type UploadStage = "menunggu" | "membaca" | "mengunggah" | "metadata" | "selesai" | "gagal";

type UploadItem = {
  key: string;
  fileName: string;
  promptIndex: number | null;
  stage: UploadStage;
  message?: string;
  error?: string;
  previewUrl?: string;
  qc?: QcStatus | "menunggu";
  note?: string;
};

const STAGE_LABEL: Record<UploadStage, string> = {
  menunggu: "Menunggu",
  membaca: "Membaca...",
  mengunggah: "Mengunggah...",
  metadata: "Metadata AI...",
  selesai: "Selesai",
  gagal: "Gagal",
};

const SET_MODES = [
  { label: "Adegan beragam", variations: false },
  { label: "Variasi satu subjek", variations: true },
];

export function PhotoForm({
  userId,
  bannedWords,
  saturated,
  initialTheme,
  uploadBy,
  recentJobs,
  openJob,
}: {
  userId: string;
  bannedWords: string[];
  saturated: SaturatedSubject[];
  initialTheme: string;
  uploadBy?: string;
  recentJobs: PhotoJobSummary[];
  openJob: OpenPhotoJob | null;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  const [countText, setCountText] = useState("5");
  const [aspect, setAspect] = useState<PhotoAspect>(DEFAULT_PHOTO_ASPECT);
  const [variations, setVariations] = useState(false);
  const [writing, setWriting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [flowModel, setFlowModel] = useState<string>(DEFAULT_FLOW_MODEL);
  const [copied, setCopied] = useState<number | "semua" | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const files = useRef(new Map<string, File>());
  const busy = useRef(false);
  const pool = useRef<HashPoolEntry[] | null>(null);
  const gate = useRef(new RateGate());
  const abort = useRef<AbortController | null>(null);
  const [tick, setTick] = useState(0);

  const count = Number(countText);
  const countValid = Number.isInteger(count) && count >= 1 && count <= MAX_PHOTO_PROMPTS;
  const bannedHits = findBannedWords(theme, bannedWords);
  const saturatedHits = matchSaturated(theme, saturated);
  const themeValid = theme.trim().length >= 2;

  // Object URLs of the previews belong to this page.
  useEffect(() => () => uploads.forEach((u) => u.previewUrl && URL.revokeObjectURL(u.previewUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function writePrompts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!themeValid || !countValid || bannedHits.length > 0 || writing) return;
    setWriting(true);
    setError(null);
    setStatus("Menulis prompt foto...");
    const controller = new AbortController();
    try {
      const { jobId } = await writePhotoPrompts({
        supabase: createClient(),
        theme: theme.trim(),
        count,
        aspect,
        avoid: saturated.slice(0, MAX_AVOID).map((s) => s.subject),
        variations,
        signal: controller.signal,
        onStatus: setStatus,
      });
      setStatus(null);
      router.push(`/generate?jenis=foto&job=${jobId}`);
    } catch (err) {
      setStatus(null);
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan tak terduga.");
    } finally {
      setWriting(false);
    }
  }

  async function copy(text: string, which: number | "semua") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      setError("Browser menolak menyalin. Tekan lama teks prompt lalu salin manual.");
    }
  }

  function addFiles(list: FileList | null, promptIndex: number | null) {
    if (!list || list.length === 0) return;
    const added: UploadItem[] = [];
    for (const file of Array.from(list)) {
      const key = crypto.randomUUID();
      files.current.set(key, file);
      added.push({ key, fileName: file.name, promptIndex, stage: "menunggu" });
    }
    setUploads((prev) => [...prev, ...added]);
  }

  const patch = (key: string, p: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...p } : u)));

  // One photo at a time (CLAUDE.md rule 2): pick the next waiting upload whenever the queue is idle.
  useEffect(() => {
    if (!openJob || busy.current) return;
    const next = uploads.find((u) => u.stage === "menunggu");
    const file = next && files.current.get(next.key);
    if (!next || !file) return;
    busy.current = true;
    abort.current ??= new AbortController();
    const signal = abort.current.signal;
    const prompt: PhotoPromptItem | undefined = next.promptIndex === null ? undefined : openJob.data.prompts[next.promptIndex];

    (async () => {
      const supabase = createClient();
      try {
        pool.current ??= await fetchHashPool(supabase, "photo");
        const res = await uploadPhoto(file, {
          supabase,
          userId,
          jobId: openJob.id,
          theme: openJob.theme,
          flowModel,
          prompt,
          bannedWords,
          pool: pool.current,
          gate: gate.current,
          signal,
          onStage: (stage, message) => patch(next.key, { stage, message }),
        });
        patch(next.key, {
          stage: "selesai",
          message: undefined,
          previewUrl: res.previewUrl,
          qc: res.verdict.status,
          note: res.metadataError ? `Metadata belum dibuat: ${res.metadataError} Buat ulang dari halaman aset.` : undefined,
        });
      } catch (err) {
        const message = signal.aborted
          ? "Dihentikan. Bila foto sudah sempat tersimpan, ada di Aset tanpa metadata."
          : err instanceof PhotoReadError || err instanceof ApiError
            ? err.message
            : "Terjadi kesalahan tak terduga.";
        patch(next.key, { stage: "gagal", message: undefined, error: message });
      } finally {
        files.current.delete(next.key);
        busy.current = false;
        if (signal.aborted) abort.current = null;
        setTick((t) => t + 1); // wake the effect for the next upload
      }
    })();
  }, [uploads, tick, openJob, userId, flowModel, bannedWords]);

  function stop() {
    abort.current?.abort();
    // Uploads that never started are dropped; the one running stops after its current step.
    setUploads((prev) => prev.filter((u) => u.stage !== "menunggu"));
  }

  const finished = uploads.filter((u) => u.stage === "selesai");
  const failed = uploads.filter((u) => u.stage === "gagal").length;
  const queued = uploads.filter((u) => u.stage !== "selesai" && u.stage !== "gagal").length;
  const lolos = finished.filter((u) => u.qc === "lolos").length;
  const perluCek = finished.filter((u) => u.qc === "perlu_cek").length;
  const gagalQc = finished.filter((u) => u.qc === "gagal").length;
  const perPrompt = (index: number) => uploads.filter((u) => u.promptIndex === index && u.stage !== "gagal").length;
  const allPrompts = openJob?.data.prompts.map((p, i) => `${i + 1}. ${p.prompt}`).join("\n\n") ?? "";

  return (
    <div className="space-y-6">
      {openJob && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-extrabold">Prompt untuk Flow: {openJob.theme}</h2>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Di Flow pilih Image, rasio {openJob.data.aspect}. Unduh dengan <strong className="text-foreground">2K Upscale</strong>: 1K
              terlalu kecil untuk Adobe (minimal 4 MP).
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <Button type="button" variant="secondary" onClick={() => copy(allPrompts, "semua")}>
                {copied === "semua" ? <Check /> : <Copy />}
                {copied === "semua" ? "Tersalin" : `Salin semua (${openJob.data.prompts.length})`}
              </Button>
              <a href={FLOW_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink />
                Buka Flow
              </a>
              <div className="space-y-1">
                <Label htmlFor="flow-model">Model di Flow</Label>
                <select id="flow-model" value={flowModel} onChange={(e) => setFlowModel(e.target.value)} className={selectClass}>
                  {FLOW_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ol className="divide-y border-y">
              {openJob.data.prompts.map((p, i) => (
                <li key={i} className="space-y-2 py-4">
                  <p className="font-semibold">
                    {i + 1}. {p.subject}
                  </p>
                  <p className="select-all text-sm text-muted-foreground">{p.prompt}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => copy(p.prompt, i)}>
                      {copied === i ? <Check /> : <Copy />}
                      {copied === i ? "Tersalin" : "Salin"}
                    </Button>
                    <UploadButton label="Unggah hasil" onFiles={(list) => addFiles(list, i)} />
                    {perPrompt(i) > 0 && <span className="text-sm text-muted-foreground">{perPrompt(i)} foto di sesi ini</span>}
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center gap-3">
              <UploadButton label="Unggah tanpa prompt" variant="outline" onFiles={(list) => addFiles(list, null)} />
              <p className="text-sm text-muted-foreground">
                {openJob.uploaded > 0 ? `${openJob.uploaded} foto sudah diunggah untuk prompt ini. ` : ""}
                JPEG dari Flow disimpan apa adanya.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {uploads.length > 0 && openJob && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-extrabold">
                {queued > 0 ? `Mengolah foto (${finished.length + failed}/${uploads.length})` : `Selesai: ${finished.length} foto tersimpan`}
              </h2>
            </CardTitle>
            <p role="status" className="text-sm text-muted-foreground empty:hidden">
              {queued > 0 ? "Satu foto sekali jalan: baca, cek, unggah, lalu metadata AI. Biarkan tab ini terbuka." : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressLine value={(finished.length + failed) / uploads.length} label="Kemajuan unggah" />
            {queued > 0 && (
              <Button type="button" variant="outline" onClick={stop}>
                <Square />
                Hentikan
              </Button>
            )}
            {queued === 0 && finished.length > 0 && (
              <div className="space-y-3 border-y py-4">
                <p className="text-sm font-semibold">
                  {[`${lolos} Lolos`, `${perluCek} Perlu cek`, gagalQc > 0 ? `${gagalQc} Gagal` : null, failed > 0 ? `${failed} ditolak sebelum disimpan` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/aset?job=${openJob.id}`} className={buttonVariants({ variant: "secondary" })}>
                    <LayoutGrid />
                    Periksa di Aset
                  </Link>
                  {lolos > 0 && (
                    <Link href="/ekspor" className={buttonVariants({ variant: "outline" })}>
                      <FileDown />
                      Ekspor {lolos} foto Lolos
                    </Link>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Foto berorang: di portal Adobe centang juga &quot;{FICTIONAL_LABEL}&quot;.
                </p>
              </div>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {uploads.map((u) => (
                <li key={u.key} className="space-y-1.5 rounded-2xl border bg-card p-2 text-xs">
                  <div
                    className={cn(
                      "flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-muted",
                      !["menunggu", "selesai", "gagal"].includes(u.stage) && "animate-pulse ring-2 ring-brand",
                    )}
                  >
                    {u.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.previewUrl} alt={u.fileName} className="size-full object-cover" />
                    ) : (
                      <span className="rounded-sm bg-card px-2.5 py-1 font-medium text-muted-foreground">{STAGE_LABEL[u.stage]}</span>
                    )}
                  </div>
                  <p className="truncate text-muted-foreground">
                    {u.promptIndex !== null ? `Prompt ${u.promptIndex + 1} · ` : ""}
                    {u.fileName}
                  </p>
                  {u.message && <p className="text-muted-foreground">{u.message}</p>}
                  {u.qc && <QcBadge status={u.qc} />}
                  {u.note && <p className="text-warning-foreground">{u.note}</p>}
                  {u.error && <p className="text-destructive">{u.error}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-extrabold">Prompt foto baru</h2>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Aplikasi menulis prompt, kamu membuat fotonya di Google Flow, lalu unggah hasilnya ke sini.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={writePrompts} noValidate className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="photo-theme">Tema</Label>
              <Input
                id="photo-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                maxLength={120}
                required
                disabled={writing}
                placeholder="mis. mental health counseling"
                aria-invalid={bannedHits.length > 0 ? true : undefined}
                aria-describedby={cn(bannedHits.length > 0 && "photo-theme-error", saturatedHits.length > 0 && "photo-theme-saturated", "photo-theme-hint")}
              />
              {bannedHits.length > 0 && (
                <p id="photo-theme-error" className="text-sm text-destructive">
                  Kata terlarang: {bannedHits.join(", ")}. Hapus dari tema, atau ubah daftarnya di Pengaturan.
                </p>
              )}
              <p id="photo-theme-hint" className="text-sm text-muted-foreground">
                Bahasa Inggris. Orang di foto selalu fiktif; tanpa merek, tokoh, atau peristiwa berita.
              </p>
              {saturatedHits.length > 0 && (
                <p id="photo-theme-saturated" className="text-sm font-medium">
                  Mirip subjek yang ditolak Adobe sebagai &quot;similar content&quot;:{" "}
                  {saturatedHits.map((s) => `${s.subject.toLowerCase()} (${s.count} aset)`).join(", ")}. Pilih subjek yang lebih spesifik.
                </p>
              )}
              {uploadBy && theme === initialTheme && (
                <p className="text-sm font-medium">
                  Dari Riset: upload sebelum{" "}
                  {new Date(`${uploadBy}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.
                </p>
              )}
            </div>

            <fieldset className="space-y-2" disabled={writing}>
              <legend className="text-sm font-medium">Isi set</legend>
              <div className="flex flex-wrap gap-1">
                {SET_MODES.map((mode) => (
                  <label
                    key={mode.label}
                    className={cn(
                      "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm",
                      tapTarget,
                      variations === mode.variations ? "border-foreground bg-secondary font-semibold" : "hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="photo-set-mode"
                      checked={variations === mode.variations}
                      onChange={() => setVariations(mode.variations)}
                      className="accent-foreground"
                    />
                    {mode.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="photo-count" className="inline-flex items-center gap-1.5">
                  Jumlah prompt
                  <InfoTip label="Tentang jumlah prompt">
                    Flow membuat beberapa foto per prompt (mis. x4). Adobe menolak lebih dari 3 foto serupa per tema, jadi pilih
                    yang terbaik dari tiap prompt.
                  </InfoTip>
                </Label>
                <Input
                  id="photo-count"
                  inputMode="numeric"
                  value={countText}
                  onChange={(e) => setCountText(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  disabled={writing}
                  aria-invalid={!countValid ? true : undefined}
                  aria-describedby="photo-count-hint"
                />
                <p id="photo-count-hint" className={cn("text-sm", countValid ? "text-muted-foreground" : "text-destructive")}>
                  1 sampai {MAX_PHOTO_PROMPTS}.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="photo-aspect">Rasio</Label>
                <select
                  id="photo-aspect"
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value as PhotoAspect)}
                  disabled={writing}
                  className={selectClass}
                >
                  {PHOTO_ASPECTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">Samakan dengan pilihan rasio di Flow.</p>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={writing || !themeValid || !countValid || bannedHits.length > 0}>
                {writing && <Loader2 className="animate-spin" />}
                Tulis prompt
              </Button>
              <p role="status" className="text-sm text-muted-foreground empty:hidden">
                {status ?? (!themeValid ? "Isi tema dulu." : "")}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {recentJobs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">Prompt sebelumnya</h2>
          <ul className="divide-y border-y">
            {recentJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                <Link href={`/generate?jenis=foto&job=${job.id}`} className="font-semibold underline underline-offset-4">
                  {job.theme}
                </Link>
                <span className="text-muted-foreground">
                  {job.prompts} prompt · {job.uploaded} foto ·{" "}
                  {new Date(job.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function UploadButton({
  label,
  onFiles,
  variant = "secondary",
}: {
  label: string;
  onFiles: (files: FileList | null) => void;
  variant?: "secondary" | "outline";
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" size="sm" variant={variant} onClick={() => input.current?.click()}>
        <Upload />
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={PHOTO_INPUT_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
