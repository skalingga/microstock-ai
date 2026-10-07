// @vitest-environment node
import Jimp from "jimp";
import { describe, expect, it, vi } from "vitest";
import { imageOrder, resolveProvider } from "@/lib/providers";
import { KenariImageProvider } from "@/lib/providers/kenari-image";
import { imagePriceIdr } from "@/lib/providers/kenari-image-pricing";
import { imagePrompt } from "@/lib/providers/prompts";
import type { SvgInput } from "@/lib/providers/types";

const input: SvgInput = {
  theme: "halloween",
  style: "silhouette",
  concept: { subject: "four flying bats", composition: "scattered, different sizes", palette: ["#000000"] },
};

async function blackSquarePng(): Promise<Buffer> {
  const size = 64;
  const data = Buffer.alloc(size * size * 4, 255);
  for (let y = 16; y < 48; y++) {
    for (let x = 16; x < 48; x++) data[(y * size + x) * 4] = data[(y * size + x) * 4 + 1] = data[(y * size + x) * 4 + 2] = 0;
  }
  return new Jimp({ data, width: size, height: size }).getBufferAsync(Jimp.MIME_PNG);
}

function provider(fetchImpl: typeof fetch, model = "gpt-image-2") {
  return new KenariImageProvider(model, { apiKey: "kn-test", baseUrl: "https://kenari.test/v1", fetchImpl });
}

describe("KenariImageProvider", () => {
  it("asks for one picture, traces it, and charges the per-image price", async () => {
    const png = await blackSquarePng();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] })));
    const out = await provider(fetchImpl as unknown as typeof fetch).generateSvg(input);

    expect(out.svg).toContain('<g id="silhouette">');
    expect(out).toMatchObject({ model: "gpt-image-2", costIdr: 125 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://kenari.test/v1/images/generations");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "gpt-image-2", n: 1 });
    expect(body.prompt).toContain("four flying bats");
    expect(body.prompt).toContain("pure white background");
  });

  it("downloads the picture when the reply carries a URL", async () => {
    const png = await blackSquarePng();
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/images/generations")
        ? new Response(JSON.stringify({ data: [{ url: "https://cdn.test/a.png" }] }))
        : new Response(new Uint8Array(png)),
    );
    const out = await provider(fetchImpl as unknown as typeof fetch).generateSvg(input);
    expect(out.svg).toContain("<path");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refuses an image model without a known price before calling Kenari", async () => {
    const fetchImpl = vi.fn();
    await expect(provider(fetchImpl as unknown as typeof fetch, "mystery-image").generateSvg(input)).rejects.toMatchObject({
      code: "model_unavailable",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses styles that a text model writes", async () => {
    const fetchImpl = vi.fn();
    await expect(
      provider(fetchImpl as unknown as typeof fetch).generateSvg({ ...input, style: "icon_set" }),
    ).rejects.toMatchObject({ code: "not_implemented" });
  });

  it.each([
    [400, '{"error":{"message":"Your request was rejected by the safety system"}}', "bad_output"],
    [402, "{}", "budget_exceeded"],
    [429, "{}", "rate_limit"],
    [401, "{}", "auth"],
    [500, "{}", "upstream"],
  ])("maps HTTP %i to %s", async (status, body, code) => {
    const fetchImpl = (async () => new Response(body, { status })) as unknown as typeof fetch;
    await expect(provider(fetchImpl).generateSvg(input)).rejects.toMatchObject({ code });
  });

  it("reports a reply without a picture, or a picture that is not an image", async () => {
    const empty = (async () => new Response(JSON.stringify({ data: [] }))) as unknown as typeof fetch;
    await expect(provider(empty).generateSvg(input)).rejects.toMatchObject({ code: "bad_output" });
    const junk = (async () => new Response(JSON.stringify({ data: [{ b64_json: "bm90IGFuIGltYWdl" }] }))) as unknown as typeof fetch;
    await expect(provider(junk).generateSvg(input)).rejects.toMatchObject({ code: "bad_output" });
  });

  it("maps a timeout", async () => {
    const fetchImpl = (async () => {
      throw new DOMException("slow", "TimeoutError");
    }) as unknown as typeof fetch;
    await expect(provider(fetchImpl).generateSvg(input)).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("imageOrder", () => {
  it("uses the settings model, then KENARI_IMAGE_MODEL, then gpt-image-2", () => {
    const before = process.env.KENARI_IMAGE_MODEL;
    delete process.env.KENARI_IMAGE_MODEL;
    try {
      expect(imageOrder("")).toEqual([{ provider: "kenari", model: "gpt-image-2", image: true }]);
      expect(imageOrder("nano-banana-2-lite")[0].model).toBe("nano-banana-2-lite");
      process.env.KENARI_IMAGE_MODEL = "hunyuan-image-v3.0";
      expect(imageOrder("")[0].model).toBe("hunyuan-image-v3.0");
    } finally {
      if (before === undefined) delete process.env.KENARI_IMAGE_MODEL;
      else process.env.KENARI_IMAGE_MODEL = before;
    }
  });

  it("takes a picked model only when it is a priced image model", () => {
    expect(imageOrder("", { provider: "kenari", model: "nano-banana-2-lite" })[0].model).toBe("nano-banana-2-lite");
    expect(imageOrder("gpt-image-2", { provider: "kenari", model: "deepseek-v4-flash" })[0].model).toBe("gpt-image-2");
    expect(imageOrder("gpt-image-2", { provider: "gemini", model: "gemini-3.5-flash-lite" })).toHaveLength(1);
  });

  it("resolves to the image adapter", () => {
    expect(resolveProvider({ provider: "kenari", model: "gpt-image-2", image: true }).provider).toBeInstanceOf(KenariImageProvider);
  });
});

describe("image prompt and pricing", () => {
  it("asks for black on white, without text, logos or real models", () => {
    const silhouette = imagePrompt({ ...input, style: "silhouette" });
    expect(silhouette).toMatch(/black silhouette/);
    expect(silhouette).toMatch(/no text/);
    expect(silhouette).toMatch(/not a specific real product, car model, brand/);
    expect(imagePrompt({ ...input, style: "line_art" })).toMatch(/no hatching/);
  });

  it("knows the default model's price", () => {
    expect(imagePriceIdr("gpt-image-2")).toBe(125);
    expect(imagePriceIdr("unknown")).toBeUndefined();
  });
});
