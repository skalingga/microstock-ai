import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { startOfMonthWib, startOfNextMonthWib } from "@/lib/budget";
import { parseCells, summarize } from "@/lib/generate/benchmark";
import { fetchGeminiModels, GEMINI_FALLBACK_MODEL } from "@/lib/providers/gemini";
import { KENARI_IMAGE_FALLBACK_MODEL, KENARI_IMAGE_PRICES_IDR } from "@/lib/providers/kenari-image-pricing";
import { fetchModelCatalog } from "@/lib/providers/kenari-pricing";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm, type ModelOption } from "./settings-form";

export const metadata: Metadata = { title: "Pengaturan" };

/** Speech, image, embedding and similar models cannot write SVG code. */
const NON_TEXT_MODEL = /(tts|speech|audio|whisper|transcri|embed|rerank|moderation|image|dall-e|imagen|veo|video)/i;

const monthFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" });

export default async function HalamanPengaturan() {
  const supabase = await createClient();
  const [{ data: settings, error }, { data: spent }, { data: benchmarks }, catalog, geminiModels] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.rpc("provider_cost_since", { p_provider: "kenari", p_since: startOfMonthWib() }),
    supabase.from("model_benchmarks").select("results").order("created_at", { ascending: false }).limit(5),
    fetchModelCatalog().catch(() => []),
    fetchGeminiModels().catch(() => []),
  ]);

  // The latest benchmark run with results: its scores label the models it tested.
  const cells = (benchmarks ?? []).map((b) => parseCells(b.results)).find((c) => c.length > 0) ?? [];
  const tested = new Map(
    summarize(cells).map((r) => [
      `${r.provider}|${r.model}`,
      `uji: ${r.lolos}/${r.total} lolos${r.medianMs !== null ? `, ${Math.round(r.medianMs / 1000)} dtk` : ""}`,
    ]),
  );
  const option = (provider: "kenari" | "gemini", id: string, price: string): ModelOption => ({
    id,
    note: [tested.get(`${provider}|${id}`), price].filter(Boolean).join(" · "),
    tested: tested.has(`${provider}|${id}`),
  });
  // Tested models first, so the benchmark winners are at the top of each list.
  const byTested = (a: ModelOption, b: ModelOption) => Number(b.tested) - Number(a.tested);
  const kenariOptions = catalog
    .filter((m) => !NON_TEXT_MODEL.test(m.id))
    .map((m) => option("kenari", m.id, m.free ? "gratis" : "berbayar"))
    .sort(byTested);
  const geminiOptions = geminiModels.map((id) => option("gemini", id, "gratis")).sort(byTested);

  // The budget month runs on WIB (UTC+7), whatever the server's own time zone.
  const nextMonth = new Date(startOfNextMonthWib());

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan" description="Biaya, model AI, dan bawaan untuk Generate. Berlaku untuk antrean berikutnya." />

      {error || !settings ? (
        <p role="alert" className="text-sm text-destructive">
          Pengaturan tidak bisa dimuat. Muat ulang halaman atau masuk kembali.
        </p>
      ) : (
        <SettingsForm
          settings={settings}
          spentIdr={Number(spent ?? 0)}
          resetLabel={monthFormat.format(nextMonth)}
          defaults={{
            kenari: process.env.KENARI_DEFAULT_MODEL || "",
            gemini: process.env.GEMINI_DEFAULT_MODEL || GEMINI_FALLBACK_MODEL,
            image: process.env.KENARI_IMAGE_MODEL || KENARI_IMAGE_FALLBACK_MODEL,
          }}
          imagePrices={KENARI_IMAGE_PRICES_IDR}
          options={{ kenari: kenariOptions, gemini: geminiOptions }}
        />
      )}
    </div>
  );
}
