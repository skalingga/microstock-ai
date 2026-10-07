import type { ProviderEntry } from "@/lib/settings/schema";
import { ProviderError, canFallBack } from "./errors";
import { GEMINI_FALLBACK_MODEL, GEMINI_TIMEOUT_MS, GeminiProvider } from "./gemini";
import { KENARI_TIMEOUT_MS, KenariProvider } from "./kenari";
import { KENARI_IMAGE_TIMEOUT_MS, KenariImageProvider } from "./kenari-image";
import { KENARI_IMAGE_FALLBACK_MODEL, imagePriceIdr } from "./kenari-image-pricing";
import type { ProviderId, SvgProvider } from "./types";

export type UsageKind = "concepts" | "svg" | "metadata" | "themes";

export type UsageEntry = {
  provider: ProviderId;
  model: string;
  kind: UsageKind;
  ok: boolean;
  costUsd?: number;
  costIdr?: number;
};

/** Runs just before a provider is called; throws a ProviderError to refuse the call (e.g. budget). */
export type CallGuard = (info: { provider: ProviderId; model: string }) => Promise<void>;

/** A backup only gets called when at least this much of the request's time is left. */
export const MIN_BACKUP_MS = 15_000;

/**
 * Concepts and metadata are text only, so Kenari may use a cheaper model for them (user setting).
 * SVG calls and other providers keep the model from the provider order.
 */
export function orderForKind(
  order: ProviderEntry[],
  kind: UsageKind,
  kenariTextModel: string,
  svgModelOverride?: ProviderEntry,
): ProviderEntry[] {
  // A model picked by the user runs alone: falling back to another model would hide which one made the asset.
  if (kind === "svg" && svgModelOverride) return [svgModelOverride];
  const textModel = kenariTextModel.trim();
  if (kind === "svg" || !textModel) return order;
  return order.map((entry) => (entry.provider === "kenari" ? { ...entry, model: textModel } : entry));
}

/**
 * Traced styles (silhouette, line art) always use one Kenari image model, with no backup: there is no free image
 * model to fall back to. A model picked on the Generate page is used only when it is an image model.
 */
export function imageOrder(settingsModel: string, override?: ProviderEntry): ProviderEntry[] {
  const picked = override?.provider === "kenari" && imagePriceIdr(override.model) !== undefined ? override.model : "";
  const model = picked || settingsModel.trim() || process.env.KENARI_IMAGE_MODEL || KENARI_IMAGE_FALLBACK_MODEL;
  return [{ provider: "kenari", model, image: true }];
}

/**
 * After the primary timed out, the browser retries with skipPrimary so the backup gets the whole
 * 60s window instead of the few seconds left over. A single provider is never dropped.
 */
export function withoutPrimary(order: ProviderEntry[]): ProviderEntry[] {
  return order.length > 1 ? order.slice(1) : order;
}

/** The only place that turns a provider name into an adapter (CLAUDE.md rule 4). */
export function resolveProvider(
  entry: ProviderEntry,
  opts: { timeoutCapMs?: number } = {},
): { provider: SvgProvider; model: string } {
  const cap = (ms: number) => (opts.timeoutCapMs === undefined ? ms : Math.min(ms, opts.timeoutCapMs));
  switch (entry.provider) {
    case "kenari": {
      const model = entry.model || process.env.KENARI_DEFAULT_MODEL;
      if (!model) {
        throw new ProviderError(
          "model_unavailable",
          "Model Kenari belum diatur. Isi di Pengaturan atau set KENARI_DEFAULT_MODEL.",
        );
      }
      if (entry.image) {
        return { provider: new KenariImageProvider(model, { timeoutMs: cap(KENARI_IMAGE_TIMEOUT_MS) }), model };
      }
      return { provider: new KenariProvider(model, { timeoutMs: cap(KENARI_TIMEOUT_MS) }), model };
    }
    case "gemini": {
      const model = entry.model || process.env.GEMINI_DEFAULT_MODEL || GEMINI_FALLBACK_MODEL;
      return { provider: new GeminiProvider(model, { timeoutMs: cap(GEMINI_TIMEOUT_MS) }), model };
    }
  }
}

/**
 * Tries each provider in the user's order. Moves on to the next one when the failure is
 * something another provider could fix (limit, timeout, missing model, upstream error).
 * Every real call is logged, including failed ones, because they still use quota.
 * With a deadline (epoch ms), no call runs past it and a backup is skipped when too little time is left.
 */
export async function runWithFallback<T extends { model: string; costUsd?: number; costIdr?: number }>(
  order: ProviderEntry[],
  kind: UsageKind,
  call: (provider: SvgProvider) => Promise<T>,
  log: (entry: UsageEntry) => Promise<void>,
  guard?: CallGuard,
  opts: { deadline?: number; now?: () => number } = {},
): Promise<T & { provider: ProviderId }> {
  const now = opts.now ?? Date.now;
  let lastError: ProviderError | null = null;

  for (const [index, entry] of order.entries()) {
    const remaining = opts.deadline === undefined ? undefined : opts.deadline - now();
    if (index > 0 && lastError && remaining !== undefined && remaining < MIN_BACKUP_MS) {
      // Too late for the backup in this request. "timeout" makes the browser retry with skipPrimary.
      throw new ProviderError("timeout", `${lastError.message} Dicoba ulang lewat provider cadangan.`);
    }

    let resolved: { provider: SvgProvider; model: string };
    try {
      resolved = resolveProvider(entry, { timeoutCapMs: remaining });
    } catch (err) {
      if (err instanceof ProviderError) {
        // Nothing was sent to the provider, so nothing to log.
        if (!lastError) lastError = err;
        continue;
      }
      throw err;
    }

    try {
      await guard?.({ provider: entry.provider, model: resolved.model });
    } catch (err) {
      // Refused before any call was made: nothing to log.
      if (!(err instanceof ProviderError)) throw err;
      if (!canFallBack(err.code)) throw err;
      lastError = err;
      continue;
    }

    try {
      const result = await call(resolved.provider);
      await log({
        provider: entry.provider,
        model: result.model,
        kind,
        ok: true,
        costUsd: result.costUsd,
        costIdr: result.costIdr,
      });
      return { ...result, provider: entry.provider };
    } catch (err) {
      if (!(err instanceof ProviderError)) throw err;
      await log({ provider: entry.provider, model: resolved.model, kind, ok: false });
      if (!canFallBack(err.code)) throw err;
      lastError = err;
    }
  }

  throw lastError ?? new ProviderError("not_implemented", "Tidak ada provider yang siap dipakai. Cek Pengaturan.");
}
