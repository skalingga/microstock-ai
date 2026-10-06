// Kenari prices models per token in Rupiah and lists them on a public endpoint (GET {base}/models).
// Reading prices live means a price change never needs a deploy.

export type ModelPrice = { inIdr: number; outIdr: number }; // Rupiah per token
export type PriceLookup = (model: string) => Promise<ModelPrice | null>;

const TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const DEFAULT_BASE_URL = "https://kenari.id/v1";

let cache: { at: number; prices: Map<string, ModelPrice> } | null = null;

/** Kenari marks its free models with a ":free" suffix. They never cost anything. */
export function isFreeModel(model: string): boolean {
  return model.endsWith(":free");
}

type CatalogEntry = { id?: string; pricing?: { input?: number | null; output?: number | null } };

export function createPriceLookup(
  opts: { baseUrl?: string; fetchImpl?: typeof fetch; now?: () => number } = {},
): PriceLookup {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const baseUrl = (opts.baseUrl ?? process.env.KENARI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  // A private cache per lookup when dependencies are injected (tests); the shared one otherwise.
  const injected = Boolean(opts.fetchImpl || opts.now);
  let local: typeof cache = null;

  return async (model) => {
    if (isFreeModel(model)) return { inIdr: 0, outIdr: 0 };

    const current = injected ? local : cache;
    if (current && now() - current.at < TTL_MS) return current.prices.get(model) ?? null;

    try {
      const res = await fetchImpl(`${baseUrl}/models`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: CatalogEntry[] };

      const prices = new Map<string, ModelPrice>();
      for (const entry of body.data ?? []) {
        const input = entry.pricing?.input;
        const output = entry.pricing?.output;
        if (entry.id && typeof input === "number" && typeof output === "number") {
          // The catalog quotes micro-Rupiah per 1M tokens.
          prices.set(entry.id, { inIdr: input / 1e12, outIdr: output / 1e12 });
        }
      }
      const fresh = { at: now(), prices };
      if (injected) local = fresh;
      else cache = fresh;
      return prices.get(model) ?? null;
    } catch {
      // Stale prices are better than none; with no cache at all the cost stays unknown.
      return current?.prices.get(model) ?? null;
    }
  };
}

export function computeCostIdr(price: ModelPrice, usage: { prompt_tokens?: number; completion_tokens?: number }): number {
  const cost = (usage.prompt_tokens ?? 0) * price.inIdr + (usage.completion_tokens ?? 0) * price.outIdr;
  return Math.round(cost * 100) / 100;
}
