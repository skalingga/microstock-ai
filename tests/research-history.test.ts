import { describe, expect, it } from "vitest";
import { buildHistory } from "@/lib/research/history";

const runs = [
  { id: "r2", createdAt: "2026-10-12T00:00:00Z", region: "ID" },
  { id: "r1", createdAt: "2026-10-05T00:00:00Z", region: "ID" },
];
const themes = [
  { id: "t1", runId: "r1", title: "Halloween" },
  { id: "t2", runId: "r1", title: "Coffee" },
  { id: "t3", runId: "r2", title: "New Year" },
];
const job = (id: string, themeTitle: string, style = "icon_set") => ({ id, themeTitle, style, createdAt: "2026-10-13T00:00:00Z" });
const asset = (id: string, jobId: string, qcStatus: string, adobeStatus: string | null = null) => ({ id, jobId, previewPath: `p/${id}`, qcStatus, adobeStatus });

describe("buildHistory", () => {
  it("keeps the run order and counts themes", () => {
    const { runs: built, own } = buildHistory({ runs, themes, jobs: [], assets: [] });
    expect(built.map((r) => [r.id, r.themeCount, r.generatedCount, r.themes.length])).toEqual([
      ["r2", 1, 0, 0],
      ["r1", 2, 0, 0],
    ]);
    expect(own).toEqual([]);
  });

  it("matches batches to research themes by title and merges batches of one theme", () => {
    const { runs: built } = buildHistory({
      runs,
      themes,
      jobs: [job("j1", "halloween "), job("j2", "HALLOWEEN", "silhouette")],
      assets: [asset("a1", "j1", "lolos", "diterima"), asset("a2", "j2", "perlu_cek", "ditolak"), asset("a3", "j2", "lolos")],
    });
    const r1 = built.find((r) => r.id === "r1")!;
    expect(r1.generatedCount).toBe(1);
    expect(r1.themes).toHaveLength(1);
    expect(r1.themes[0]).toMatchObject({ title: "halloween", styles: ["icon_set", "silhouette"], lolos: 2, accepted: 1, rejected: 1, latestJobId: "j1" });
    expect(r1.themes[0].assets.map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("gives a title that appears in two runs to the newest run", () => {
    const { runs: built } = buildHistory({
      runs,
      themes: [...themes, { id: "t4", runId: "r1", title: "New Year" }],
      jobs: [job("j1", "New Year")],
      assets: [asset("a1", "j1", "lolos")],
    });
    expect(built.find((r) => r.id === "r2")!.themes).toHaveLength(1);
    expect(built.find((r) => r.id === "r1")!.themes).toEqual([]);
  });

  it("lists themes that match no research theme as own, and skips themes without assets", () => {
    const { runs: built, own } = buildHistory({
      runs,
      themes,
      jobs: [job("j1", "Retro motorcycles"), job("j2", "Coffee")],
      assets: [asset("a1", "j1", "lolos", "ditolak")],
    });
    expect(own.map((t) => t.title)).toEqual(["Retro motorcycles"]);
    // "Coffee" was generated but its assets are gone: counted, not listed.
    const r1 = built.find((r) => r.id === "r1")!;
    expect(r1.generatedCount).toBe(1);
    expect(r1.themes).toEqual([]);
  });
});
