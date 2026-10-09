import { describe, expect, it } from "vitest";
import { cellsToRedo, confidence, estimateRemainingMs, parseCells, quotaGroup, suggest, summarize, visualStatus, type BenchCell } from "@/lib/generate/benchmark";

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
  it("picks the backup from the other provider", () => {
    const rows = summarize([
      cell("a:free", { durationMs: 1_000 }),
      cell("b:free", { durationMs: 2_000 }),
      cell("paid-model", { durationMs: 3_000 }),
      cell("gemini-3.5-flash-lite", { qc: "perlu_cek" }),
    ]);
    const { primary, backup } = suggest(rows);
    expect(primary?.model).toBe("a:free");
    // b:free and paid-model score higher but are Kenari too: Settings cannot chain two Kenari models.
    expect(backup?.model).toBe("gemini-3.5-flash-lite");
  });

  it("suggests no backup when only one provider made usable SVGs", () => {
    const { primary, backup } = suggest(summarize([cell("a:free"), cell("paid-model")]));
    expect(primary?.model).toBe("a:free");
    expect(backup).toBeUndefined();
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

describe("cellsToRedo", () => {
  const cells = [
    cell("a", { status: "selesai" }),
    cell("b", { status: "gagal", errorCode: "timeout" }),
    cell("c", { status: "menunggu" }),
    cell("d", { status: "berjalan" }),
  ];

  it("continues the cells that never finished", () => {
    expect(cellsToRedo(cells, false)).toEqual([2, 3]);
  });

  it("also redraws the failed cells when asked, never the finished ones", () => {
    expect(cellsToRedo(cells, true)).toEqual([1, 2, 3]);
  });
});

describe("estimateRemainingMs", () => {
  it("multiplies the median time of finished cells by the cells left", () => {
    const cells = [
      cell("a", { durationMs: 4_000 }),
      cell("a", { durationMs: 6_000 }),
      cell("a", { durationMs: 20_000 }),
      cell("b", { status: "menunggu", durationMs: undefined }),
      cell("b", { status: "berjalan", durationMs: undefined }),
    ];
    expect(estimateRemainingMs(cells)).toBe(12_000);
  });

  it("has no estimate before the first cell is done", () => {
    expect(estimateRemainingMs([cell("a", { status: "menunggu", durationMs: undefined })])).toBeNull();
  });
});

describe("confidence", () => {
  it("counts the cells still waiting and the fewest attempts per model", () => {
    const cells = [cell("a"), cell("a"), cell("b"), cell("b", { status: "menunggu" })];
    const rows = summarize(cells);
    expect(confidence(cells, rows)).toEqual({ waiting: 1, total: 4, minAttempts: 1 });
  });
});
