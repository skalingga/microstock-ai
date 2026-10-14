import { describe, expect, it } from "vitest";
import { UPLOAD_LEAD_DAYS } from "@/lib/research/calendar";
import {
  LAST_CHANCE_LEAD_DAYS,
  LATE_GRACE_DAYS,
  competitionFromCount,
  daysUntil,
  deadlineStatus,
  demandFromRatio,
  lastChanceDate,
  provenanceOf,
  scoreTheme,
  timingFactor,
} from "@/lib/research/score";

describe("competitionFromCount", () => {
  it("is 0 for small niches and 100 for huge ones", () => {
    expect(competitionFromCount(500)).toBe(0);
    expect(competitionFromCount(10_000_000)).toBe(100);
    expect(competitionFromCount(30_000_000)).toBe(100);
    expect(competitionFromCount(1_000_000)).toBeLessThan(competitionFromCount(8_000_000));
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

describe("deadline timing", () => {
  const now = Date.parse("2026-10-06T08:00:00Z");
  it("counts days from today", () => {
    expect(daysUntil("2026-10-06", now)).toBe(0);
    expect(daysUntil("2026-08-25", now)).toBe(-42);
    expect(daysUntil("2026-10-11", now)).toBe(5);
  });
  it("classifies the deadline", () => {
    expect(deadlineStatus(-1)).toBe("telat");
    expect(deadlineStatus(-LATE_GRACE_DAYS)).toBe("telat");
    expect(deadlineStatus(-LATE_GRACE_DAYS - 1)).toBe("terlewat");
    expect(deadlineStatus(5)).toBe("mendesak");
    expect(deadlineStatus(30)).toBe("cukup");
    expect(deadlineStatus(null)).toBeNull();
  });
  it("lowers opportunity once the deadline has passed", () => {
    const open = scoreTheme({ trendScore: 80, adobeResultCount: 5_000, daysLeft: 40 });
    const missed = scoreTheme({ trendScore: 80, adobeResultCount: 5_000, daysLeft: -10 });
    expect(missed.opportunity).toBe(Math.round(open.opportunity * timingFactor(-10)));
    expect(missed.opportunity).toBeLessThan(open.opportunity);
  });
  it("cuts late themes less than missed ones", () => {
    expect(timingFactor(-10)).toBeGreaterThan(timingFactor(-LATE_GRACE_DAYS - 1));
    expect(timingFactor(-10)).toBeLessThan(timingFactor(5));
  });
  it("puts the last chance one month before the event", () => {
    // Ideal deadline is 75 days before the event; the last chance is 30 days before it.
    expect(LATE_GRACE_DAYS).toBe(UPLOAD_LEAD_DAYS - LAST_CHANCE_LEAD_DAYS);
    expect(LAST_CHANCE_LEAD_DAYS).toBe(30);
    expect(lastChanceDate("2026-10-11")).toBe("2026-11-25");
  });
  it("leaves evergreen themes alone", () => expect(timingFactor(null)).toBe(1));
});

describe("provenanceOf", () => {
  it("says which inputs were measured", () => {
    expect(provenanceOf(scoreTheme({ trendScore: 60, adobeResultCount: 20_000 }))).toBe("data");
    expect(provenanceOf(scoreTheme({ trendScore: 60, aiCompetition: 40 }))).toBe("sebagian");
    expect(provenanceOf(scoreTheme({ aiDemand: 60, adobeResultCount: 20_000 }))).toBe("sebagian");
    expect(provenanceOf(scoreTheme({ aiDemand: 60, aiCompetition: 40 }))).toBe("perkiraan");
  });
});
