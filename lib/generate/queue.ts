import type { RateLimit } from "@/lib/providers/types";
import { ApiError, isFatal } from "./client";

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export const sleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Dihentikan", "AbortError"));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Dihentikan", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Keeps the queue inside the provider's quota (Kenari free models: 5 requests per minute).
 * It learns the remaining quota from response headers, so it needs no hardcoded limit.
 */
export class RateGate {
  private remaining?: number;
  private resetAt?: number;
  private blockedUntil = 0;
  private lastCallAt = 0;

  constructor(
    private readonly minSpacingMs = 1000,
    private readonly now: () => number = Date.now,
    private readonly wait: Sleep = sleep,
  ) {}

  update(rateLimit?: RateLimit) {
    if (!rateLimit) return;
    if (rateLimit.remaining !== undefined) this.remaining = rateLimit.remaining;
    if (rateLimit.resetAt !== undefined) this.resetAt = rateLimit.resetAt;
  }

  /** The provider said "slow down": hold every call for this long. */
  block(seconds: number) {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + seconds * 1000);
  }

  /** Resolves when the next call may go out. Returns how long it waited, in ms. */
  async acquire(signal?: AbortSignal, onWait?: (ms: number) => void): Promise<number> {
    const start = this.now();
    for (;;) {
      const now = this.now();
      let delay = Math.max(0, this.blockedUntil - now, this.lastCallAt + this.minSpacingMs - now);

      if (this.remaining !== undefined && this.remaining <= 0 && this.resetAt !== undefined) {
        if (now < this.resetAt) delay = Math.max(delay, this.resetAt - now + 500);
        else this.remaining = undefined; // window passed, quota is back
      }

      if (delay <= 0) break;
      onWait?.(delay);
      await this.wait(delay, signal);
    }

    this.lastCallAt = this.now();
    if (this.remaining !== undefined) this.remaining -= 1;
    return this.now() - start;
  }
}

export type RetryOptions = {
  gate: RateGate;
  signal?: AbortSignal;
  /** Attempts for failures other than rate limits. */
  maxAttempts?: number;
  /** Rate-limit waits allowed per call before giving up. */
  maxRateLimitWaits?: number;
  retryDelayMs?: number;
  onStatus?: (message: string) => void;
  sleepImpl?: Sleep;
};

export type AttemptContext = {
  /** True after a timeout: the server then starts at the backup provider, which gets the full time window. */
  skipPrimary: boolean;
};

/** Runs one provider call through the rate gate, retrying the failures worth retrying. */
export async function callWithRetry<T>(fn: (ctx: AttemptContext) => Promise<T>, opts: RetryOptions): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const maxRateLimitWaits = opts.maxRateLimitWaits ?? 6;
  const retryDelayMs = opts.retryDelayMs ?? 3000;
  const wait = opts.sleepImpl ?? sleep;

  let attempts = 0;
  let rateLimitWaits = 0;
  let skipPrimary = false;

  for (;;) {
    await opts.gate.acquire(opts.signal, (ms) => opts.onStatus?.(`Menunggu kuota provider (${Math.ceil(ms / 1000)} dtk)...`));
    try {
      return await fn({ skipPrimary });
    } catch (err) {
      if (opts.signal?.aborted || !(err instanceof ApiError)) throw err;

      if (err.code === "rate_limit" && rateLimitWaits < maxRateLimitWaits) {
        rateLimitWaits += 1;
        opts.gate.block(err.retryAfterSec ?? 30);
        continue;
      }

      if (err.code === "timeout") skipPrimary = true;
      const retryable = err.code === "timeout" || err.code === "upstream" || err.code === "network" || err.code === "bad_output" || err.code === "bad_svg";
      attempts += 1;
      if (!retryable || isFatal(err.code) || attempts >= maxAttempts) throw err;

      opts.onStatus?.(`Mencoba ulang (${attempts + 1}/${maxAttempts})...`);
      await wait(retryDelayMs, opts.signal);
    }
  }
}
