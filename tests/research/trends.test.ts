import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTrendsCache, demandScores } from "@/lib/research/trends";

describe("demandScores", () => {
  beforeEach(() => clearTrendsCache());

  it("scores terms against the anchor", async () => {
    const fetcher = vi.fn().mockResolvedValue([[10, 10], [10, 10], [30, 30]]);
    const scores = await demandScores(["pumpkin", "acorn"], "US", fetcher);
    expect(scores.pumpkin).toBe(50);
    expect(scores.acorn).toBe(75);
    expect(fetcher).toHaveBeenCalledWith(["wallpaper", "pumpkin", "acorn"], "US");
  });

  it("serves repeat terms from the cache", async () => {
    const fetcher = vi.fn().mockResolvedValue([[10], [10]]);
    await demandScores(["pumpkin"], "US", fetcher);
    await demandScores(["pumpkin"], "US", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns nothing when Trends has no data", async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    expect(await demandScores(["pumpkin"], "US", fetcher)).toEqual({});
  });
});
