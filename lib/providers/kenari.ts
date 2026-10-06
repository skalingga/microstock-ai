import { z } from "zod";
import { extractJson, extractSvg } from "@/lib/svg/extract";
import { ProviderError } from "./errors";
import { computeCostIdr, createPriceLookup, type PriceLookup } from "./kenari-pricing";
import { conceptsPrompt, svgPrompt } from "./prompts";
import type {
  AssetMetadata,
  Concept,
  ConceptInput,
  RateLimit,
  SvgInput,
  SvgProvider,
} from "./types";

const DEFAULT_BASE_URL = "https://kenari.id/v1";
// Stays below the 60s Vercel function limit (CLAUDE.md rule 3). deepseek-v4-flash needs about 35s per SVG.
const DEFAULT_TIMEOUT_MS = 55_000;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export type KenariConfig = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Looks up Rupiah-per-token prices; replaced in tests. */
  priceLookup?: PriceLookup;
};

const conceptsSchema = z.object({
  concepts: z.array(
    z.object({
      subject: z.string().trim().min(1).max(200),
      composition: z.string().trim().min(1).max(300),
      palette: z.array(z.string()).optional().default([]),
    }),
  ),
});

/** Kenari speaks the OpenAI chat-completions protocol (base URL https://kenari.id/v1). */
export class KenariProvider implements SvgProvider {
  readonly id = "kenari" as const;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly priceLookup: PriceLookup;

  constructor(model: string, config: KenariConfig = {}) {
    this.model = model;
    this.apiKey = config.apiKey ?? process.env.KENARI_API_KEY;
    this.baseUrl = (config.baseUrl ?? process.env.KENARI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.priceLookup = config.priceLookup ?? createPriceLookup({ baseUrl: this.baseUrl });
  }

  async generateConcepts(input: ConceptInput) {
    const { system, user } = conceptsPrompt(input);
    const { content, rateLimit, costIdr } = await this.chat(system, user, { maxTokens: 6000, temperature: 0.9 });

    const parsed = conceptsSchema.safeParse(extractJson(content));
    if (!parsed.success) {
      throw new ProviderError("bad_output", "Balasan model bukan daftar konsep yang valid.");
    }

    const concepts: Concept[] = parsed.data.concepts.slice(0, input.count).map((c) => ({
      subject: c.subject,
      composition: c.composition,
      palette: c.palette.filter((color) => HEX.test(color)).slice(0, 5),
    }));
    if (concepts.length === 0) {
      throw new ProviderError("bad_output", "Model tidak menghasilkan konsep.");
    }
    return { concepts, model: this.model, costIdr, rateLimit };
  }

  async generateSvg(input: SvgInput) {
    const { system, user } = svgPrompt(input);
    const { content, rateLimit, costIdr } = await this.chat(system, user, { maxTokens: 12_000, temperature: 0.7 });

    const svg = extractSvg(content);
    if (!svg) {
      throw new ProviderError("bad_output", "Balasan model tidak berisi SVG yang utuh.");
    }
    return { svg, model: this.model, costIdr, rateLimit };
  }

  async generateMetadata(): Promise<AssetMetadata> {
    throw new ProviderError("not_implemented", "Metadata AI baru tersedia di Tahap 3.");
  }

  private async chat(system: string, user: string, opts: { maxTokens: number; temperature: number }) {
    if (!this.apiKey) {
      throw new ProviderError("auth", "KENARI_API_KEY belum diisi di server.");
    }

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const name = typeof err === "object" && err !== null ? (err as { name?: string }).name : undefined;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new ProviderError("timeout", "Kenari terlalu lama menjawab.");
      }
      throw new ProviderError("upstream", "Tidak bisa terhubung ke Kenari.");
    }

    const rateLimit = readRateLimit(res.headers);

    if (!res.ok) throw await toProviderError(res, rateLimit);

    const body = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    } | null;
    const content = body?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      const truncated = body?.choices?.[0]?.finish_reason === "length";
      throw new ProviderError(
        "bad_output",
        truncated ? "Jawaban model terpotong sebelum selesai." : "Model mengirim balasan kosong.",
      );
    }
    return { content, rateLimit, costIdr: await this.costOf(body?.usage) };
  }

  /** Rupiah cost of one call, or undefined when the price or token usage is unknown. */
  private async costOf(usage?: { prompt_tokens?: number; completion_tokens?: number }) {
    if (!usage) return undefined;
    const price = await this.priceLookup(this.model);
    return price ? computeCostIdr(price, usage) : undefined;
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

async function toProviderError(res: Response, rateLimit?: RateLimit): Promise<ProviderError> {
  const detail = await res
    .json()
    .then((j: { error?: { message?: string } | string }) => (typeof j.error === "string" ? j.error : j.error?.message))
    .catch(() => undefined);

  if (res.status === 401 || res.status === 403) {
    return new ProviderError("auth", "API key Kenari ditolak. Periksa KENARI_API_KEY.");
  }
  if (res.status === 429) {
    const header = Number(res.headers.get("retry-after"));
    const fromReset = rateLimit?.resetAt ? Math.ceil((rateLimit.resetAt - Date.now()) / 1000) : undefined;
    const retryAfterSec = Math.min(Math.max(Number.isFinite(header) && header > 0 ? header : (fromReset ?? 30), 1), 120);
    return new ProviderError("rate_limit", "Batas pemakaian Kenari tercapai.", { retryAfterSec });
  }
  if (res.status === 404 || (res.status === 400 && /model/i.test(detail ?? ""))) {
    return new ProviderError("model_unavailable", "Model Kenari tidak ditemukan atau sudah dihapus.");
  }
  return new ProviderError("upstream", `Kenari mengembalikan error ${res.status}.`);
}
