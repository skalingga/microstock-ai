import { describe, expect, it, vi } from "vitest";
import { photoMetadataRequestSchema, photoPromptsRequestSchema } from "@/lib/generate/schemas";
import { normalizePhotoMetadata } from "@/lib/metadata/postprocess";
import { visionOrder } from "@/lib/providers";
import { GeminiProvider } from "@/lib/providers/gemini";
import { isIconSetPrompt } from "@/lib/photo/config";
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

describe("photo file names and gallery filter", () => {
  it("names photos .jpg within Adobe's 30 characters", async () => {
    const { makeFilename } = await import("@/lib/export/slug");
    const name = makeFilename("Two hikers walking through a misty old growth forest", "0f8fad5b-d9cb-469f-a165-70867728950e", new Set(), ".jpg");
    expect(name.endsWith(".jpg")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(30);
  });

  it("carries the kind filter in the query and back", async () => {
    const { galleryQuery, parseGalleryFilter } = await import("@/app/(app)/aset/filters");
    const filter = parseGalleryFilter({ jenis: "foto" });
    expect(filter.kind).toBe("foto");
    expect(galleryQuery(filter)).toBe("jenis=foto");
    expect(parseGalleryFilter({ jenis: "video" }).kind).toBe("semua");
  });
});

describe("illustration variant", () => {
  const base = { theme: "retro motorcycle", count: 6, aspect: "1:1" as const, variant: "illustration" as const };

  it("writes specific, text-free, name-free illustration prompts in the chosen look", () => {
    const { system, user } = photoPromptsPrompt({ ...base, illustrationStyle: "watercolor", avoid: ["cute cat sticker"] });
    expect(system).toContain("raster illustrations");
    expect(user).toContain("exactly 6 prompts");
    expect(user).toContain("1:1");
    expect(user).toMatch(/watercolor illustration/);
    expect(user).toMatch(/No text anywhere/);
    expect(user).toMatch(/in the style of/);
    expect(user).toContain("cute cat sticker");
    expect(user).not.toMatch(/fictional ordinary adults/);
  });

  it("falls back to the sticker look and keeps one subject for variations", () => {
    const { user } = photoPromptsPrompt({ ...base, variations: true });
    expect(user).toMatch(/die-cut border/);
    expect(user).toContain("ONE subject");
  });

  it("writes one-line icon sheet prompts with six named icons and no writing", () => {
    const { system, user } = photoPromptsPrompt({ ...base, aspect: "16:9", illustrationStyle: "icon_set_3d", avoid: ["generic briefcase"] });
    expect(system).toContain("icon sheets");
    expect(user).toContain("exactly 6 prompts");
    expect(user).toContain("exactly 6 different icons");
    expect(user).toContain("6 icons in one frame:");
    expect(user).toMatch(/ONE single line/);
    expect(user).toMatch(/No text anywhere/);
    expect(user).toMatch(/ID badges, certificates/);
    // The image model draws divider lines and card panels when the prompt says "grid"; the sheet must be one white field.
    expect(user).toMatch(/no grid lines, no dividers, no panels, no cards, no frames/);
    expect(user).not.toMatch(/evenly spaced grid/);
    expect(user).toMatch(/Never use these at all: clocks, watches, rulers, compasses/);
    // 15 Oct 2026 review of 9 sheets: organs and hands, gray floors, icons touching the edge, repeated stock objects.
    expect(user).toMatch(/No hands, people, faces, body parts, organs, bones/);
    expect(user).toMatch(/generous margin of about 10 percent/);
    expect(user).toMatch(/no gray, no tint\), no floor shadows/);
    expect(user).toMatch(/microchip, battery, power plug, gear/);
    expect(user).toMatch(/clearly recognizable everyday object/);
    expect(user).toContain("generic briefcase");
    expect(user).not.toContain("ONE subject");
  });

  it("keeps one topic for icon sheet variations and spots a sheet prompt for metadata", () => {
    const { user } = photoPromptsPrompt({ ...base, illustrationStyle: "icon_set_3d", variations: true });
    expect(user).toContain("ONE topic");
    const prompt = "3D business icons, 6 icons in one frame: rocket, lightbulb, target, coin stack, gear, chart";
    expect(photoMetadataPrompt({ theme: "business", variant: "illustration", prompt }).user).toContain("sheet of several separate 3D icons");
    expect(photoMetadataPrompt({ theme: "business", variant: "illustration", prompt: "a sticker of a cat" }).user).not.toContain("sheet of several");
    expect(isIconSetPrompt(prompt)).toBe(true);
    expect(isIconSetPrompt("a retro motorcycle sticker")).toBe(false);
  });

  it("asks for illustration search words and bans the word vector", () => {
    const { user } = photoMetadataPrompt({ theme: "motorcycle", variant: "illustration" });
    expect(user).toContain("raster");
    expect(user).toContain('Never use the word "vector"');
    expect(photoMetadataPrompt({ theme: "motorcycle" }).user).not.toContain("raster");
  });

  it("accepts the variant and a known style in requests, and rejects an unknown style", () => {
    const req = { theme: "forest", count: 5, aspect: "1:1", variant: "illustration" };
    expect(photoPromptsRequestSchema.parse({ ...req, illustrationStyle: "sticker" }).illustrationStyle).toBe("sticker");
    expect(photoPromptsRequestSchema.safeParse({ ...req, illustrationStyle: "oil" }).success).toBe(false);
    expect(photoMetadataRequestSchema.parse({ theme: "forest", image: IMAGE, variant: "illustration" }).variant).toBe("illustration");
  });

  it("stores variant and style in the job; old jobs stay photos", async () => {
    const { parsePhotoJob } = await import("@/lib/photo/run");
    const row = { aspect: "1:1", model: "m", provider: "gemini", prompts: [{ subject: "a", prompt: "b" }] };
    const job = parsePhotoJob({ ...row, variant: "illustration", illustrationStyle: "flat" });
    expect(job?.variant).toBe("illustration");
    expect(job?.illustrationStyle).toBe("flat");
    expect(parsePhotoJob({ ...row, variant: "illustration", illustrationStyle: "oil" })?.illustrationStyle).toBeUndefined();
    expect(parsePhotoJob(row)?.variant).toBe("photo");
  });

  it("filters and labels illustrations", async () => {
    const { parseGalleryFilter, galleryQuery, photoLabel } = await import("@/app/(app)/aset/filters");
    expect(parseGalleryFilter({ jenis: "ilustrasi" }).kind).toBe("ilustrasi");
    expect(galleryQuery(parseGalleryFilter({ jenis: "ilustrasi" }))).toBe("jenis=ilustrasi");
    expect(photoLabel("illustration")).toBe("Ilustrasi");
    expect(photoLabel(null)).toBe("Foto");
  });

  it("notes what to check by hand on a clean illustration", async () => {
    const { photoContentNotes } = await import("@/lib/qc/photo");
    const notes = photoContentNotes([], false, "illustration");
    expect(notes[0].message).toMatch(/die-cut/);
  });
});

describe("background variant", () => {
  const base = { theme: "technology background", count: 6, aspect: "16:9" as const };

  it("writes subject-less, specific, text-free background prompts", () => {
    const { system, user } = photoPromptsPrompt({ ...base, variant: "background", avoid: ["blue abstract gradient"] });
    expect(system).toContain("background images");
    expect(user).toContain("exactly 6 prompts");
    expect(user).toContain("16:9");
    expect(user).toMatch(/No people, no animals/);
    expect(user).toMatch(/No text anywhere/);
    expect(user).toMatch(/calm and uncluttered/);
    expect(user).toContain("blue abstract gradient");
    expect(user).not.toMatch(/fictional ordinary adults/);
  });

  it("keeps one design direction for variations", () => {
    const { user } = photoPromptsPrompt({ ...base, variant: "background", variations: true });
    expect(user).toContain("ONE design direction");
  });

  it("leaves the photo prompt untouched by default", () => {
    const { user } = photoPromptsPrompt(base);
    expect(user).toMatch(/fictional/);
    expect(user).not.toMatch(/design direction/);
  });

  it("asks for background search words in the metadata", () => {
    const { user } = photoMetadataPrompt({ theme: "tech", variant: "background" });
    expect(user).toContain("copy space");
    expect(user).toContain("backdrop");
    expect(photoMetadataPrompt({ theme: "tech" }).user).not.toContain("backdrop");
  });

  it("accepts the variant in requests and defaults to photo", () => {
    expect(photoPromptsRequestSchema.parse({ theme: "forest", count: 5, aspect: "16:9" }).variant).toBe("photo");
    expect(photoPromptsRequestSchema.parse({ theme: "forest", count: 5, aspect: "16:9", variant: "background" }).variant).toBe("background");
    expect(photoPromptsRequestSchema.safeParse({ theme: "forest", count: 5, aspect: "16:9", variant: "video" }).success).toBe(false);
    expect(photoMetadataRequestSchema.parse({ theme: "forest", image: IMAGE }).variant).toBe("photo");
  });

  it("stores the variant in the job and treats old jobs as photos", async () => {
    const { parsePhotoJob } = await import("@/lib/photo/run");
    const row = { aspect: "16:9", model: "m", provider: "gemini", prompts: [{ subject: "a", prompt: "b" }] };
    expect(parsePhotoJob({ ...row, variant: "background" })?.variant).toBe("background");
    expect(parsePhotoJob(row)?.variant).toBe("photo");
    expect(parsePhotoJob({ ...row, variant: "other" })?.variant).toBe("photo");
  });

  it("is looser about similarity, and flags people in a background", async () => {
    const { photoTechNotes, photoContentNotes } = await import("@/lib/qc/photo");
    const facts = { width: 2752, height: 1536, bytes: 1_000_000, converted: false };
    // 4 bits apart out of 40 set bits: "alike" for a photo (limit 8), but ordinary for two smooth backgrounds (limit 3).
    const a = "ffffffffff000000";
    const b = "ffffffffc3000000";
    const pool = [{ id: "other", phash: b }];
    const status = (variant: "photo" | "background") =>
      photoTechNotes(facts, a, pool, "self", variant).find((n) => n.check === "kemiripan")?.status;
    expect(status("photo")).toBe("cek");
    expect(status("background")).toBe("ok");
    const people = photoContentNotes([], true, "background");
    expect(people.find((n) => n.check === "orang")?.status).toBe("cek");
  });

  it("does not flag two icon sheets 6 bits apart, but still flags a near copy", async () => {
    const { photoTechNotes } = await import("@/lib/qc/photo");
    const facts = { width: 2752, height: 1536, bytes: 200_000, converted: false };
    const a = "ffffffffff000000";
    const sixApart = "ffffffff03000000"; // 6 bits differ: same 3x2 layout, different icons
    const twoApart = "fffffffffc000000";
    const status = (other: string) =>
      photoTechNotes(facts, a, [{ id: "o", phash: other }], "self", "illustration").find((n) => n.check === "kemiripan")?.status;
    expect(status(sixApart)).toBe("ok");
    expect(status(twoApart)).toBe("cek");
  });

  it("tells a plain white icon sheet from a gray one by its border", async () => {
    const { borderColor, sheetBackgroundNote, photoTechNotes } = await import("@/lib/qc/photo");
    const make = (w: number, h: number, rgb: [number, number, number], inner: [number, number, number]) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const edge = x < 3 || y < 3 || x >= w - 3 || y >= h - 3;
          const c = edge ? rgb : inner;
          const i = (y * w + x) * 4;
          data[i] = c[0];
          data[i + 1] = c[1];
          data[i + 2] = c[2];
          data[i + 3] = 255;
        }
      }
      return { data, width: w, height: h };
    };
    const white = borderColor(make(100, 56, [254, 254, 254], [20, 120, 200]), 0.05);
    expect(Math.round(white.r)).toBe(254);
    expect(sheetBackgroundNote(white).status).toBe("ok");

    const gray = borderColor(make(100, 56, [239, 240, 241], [255, 255, 255]), 0.05);
    expect(sheetBackgroundNote(gray).status).toBe("cek");
    const tinted = borderColor(make(100, 56, [240, 246, 252], [255, 255, 255]), 0.05);
    expect(sheetBackgroundNote(tinted).status).toBe("cek");

    const facts = { width: 2752, height: 1536, bytes: 200_000, converted: false };
    const withSheet = photoTechNotes(facts, "ffffffffff000000", [], "self", "illustration", gray);
    expect(withSheet.find((n) => n.check === "latar")?.status).toBe("cek");
    // Without a sheet border (stickers, ordinary photos) there is no background check.
    expect(photoTechNotes(facts, "ffffffffff000000", [], "self", "illustration").some((n) => n.check === "latar")).toBe(false);
  });
});
