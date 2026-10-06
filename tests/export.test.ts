import { describe, expect, it } from "vitest";
import { ADOBE, ADOBE_CATEGORIES, categoryNumber, normalizeCategory } from "@/lib/adobe/rules";
import { applyArtboard, artboardFor } from "@/lib/export/artboard";
import { buildAdobeCsv, csvField, csvProblems } from "@/lib/export/csv";
import { makeFilename, slugify } from "@/lib/export/slug";

describe("slugify", () => {
  it("makes lowercase ascii slugs", () => {
    expect(slugify("Orange Pumpkin & Green Leaves!", 40)).toBe("orange-pumpkin-green-leaves");
    expect(slugify("Café déjà vu", 40)).toBe("cafe-deja-vu");
    expect(slugify("日本語", 40)).toBe("asset");
  });

  it("shortens at a hyphen when it can", () => {
    expect(slugify("autumn harvest pumpkin icon set", 20)).toBe("autumn-harvest");
    expect(slugify("supercalifragilisticexpialidocious", 10)).toBe("supercalif");
  });
});

describe("makeFilename", () => {
  const id = "0b6d7691-3e38-49a8-a457-e057587cf770";

  it("never exceeds Adobe's 30 characters and ends with .svg", () => {
    const name = makeFilename("A very long title about an orange pumpkin on a table", id, new Set());
    expect(name.length).toBeLessThanOrEqual(ADOBE.filenameMaxChars);
    expect(name).toMatch(/^[a-z0-9-]+-0b6d\.svg$/);
  });

  it("keeps names unique for identical titles", () => {
    const used = new Set<string>();
    const a = makeFilename("Pumpkin", "aaaa1111-0000-0000-0000-000000000000", used);
    const b = makeFilename("Pumpkin", "aaaa2222-0000-0000-0000-000000000000", used);
    const c = makeFilename("Pumpkin", "aaaa1111-0000-0000-0000-000000000001", used); // same first 4 chars as a
    expect(new Set([a, b, c]).size).toBe(3);
    for (const n of [a, b, c]) expect(n.length).toBeLessThanOrEqual(ADOBE.filenameMaxChars);
  });
});

describe("csv", () => {
  it("uses Adobe's exact header and quotes keyword lists", () => {
    const csv = buildAdobeCsv([
      { filename: "pumpkin-0b6d.svg", title: "Orange pumpkin", keywords: ["pumpkin", "autumn", "harvest"], categoryNumber: 8 },
    ]);
    expect(csv.split("\n")[0]).toBe("Filename,Title,Keywords,Category,Releases");
    expect(csv.split("\n")[1]).toBe('pumpkin-0b6d.svg,Orange pumpkin,"pumpkin, autumn, harvest",8,');
    expect(csv.endsWith("\n")).toBe(true);
  });

  it("escapes quotes, commas, and line breaks, and leaves an unknown category empty", () => {
    expect(csvField('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvField("two\nlines")).toBe("two lines");
    const csv = buildAdobeCsv([{ filename: "a.svg", title: "T", keywords: [], categoryNumber: null }]);
    expect(csv.split("\n")[1]).toBe("a.svg,T,,,");
  });

  it("checks Adobe's size limits", () => {
    expect(csvProblems("x", 10)).toEqual([]);
    expect(csvProblems("x", 5001)[0]).toContain("5001");
    expect(csvProblems("x".repeat(1_000_001), 10)[0]).toContain("byte");
  });
});

describe("artboard", () => {
  it("gives a square 4800 px per side (23 MP)", () => {
    const a = artboardFor(512, 512);
    expect(a).toMatchObject({ width: 4800, height: 4800, ok: true });
    expect(a.megapixels).toBeCloseTo(23.04);
  });

  it("scales 4:3 and 3:2 within Adobe's range", () => {
    expect(artboardFor(800, 600)).toMatchObject({ width: 4800, height: 3600, ok: true });
    expect(artboardFor(1500, 1000)).toMatchObject({ width: 4800, height: 3200, ok: true });
  });

  it("rejects a 16:9 canvas: it cannot reach 15 MP within 4800 px", () => {
    const a = artboardFor(1600, 900);
    expect(a.ok).toBe(false);
    expect(a.reason).toContain("lebar");
    expect(a.megapixels).toBeLessThan(15);
  });

  it("sets width and height on the root and keeps the viewBox", () => {
    const out = applyArtboard(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="10" height="10"><rect width="5" height="5"/></svg>',
    );
    expect(out?.svg).toContain('width="4800"');
    expect(out?.svg).toContain('height="4800"');
    expect(out?.svg).toContain('viewBox="0 0 512 512"');
    expect(applyArtboard('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull();
  });
});

describe("Adobe categories", () => {
  it("has the 21 official categories with numbers 1..21", () => {
    expect(ADOBE_CATEGORIES).toHaveLength(21);
    expect(categoryNumber("Animals")).toBe(1);
    expect(categoryNumber("graphic resources")).toBe(8);
    expect(categoryNumber("Travel")).toBe(21);
    expect(categoryNumber("Gadgets")).toBeNull();
    expect(normalizeCategory("GRAPHIC RESOURCES")).toBe("Graphic resources");
  });
});
