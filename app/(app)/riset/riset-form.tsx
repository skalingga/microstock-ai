"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson, type ThemesResponse, type TrendsResponse } from "@/lib/generate/client";
import { REGIONS } from "@/lib/research/calendar";
import { MAX_THEMES } from "@/lib/research/schemas";
import { scoreTheme } from "@/lib/research/score";
import { createClient } from "@/lib/supabase/client";
import { selectClass } from "@/lib/ui";

export type ThemeRow = {
  id?: string;
  title: string;
  event: string;
  eventWeight: 1 | 2 | 3;
  uploadBy: string | null;
  keywords: string[];
  demandGuess: number;
  competitionGuess: number;
  /** From Google Trends; null when it was blocked or had no data. */
  trendScore: number | null;
  /** Adobe Stock result count typed in by the user; null until entered. */
  adobeCount: number | null;
};

const TRENDS_BATCH = 4;
const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

function scoresOf(row: ThemeRow) {
  return scoreTheme({
    eventWeight: row.eventWeight,
    trendScore: row.trendScore,
    aiDemand: row.demandGuess,
    adobeResultCount: row.adobeCount,
    aiCompetition: row.competitionGuess,
  });
}

export function RisetForm({
  initialRows,
  initialRun,
}: {
  initialRows: ThemeRow[];
  initialRun: { region: string } | null;
}) {
  const [region, setRegion] = useState(initialRun?.region ?? "global");
  const [periodStart, setPeriodStart] = useState(day(0));
  const [periodEnd, setPeriodEnd] = useState(day(180));
  const [category, setCategory] = useState("");
  const [count, setCount] = useState(10);
  const [rows, setRows] = useState<ThemeRow[]>(initialRows);
  const [status, setStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [trendsMissing, setTrendsMissing] = useState(false);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => scoresOf(b).opportunity - scoresOf(a).opportunity),
    [rows],
  );

  async function persist(list: ThemeRow[]): Promise<ThemeRow[]> {
    const supabase = createClient();
    const { data: run, error } = await supabase
      .from("research_runs")
      .insert({ region, period_start: periodStart, period_end: periodEnd })
      .select("id")
      .single();
    if (error || !run) throw new Error("Hasil riset tidak bisa disimpan.");

    const payload = list.map((row) => {
      const s = scoresOf(row);
      return {
        run_id: run.id,
        title: row.title,
        country: region,
        event: row.event || null,
        upload_by: row.uploadBy,
        demand_score: s.demand,
        competition_score: s.competition,
        opportunity_score: s.opportunity,
        trend_score: row.trendScore,
        adobe_result_count: row.adobeCount,
        seed_keywords: row.keywords,
      };
    });
    const { data: saved, error: themesError } = await supabase.from("themes").insert(payload).select("id");
    if (themesError || !saved) throw new Error("Tema tidak bisa disimpan.");
    // Insert returns rows in the order sent, so ids line up with the list.
    return list.map((row, i) => ({ ...row, id: saved[i]?.id }));
  }

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    setRunning(true);
    setTrendsMissing(false);
    setStatus("Menyusun ide tema...");

    try {
      const result = await postJson<ThemesResponse>("/api/research/themes", {
        region,
        periodStart,
        periodEnd,
        category: category.trim() || undefined,
        count,
      });

      let list: ThemeRow[] = result.themes.map((t) => ({
        title: t.title,
        event: t.event,
        eventWeight: t.eventWeight,
        uploadBy: t.uploadBy,
        keywords: t.keywords,
        demandGuess: t.demandGuess,
        competitionGuess: t.competitionGuess,
        trendScore: null,
        adobeCount: null,
      }));
      setRows(list);

      // Trends runs in small batches, one request each (CLAUDE.md rule 2). A failure only means
      // those themes keep the AI estimate.
      let missing = false;
      for (let i = 0; i < list.length; i += TRENDS_BATCH) {
        setStatus(`Mengambil tren pencarian (${Math.min(i + TRENDS_BATCH, list.length)}/${list.length})...`);
        const batch = list.slice(i, i + TRENDS_BATCH);
        try {
          const res = await postJson<TrendsResponse>("/api/research/trends", {
            region,
            terms: batch.map((t) => t.keywords[0] ?? t.title),
          });
          if (res.unavailable) missing = true;
          list = list.map((row) => {
            const term = row.keywords[0] ?? row.title;
            return term in res.scores ? { ...row, trendScore: res.scores[term] } : row;
          });
          setRows(list);
        } catch {
          missing = true;
        }
      }
      if (list.every((r) => r.trendScore === null)) missing = true;
      setTrendsMissing(missing);

      setStatus("Menyimpan hasil...");
      setRows(await persist(list));
      toast.success(`${list.length} tema siap dibandingkan.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Riset gagal.");
    } finally {
      setStatus(null);
      setRunning(false);
    }
  }

  async function saveAdobeCount(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    const adobeCount = digits === "" ? null : Number(digits);
    const row = sorted[index];
    const next = { ...row, adobeCount };
    setRows((prev) => prev.map((r) => (r === row ? next : r)));
    if (!row.id) return;
    const s = scoresOf(next);
    const { error } = await createClient()
      .from("themes")
      .update({
        adobe_result_count: adobeCount,
        competition_score: s.competition,
        opportunity_score: s.opportunity,
      })
      .eq("id", row.id);
    if (error) toast.error("Jumlah hasil tidak bisa disimpan.");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Riset baru</CardTitle>
          <CardDescription>
            Periode maksimal 12 bulan. Tanggal event bergerak (Ramadan, Diwali, Imlek, Paskah) adalah perkiraan,
            cek lagi sebelum menentukan batas upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={start} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="region">Pasar</Label>
                <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} disabled={running} className={selectClass}>
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori (opsional)</Label>
                <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} disabled={running} placeholder="food, travel, icons" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Awal periode</Label>
                <Input id="start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required disabled={running} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Akhir periode</Label>
                <Input id="end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required disabled={running} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">Jumlah tema</Label>
                <Input id="count" type="number" min={1} max={MAX_THEMES} value={count} onChange={(e) => setCount(Number(e.target.value))} required disabled={running} />
              </div>
            </div>
            <Button type="submit" disabled={running}>
              {running ? "Sedang berjalan..." : "Mulai riset"}
            </Button>
            {status && <p className="text-sm text-muted-foreground">{status}</p>}
          </form>
        </CardContent>
      </Card>

      {sorted.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tema berdasarkan peluang</CardTitle>
            <CardDescription>
              Peluang = permintaan tinggi dan persaingan rendah. Isi “Hasil Adobe” (jumlah hasil pencarian di Adobe
              Stock) agar skor persaingan memakai data nyata; tanpa itu dianggap sedang.
              {trendsMissing && " Google Trends tidak tersedia, jadi permintaan memakai perkiraan AI dan bobot event."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sorted.map((row, index) => {
              const s = scoresOf(row);
              const query = row.keywords[0] ?? row.title;
              const generateHref = `/generate?${new URLSearchParams({ tema: row.title })}`;
              return (
                <div key={row.id ?? `${row.title}-${index}`} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.event || "Tema sepanjang tahun"}
                        {row.uploadBy ? ` · upload sebelum ${row.uploadBy}` : ""}
                      </p>
                    </div>
                    <Link href={generateHref} className={buttonVariants({ size: "sm" })}>
                      Generate dari tema ini
                    </Link>
                  </div>
                  <p className="text-sm">
                    Peluang <strong>{s.opportunity}</strong> · permintaan {s.demand}
                    {row.trendScore === null ? " (perkiraan)" : " (Trends)"} · persaingan{" "}
                    {s.competition === null ? "belum diketahui" : `${s.competition}${s.competitionKnown ? "" : " (perkiraan)"}`}
                  </p>
                  {row.keywords.length > 0 && (
                    <p className="text-xs text-muted-foreground">{row.keywords.join(", ")}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Label htmlFor={`adobe-${index}`} className="text-xs">
                      Hasil Adobe
                    </Label>
                    <Input
                      id={`adobe-${index}`}
                      inputMode="numeric"
                      className="h-8 w-32"
                      defaultValue={row.adobeCount?.toLocaleString("id-ID") ?? ""}
                      onBlur={(e) => saveAdobeCount(index, e.target.value)}
                      placeholder="mis. 125000"
                    />
                    <a
                      href={`https://stock.adobe.com/search?k=${encodeURIComponent(query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline"
                    >
                      Cari “{query}” di Adobe Stock
                    </a>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
