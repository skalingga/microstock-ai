import { describe, expect, it } from "vitest";
import { buildReport, shapeBucket, type ReviewedAsset } from "@/lib/adobe/stats";

const row = (over: Partial<ReviewedAsset>): ReviewedAsset => ({
  provider: "kenari",
  model: "deepseek-v4-flash",
  style: "icon_set",
  qcStatus: "lolos",
  pathCount: 12,
  adobeStatus: "diterima",
  adobeReason: null,
  ...over,
});

describe("shapeBucket", () => {
  it("buckets shape counts", () => {
    expect(shapeBucket(5)).toBe("1-10 bentuk");
    expect(shapeBucket(30)).toBe("11-30 bentuk");
    expect(shapeBucket(81)).toBe("lebih dari 80 bentuk");
    expect(shapeBucket(null)).toBe("tidak diketahui");
  });
});

describe("buildReport", () => {
  const rows = [
    row({}),
    row({}),
    row({ adobeStatus: "ditolak", adobeReason: "Similar content" }),
    row({ provider: "gemini", model: "g", style: "seamless_pattern", adobeStatus: "ditolak", adobeReason: "similar content" }),
  ];
  const report = buildReport(rows);

  it("computes the overall rate", () => {
    expect(report.overall).toMatchObject({ accepted: 2, rejected: 2, total: 4, rate: 0.5 });
  });
  it("splits by provider and model", () => {
    const kenari = report.byProvider.find((g) => g.label === "kenari · deepseek-v4-flash");
    expect(kenari).toMatchObject({ accepted: 2, rejected: 1 });
  });
  it("counts rejection reasons case-insensitively", () => {
    expect(report.reasons).toEqual([{ reason: "Similar content", count: 2 }]);
  });
  it("handles no data", () => {
    expect(buildReport([]).overall.total).toBe(0);
  });
});
