import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/providers/errors";
import { resolveProvider, runWithFallback, type UsageEntry } from "@/lib/providers";
import { GeminiProvider, fetchGeminiModels } from "@/lib/providers/gemini";
import { KenariProvider, readRateLimit } from "@/lib/providers/kenari";
import type { ConceptInput, SvgInput, SvgProvider } from "@/lib/providers/types";

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

  it("parses metadata JSON, accepting keywords as a comma separated string", async () => {
    const json = JSON.stringify({ title: "Orange pumpkin", keywords: "pumpkin, autumn, harvest", category: "Graphic resources", needs_release: false });
    const out = await kenari((async () => reply(`Here you go:
${json}`)) as unknown as typeof fetch).generateMetadata({
      theme: "autumn",
      style: "icon_set",
      concept: "A pumpkin.",
    });
    expect(out.metadata).toEqual({
      title: "Orange pumpkin",
      keywords: ["pumpkin", " autumn", " harvest"],
      category: "Graphic resources",
      needsRelease: false,
    });
  });

  it("reports unusable metadata as bad_output", async () => {
    const provider = kenari((async () => reply("{\"title\": \"\"}")) as unknown as typeof fetch);
    await expect(provider.generateMetadata({ theme: "a", style: "icon_set", concept: "b" })).rejects.toMatchObject({
      code: "bad_output",
    });
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

  it("falls back to Gemini on a rate limit and logs both calls", async () => {
    const log = vi.fn<(e: UsageEntry) => Promise<void>>(async () => {});
    const call = vi.fn(async (p: SvgProvider) => {
      if (p.id === "kenari") throw new ProviderError("rate_limit", "limit", { retryAfterSec: 9 });
      return { model: "gemini-model" };
    });
    const result = await runWithFallback(order, "svg", call, log);
    expect(result).toMatchObject({ provider: "gemini", model: "gemini-model" });
    expect(log).toHaveBeenNthCalledWith(1, expect.objectContaining({ provider: "kenari", ok: false }));
    expect(log).toHaveBeenNthCalledWith(2, expect.objectContaining({ provider: "gemini", ok: true }));
  });

  it("keeps the last rate limit when every provider is limited", async () => {
    const log = vi.fn<(e: UsageEntry) => Promise<void>>(async () => {});
    await expect(
      runWithFallback(order, "svg", async () => {
        throw new ProviderError("rate_limit", "limit", { retryAfterSec: 9 });
      }, log),
    ).rejects.toMatchObject({ code: "rate_limit", retryAfterSec: 9 });
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("skips the backup when too little request time is left, so the browser retries", async () => {
    let clock = 0;
    const call = vi.fn(async (p: SvgProvider) => {
      if (p.id === "kenari") {
        clock = 50_000; // the primary used most of the window before failing
        throw new ProviderError("timeout", "Kenari terlalu lama menjawab.");
      }
      return { model: "g" };
    });
    await expect(
      runWithFallback(order, "svg", call, async () => {}, undefined, { deadline: 57_000, now: () => clock }),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("still tries the backup when a fast failure leaves enough time", async () => {
    const call = vi.fn(async (p: SvgProvider) => {
      if (p.id === "kenari") throw new ProviderError("upstream", "502");
      return { model: "g" };
    });
    const result = await runWithFallback(order, "svg", call, async () => {}, undefined, { deadline: 57_000, now: () => 1_000 });
    expect(result.provider).toBe("gemini");
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
    const before = process.env.KENARI_DEFAULT_MODEL;
    delete process.env.KENARI_DEFAULT_MODEL;
    try {
      await expect(
        runWithFallback([{ provider: "kenari", model: "" }], "svg", async () => ({ model: "x" }), async () => {}),
      ).rejects.toMatchObject({ code: "model_unavailable" });
    } finally {
      if (before !== undefined) process.env.KENARI_DEFAULT_MODEL = before;
    }
  });
});

import { orderForKind, withoutPrimary } from "@/lib/providers";

describe("orderForKind", () => {
  const order = [
    { provider: "kenari" as const, model: "deepseek-v4-flash" },
    { provider: "gemini" as const, model: "g" },
  ];

  it("uses the text model for concepts and metadata on Kenari only", () => {
    expect(orderForKind(order, "metadata", "gpt-oss-120b")).toEqual([
      { provider: "kenari", model: "gpt-oss-120b" },
      { provider: "gemini", model: "g" },
    ]);
    expect(orderForKind(order, "concepts", " gpt-oss-120b ")[0].model).toBe("gpt-oss-120b");
  });

  it("keeps the order for SVG calls and when no text model is set", () => {
    expect(orderForKind(order, "svg", "gpt-oss-120b")).toBe(order);
    expect(orderForKind(order, "metadata", "  ")).toBe(order);
  });
});

describe("withoutPrimary", () => {
  it("drops the primary only when a backup exists", () => {
    const one = [{ provider: "kenari" as const, model: "a" }];
    const two = [...one, { provider: "gemini" as const, model: "" }];
    expect(withoutPrimary(two)).toEqual([{ provider: "gemini", model: "" }]);
    expect(withoutPrimary(one)).toBe(one);
  });
});

describe("GeminiProvider", () => {
  function gemini(fetchImpl: typeof fetch) {
    return new GeminiProvider("gemini-test", { apiKey: "g-test", baseUrl: "https://gemini.test/openai/", fetchImpl });
  }
  const geminiError = (status: number, message: string, extra = "") =>
    new Response(`[{"error": {"code": ${status}, "message": "${message}"${extra}}}]`, { status });

  it("calls the OpenAI-compatible endpoint with low reasoning and costs nothing", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: SVG }, finish_reason: "stop" }],
          usage: { prompt_tokens: 100, completion_tokens: 900 },
        }),
      ),
    );
    const out = await gemini(fetchImpl as unknown as typeof fetch).generateSvg(svgInput);
    expect(out).toMatchObject({ svg: SVG, model: "gemini-test", costIdr: undefined });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gemini.test/openai/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer g-test");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "gemini-test", reasoning_effort: "low" });
  });

  it("reads the retry delay from a 429 body", async () => {
    const body = ', "status": "RESOURCE_EXHAUSTED", "details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "42s"}]';
    const provider = gemini((async () => geminiError(429, "quota", body)) as unknown as typeof fetch);
    await expect(provider.generateSvg(svgInput)).rejects.toMatchObject({ code: "rate_limit", retryAfterSec: 42 });
  });

  it.each([
    [404, "models/gemini-x is not found for API version v1main", "model_unavailable"],
    [400, "Please pass a valid API key", "auth"],
    [400, "Thinking level MINIMAL is not supported for this model.", "upstream"],
    [503, "The model is overloaded.", "upstream"],
  ])("maps HTTP %i (%s) to %s", async (status, message, code) => {
    const provider = gemini((async () => geminiError(status, message)) as unknown as typeof fetch);
    await expect(provider.generateSvg(svgInput)).rejects.toMatchObject({ code });
  });

  it("names GEMINI_API_KEY when the key is missing", async () => {
    const provider = new GeminiProvider("m", { apiKey: "", fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(provider.generateSvg(svgInput)).rejects.toMatchObject({
      code: "auth",
      message: expect.stringContaining("GEMINI_API_KEY"),
    });
  });

  it("uses the built-in model when settings and env are empty", () => {
    const before = process.env.GEMINI_DEFAULT_MODEL;
    delete process.env.GEMINI_DEFAULT_MODEL;
    try {
      expect(resolveProvider({ provider: "gemini", model: "" }).model).toBe("gemini-3.5-flash");
      expect(resolveProvider({ provider: "gemini", model: "gemini-3.5-flash-lite" }).model).toBe("gemini-3.5-flash-lite");
    } finally {
      if (before !== undefined) process.env.GEMINI_DEFAULT_MODEL = before;
    }
  });
});

describe("fetchGeminiModels", () => {
  it("keeps only text models, without the models/ prefix, newest first", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "models/gemini-2.5-flash" },
            { id: "models/gemini-3.5-flash" },
            { id: "models/gemini-3.8-flash-tts" },
            { id: "models/gemini-3.1-flash-image" },
            { id: "models/gemini-embedding-2" },
            { id: "models/gemini-3.10-flash" },
          ],
        }),
      )) as unknown as typeof fetch;
    expect(await fetchGeminiModels({ apiKey: "k", fetchImpl })).toEqual([
      "gemini-3.10-flash",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
    ]);
  });

  it("returns nothing without a key", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchGeminiModels({ apiKey: "", fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
