import { describe, expect, it } from "vitest";
import { eventsInPeriod } from "@/lib/research/calendar";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("eventsInPeriod", () => {
  it("computes Thanksgiving and Black Friday", () => {
    const events = eventsInPeriod("US", d("2026-11-01"), d("2026-11-30"));
    expect(events.find((e) => e.name === "Thanksgiving")?.date).toBe("2026-11-26");
    expect(events.find((e) => e.name === "Black Friday")?.date).toBe("2026-11-27");
  });
  it("skips events that do not apply to the region", () => {
    const events = eventsInPeriod("ID", d("2026-07-01"), d("2026-08-31"));
    expect(events.map((e) => e.name)).toContain("Independence Day (Indonesia)");
    expect(events.map((e) => e.name)).not.toContain("Independence Day (USA)");
  });
  it("sets the upload deadline before the event", () => {
    const [halloween] = eventsInPeriod("US", d("2026-10-31"), d("2026-10-31"));
    expect(halloween.uploadBy < halloween.date).toBe(true);
  });
  it("spans the year boundary", () => {
    const names = eventsInPeriod("US", d("2026-12-01"), d("2027-02-28")).map((e) => e.name);
    expect(names).toContain("Christmas");
    expect(names).toContain("Valentine's Day");
  });
});
