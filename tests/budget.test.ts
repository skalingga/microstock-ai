import { describe, expect, it } from "vitest";
import { formatIdr, startOfDayWib, startOfMonthWib, startOfNextMonthWib } from "@/lib/budget";

describe("startOfMonthWib", () => {
  it("returns midnight of the 1st in WIB (17:00 UTC the day before)", () => {
    expect(startOfMonthWib(new Date("2026-10-06T12:00:00Z"))).toBe("2026-09-30T17:00:00.000Z");
  });

  it("rolls over at midnight WIB, not midnight UTC", () => {
    // 31 Oct 20:00 UTC is already 1 Nov 03:00 in Jakarta, so it belongs to November.
    expect(startOfMonthWib(new Date("2026-10-31T20:00:00Z"))).toBe("2026-10-31T17:00:00.000Z");
    // 31 Oct 16:59 UTC is still 31 Oct 23:59 in Jakarta.
    expect(startOfMonthWib(new Date("2026-10-31T16:59:00Z"))).toBe("2026-09-30T17:00:00.000Z");
  });
});

describe("startOfNextMonthWib", () => {
  it("returns midnight WIB of the 1st of next month", () => {
    expect(startOfNextMonthWib(new Date("2026-10-06T12:00:00Z"))).toBe("2026-10-31T17:00:00.000Z");
  });

  it("follows the Jakarta month at the boundary and across the year", () => {
    // Already 1 Nov in Jakarta: the budget runs until 1 Dec.
    expect(startOfNextMonthWib(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11-30T17:00:00.000Z");
    expect(startOfNextMonthWib(new Date("2026-12-15T00:00:00Z"))).toBe("2026-12-31T17:00:00.000Z");
  });
});

describe("startOfDayWib", () => {
  it("returns midnight WIB of the current Jakarta day", () => {
    expect(startOfDayWib(new Date("2026-10-06T12:00:00Z"))).toBe("2026-10-05T17:00:00.000Z");
    expect(startOfDayWib(new Date("2026-10-06T18:00:00Z"))).toBe("2026-10-06T17:00:00.000Z");
  });
});

describe("formatIdr", () => {
  it("formats Rupiah without decimals", () => {
    expect(formatIdr(20000).replace(/\s/g, "")).toBe("Rp20.000");
    expect(formatIdr(1186.7).replace(/\s/g, "")).toBe("Rp1.187");
  });
});
