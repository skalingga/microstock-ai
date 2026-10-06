import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/providers/errors";
import { runWithFallback, type UsageEntry } from "@/lib/providers";
import { KenariProvider, readRateLimit } from "@/lib/providers/kenari";
import type { ConceptInput, SvgInput } from "@/lib/providers/types";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>';

function reply(content: string, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }), {
    status,
    headers,
  });
}

function kenari(fetchImpl: typeof fetch) {
  return new KenariProvider("test-model:free", { apiKey: "kn-test", baseUrl: "https://example.test/v1/", fetchImpl });
}

const conceptInput: ConceptInput = { theme: "autumn leaves", style: "icon_set", palette: ["#ff0000"], count: 2 };
const svgInput: SvgInput = {
  theme: "autumn leaves",
  style: "icon_set",
  concept: { subject: "maple leaf", composition: "centered", palette: ["#ff0000"] },
};

describe("readRateLimit", () => {
  it("reads Kenari headers and converts epoch seconds to milliseconds", () => {
    const rl = readRateLimit(
      new Headers({ "x-ratelimit-limit": "5", "x-ratelimit-remaining": "4", "x-ratelimit-reset": "1791288308" }),
    );
    expect(rl).toEqual({ limit: 5, remaining: 4, resetAt: 1791288308000 });
  });

  it("returns undefined when no headers are present", () => {
    expect(readRateLimit(new Headers())).toBeUndefined();
  });
});

describe("KenariProvider", () => {
  it("calls the OpenAI-compatible endpoint with the key and parses the svg", async () => {
    const fetchImpl = vi.fn(async () => reply(`\`\`\`svg\n${SVG}\n\`\`\``, { "x-ratelimit-remaining": "3" }));
    const out = await kenari(fetchImpl as unknown as typeof fetch).generateSvg(svgInput);

    expect(out.svg).toBe(SVG);
    expect(out.model).toBe("test-model:free");
    expect(out.rateLimit?.remaining).toBe(3);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer kn-test");
    expect(JSON.parse(init.body as string).model).toBe("test-model:free");
  });

  it("parses concepts and drops invalid colors", async () => {
    const json = JSON.stringify({
      concepts: [
        { subject: "maple leaf", composition: "centered", palette: ["#ff0000", "red", "#00ff00"] },
        { subject: "oak leaf", composition: "tilted", palette: [] },
        { subject: "third", composition: "extra", palette: [] },
      ],
    });
    const out = await kenari((async () => reply(`Sure!\n${json}`)) as unknown as typeof fetch).generateConcepts(conceptInput);
    expect(out.concepts).toHaveLength(2); // capped at the requested count
    expect(out.concepts[0].palette).toEqual(["#ff0000", "#00ff00"]);
  });

  it.each([
    [401, "auth"],
    [403, "auth"],
    [404, "model_unavailable"],
    [500, "upstream"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const provider = kenari((async () => new Response("{}", { status })) as unknown as typeof fetch);
    await expect(provider.generateSvg(svgInput)).rejects.toMatchObject({ code });
  });

  it("maps 429 to rate_limit with a retry delay", async () => {
    const provider = kenari((async () => new Response("{}", { status: 429, headers: { "retry-after": "17" } })) as unknown as typeof fetch);
    await expect(provider.generateSvg(svgInput)).rejects.toMatchObject({ code: "rate_limit", retryAfterSec: 17 });
  });

  it("maps a timeout to the timeout code", async () => {
    const provider = kenari((async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch);
    await expect(provider.generateSvg(svgInput)).rejects.toMatchObject({ code: "timeout" });
  });

  it("reports unusable replies as bad_output", async () => {
    await expect(kenari((async () => reply("I cannot draw that.")) as unknown as typeof fetch).generateSvg(svgInput)).rejects.toMatchObject({ code: "bad_output" });
    await expect(kenari((async () => reply("not json")) as unknown as typeof fetch).generateConcepts(conceptInput)).rejects.toMatchObject({ code: "bad_output" });
  });

  it("reports the Rupiah cost of a call from token usage and the live price", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: SVG }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1000, completion_tokens: 2000 },
          }),
        ),
    );
    const provider = new KenariProvider("paid-model", {
      apiKey: "kn-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      priceLookup: async () => ({ inIdr: 0.001, outIdr: 0.005 }),
    });
    expect((await provider.generateSvg(svgInput)).costIdr).toBe(11); // 1000*0.001 + 2000*0.005
  });

  it("leaves the cost undefined when the price is unknown", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: SVG } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }),
        ),
    );
    const provider = new KenariProvider("mystery", {
      apiKey: "kn-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      priceLookup: async () => null,
    });
    expect((await provider.generateSvg(svgInput)).costIdr).toBeUndefined();
  });

  it("fails clearly without an api key", async () => {
    const provider = new KenariProvider("m", { apiKey: "", fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(provider.generateSvg(svgInput)).rejects.toMatchObject({ code: "auth" });
  });
});

describe("runWithFallback", () => {
  const order = [
    { provider: "kenari" as const, model: "primary" },
    { provider: "gemini" as const, model: "" },
  ];

  it("returns the first provider's result and logs it", async () => {
    const log = vi.fn<(e: UsageEntry) => Promise<void>>(async () => {});
    const result = await runWithFallback(order, "svg", async () => ({ model: "primary" }), log);
    expect(result).toMatchObject({ provider: "kenari", model: "primary" });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ provider: "kenari", ok: true, kind: "svg" }));
  });

  it("logs a failed call and does not hide a rate limit when the next provider is not built yet", async () => {
    const log = vi.fn<(e: UsageEntry) => Promise<void>>(async () => {});
    await expect(
      runWithFallback(order, "svg", async () => {
        throw new ProviderError("rate_limit", "limit", { retryAfterSec: 9 });
      }, log),
    ).rejects.toMatchObject({ code: "rate_limit", retryAfterSec: 9 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ provider: "kenari", ok: false }));
  });

  it("does not fall back on errors another provider cannot fix", async () => {
    const log = vi.fn<(e: UsageEntry) => Promise<void>>(async () => {});
    await expect(
      runWithFallback(order, "svg", async () => {
        throw new ProviderError("bad_output", "no svg");
      }, log),
    ).rejects.toMatchObject({ code: "bad_output" });
  });

  it("refuses the call when the guard says the budget is used up, without logging", async () => {
    const log = vi.fn<(e: UsageEntry) => Promise<void>>(async () => {});
    const call = vi.fn(async () => ({ model: "paid" }));
    await expect(
      runWithFallback(
        order,
        "svg",
        call,
        log,
        async () => {
          throw new ProviderError("budget_exceeded", "habis");
        },
      ),
    ).rejects.toMatchObject({ code: "budget_exceeded" });
    expect(call).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("passes the model to the guard and records the cost of a successful call", async () => {
    const log = vi.fn<(e: UsageEntry) => Promise<void>>(async () => {});
    const guard = vi.fn(async () => {});
    await runWithFallback(order, "svg", async () => ({ model: "primary", costIdr: 6.5 }), log, guard);
    expect(guard).toHaveBeenCalledWith({ provider: "kenari", model: "primary" });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ ok: true, costIdr: 6.5 }));
  });

  it("explains when no provider is usable", async () => {
    await expect(
      runWithFallback([{ provider: "gemini", model: "" }], "svg", async () => ({ model: "x" }), async () => {}),
    ).rejects.toMatchObject({ code: "not_implemented" });
  });
});
