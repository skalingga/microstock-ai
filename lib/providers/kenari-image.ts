import { isImageStyle } from "@/lib/settings/schema";
import { ProviderError, charged } from "./errors";
import { kenariHttpError, readRateLimit } from "./kenari";
import { imagePriceIdr } from "./kenari-image-pricing";
import { imagePrompt } from "./prompts";
import type { SvgInput, SvgProvider } from "./types";

const DEFAULT_BASE_URL = "https://kenari.id/v1";
// gpt-image-2 needed 13-57s per picture in the Oktober 2026 tests; tracing adds well under a second.
// The SVG route allows 120s for the traced styles (app/api/generate/svg/route.ts).
export const IMAGE_REQUEST_BUDGET_MS = 115_000;
export const KENARI_IMAGE_TIMEOUT_MS = 105_000;
const DOWNLOAD_TIMEOUT_MS = 10_000;

export type KenariImageConfig = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Stage 7: a Kenari image model draws the asset black on white, and the server traces it to SVG.
 * Only the SVG step of the traced styles (silhouette, line art) comes here; concepts and metadata stay with
 * the text models, so the other methods refuse.
 */
export class KenariImageProvider implements SvgProvider {
  readonly id = "kenari" as const;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(model: string, config: KenariImageConfig = {}) {
    this.model = model;
    this.apiKey = config.apiKey ?? process.env.KENARI_API_KEY;
    this.baseUrl = (config.baseUrl ?? process.env.KENARI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? KENARI_IMAGE_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generateSvg(input: SvgInput) {
    const style = input.style;
    if (!isImageStyle(style)) {
      throw new ProviderError("not_implemented", "Model gambar hanya dipakai untuk gaya Siluet dan Line art.");
    }
    // Fail closed: without a known price the call would not count toward the monthly budget.
    const price = imagePriceIdr(this.model);
    if (price === undefined) {
      throw new ProviderError(
        "model_unavailable",
        `Harga model gambar ${this.model} belum diketahui. Pilih model lain di Pengaturan atau tambahkan harganya di kenari-image-pricing.ts.`,
      );
    }
    if (!this.apiKey) throw new ProviderError("auth", "KENARI_API_KEY belum diisi di server.");

    const started = Date.now();
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: imagePrompt({ ...input, style }), n: 1, size: "1024x1024" }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw networkError(err);
    }

    const rateLimit = readRateLimit(res.headers);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // A refused prompt (safety filter) will be refused again by any other model: report it, do not fall back.
      if (res.status === 400 && /safety|moderation|policy|content/i.test(detail)) {
        throw new ProviderError("bad_output", "Model gambar menolak prompt ini. Ubah tema atau konsepnya.");
      }
      throw kenariHttpError(res, detail, rateLimit);
    }

    // Kenari bills the picture once it answers 200, so every failure from here on still costs the price.
    try {
      const body = (await res.json().catch(() => null)) as { data?: { b64_json?: string; url?: string }[] } | null;
      const item = body?.data?.[0];
      const remaining = Math.max(1_000, Math.min(DOWNLOAD_TIMEOUT_MS, this.timeoutMs - (Date.now() - started)));
      const bytes = item?.b64_json
        ? Buffer.from(item.b64_json, "base64")
        : item?.url
          ? await this.download(item.url, remaining)
          : null;
      if (!bytes) throw new ProviderError("bad_output", "Model gambar tidak mengirim gambar.");

      // Loaded on demand so the other generate routes do not pull in potrace and jimp.
      const { TraceError, traceImage } = await import("@/lib/svg/trace");
      try {
        const traced = await traceImage(bytes, style);
        return { svg: traced.svg, model: this.model, costIdr: price, rateLimit };
      } catch (err) {
        if (err instanceof TraceError) throw new ProviderError("bad_output", err.message);
        throw err;
      }
    } catch (err) {
      if (err instanceof ProviderError) throw charged(err, { costIdr: price });
      throw err;
    }
  }

  private async download(url: string, timeoutMs: number): Promise<Buffer> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw networkError(err);
    }
    if (!res.ok) throw new ProviderError("upstream", `Gambar dari Kenari tidak bisa diunduh (error ${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }

  generateConcepts(): never {
    throw new ProviderError("not_implemented", "Model gambar tidak membuat konsep.");
  }
  generateMetadata(): never {
    throw new ProviderError("not_implemented", "Model gambar tidak membuat metadata.");
  }
  generateThemes(): never {
    throw new ProviderError("not_implemented", "Model gambar tidak membuat tema.");
  }
}

function networkError(err: unknown): ProviderError {
  const name = typeof err === "object" && err !== null ? (err as { name?: string }).name : undefined;
  return name === "TimeoutError" || name === "AbortError"
    ? new ProviderError("timeout", "Model gambar Kenari terlalu lama menjawab.")
    : new ProviderError("upstream", "Tidak bisa terhubung ke Kenari.");
}
