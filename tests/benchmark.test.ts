import { describe, expect, it } from "vitest";
import { parseCells, quotaGroup, suggest, summarize, visualStatus, type BenchCell } from "@/lib/generate/benchmark";

const cell = (model: string, patch: Partial<BenchCell> = {}): BenchCell => ({
  theme: "autumn",
  style: "icon_set",
  concept: "a leaf",
  provider: model.startsWith("gemini") ? "gemini" : "kenari",
  model,
  status: "selesai",
  qc: "lolos",
  durationMs: 10_000,
  ...patch,
});

describe("visualStatus", () => {
  it("fails on any failed note and asks for a check on any warning", () => {
    expect(visualStatus([{ check: "teks", status: "ok", message: "" }])).toBe("lolos");
    expect(visualStatus([{ check: "teks", status: "cek", message: "" }])).toBe("perlu_cek");
    expect(visualStatus([{ check: "teks", status: "cek", message: "" }, { check: "kosong", status: "gagal", message: "" }])).toBe("gagal");
  });
});

describe("quotaGroup", () => {
  it("puts every free Kenari model in one shared quota", () => {
    expect(quotaGroup({ provider: "kenari", model: "agnes-3-0-flash:free" })).toBe(quotaGroup({ provider: "kenari", model: "hy3:free" }));
    expect(quotaGroup({ provider: "kenari", model: "deepseek-v4-flash" })).not.toBe("kenari:free");
    expect(quotaGroup({ provider: "gemini", model: "gemini-3.5-flash-lite" })).toBe("gemini:gemini-3.5-flash-lite");
  });
});

describe("summarize", () => {
  it("counts verdicts, errors, time and cost per model, best first", () => {
    const rows = summarize([
      cell("a:free", { qc: "lolos", durationMs: 4_000 }),
      cell("a:free", { qc: "perlu_cek", durationMs: 8_000 }),
      cell("a:free", { status: "gagal", qc: undefined, errorCode: "timeout", durationMs: 55_000 }),
      cell("deepseek-v4-flash", { qc: "lolos", costIdr: 6.2, shapes: 10 }),
      cell("deepseek-v4-flash", { qc: "gagal", costIdr: 5.1, shapes: 30 }),
      cell("deepseek-v4-flash", { qc: "lolos", costIdr: 4, shapes: 20 }),
      cell("waiting:free", { status: "menunggu", qc: undefined }),
    ]);

    expect(rows.map((r) => r.model)).toEqual(["deepseek-v4-flash", "a:free"]);
    expect(rows[0]).toMatchObject({ total: 3, made: 3, lolos: 2, gagalQc: 1, costIdr: 15.3, avgShapes: 20 });
    expect(rows[0].score).toBeCloseTo(2 / 3);
    // The timed-out call counts as a try but not toward the median of finished drawings.
    expect(rows[1]).toMatchObject({ total: 3, made: 2, lolos: 1, perluCek: 1, errors: { timeout: 1 }, medianMs: 6_000 });
    expect(rows[1].score).toBeCloseTo(0.5);
  });

  it("breaks a tie with the faster model", () => {
    const rows = summarize([cell("slow:free", { durationMs: 30_000 }), cell("fast:free", { durationMs: 5_000 })]);
    expect(rows[0].model).toBe("fast:free");
  });
});

describe("suggest", () => {
  it("picks a backup with its own quota", () => {
    const rows = summarize([
      cell("a:free", { durationMs: 1_000 }),
      cell("b:free", { durationMs: 2_000 }),
      cell("gemini-3.5-flash-lite", { qc: "perlu_cek" }),
    ]);
    const { primary, backup } = suggest(rows);
    expect(primary?.model).toBe("a:free");
    // b:free is second best but shares the free quota with a:free.
    expect(backup?.model).toBe("gemini-3.5-flash-lite");
  });

  it("suggests nothing when no model made a usable SVG", () => {
    expect(suggest(summarize([cell("a:free", { qc: "gagal" })]))).toEqual({});
  });
});

describe("parseCells", () => {
  it("keeps well-formed rows and drops the rest", () => {
    const good = cell("a:free");
    expect(parseCells([good, { foo: 1 }, null, "x"] as never)).toEqual([good]);
    expect(parseCells({} as never)).toEqual([]);
  });
});
