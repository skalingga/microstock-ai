import { ProviderError } from "./errors";
import { computeCostIdr, createPriceLookup, type PriceLookup } from "./kenari-pricing";
import { OpenAiCompatProvider, clampRetryAfter, type TokenUsage } from "./openai-compat";
import type { RateLimit } from "./types";

const DEFAULT_BASE_URL = "https://kenari.id/v1";
// Stays below the 60s Vercel function limit (CLAUDE.md rule 3). deepseek-v4-flash needs about 35s per SVG.
export const KENARI_TIMEOUT_MS = 55_000;

export type KenariConfig = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Looks up Rupiah-per-token prices; replaced in tests. */
  priceLookup?: PriceLookup;
};

/** Kenari speaks the OpenAI chat-completions protocol (base URL https://kenari.id/v1). */
export class KenariProvider extends OpenAiCompatProvider {
  readonly id = "kenari" as const;
  protected readonly label = "Kenari";
  protected readonly keyEnv = "KENARI_API_KEY";
  private readonly priceLookup: PriceLookup;

  constructor(model: string, config: KenariConfig = {}) {
    const baseUrl = config.baseUrl ?? process.env.KENARI_BASE_URL ?? DEFAULT_BASE_URL;
    super({
      model,
      apiKey: config.apiKey ?? process.env.KENARI_API_KEY,
      baseUrl,
      timeoutMs: config.timeoutMs ?? KENARI_TIMEOUT_MS,
      fetchImpl: config.fetchImpl,
    });
    this.priceLookup = config.priceLookup ?? createPriceLookup({ baseUrl: this.baseUrl });
  }

  protected async costOf(usage?: TokenUsage) {
    if (!usage) return undefined;
    const price = await this.priceLookup(this.model);
    return price ? computeCostIdr(price, usage) : undefined;
  }

  protected readRateLimit(headers: Headers) {
    return readRateLimit(headers);
  }

  protected toError(res: Response, detail: string | undefined, rateLimit?: RateLimit): ProviderError {
    if (res.status === 401 || res.status === 403) {
      return new ProviderError("auth", "API key Kenari ditolak. Periksa KENARI_API_KEY.");
    }
    if (res.status === 429) {
      const header = Number(res.headers.get("retry-after"));
      const fromReset = rateLimit?.resetAt ? (rateLimit.resetAt - Date.now()) / 1000 : undefined;
      return new ProviderError("rate_limit", "Batas pemakaian Kenari tercapai.", {
        retryAfterSec: clampRetryAfter(header > 0 ? header : fromReset),
      });
    }
    if (res.status === 404 || (res.status === 400 && /model/i.test(detail ?? ""))) {
      return new ProviderError("model_unavailable", "Model Kenari tidak ditemukan atau sudah dihapus.");
    }
    return new ProviderError("upstream", `Kenari mengembalikan error ${res.status}.`);
  }
}

export function readRateLimit(headers: Headers): RateLimit | undefined {
  const num = (name: string) => {
    const raw = headers.get(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const limit = num("x-ratelimit-limit");
  const remaining = num("x-ratelimit-remaining");
  const reset = num("x-ratelimit-reset");
  if (limit === undefined && remaining === undefined && reset === undefined) return undefined;

  // Kenari sends the reset as epoch seconds; accept milliseconds too.
  const resetAt = reset === undefined ? undefined : reset < 1e12 ? reset * 1000 : reset;
  return { limit, remaining, resetAt };
}
