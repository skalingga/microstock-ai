import { z } from "zod";
import { extractJson, extractSvg } from "@/lib/svg/extract";
import { ProviderError } from "./errors";
import { conceptsPrompt, metadataPrompt, svgPrompt, themesPrompt } from "./prompts";
import type {
  Concept,
  ConceptInput,
  MetadataInput,
  ProviderId,
  RateLimit,
  SvgInput,
  SvgProvider,
  ThemeIdea,
  ThemesInput,
} from "./types";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export type TokenUsage = { prompt_tokens?: number; completion_tokens?: number };

export type OpenAiCompatConfig = {
  model: string;
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

const metadataSchema = z.object({
  title: z.string().trim().min(1),
  keywords: z.union([z.array(z.string()), z.string()]),
  category: z.string().trim().default(""),
  needs_release: z.boolean().optional().default(false),
});

const conceptsSchema = z.object({
  concepts: z.array(
    z.object({
      subject: z.string().trim().min(1).max(200),
      composition: z.string().trim().min(1).max(300),
      palette: z.array(z.string()).optional().default([]),
    }),
  ),
});

const score = z.coerce.number().min(0).max(100).catch(50);

const themesSchema = z.object({
  themes: z.array(
    z.object({
      title: z.string().trim().min(2).max(120),
      event: z.string().trim().max(80).optional().default(""),
      keywords: z.union([z.array(z.string()), z.string()]).optional().default([]),
      demand_guess: score,
      competition_guess: score,
    }),
  ),
});

/**
 * Shared body of every provider that speaks the OpenAI chat-completions protocol (Kenari, Gemini).
 * Subclasses only supply what differs: name, key, error mapping, cost, and extra request fields.
 */
export abstract class OpenAiCompatProvider implements SvgProvider {
  abstract readonly id: ProviderId;
  /** Provider name shown in error messages. */
  protected abstract readonly label: string;
  /** Environment variable that holds the key, named in the "missing key" message. */
  protected abstract readonly keyEnv: string;

  protected readonly model: string;
  private readonly apiKey?: string;
  protected readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiCompatConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /** Extra request fields, e.g. Gemini's reasoning_effort. */
  protected extraBody(): Record<string, unknown> {
    return {};
  }

  /** Rupiah cost of one call from its token usage, or undefined when unknown. Free by default. */
  protected async costOf(usage?: TokenUsage): Promise<number | undefined> {
    void usage;
    return undefined;
  }

  protected abstract readRateLimit(headers: Headers): RateLimit | undefined;
  protected abstract toError(res: Response, detail: string | undefined, rateLimit?: RateLimit): ProviderError;

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

  async generateMetadata(input: MetadataInput) {
    const { system, user } = metadataPrompt(input);
    const { content, rateLimit, costIdr } = await this.chat(system, user, { maxTokens: 4000, temperature: 0.4 });

    const parsed = metadataSchema.safeParse(extractJson(content));
    if (!parsed.success) {
      throw new ProviderError("bad_output", "Balasan model bukan metadata yang valid.");
    }
    const { title, keywords, category, needs_release } = parsed.data;
    return {
      metadata: {
        title,
        keywords: Array.isArray(keywords) ? keywords : keywords.split(","),
        category,
        needsRelease: needs_release,
      },
      model: this.model,
      costIdr,
      rateLimit,
    };
  }

  async generateThemes(input: ThemesInput) {
    const { system, user } = themesPrompt(input);
    // Generous on purpose: reasoning models spend part of the limit thinking before they answer.
    const { content, rateLimit, costIdr } = await this.chat(system, user, { maxTokens: 14_000, temperature: 0.8 });

    const parsed = themesSchema.safeParse(extractJson(content));
    if (!parsed.success) {
      throw new ProviderError("bad_output", "Balasan model bukan daftar tema yang valid.");
    }

    const themes: ThemeIdea[] = parsed.data.themes.slice(0, input.count).map((t) => ({
      title: t.title,
      event: t.event,
      keywords: (Array.isArray(t.keywords) ? t.keywords : t.keywords.split(","))
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10),
      demandGuess: Math.round(t.demand_guess),
      competitionGuess: Math.round(t.competition_guess),
    }));
    if (themes.length === 0) {
      throw new ProviderError("bad_output", "Model tidak menghasilkan tema.");
    }
    return { themes, model: this.model, costIdr, rateLimit };
  }

  private async chat(system: string, user: string, opts: { maxTokens: number; temperature: number }) {
    if (!this.apiKey) {
      throw new ProviderError("auth", `${this.keyEnv} belum diisi di server.`);
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
          ...this.extraBody(),
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
        throw new ProviderError("timeout", `${this.label} terlalu lama menjawab.`);
      }
      throw new ProviderError("upstream", `Tidak bisa terhubung ke ${this.label}.`);
    }

    const rateLimit = this.readRateLimit(res.headers);

    if (!res.ok) throw this.toError(res, await errorDetail(res), rateLimit);

    const body = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: TokenUsage;
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
}

/** Raw error text: OpenAI style `{error: {message}}`, a bare string, or Gemini's `[{error: {...}}]`. */
async function errorDetail(res: Response): Promise<string | undefined> {
  const text = await res.text().catch(() => "");
  if (!text) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    const first = (Array.isArray(parsed) ? parsed[0] : parsed) as { error?: { message?: string } | string } | undefined;
    const message = typeof first?.error === "string" ? first.error : first?.error?.message;
    // Keep the raw text too: Gemini puts the retry delay in error.details.
    return message ? `${message}\n${text}` : text;
  } catch {
    return text;
  }
}

/** Seconds to wait after a 429, clamped to 1..120. */
export function clampRetryAfter(seconds: number | undefined, fallback = 30): number {
  const value = seconds !== undefined && Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
  return Math.min(Math.max(Math.ceil(value), 1), 120);
}
