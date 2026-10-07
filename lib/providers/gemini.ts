import { ProviderError } from "./errors";
import { OpenAiCompatProvider, clampRetryAfter } from "./openai-compat";

// Google's OpenAI-compatible endpoint for the Gemini API (AI Studio key).
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// Used when neither the setting nor GEMINI_DEFAULT_MODEL names a model. Free tier (AI Studio, Oktober 2026):
// 3.5 Flash-Lite allows 15 RPM / 500 RPD and draws an SVG in about 5s; 3.5 Flash only 5 RPM / 20 RPD.
export const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_TIMEOUT_MS = 55_000;

export type GeminiConfig = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Gemini text models through the OpenAI-compatible endpoint. Free tier only: calls cost nothing,
 * and the limits are not published (they show in AI Studio), so every call is logged per day.
 */
export class GeminiProvider extends OpenAiCompatProvider {
  readonly id = "gemini" as const;
  protected readonly label = "Gemini";
  protected readonly keyEnv = "GEMINI_API_KEY";

  constructor(model: string, config: GeminiConfig = {}) {
    super({
      model,
      apiKey: config.apiKey ?? process.env.GEMINI_API_KEY,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: config.timeoutMs ?? GEMINI_TIMEOUT_MS,
      fetchImpl: config.fetchImpl,
    });
  }

  // Without a limit, Gemini 3.x thinks long enough to miss the 60s window. "low" keeps an SVG well under it.
  protected extraBody() {
    return { reasoning_effort: "low" };
  }

  // Gemini sends no rate-limit headers; a 429 carries the wait in its body instead.
  protected readRateLimit() {
    return undefined;
  }

  protected toError(res: Response, detail: string | undefined): ProviderError {
    const text = detail ?? "";
    if (res.status === 401 || res.status === 403 || /API key not valid|API_KEY_INVALID|valid API key/i.test(text)) {
      return new ProviderError("auth", "API key Gemini ditolak. Periksa GEMINI_API_KEY.");
    }
    if (res.status === 429) {
      const header = Number(res.headers.get("retry-after"));
      const fromBody = Number(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(text)?.[1]);
      return new ProviderError("rate_limit", "Batas free tier Gemini tercapai.", {
        retryAfterSec: clampRetryAfter(header > 0 ? header : fromBody),
      });
    }
    if (res.status === 404 || (res.status === 400 && /models\/\S+ is not found|not found for API version|unknown model/i.test(text))) {
      return new ProviderError("model_unavailable", "Model Gemini tidak ditemukan atau sudah dihapus.");
    }
    return new ProviderError("upstream", `Gemini mengembalikan error ${res.status}.`);
  }
}

// Model ids that are not text chat models (speech, images, embeddings, live audio, robotics...).
const NOT_TEXT = /tts|image|embedding|live|audio|transcribe|robotics|computer-use|customtools|nano-banana|omni|veo|imagen/i;
// Text models that always fail on the free tier, checked in AI Studio (Oktober 2026): Pro has a quota of 0,
// 3.8 Flash and the "-latest" aliases take longer than the 60s Vercel window. Gemma is filtered by the
// "gemini-" prefix (over 90s per SVG).
const UNUSABLE = /-pro\b|^gemini-3\.8-flash$|-latest$/i;
const TTL_MS = 6 * 60 * 60 * 1000;
let catalogCache: { at: number; models: string[] } | null = null;

/** Gemini text models this key can use, for the model picker. Empty when the key is missing or the call fails. */
export async function fetchGeminiModels(
  opts: { apiKey?: string; baseUrl?: string; fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<string[]> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const injected = Boolean(opts.fetchImpl || opts.now);
  if (!injected && catalogCache && now() - catalogCache.at < TTL_MS) return catalogCache.models;

  try {
    const res = await fetchImpl(`${(opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data?: { id?: string }[] };
    const models = (body.data ?? [])
      .map((m) => (m.id ?? "").replace(/^models\//, ""))
      .filter((id) => id.startsWith("gemini-") && !NOT_TEXT.test(id) && !UNUSABLE.test(id))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (!injected) catalogCache = { at: now(), models };
    return models;
  } catch {
    return catalogCache?.models ?? [];
  }
}
