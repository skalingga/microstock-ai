"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/lib/database.types";
import {
  AUTO_PROVIDERS,
  STYLES,
  formatBannedWords,
  formatPalettes,
  toPalettes,
  toProviderOrder,
} from "@/lib/settings/schema";
import { simpanPengaturan } from "./actions";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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
          <CardTitle>Urutan provider AI</CardTitle>
          <CardDescription>
            Aplikasi memakai provider utama dulu, lalu pindah ke cadangan bila kena limit atau model hilang.
            Kosongkan nama model untuk memakai model bawaan dari environment. Recraft tidak masuk daftar ini
            karena hanya jalan lewat tombol eksplisit.
          </CardDescription>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kata terlarang</CardTitle>
          <CardDescription>
            Nama artis, orang terkenal, karakter fiksi, merek, atau IP lain. Satu kata atau frasa per baris.
            Dipakai untuk menyaring prompt dan metadata.
          </CardDescription>
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
          <CardTitle>Gaya dan palet bawaan</CardTitle>
          <CardDescription>
            Palet ditulis satu per baris dengan format <code>Nama: #FF6B6B, #FFD93D</code>.
          </CardDescription>
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
            <Label htmlFor="palettes">Palet warna</Label>
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
          <CardTitle>Batas biaya Recraft</CardTitle>
          <CardDescription>
            Batas pengeluaran per bulan dalam dolar AS. Nilai tertinggi yang diizinkan adalah $10.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="recraft_monthly_budget_usd" className="sr-only">
            Batas biaya Recraft per bulan (USD)
          </Label>
          <Input
            id="recraft_monthly_budget_usd"
            name="recraft_monthly_budget_usd"
            type="number"
            min={0}
            max={10}
            step={0.5}
            defaultValue={settings.recraft_monthly_budget_usd}
            className="max-w-32"
          />
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan pengaturan"}
      </Button>
    </form>
  );
}
