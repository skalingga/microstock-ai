import { z } from "zod";
import { extractJson, extractSvg } from "@/lib/svg/extract";
import { ProviderError } from "./errors";
import { PHOTO_PROBLEM_IDS, type PhotoProblem } from "@/lib/photo/config";
import { conceptsPrompt, metadataPrompt, photoMetadataPrompt, photoPromptsPrompt, svgPrompt, themesPrompt } from "./prompts";
import type {
  Concept,
  ConceptInput,
  MetadataInput,
  PhotoMetadataInput,
  PhotoPrompt,
  PhotoPromptsInput,
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

const photoPromptsSchema = z.object({
  prompts: z.array(
    z.object({
      subject: z.string().trim().min(1).max(200),
      prompt: z.string().trim().min(20).max(1500),
    }),
  ),
});

const photoMetadataSchema = z.object({
  title: z.string().trim().min(1),
  keywords: z.union([z.array(z.string()), z.string()]),
  category: z.string().trim().default(""),
  has_people: z.boolean().optional().default(false),
  problems: z.array(z.string()).optional().default([]),
});

/** Chat message content: plain text, or text plus an image (OpenAI vision format, base64 data URL). */
type UserContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

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
      throw new ProviderError("bad_output", "Balasan model bukan daftar konsep yang valid.", { costIdr });
    }

    const concepts: Concept[] = parsed.data.concepts.slice(0, input.count).map((c) => ({
      subject: c.subject,
      composition: c.composition,
      palette: c.palette.filter((color) => HEX.test(color)).slice(0, 5),
    }));
    if (concepts.length === 0) {
      throw new ProviderError("bad_output", "Model tidak menghasilkan konsep.", { costIdr });
    }
    return { concepts, model: this.model, costIdr, rateLimit };
  }

  async generateSvg(input: SvgInput) {
    const { system, user } = svgPrompt(input);
    const { content, rateLimit, costIdr } = await this.chat(system, user, { maxTokens: 12_000, temperature: 0.7 });

    const svg = extractSvg(content);
    if (!svg) {
      throw new ProviderError("bad_output", "Balasan model tidak berisi SVG yang utuh.", { costIdr });
    }
    return { svg, model: this.model, costIdr, rateLimit };
  }

  async generateMetadata(input: MetadataInput) {
    const { system, user } = metadataPrompt(input);
    const { content, rateLimit, costIdr } = await this.chat(system, user, { maxTokens: 4000, temperature: 0.4 });

    const parsed = metadataSchema.safeParse(extractJson(content));
    if (!parsed.success) {
      throw new ProviderError("bad_output", "Balasan model bukan metadata yang valid.", { costIdr });
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
      throw new ProviderError("bad_output", "Balasan model bukan daftar tema yang valid.", { costIdr });
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
      throw new ProviderError("bad_output", "Model tidak menghasilkan tema.", { costIdr });
    }
    return { themes, model: this.model, costIdr, rateLimit };
  }

  async generatePhotoPrompts(input: PhotoPromptsInput) {
    const { system, user } = photoPromptsPrompt(input);
    const { content, rateLimit, costIdr } = await this.chat(system, user, { maxTokens: 8000, temperature: 0.9 });

    const parsed = photoPromptsSchema.safeParse(extractJson(content));
    if (!parsed.success) {
      throw new ProviderError("bad_output", "Balasan model bukan daftar prompt foto yang valid.", { costIdr });
    }
    const prompts: PhotoPrompt[] = parsed.data.prompts.slice(0, input.count);
    if (prompts.length === 0) {
      throw new ProviderError("bad_output", "Model tidak menghasilkan prompt foto.", { costIdr });
    }
    return { prompts, model: this.model, costIdr, rateLimit };
  }

  async generatePhotoMetadata(input: PhotoMetadataInput) {
    const { system, user } = photoMetadataPrompt(input);
    const content: UserContent = [
      { type: "text", text: user },
      { type: "image_url", image_url: { url: input.image } },
    ];
    const reply = await this.chat(system, content, { maxTokens: 4000, temperature: 0.3 });

    const parsed = photoMetadataSchema.safeParse(extractJson(reply.content));
    if (!parsed.success) {
      throw new ProviderError("bad_output", "Balasan model bukan metadata foto yang valid.", { costIdr: reply.costIdr });
    }
    const { title, keywords, category, has_people, problems } = parsed.data;
    const known = new Set<string>(PHOTO_PROBLEM_IDS);
    return {
      metadata: {
        title,
        keywords: Array.isArray(keywords) ? keywords : keywords.split(","),
        category,
        // Fictional people need no release; a lookalike of a real person is reported as a problem instead.
        needsRelease: false,
        hasPeople: has_people,
        problems: [...new Set(problems.map((p) => p.trim().toLowerCase()).filter((p) => known.has(p)))] as PhotoProblem[],
      },
      model: this.model,
      costIdr: reply.costIdr,
      rateLimit: reply.rateLimit,
    };
  }

  private async chat(system: string, user: UserContent, opts: { maxTokens: number; temperature: number }) {
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
    // Tokens are billed once the provider answers, even when the answer turns out unusable.
    const costIdr = await this.costOf(body?.usage);
    const content = body?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      const truncated = body?.choices?.[0]?.finish_reason === "length";
      throw new ProviderError(
        "bad_output",
        truncated ? "Jawaban model terpotong sebelum selesai." : "Model mengirim balasan kosong.",
        { costIdr },
      );
    }
    return { content, rateLimit, costIdr };
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
