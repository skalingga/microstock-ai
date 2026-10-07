import { describe, expect, it } from "vitest";
import { svgRequestSchema } from "@/lib/generate/schemas";
import { orderForKind } from "@/lib/providers";
import { fetchModelCatalog } from "@/lib/providers/kenari-pricing";

const order = [
  { provider: "kenari" as const, model: "deepseek-v4-flash" },
  { provider: "gemini" as const, model: "g" },
];

describe("orderForKind with a chosen model", () => {
  it("runs only the chosen Kenari model for SVG calls", () => {
    expect(orderForKind(order, "svg", "", "vendor/model:free")).toEqual([{ provider: "kenari", model: "vendor/model:free" }]);
  });
  it("ignores the choice for concepts and metadata", () => {
    expect(orderForKind(order, "metadata", "", "vendor/model:free")).toEqual(order);
  });
  it("keeps the saved order when nothing is chosen", () => {
    expect(orderForKind(order, "svg", "cheap")).toEqual(order);
  });
});

describe("svgRequestSchema model", () => {
  const base = { theme: "winter", style: "icon_set", concept: { subject: "a", composition: "b", palette: [] } };
  it("accepts Kenari style ids", () => {
    expect(svgRequestSchema.safeParse({ ...base, model: "vendor/model-1.5:free" }).success).toBe(true);
    expect(svgRequestSchema.safeParse(base).success).toBe(true);
  });
  it("rejects odd input", () => {
    expect(svgRequestSchema.safeParse({ ...base, model: "a b; drop" }).success).toBe(false);
    expect(svgRequestSchema.safeParse({ ...base, model: "x".repeat(200) }).success).toBe(false);
  });
});

describe("fetchModelCatalog", () => {
  it("lists free models first with prices per million tokens", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "paid-b", pricing: { input: 2_000_000_000, output: 8_000_000_000 } },
            { id: "free-a:free" },
            { id: "paid-a", pricing: { input: 1_000_000_000, output: 4_000_000_000 } },
          ],
        }),
      )) as unknown as typeof fetch;
    const models = await fetchModelCatalog({ fetchImpl, baseUrl: "https://x.test/v1" });
    expect(models.map((m) => m.id)).toEqual(["free-a:free", "paid-a", "paid-b"]);
    expect(models[1]).toMatchObject({ free: false, inPerMTokIdr: 1000, outPerMTokIdr: 4000 });
  });
  it("returns an empty list when Kenari is unreachable", async () => {
    const fetchImpl = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect(await fetchModelCatalog({ fetchImpl })).toEqual([]);
  });
});
