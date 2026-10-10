import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/next-path";
import { DEADLINE_WINDOW_DAYS, acceptanceRate, pickDeadlines } from "@/lib/dashboard/summary";
import { CHECKLIST_STEP_IDS, unfinishedUploads } from "@/lib/export/checklist";

const NOW = Date.parse("2026-10-10T05:00:00Z");

describe("pickDeadlines", () => {
  it("lists the nearest upcoming deadlines first, at most three", () => {
    const themes = [
      { title: "Thanksgiving", upload_by: "2026-10-30" },
      { title: "Christmas", upload_by: "2026-10-11" },
      { title: "Diwali", upload_by: "2026-10-20" },
      { title: "Hanukkah", upload_by: "2026-11-05" },
    ];
    const picked = pickDeadlines(themes, NOW);
    expect(picked.map((d) => d.title)).toEqual(["Christmas", "Diwali", "Thanksgiving"]);
    expect(picked[0]).toMatchObject({ daysLeft: 1, status: "mendesak" });
    expect(picked[2]).toMatchObject({ daysLeft: 20, status: "cukup" });
  });

  it("drops passed deadlines, themes without a date, and dates beyond the window", () => {
    const themes = [
      { title: "Halloween lewat", upload_by: "2026-10-01" },
      { title: "Tanpa tanggal", upload_by: null },
      { title: "Jauh", upload_by: "2027-03-01" },
      { title: "Hari ini", upload_by: "2026-10-10" },
    ];
    expect(pickDeadlines(themes, NOW)).toEqual([{ title: "Hari ini", uploadBy: "2026-10-10", daysLeft: 0, status: "mendesak" }]);
    expect(DEADLINE_WINDOW_DAYS).toBeGreaterThan(14);
  });
});

describe("acceptanceRate", () => {
  it("rounds to a whole percent and is null before any decision", () => {
    expect(acceptanceRate(35, 7)).toBe(83);
    expect(acceptanceRate(0, 0)).toBeNull();
    expect(acceptanceRate(0, 4)).toBe(0);
  });
});

describe("unfinishedUploads", () => {
  it("counts exports with open steps and those still missing the AI label", () => {
    const rows = [
      { checklist_done: [...CHECKLIST_STEP_IDS] },
      { checklist_done: ["zip", "upload", "ai"] },
      { checklist_done: [] },
      { checklist_done: null },
    ];
    expect(unfinishedUploads(rows)).toEqual({ unfinished: 3, missingAiLabel: 2 });
    expect(unfinishedUploads([])).toEqual({ unfinished: 0, missingAiLabel: 0 });
  });
});

describe("after sign-in", () => {
  it("lands on Meja by default and keeps safe same-site paths", () => {
    expect(DEFAULT_AFTER_LOGIN).toBe("/meja");
    expect(safeNextPath(undefined)).toBe("/meja");
    expect(safeNextPath("/")).toBe("/meja");
    expect(safeNextPath("//evil.example")).toBe("/meja");
    expect(safeNextPath("/aset/tinjau")).toBe("/aset/tinjau");
  });
});
