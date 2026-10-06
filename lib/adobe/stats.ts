// Acceptance statistics for stage 6: how often Adobe Stock accepted assets, split by what we
// control (provider and model, style, our own QC verdict, shape count). Used to tune lib/qc/config.ts.

export type ReviewedAsset = {
  provider: string;
  model: string;
  style: string;
  qcStatus: string;
  pathCount: number | null;
  adobeStatus: "diterima" | "ditolak";
  adobeReason: string | null;
};

export type Group = { label: string; accepted: number; rejected: number; total: number; rate: number };

function group(rows: ReviewedAsset[], keyOf: (r: ReviewedAsset) => string, order?: string[]): Group[] {
  const map = new Map<string, { accepted: number; rejected: number }>();
  for (const row of rows) {
    const entry = map.get(keyOf(row)) ?? { accepted: 0, rejected: 0 };
    if (row.adobeStatus === "diterima") entry.accepted += 1;
    else entry.rejected += 1;
    map.set(keyOf(row), entry);
  }
  const groups = [...map.entries()].map(([label, v]) => {
    const total = v.accepted + v.rejected;
    return { label, ...v, total, rate: total === 0 ? 0 : v.accepted / total };
  });
  return order
    ? groups.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
    : groups.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export const SHAPE_BUCKETS = ["1-10 bentuk", "11-30 bentuk", "31-80 bentuk", "lebih dari 80 bentuk", "tidak diketahui"];

export function shapeBucket(count: number | null): string {
  if (count === null) return "tidak diketahui";
  if (count <= 10) return SHAPE_BUCKETS[0];
  if (count <= 30) return SHAPE_BUCKETS[1];
  if (count <= 80) return SHAPE_BUCKETS[2];
  return SHAPE_BUCKETS[3];
}

export type AcceptanceReport = {
  overall: Group;
  byProvider: Group[];
  byStyle: Group[];
  byQc: Group[];
  byShapes: Group[];
  /** Most common rejection reasons, case-insensitive. */
  reasons: { reason: string; count: number }[];
};

export function buildReport(rows: ReviewedAsset[]): AcceptanceReport {
  const [overall] = group(rows, () => "Semua");
  const tally = new Map<string, { reason: string; count: number }>();
  for (const row of rows) {
    const reason = row.adobeReason?.trim();
    if (row.adobeStatus !== "ditolak" || !reason) continue;
    const key = reason.toLowerCase();
    const entry = tally.get(key) ?? { reason, count: 0 };
    entry.count += 1;
    tally.set(key, entry);
  }
  return {
    overall: overall ?? { label: "Semua", accepted: 0, rejected: 0, total: 0, rate: 0 },
    byProvider: group(rows, (r) => `${r.provider} · ${r.model}`),
    byStyle: group(rows, (r) => r.style),
    byQc: group(rows, (r) => r.qcStatus),
    byShapes: group(rows, (r) => shapeBucket(r.pathCount), SHAPE_BUCKETS),
    reasons: [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 10),
  };
}
