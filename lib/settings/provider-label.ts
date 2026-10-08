import type { ProviderEntry } from "./schema";

// Human-readable provider order, shared by the pages that show which model a call will use.

export function entryLabel(entry: ProviderEntry) {
  return `${entry.provider} · ${entry.model || "bawaan server"}`;
}

/** "kenari · x, cadangan gemini · y". */
export function orderLabel(order: ProviderEntry[]) {
  if (order.length === 0) return "bawaan";
  const [first, ...backups] = order;
  return backups.length > 0 ? `${entryLabel(first)}, cadangan ${backups.map(entryLabel).join(", ")}` : entryLabel(first);
}

export const isPaidEntry = (e: ProviderEntry) => e.provider === "kenari" && !!e.model && !e.model.endsWith(":free");
