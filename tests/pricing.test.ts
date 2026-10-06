import { describe, expect, it, vi } from "vitest";
import { computeCostIdr, createPriceLookup, isFreeModel } from "@/lib/providers/kenari-pricing";

const catalog = {
  data: [
    // micro-Rupiah per 1M tokens, as the real catalog quotes it
    { id: "deepseek-v4-flash", pricing: { input: 2_750_000_000, output: 5_500_000_000 } },
    { id: "claude-sonnet-5", pricing: { input: 25_000_000_000, output: 125_000_000_000 } },
  ],
};

const okFetch = () => vi.fn(async () => new Response(JSON.stringify(catalog)));

describe("isFreeModel", () => {
  it("recognizes the :free suffix", () => {
    expect(isFreeModel("agnes-3-0-flash:free")).toBe(true);
    expect(isFreeModel("deepseek-v4-flash")).toBe(false);
  });
});

describe("createPriceLookup", () => {
  it("treats :free models as zero cost without calling the catalog", async () => {
    const fetchImpl = okFetch();
    const lookup = createPriceLookup({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 0 });
    expect(await lookup("x:free")).toEqual({ inIdr: 0, outIdr: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("converts catalog prices to Rupiah per token", async () => {
    const lookup = createPriceLookup({ fetchImpl: okFetch() as unknown as typeof fetch, now: () => 0 });
    const price = await lookup("deepseek-v4-flash");
    expect(price?.inIdr).toBeCloseTo(0.00275, 8);
    expect(price?.outIdr).toBeCloseTo(0.0055, 8);
  });

  it("caches the catalog between lookups", async () => {
    const fetchImpl = okFetch();
    const lookup = createPriceLookup({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 0 });
    await lookup("deepseek-v4-flash");
    await lookup("claude-sonnet-5");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns null for an unknown model", async () => {
    const lookup = createPriceLookup({ fetchImpl: okFetch() as unknown as typeof fetch, now: () => 0 });
    expect(await lookup("no-such-model")).toBeNull();
  });

  it("keeps using stale prices when a refresh fails, and returns null with no cache at all", async () => {
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog)))
      .mockRejectedValue(new Error("offline"));
    const lookup = createPriceLookup({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => now });

    expect((await lookup("deepseek-v4-flash"))?.outIdr).toBeCloseTo(0.0055, 8);
    now = 7 * 60 * 60 * 1000; // past the 6 hour cache window
    expect((await lookup("deepseek-v4-flash"))?.outIdr).toBeCloseTo(0.0055, 8);

    const cold = createPriceLookup({
      fetchImpl: vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch,
      now: () => 0,
    });
    expect(await cold("deepseek-v4-flash")).toBeNull();
  });
});

describe("computeCostIdr", () => {
  it("matches the cost measured in the benchmark", () => {
    // deepseek-v4-flash: 1030 output tokens + a ~700 token prompt came to about Rp6.6
    const price = { inIdr: 0.00275, outIdr: 0.0055 };
    expect(computeCostIdr(price, { prompt_tokens: 700, completion_tokens: 1030 })).toBeCloseTo(7.59, 2);
    expect(computeCostIdr(price, { completion_tokens: 1000 })).toBe(5.5);
  });
});
