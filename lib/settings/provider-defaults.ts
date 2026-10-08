import { GEMINI_FALLBACK_MODEL } from "@/lib/providers/gemini";
import type { ProviderEntry } from "./schema";

/** Server only. An empty model means the env default (resolveProvider); name it so a page can show model and price. */
export function withEnvDefaults(order: ProviderEntry[]): ProviderEntry[] {
  return order.map((e) => ({
    ...e,
    model:
      e.model ||
      (e.provider === "kenari" ? (process.env.KENARI_DEFAULT_MODEL ?? "") : process.env.GEMINI_DEFAULT_MODEL || GEMINI_FALLBACK_MODEL),
  }));
}
