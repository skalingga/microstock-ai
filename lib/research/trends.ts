import googleTrends from "google-trends-api";
import { demandFromRatio } from "./score";

// Google Trends has no official free API. This uses an unofficial client, so every call can fail
// (blocked, changed, slow). Callers must treat a failure as "no data" and fall back to other signals.

/** A steady, always-searched term used to compare themes across separate requests. */
export const TRENDS_ANCHOR = "wallpaper";
const MAX_TERMS_PER_REQUEST = 4;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 20_000;

export type TrendsFetcher = (terms: string[], geo: string) => Promise<number[][] | null>;

type CacheEntry = { at: number; value: Record<string, number> };
const cache = new Map<string, CacheEntry>();

/** Weekly interest over the past 12 months for each term, in the order given. */
export const fetchInterest: TrendsFetcher = async (terms, geo) => {
  const startTime = new Date(Date.now() - 365 * 86_400_000);
  const raw = await Promise.race([
    googleTrends.interestOverTime({ keyword: terms, geo: geo || undefined, startTime }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
  ]);
  const data = JSON.parse(raw) as { default?: { timelineData?: { value?: number[] }[] } };
  const rows = data.default?.timelineData ?? [];
  if (rows.length === 0) return null;
  return terms.map((_, i) => rows.map((row) => row.value?.[i] ?? 0));
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Demand score 0-100 per term, measured against the anchor term so batches stay comparable.
 * Terms that could not be measured are missing from the result.
 */
export async function demandScores(
  terms: string[],
  geo: string,
  fetcher: TrendsFetcher = fetchInterest,
  now: number = Date.now(),
): Promise<Record<string, number>> {
  const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TERMS_PER_REQUEST);
  const result: Record<string, number> = {};

  const missing: string[] = [];
  for (const term of unique) {
    const hit = cache.get(`${geo}|${term.toLowerCase()}`);
    if (hit && now - hit.at < CACHE_TTL_MS) Object.assign(result, hit.value);
    else missing.push(term);
  }
  if (missing.length === 0) return result;

  const series = await fetcher([TRENDS_ANCHOR, ...missing], geo);
  if (!series) return result;

  const anchorMean = mean(series[0] ?? []);
  missing.forEach((term, i) => {
    const score = demandFromRatio(mean(series[i + 1] ?? []), anchorMean);
    result[term] = score;
    cache.set(`${geo}|${term.toLowerCase()}`, { at: now, value: { [term]: score } });
  });
  return result;
}

export function clearTrendsCache() {
  cache.clear();
}
