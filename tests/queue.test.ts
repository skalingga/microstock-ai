import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/generate/client";
import { RateGate, callWithRetry, type Sleep } from "@/lib/generate/queue";

// A fake clock: sleeping just moves time forward, so tests run instantly.
function clock(start = 1_000_000) {
  let t = start;
  const waits: number[] = [];
  const sleep: Sleep = async (ms) => {
    waits.push(ms);
    t += ms;
  };
  return { now: () => t, sleep, waits };
}

describe("RateGate", () => {
  it("spaces consecutive calls", async () => {
    const c = clock();
    const gate = new RateGate(1000, c.now, c.sleep);
    await gate.acquire();
    await gate.acquire();
    expect(c.waits).toEqual([1000]);
  });

  it("waits for the quota window to reset when none is left", async () => {
    const c = clock();
    const gate = new RateGate(0, c.now, c.sleep);
    gate.update({ limit: 5, remaining: 0, resetAt: c.now() + 20_000 });
    await gate.acquire();
    expect(c.waits[0]).toBe(20_500);
  });

  it("does not wait while quota remains", async () => {
    const c = clock();
    const gate = new RateGate(0, c.now, c.sleep);
    gate.update({ limit: 5, remaining: 3, resetAt: c.now() + 20_000 });
    await gate.acquire();
    expect(c.waits).toEqual([]);
  });

  it("counts down its own estimate between responses", async () => {
    const c = clock();
    const gate = new RateGate(0, c.now, c.sleep);
    gate.update({ remaining: 1, resetAt: c.now() + 10_000 });
    await gate.acquire(); // uses the last slot
    await gate.acquire(); // must wait for the reset
    expect(c.waits).toEqual([10_500]);
  });

  it("honors an explicit block from a 429", async () => {
    const c = clock();
    const gate = new RateGate(0, c.now, c.sleep);
    gate.block(15);
    await gate.acquire();
    expect(c.waits).toEqual([15_000]);
  });
});

describe("callWithRetry", () => {
  const setup = () => {
    const c = clock();
    return { c, gate: new RateGate(0, c.now, c.sleep), base: { sleepImpl: c.sleep, retryDelayMs: 10 } };
  };

  it("returns the value on success", async () => {
    const { gate, base } = setup();
    expect(await callWithRetry(async () => "ok", { gate, ...base })).toBe("ok");
  });

  it("waits out a rate limit and tries again without using an attempt", async () => {
    const { c, gate, base } = setup();
    let calls = 0;
    const result = await callWithRetry(
      async () => {
        calls += 1;
        if (calls <= 2) throw new ApiError("rate_limit", "limit", 12);
        return "ok";
      },
      { gate, maxAttempts: 1, ...base },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
    expect(c.waits.filter((w) => w === 12_000)).toHaveLength(2);
  });

  it("retries timeouts and bad output, then gives up after maxAttempts", async () => {
    const { gate, base } = setup();
    let calls = 0;
    await expect(
      callWithRetry(
        async () => {
          calls += 1;
          throw new ApiError("bad_output", "no svg");
        },
        { gate, maxAttempts: 3, ...base },
      ),
    ).rejects.toMatchObject({ code: "bad_output" });
    expect(calls).toBe(3);
  });

  it("asks the server to skip the primary provider after a timeout", async () => {
    const { gate, base } = setup();
    const seen: boolean[] = [];
    const result = await callWithRetry(
      async ({ skipPrimary }) => {
        seen.push(skipPrimary);
        if (seen.length === 1) throw new ApiError("upstream", "502");
        if (seen.length === 2) throw new ApiError("timeout", "slow");
        return "ok";
      },
      { gate, maxAttempts: 3, ...base },
    );
    expect(result).toBe("ok");
    expect(seen).toEqual([false, false, true]);
  });

  it("does not retry errors that retrying cannot fix", async () => {
    const { gate, base } = setup();
    for (const code of ["banned_words", "auth", "model_unavailable", "storage"] as const) {
      let calls = 0;
      await expect(
        callWithRetry(
          async () => {
            calls += 1;
            throw new ApiError(code, "x");
          },
          { gate, maxAttempts: 3, ...base },
        ),
      ).rejects.toMatchObject({ code });
      expect(calls).toBe(1);
    }
  });

  it("stops waiting on a rate limit that never clears", async () => {
    const { gate, base } = setup();
    await expect(
      callWithRetry(
        async () => {
          throw new ApiError("rate_limit", "limit", 1);
        },
        { gate, maxRateLimitWaits: 2, ...base },
      ),
    ).rejects.toMatchObject({ code: "rate_limit" });
  });
});
