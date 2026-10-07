"use client";

import { ExternalLink, Search, Sparkles, TrendingUp } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { cn } from "@/lib/utils";
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
import { daysUntil, deadlineStatus, scoreTheme } from "@/lib/research/score";
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

const daysLeftOf = (row: ThemeRow) => (row.uploadBy ? daysUntil(row.uploadBy) : null);

function scoresOf(row: ThemeRow) {
  return scoreTheme({
    daysLeft: daysLeftOf(row),
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
        const terms = batch.map((t) => t.keywords[0] ?? t.title);
        // Google Trends fails now and then; one retry after a pause recovers most of those.
        let res: TrendsResponse | null = null;
        for (let attempt = 0; attempt < 2 && !res; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
          try {
            const r = await postJson<TrendsResponse>("/api/research/trends", { region, terms });
            if (!r.unavailable && Object.keys(r.scores).length > 0) res = r;
          } catch {
            // try again, then fall back to the AI estimate
          }
        }
        if (!res) {
          missing = true;
        } else {
          const scores = res.scores;
          list = list.map((row) => {
            const term = row.keywords[0] ?? row.title;
            return term in scores ? { ...row, trendScore: scores[term] } : row;
          });
          setRows(list);
        }
        await new Promise((r) => setTimeout(r, 800)); // gentle pacing between batches
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
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4 text-primary" />
            Riset baru
            <InfoTip align="start">
              Periode maksimal 12 bulan. Tanggal event bergerak (Ramadan, Diwali, Imlek, Paskah) hanya perkiraan: cek lagi
              sebelum menentukan batas upload.
            </InfoTip>
          </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Tema berdasarkan peluang
              <InfoTip align="start">
                Peluang tinggi = permintaan tinggi dan persaingan rendah. Isi “Hasil Adobe” (jumlah hasil pencarian di Adobe
                Stock) agar skor persaingan memakai data nyata; kalau kosong dianggap sedang.
              </InfoTip>
            </CardTitle>
            {trendsMissing && (
              <CardDescription>Google Trends tidak tersedia: permintaan memakai perkiraan AI.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {sorted.map((row, index) => {
              const s = scoresOf(row);
              const query = row.keywords[0] ?? row.title;
              const generateHref = `/generate?${new URLSearchParams({ tema: row.title })}`;
              return (
                <div
                  key={row.id ?? `${row.title}-${index}`}
                  className="space-y-3 rounded-2xl border bg-card p-4 transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div
                      className={cn(
                        "flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl ring-1 ring-inset",
                        s.opportunity >= 60
                          ? "bg-success-soft text-success-foreground ring-success/25"
                          : s.opportunity >= 40
                            ? "bg-warning-soft text-warning-foreground ring-warning/30"
                            : "bg-muted text-muted-foreground ring-border",
                      )}
                      title="Skor peluang"
                    >
                      <span className="text-lg leading-none font-bold tabular-nums">{s.opportunity}</span>
                      <span className="text-[10px] font-medium uppercase">peluang</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{row.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.event || "Tema sepanjang tahun"}
                        {row.uploadBy ? ` · upload sebelum ${row.uploadBy}` : ""}
                      </p>
                      {deadlineStatus(daysLeftOf(row)) === "terlewat" && (
                        <p className="text-xs text-destructive">
                          Batas upload sudah lewat; peluang diturunkan. Masih bisa dikejar bila Anda siap upload cepat.
                        </p>
                      )}
                      {deadlineStatus(daysLeftOf(row)) === "mendesak" && (
                        <p className="text-xs font-medium text-warning-foreground">Batas upload kurang dari 14 hari lagi.</p>
                      )}
                    </div>
                    <Link href={generateHref} className={buttonVariants({ size: "sm" })}>
                      <Sparkles />
                      Generate dari tema ini
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Permintaan <span className="font-medium text-foreground">{s.demand}</span>
                    {row.trendScore === null ? " (perkiraan)" : " (Trends)"} · persaingan{" "}
                    {s.competition === null ? "belum diketahui" : `${s.competition}${s.competitionKnown ? "" : " (perkiraan)"}`}
                  </p>
                  {row.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {row.keywords.map((k, i) => (
                        <span key={`${k}-${i}`} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {k}
                        </span>
                      ))}
                    </div>
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
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="size-3" />
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
