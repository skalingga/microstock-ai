import type { ProviderEntry } from "@/lib/settings/schema";
import { ProviderError, canFallBack } from "./errors";
import { KenariProvider } from "./kenari";
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

/**
 * Concepts and metadata are text only, so Kenari may use a cheaper model for them (user setting).
 * SVG calls and other providers keep the model from the provider order.
 */
export function orderForKind(order: ProviderEntry[], kind: UsageKind, kenariTextModel: string): ProviderEntry[] {
  const textModel = kenariTextModel.trim();
  if (kind === "svg" || !textModel) return order;
  return order.map((entry) => (entry.provider === "kenari" ? { ...entry, model: textModel } : entry));
}

/** The only place that turns a provider name into an adapter (CLAUDE.md rule 4). */
export function resolveProvider(entry: ProviderEntry): { provider: SvgProvider; model: string } {
  switch (entry.provider) {
    case "kenari": {
      const model = entry.model || process.env.KENARI_DEFAULT_MODEL;
      if (!model) {
        throw new ProviderError(
          "model_unavailable",
          "Model Kenari belum diatur. Isi di Pengaturan atau set KENARI_DEFAULT_MODEL.",
        );
      }
      return { provider: new KenariProvider(model), model };
    }
    case "gemini":
      throw new ProviderError("not_implemented", "Gemini baru tersedia di Tahap 5.");
  }
}

/**
 * Tries each provider in the user's order. Moves on to the next one when the failure is
 * something another provider could fix (limit, timeout, missing model, upstream error).
 * Every real call is logged, including failed ones, because they still use quota.
 */
export async function runWithFallback<T extends { model: string; costUsd?: number; costIdr?: number }>(
  order: ProviderEntry[],
  kind: UsageKind,
  call: (provider: SvgProvider) => Promise<T>,
  log: (entry: UsageEntry) => Promise<void>,
  guard?: CallGuard,
): Promise<T & { provider: ProviderId }> {
  let lastError: ProviderError | null = null;

  for (const entry of order) {
    let resolved: { provider: SvgProvider; model: string };
    try {
      resolved = resolveProvider(entry);
    } catch (err) {
      if (err instanceof ProviderError) {
        // Nothing was sent to the provider, so nothing to log.
        if (!lastError || lastError.code === "not_implemented") lastError = err;
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
