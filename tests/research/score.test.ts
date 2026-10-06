import { describe, expect, it } from "vitest";
import { competitionFromCount, demandFromRatio, scoreTheme } from "@/lib/research/score";

describe("competitionFromCount", () => {
  it("is 0 for small niches and 100 for huge ones", () => {
    expect(competitionFromCount(500)).toBe(0);
    expect(competitionFromCount(1_000_000)).toBe(100);
    expect(competitionFromCount(30_000_000)).toBe(100);
  });
  it("grows with the count", () => {
    expect(competitionFromCount(10_000)).toBeLessThan(competitionFromCount(100_000));
  });
});

describe("demandFromRatio", () => {
  it("gives 50 at equal interest", () => expect(demandFromRatio(10, 10)).toBe(50));
  it("handles a zero anchor", () => {
    expect(demandFromRatio(5, 0)).toBe(100);
    expect(demandFromRatio(0, 0)).toBe(0);
  });
});

describe("scoreTheme", () => {
  it("prefers Trends over the AI guess", () => {
    expect(scoreTheme({ trendScore: 80, aiDemand: 10, eventWeight: 2 }).demand).toBe(80);
  });
  it("lowers opportunity as competition rises", () => {
    const low = scoreTheme({ trendScore: 70, adobeResultCount: 5_000 });
    const high = scoreTheme({ trendScore: 70, adobeResultCount: 900_000 });
    expect(low.opportunity).toBeGreaterThan(high.opportunity);
    expect(low.competitionKnown).toBe(true);
  });
  it("keeps competition null when nothing is known", () => {
    const s = scoreTheme({ trendScore: 60 });
    expect(s.competition).toBeNull();
    expect(s.competitionKnown).toBe(false);
    expect(s.opportunity).toBe(30);
  });
  it("stays within 0-100", () => {
    expect(scoreTheme({ trendScore: 100, eventWeight: 3 }).demand).toBe(100);
  });
});
