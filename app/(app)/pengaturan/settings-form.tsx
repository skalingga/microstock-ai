"use client";

import { ChevronDown, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatIdr } from "@/lib/budget";
import type { Tables } from "@/lib/database.types";
import { isImageStyle, AUTO_PROVIDERS, STYLES, formatBannedWords, formatPalettes, parseBannedWords, parsePalettes, toPalettes, toProviderOrder } from "@/lib/settings/schema";
import { selectClass, tapTarget } from "@/lib/ui";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { cn } from "@/lib/utils";
import { simpanPengaturan, type SettingsField } from "./actions";

export type ModelOption = { id: string; note: string; tested: boolean; paid: boolean; testNote: string | null };

type Provider = "kenari" | "gemini";

type Props = {
  settings: Tables<"user_settings">;
  spentIdr: number;
  resetLabel: string;
  /** What an empty model field falls back to on the server. */
  defaults: { kenari: string; gemini: string; image: string };
  imagePrices: Record<string, number>;
  /** Average real cost of one SVG call per paid Kenari model, from provider_usage. */
  svgCostIdr: Record<string, number>;
  options: Record<Provider, ModelOption[]>;
};

const MAX_BANNED = 500;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const timeFormat = new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Jakarta" });

function Section({ id, title, tip, children }: { id: string; title: string; tip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0" aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-1 text-lg font-bold">
        {title}
        {tip && <InfoTip align="start">{tip}</InfoTip>}
      </h2>
      {children}
    </section>
  );
}

/** Label, control, and the line under it: an error when there is one, otherwise the hint. */
function Field({
  name,
  label,
  hint,
  error,
  children,
  className,
}: {
  name: SettingsField | "primary_provider";
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? (
        <p id={`${name}-msg`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${name}-msg`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const joinHint = (...parts: string[]) => parts.filter(Boolean).join(" ");

const describe = (name: string, error?: string, hint?: unknown) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error || hint ? `${name}-msg` : undefined,
});

export function SettingsForm({ settings, spentIdr, resetLabel, defaults, imagePrices, svgCostIdr, options }: Props) {
  const [primary, backup] = toProviderOrder(settings.provider_order);
  const initial = {
    primaryProvider: primary.provider as Provider,
    backupProvider: (backup?.provider ?? "") as Provider | "",
    primaryModel: primary.model,
    backupModel: backup?.model ?? "",
    budget: String(settings.kenari_monthly_budget_idr),
    textModel: settings.kenari_text_model,
    imageModel: settings.kenari_image_model,
    style: settings.default_style,
    palettes: formatPalettes(toPalettes(settings.palettes)),
    banned: formatBannedWords(settings.banned_words),
  };

  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [primaryProvider, setPrimaryProvider] = useState(initial.primaryProvider);
  const [backupProvider, setBackupProvider] = useState(initial.backupProvider);
  const [primaryModel, setPrimaryModel] = useState(initial.primaryModel);
  const [backupModel, setBackupModel] = useState(initial.backupModel);
  /** Why a model field just changed by itself, shown under it until the next edit there. */
  const [modelNote, setModelNote] = useState<{ primary?: string; backup?: string }>({});
  const [budget, setBudget] = useState(initial.budget);
  const [textModel, setTextModel] = useState(initial.textModel);
  const [imageModel, setImageModel] = useState(initial.imageModel);
  const [style, setStyle] = useState(initial.style);
  const [palettes, setPalettes] = useState(initial.palettes);
  const [banned, setBanned] = useState(initial.banned);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Leaving with unsaved edits asks first: closing the tab and in-app links (the sidebar, "Lihat hasil uji model").
  useUnsavedGuard(dirty);

  // A model id belongs to one provider: switching provider never keeps the other provider's id.
  function changePrimaryProvider(next: Provider) {
    if (next === primaryProvider) return;
    if (next === backupProvider) {
      // Picking the backup's provider swaps the two, models included.
      setBackupProvider(primaryProvider);
      setBackupModel(primaryModel);
      setPrimaryModel(backupModel);
      setModelNote({ primary: "Ditukar dengan cadangan.", backup: "Ditukar dengan utama." });
    } else {
      setPrimaryModel("");
      setModelNote((n) => ({ ...n, primary: primaryModel ? `Dikosongkan (tadinya ${primaryModel}): model itu milik provider lain.` : undefined }));
    }
    setPrimaryProvider(next);
  }

  function changeBackupProvider(next: Provider | "") {
    if (next === backupProvider) return;
    setBackupModel("");
    setModelNote((n) => ({ ...n, backup: backupModel && next ? `Dikosongkan (tadinya ${backupModel}): model itu milik provider lain.` : undefined }));
    setBackupProvider(next);
  }

  // After a failed save, take the user to the first field that needs fixing.
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  function discard() {
    formRef.current?.reset();
    setPrimaryProvider(initial.primaryProvider);
    setBackupProvider(initial.backupProvider);
    setPrimaryModel(initial.primaryModel);
    setBackupModel(initial.backupModel);
    setModelNote({});
    setBudget(initial.budget);
    setTextModel(initial.textModel);
    setImageModel(initial.imageModel);
    setStyle(initial.style);
    setPalettes(initial.palettes);
    setBanned(initial.banned);
    setErrors({});
    setSummary(null);
    setDirty(false);
  }

  // Submitted by hand (not via form action) so a validation error does not reset the fields.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await simpanPengaturan(formData);
      if (result.ok) {
        setErrors({});
        setSummary(null);
        setDirty(false);
        setSavedAt(result.savedAt);
      } else {
        setSummary(result.error);
        setErrors(result.fields);
      }
    });
  }

  // Budget: what it means in money and in images, before saving.
  const budgetNumber = budget.trim() === "" ? null : Number(budget);
  const oldBudget = settings.kenari_monthly_budget_idr;
  const effectiveImageModel = imageModel.trim() || defaults.image;
  const imagePrice = imagePrices[effectiveImageModel];
  const spentShare = oldBudget > 0 ? Math.min(1, spentIdr / oldBudget) : spentIdr > 0 ? 1 : 0;
  const budgetHint =
    budgetNumber === null
      ? "Wajib diisi. Tulis 0 untuk mematikan semua model berbayar."
      : budgetNumber === 0
        ? "0: semua model berbayar mati, termasuk Siluet dan Line art. Model gratis tetap jalan."
        : imagePrice && budgetNumber > spentIdr
          ? `Sisa bulan ini ${formatIdr(budgetNumber - spentIdr)}: cukup untuk sekitar ${Math.floor((budgetNumber - spentIdr) / imagePrice)} gambar ${effectiveImageModel}. Model teks berbayar memakai batas yang sama; model gratis tidak dihitung.`
          : "Berlaku untuk model teks dan gambar berbayar. Model gratis tidak dihitung.";
  const budgetWarning =
    budgetNumber !== null && budgetNumber > 0 && budgetNumber < spentIdr
      ? `Lebih kecil dari pemakaian bulan ini (${formatIdr(spentIdr)}): model berbayar langsung berhenti sampai ${resetLabel}.`
      : budgetNumber !== null && oldBudget > 0 && budgetNumber >= oldBudget * 3
        ? `Naik ${Math.round(budgetNumber / oldBudget)} kali lipat dari batas sekarang (${formatIdr(oldBudget)}). Pastikan saldo Kenari cukup.`
        : null;

  const modelPlaceholder = (provider: Provider | "") =>
    provider === "gemini" ? `Bawaan: ${defaults.gemini}` : provider === "kenari" ? (defaults.kenari ? `Bawaan: ${defaults.kenari}` : "Bawaan server") : "";

  // The line under a model field: free or paid, what an SVG costs, how it did in the model test.
  const modelCost = (provider: Provider | "", model: string): string => {
    if (!provider) return "";
    const id = model.trim() || (provider === "gemini" ? defaults.gemini : defaults.kenari);
    if (!id) return "";
    if (provider === "gemini") return "Gemini free tier: gratis.";
    const option = options.kenari.find((o) => o.id === id);
    if (!option) return "";
    if (!option.paid) return "Model gratis, tidak dihitung ke batas biaya.";
    const avg = svgCostIdr[id];
    const parts = ["Berbayar", avg !== undefined ? `±${formatIdr(avg)} per SVG` : "belum ada data biaya", option.testNote].filter(Boolean);
    return `${parts.join(" · ")}.`;
  };

  const bannedCount = parseBannedWords(banned).length;
  const paletteRows = parsePalettes(palettes);
  const paidStyleBlocked = budgetNumber === 0 && isImageStyle(style);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={(e) => {
        setDirty(true);
        // Editing a field clears its error; the others stay until the next save.
        const target = e.target as unknown as { name?: string };
        const name = (target.name ?? "") as SettingsField;
        if (errors[name]) {
          setErrors((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
          });
          setSummary(null);
        }
      }}
      className="max-w-3xl space-y-8"
      noValidate
    >
      {/* Shared suggestion lists for the model fields. */}
      {(["kenari", "gemini"] as const).map((p) => (
        <datalist key={p} id={`models-${p}`}>
          {options[p].map((m) => (
            <option key={m.id} value={m.id} label={m.note || undefined} />
          ))}
        </datalist>
      ))}
      <datalist id="models-image">
        {Object.entries(imagePrices).map(([id, price]) => (
          <option key={id} value={id} label={`${formatIdr(price)} per gambar`} />
        ))}
      </datalist>

      <Section id="biaya-heading" title="Biaya dan model berbayar">
        <div className="space-y-2">
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <span>
              Terpakai bulan ini <strong className="text-base tabular-nums">{formatIdr(spentIdr)}</strong> dari{" "}
              <span className="tabular-nums">{formatIdr(oldBudget)}</span>
            </span>
            <span className="text-xs text-muted-foreground">Mulai dari nol lagi {resetLabel} (WIB)</span>
          </p>
          <div className="h-1 bg-muted" role="progressbar" aria-label="Pemakaian anggaran Kenari" aria-valuenow={Math.round(spentShare * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full origin-left", spentShare >= 0.9 ? "bg-destructive" : "bg-foreground")} style={{ transform: `scaleX(${spentShare})` }} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="kenari_monthly_budget_idr" label="Batas biaya Kenari per bulan" hint={budgetHint} error={errors.kenari_monthly_budget_idr}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Rp</span>
              <Input
                id="kenari_monthly_budget_idr"
                name="kenari_monthly_budget_idr"
                type="number"
                inputMode="numeric"
                min={0}
                max={1000000}
                step={1000}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="max-w-40 tabular-nums"
                {...describe("kenari_monthly_budget_idr", errors.kenari_monthly_budget_idr, budgetHint)}
              />
            </div>
          </Field>

          <Field
            name="kenari_image_model"
            label="Model gambar (Siluet dan Line art)"
            hint={
              imagePrice
                ? `${formatIdr(imagePrice)} per gambar dari saldo Kenari. Tanpa cadangan.`
                : `Harga ${effectiveImageModel} belum dikenal aplikasi, jadi panggilannya akan ditolak. Pilih dari daftar.`
            }
            error={errors.kenari_image_model}
          >
            <Input
              id="kenari_image_model"
              name="kenari_image_model"
              list="models-image"
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              placeholder={`Bawaan: ${defaults.image}`}
              className="font-mono md:text-sm"
              autoComplete="off"
              spellCheck={false}
              {...describe("kenari_image_model", errors.kenari_image_model, true)}
            />
          </Field>
        </div>
        {budgetWarning && (
          <p role="status" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-foreground">
            {budgetWarning}
          </p>
        )}
      </Section>

      <Section
        id="provider-heading"
        title="Rantai provider"
        tip="Provider utama dipakai dulu. Saat kena limit, terlalu lama, atau error, aplikasi pindah ke cadangan. Model yang kamu pilih sendiri di Generate tetap jalan tanpa cadangan."
      >
        <p className="text-sm text-muted-foreground">
          Bingung memilih?{" "}
          <Link href="/uji-model" className="font-semibold text-foreground underline underline-offset-4 hover:decoration-2">
            Lihat hasil uji model
          </Link>
          . Model yang sudah diuji tampil paling atas di daftar, dengan skornya.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-3">
            <Field name="primary_provider" label="Provider utama">
              <select
                id="primary_provider"
                name="primary_provider"
                value={primaryProvider}
                onChange={(e) => changePrimaryProvider(e.target.value as Provider)}
                className={selectClass}
              >
                {AUTO_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="primary_model" label="Model utama" hint={modelNote.primary ?? joinHint("Kosong: model bawaan.", modelCost(primaryProvider, primaryModel))} error={errors.primary_model}>
              <Input
                id="primary_model"
                name="primary_model"
                list={`models-${primaryProvider}`}
                value={primaryModel}
                onChange={(e) => {
                  setPrimaryModel(e.target.value);
                  setModelNote((n) => ({ ...n, primary: undefined }));
                }}
                placeholder={modelPlaceholder(primaryProvider)}
                className="font-mono md:text-sm"
                autoComplete="off"
                spellCheck={false}
                {...describe("primary_model", errors.primary_model, true)}
              />
            </Field>
          </div>
          <div className="space-y-3">
            <Field name="backup_provider" label="Provider cadangan" error={errors.backup_provider}>
              <select
                id="backup_provider"
                name="backup_provider"
                value={backupProvider}
                onChange={(e) => changeBackupProvider(e.target.value as Provider | "")}
                className={selectClass}
                {...describe("backup_provider", errors.backup_provider)}
              >
                <option value="">Tidak dipakai</option>
                {AUTO_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value} disabled={p.value === primaryProvider}>
                    {p.label}
                    {p.value === primaryProvider ? " (sudah jadi utama)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {backupProvider && (
              <Field name="backup_model" label="Model cadangan" hint={modelNote.backup ?? joinHint("Kosong: model bawaan.", modelCost(backupProvider, backupModel))} error={errors.backup_model}>
                <Input
                  id="backup_model"
                  name="backup_model"
                  list={`models-${backupProvider}`}
                  value={backupModel}
                  onChange={(e) => {
                    setBackupModel(e.target.value);
                    setModelNote((n) => ({ ...n, backup: undefined }));
                  }}
                  placeholder={modelPlaceholder(backupProvider)}
                  className="font-mono md:text-sm"
                  autoComplete="off"
                  spellCheck={false}
                  {...describe("backup_model", errors.backup_model, true)}
                />
              </Field>
            )}
          </div>
          <Field
            name="kenari_text_model"
            label="Model teks Kenari (konsep dan metadata)"
            hint={joinHint(
              "Dipakai saat konsep dan metadata jalan di Kenari. Bisa model yang lebih murah. Kosong: sama dengan model Kenari di atas.",
              modelCost("kenari", textModel),
            )}
            error={errors.kenari_text_model}
            className="sm:col-span-2"
          >
            <Input
              id="kenari_text_model"
              name="kenari_text_model"
              list="models-kenari"
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              placeholder="Sama dengan model Kenari di atas"
              className="font-mono md:text-sm"
              autoComplete="off"
              spellCheck={false}
              {...describe("kenari_text_model", errors.kenari_text_model, true)}
            />
          </Field>
        </div>
      </Section>

      <Section id="bawaan-heading" title="Bawaan untuk Generate">
        <Field
          name="default_style"
          label="Gaya bawaan"
          hint={paidStyleBlocked ? undefined : "Siluet dan Line art memakai model gambar berbayar."}
          error={errors.default_style}
        >
          <select
            id="default_style"
            name="default_style"
            value={style}
            onChange={(e) => setStyle(e.target.value as typeof style)}
            className={cn(selectClass, "max-w-sm")}
            {...describe("default_style", errors.default_style, true)}
          >
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        {paidStyleBlocked && (
          <p className="text-sm text-warning-foreground">Batas biaya Rp0, jadi gaya ini tidak akan bisa jalan sampai batasnya dinaikkan.</p>
        )}

        <Field
          name="palettes"
          label="Palet warna"
          hint={
            <>
              Satu palet per baris: <code className="font-mono">Nama: #FF6B6B, #FFD93D</code>. Maksimal 20 palet, 12 warna per palet.
            </>
          }
          error={errors.palettes}
        >
          <Textarea
            id="palettes"
            name="palettes"
            rows={5}
            className="font-mono md:text-sm"
            value={palettes}
            onChange={(e) => setPalettes(e.target.value)}
            spellCheck={false}
            {...describe("palettes", errors.palettes, true)}
          />
        </Field>
        {paletteRows.length > 0 && (
          <ul className="space-y-1.5" aria-label="Contoh palet">
            {paletteRows.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-24 font-medium">{p.name || "Tanpa nama"}</span>
                <span className="flex flex-wrap gap-1">
                  {p.colors.length === 0 && <span className="text-xs text-destructive">belum ada warna</span>}
                  {p.colors.map((c, j) =>
                    HEX.test(c) ? (
                      <span key={j} title={c} className="size-5 border border-foreground/20" style={{ backgroundColor: c }} />
                    ) : (
                      <span key={j} className="rounded-sm bg-danger-soft px-1 font-mono text-xs text-danger-foreground">
                        {c}?
                      </span>
                    ),
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="kata-heading" title="Kata terlarang" tip="Nama artis, tokoh, karakter fiksi, merek, atau IP lain. Dipakai untuk menyaring tema, prompt, dan metadata.">
        <details className="group" open={Boolean(errors.banned_words)}>
          <summary className={cn("inline-flex cursor-pointer list-none items-center gap-2 text-sm", tapTarget)}>
            <span>
              <strong className="tabular-nums">{bannedCount}</strong> kata atau frasa
            </span>
            <span className="font-semibold underline underline-offset-4">Edit daftar</span>
            <ChevronDown aria-hidden className="size-4 transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <div className="pt-2">
            <Field
              name="banned_words"
              label={
                <span className="flex w-full justify-between gap-2">
                  Daftar
                  <span className={cn("text-xs font-normal tabular-nums", bannedCount > MAX_BANNED ? "text-destructive" : "text-muted-foreground")}>
                    {bannedCount}/{MAX_BANNED}
                  </span>
                </span>
              }
              hint="Satu per baris, atau dipisah koma. Huruf besar-kecil tidak berpengaruh; duplikat dibuang."
              error={errors.banned_words}
            >
              <Textarea
                id="banned_words"
                name="banned_words"
                rows={8}
                value={banned}
                onChange={(e) => setBanned(e.target.value)}
                {...describe("banned_words", errors.banned_words, true)}
              />
            </Field>
          </div>
        </details>
      </Section>

      {/* Recraft is not built yet (Stage 7 became the Kenari image path): keep its saved limit without showing it. */}
      <input type="hidden" name="recraft_monthly_budget_usd" value={settings.recraft_monthly_budget_usd} />

      {/* Pinned only while there is something to save, so it does not cover the page on a phone otherwise. */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-end gap-x-4 gap-y-2 rounded-md border p-3",
          dirty || summary ? "sticky bottom-[calc(max(var(--tabbar-h),env(safe-area-inset-bottom))+1rem)] z-10 border-foreground/30 bg-card shadow-md" : "bg-card/70",
        )}
      >
        <p className="mr-auto text-sm" role="status">
          {summary ? (
            <span className="text-destructive">{summary}</span>
          ) : dirty ? (
            "Ada perubahan yang belum disimpan."
          ) : savedAt ? (
            <span className="text-muted-foreground">Tersimpan pukul {timeFormat.format(new Date(savedAt))}. Berlaku untuk antrean berikutnya.</span>
          ) : (
            <span className="text-muted-foreground">Belum ada perubahan.</span>
          )}
        </p>
        {dirty && (
          <Button type="button" variant="ghost" onClick={discard} disabled={pending}>
            Batalkan perubahan
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending || !dirty}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {pending ? "Menyimpan..." : "Simpan pengaturan"}
        </Button>
      </div>
    </form>
  );
}
