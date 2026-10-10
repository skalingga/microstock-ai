import { describe, expect, it, vi } from "vitest";
import { photoMetadataRequestSchema, photoPromptsRequestSchema } from "@/lib/generate/schemas";
import { normalizePhotoMetadata } from "@/lib/metadata/postprocess";
import { visionOrder } from "@/lib/providers";
import { GeminiProvider } from "@/lib/providers/gemini";
import { photoMetadataPrompt, photoPromptsPrompt } from "@/lib/providers/prompts";

const IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

function reply(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }), { status: 200 });
}

function gemini(fetchImpl: typeof fetch) {
  return new GeminiProvider("gemini-test", { apiKey: "g-test", baseUrl: "https://example.test/v1beta/openai", fetchImpl });
}

describe("photoPromptsPrompt", () => {
  it("asks for fictional people, no text, and the avoid list", () => {
    const { user } = photoPromptsPrompt({ theme: "forest hiking", count: 5, aspect: "16:9", avoid: ["therapy session on sofa"] });
    expect(user).toContain("exactly 5 prompts");
    expect(user).toContain("16:9");
    expect(user).toMatch(/fictional/);
    expect(user).toMatch(/No text anywhere/);
    expect(user).toContain("therapy session on sofa");
  });

  it("switches to one subject for variations", () => {
    expect(photoPromptsPrompt({ theme: "t", count: 3, aspect: "1:1", variations: true }).user).toContain("ONE subject");
  });
});

describe("photoMetadataPrompt", () => {
  it("lists the problem ids and includes the prompt when known", () => {
    const { user } = photoMetadataPrompt({ theme: "therapy", prompt: "Two people talk in a bright room" });
    expect(user).toContain("visible_text");
    expect(user).toContain("deformed_people");
    expect(user).toContain("Two people talk");
  });
});

describe("GeminiProvider photos", () => {
  it("writes photo prompts", async () => {
    const json = JSON.stringify({
      prompts: [
        { subject: "hikers in misty forest", prompt: "A cinematic wide shot of two hikers walking a dirt trail through a misty old forest at sunrise." },
      ],
    });
    const out = await gemini(vi.fn(async () => reply(json)) as unknown as typeof fetch).generatePhotoPrompts({
      theme: "forest",
      count: 1,
      aspect: "16:9",
    });
    expect(out.prompts).toHaveLength(1);
    expect(out.prompts[0].subject).toBe("hikers in misty forest");
  });

  it("sends the image as an image_url part and keeps only known problems", async () => {
    const json = JSON.stringify({
      title: "Therapist listening to a client",
      keywords: ["therapy", "counseling"],
      category: "People",
      has_people: true,
      problems: ["visible_text", "Deformed_People", "made_up"],
    });
    const fetchImpl = vi.fn(async () => reply(json));
    const out = await gemini(fetchImpl as unknown as typeof fetch).generatePhotoMetadata({ theme: "therapy", image: IMAGE });

    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    const parts = body.messages[1].content;
    expect(parts[0].type).toBe("text");
    expect(parts[1]).toEqual({ type: "image_url", image_url: { url: IMAGE } });

    expect(out.metadata.hasPeople).toBe(true);
    expect(out.metadata.needsRelease).toBe(false);
    expect(out.metadata.problems).toEqual(["visible_text", "deformed_people"]);
  });
});

describe("visionOrder", () => {
  it("keeps only Gemini, or falls back to the default Gemini model", () => {
    expect(
      visionOrder([
        { provider: "kenari", model: "deepseek-v4-flash" },
        { provider: "gemini", model: "gemini-3.5-flash-lite" },
      ]),
    ).toEqual([{ provider: "gemini", model: "gemini-3.5-flash-lite" }]);
    expect(visionOrder([{ provider: "kenari", model: "x" }])).toEqual([{ provider: "gemini", model: "" }]);
  });
});

describe("normalizePhotoMetadata", () => {
  it("drops AI words, keeps icon-free photo keywords, and leaves an unknown category empty", () => {
    const { metadata, notes } = normalizePhotoMetadata(
      {
        title: "AI generated hikers, misty forest",
        keywords: ["hikers", "generative ai", "forest", "Forest"],
        category: "Nature",
        needsRelease: false,
        hasPeople: true,
        problems: [],
      },
      [],
    );
    expect(metadata.title).toBe("hikers misty forest");
    expect(metadata.keywords).toEqual(["hikers", "forest"]);
    expect(metadata.category).toBe("");
    expect(notes.some((n) => n.includes("pilih sendiri"))).toBe(true);
  });

  it("keeps a valid category", () => {
    const { metadata } = normalizePhotoMetadata(
      { title: "Hikers", keywords: ["hikers"], category: "Travel", needsRelease: false, hasPeople: true, problems: [] },
      [],
    );
    expect(metadata.category).toBe("Travel");
  });
});

describe("photo request schemas", () => {
  it("accepts a JPEG data URL only", () => {
    expect(photoMetadataRequestSchema.safeParse({ theme: "forest", image: IMAGE }).success).toBe(true);
    expect(photoMetadataRequestSchema.safeParse({ theme: "forest", image: "data:image/png;base64,AAAA" }).success).toBe(false);
  });

  it("limits prompts and aspect ratios", () => {
    expect(photoPromptsRequestSchema.safeParse({ theme: "forest", count: 20, aspect: "4:3" }).success).toBe(true);
    expect(photoPromptsRequestSchema.safeParse({ theme: "forest", count: 21, aspect: "4:3" }).success).toBe(false);
    expect(photoPromptsRequestSchema.safeParse({ theme: "forest", count: 5, aspect: "21:9" }).success).toBe(false);
  });
});

describe("photo QC", () => {
  it("refuses 1K downloads and accepts the 2K sizes Flow gives", async () => {
    const { photoRejection } = await import("@/lib/qc/photo");
    expect(photoRejection({ width: 1376, height: 768, bytes: 300_000 })).toMatch(/2K Upscale/);
    expect(photoRejection({ width: 2752, height: 1536, bytes: 1_000_000 })).toBeNull();
    expect(photoRejection({ width: 2400, height: 1792, bytes: 697_000 })).toBeNull();
    expect(photoRejection({ width: 2752, height: 1536, bytes: 50 * 1024 * 1024 })).toMatch(/batas Adobe/);
  });

  it("turns vision problems into Perlu cek notes and reminds about fictional people", async () => {
    const { photoContentNotes } = await import("@/lib/qc/photo");
    const { combine } = await import("@/lib/qc/evaluate");
    const notes = photoContentNotes(["visible_text"], true);
    expect(notes.map((n) => [n.check, n.status])).toEqual([
      ["isi", "cek"],
      ["orang", "ok"],
    ]);
    const meta = { title: "Therapist listening", keywords: ["therapy"], category: "People", needsRelease: false };
    expect(combine(notes, meta, []).status).toBe("perlu_cek");
    expect(combine(photoContentNotes([], true), meta, []).status).toBe("lolos");
  });
});

describe("parsePhotoJob", () => {
  it("reads the stored prompts and ignores broken rows", async () => {
    const { parsePhotoJob } = await import("@/lib/photo/run");
    const job = parsePhotoJob({ aspect: "16:9", model: "m", provider: "gemini", prompts: [{ subject: "a", prompt: "b" }, { subject: 1 }] });
    expect(job?.prompts).toEqual([{ subject: "a", prompt: "b" }]);
    expect(parsePhotoJob(null)).toBeNull();
    expect(parsePhotoJob([])).toBeNull();
  });
});
