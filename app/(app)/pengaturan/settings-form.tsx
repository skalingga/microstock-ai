"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Ban, Bot, Loader2, Palette, Save, Wallet } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/lib/database.types";
import { selectClass } from "@/lib/ui";
import {
  AUTO_PROVIDERS,
  STYLES,
  formatBannedWords,
  formatPalettes,
  toPalettes,
  toProviderOrder,
} from "@/lib/settings/schema";
import { simpanPengaturan } from "./actions";

export function SettingsForm({ settings }: { settings: Tables<"user_settings"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [primary, backup] = toProviderOrder(settings.provider_order);

  // Submitted by hand (not via form action) so a validation error does not reset the fields.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await simpanPengaturan(formData);
      if (result.ok) {
        setError(null);
        toast.success("Pengaturan disimpan.");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            Model AI
            <InfoTip align="start">
              Provider utama dipakai dulu. Saat kena limit, terlalu lama, atau error, aplikasi pindah ke cadangan.
              Kolom model yang kosong memakai model bawaan (Gemini: gemini-3.5-flash-lite).
            </InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary_provider">Provider utama</Label>
            <select
              id="primary_provider"
              name="primary_provider"
              defaultValue={primary.provider}
              className={selectClass}
            >
              {AUTO_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Label htmlFor="primary_model">Model utama</Label>
            <Input
              id="primary_model"
              name="primary_model"
              defaultValue={primary.model}
              placeholder="Model bawaan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="backup_provider">Provider cadangan</Label>
            <select
              id="backup_provider"
              name="backup_provider"
              defaultValue={backup?.provider ?? ""}
              className={selectClass}
            >
              <option value="">Tidak dipakai</option>
              {AUTO_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Label htmlFor="backup_model">Model cadangan</Label>
            <Input
              id="backup_model"
              name="backup_model"
              defaultValue={backup?.model ?? ""}
              placeholder="Model bawaan"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="kenari_text_model">Model teks Kenari (konsep dan metadata)</Label>
              <InfoTip align="start">Bisa memakai model yang lebih murah, karena hanya teks. SVG tetap memakai model utama.</InfoTip>
            </div>
            <Input
              id="kenari_text_model"
              name="kenari_text_model"
              defaultValue={settings.kenari_text_model}
              placeholder="Sama dengan model utama"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="kenari_image_model">Model gambar (Siluet dan Line art)</Label>
              <InfoTip align="start">Berbayar per gambar dari saldo Kenari dan masuk batas biaya bulanan. Tanpa cadangan.</InfoTip>
            </div>
            <Input
              id="kenari_image_model"
              name="kenari_image_model"
              defaultValue={settings.kenari_image_model}
              placeholder="gpt-image-2"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="size-4 text-primary" />
            Kata terlarang
            <InfoTip align="start">
              Nama artis, tokoh, karakter fiksi, merek, atau IP lain. Dipakai untuk menyaring tema, prompt, dan metadata.
            </InfoTip>
          </CardTitle>
          <CardDescription>Satu kata atau frasa per baris.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="banned_words" className="sr-only">
            Kata terlarang
          </Label>
          <Textarea
            id="banned_words"
            name="banned_words"
            rows={8}
            defaultValue={formatBannedWords(settings.banned_words)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            Gaya dan palet bawaan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default_style">Gaya bawaan</Label>
            <select
              id="default_style"
              name="default_style"
              defaultValue={settings.default_style}
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
            <Label htmlFor="palettes">
              Palet warna <span className="font-normal text-muted-foreground">· format <code>Nama: #FF6B6B, #FFD93D</code></span>
            </Label>
            <Textarea
              id="palettes"
              name="palettes"
              rows={5}
              className="font-mono"
              defaultValue={formatPalettes(toPalettes(settings.palettes))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            Batas biaya Kenari per bulan
            <InfoTip align="start">
              Setelah tercapai, model berbayar berhenti sampai bulan berikutnya. Model gratis tidak dihitung. Isi 0 untuk
              melarang model berbayar.
            </InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="kenari_monthly_budget_idr" className="sr-only">
            Batas biaya Kenari per bulan (Rupiah)
          </Label>
          <div className="flex max-w-48 items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Rp</span>
            <Input
              id="kenari_monthly_budget_idr"
              name="kenari_monthly_budget_idr"
              type="number"
              min={0}
              max={1000000}
              step={1000}
              defaultValue={settings.kenari_monthly_budget_idr}
            />
          </div>
        </CardContent>
      </Card>

      {/* Recraft is not built yet (Stage 7 became the Kenari image path): keep its saved limit without showing it. */}
      <input type="hidden" name="recraft_monthly_budget_usd" value={settings.recraft_monthly_budget_usd} />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" size="lg" disabled={pending} className="shadow-lg shadow-primary/30">
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {pending ? "Menyimpan..." : "Simpan pengaturan"}
        </Button>
      </div>
    </form>
  );
}
