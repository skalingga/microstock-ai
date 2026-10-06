import { describe, expect, it } from "vitest";
import { cleanKeywords, cleanTitle, normalizeMetadata } from "@/lib/metadata/postprocess";

describe("cleanTitle", () => {
  it("removes commas, quotes, and extra spaces", () => {
    expect(cleanTitle('  "Orange pumpkin,  green leaves"  ')).toBe("Orange pumpkin green leaves");
  });

  it("cuts at 70 characters on a word boundary", () => {
    const long = "A very descriptive title about a cheerful orange pumpkin sitting beside green autumn leaves";
    const out = cleanTitle(long);
    expect(out.length).toBeLessThanOrEqual(70);
    expect(long.startsWith(out)).toBe(true);
    expect(out.endsWith(" ")).toBe(false);
  });
});

describe("cleanKeywords", () => {
  it("normalizes, dedupes, and keeps the order", () => {
    const { keywords } = cleanKeywords(["Pumpkin", "pumpkin", " Autumn! ", "flat-vector", "fall  harvest"], []);
    expect(keywords).toEqual(["pumpkin", "autumn", "flat-vector", "fall harvest"]);
  });

  it("drops banned, over-long and empty keywords and counts them", () => {
    const { keywords, dropped } = cleanKeywords(
      ["pumpkin", "disney castle", "a b c d e f", "x".repeat(50), "", "   "],
      ["disney"],
    );
    expect(keywords).toEqual(["pumpkin"]);
    expect(dropped).toEqual({ banned: 1, invalid: 2, overLimit: 0 });
  });

  it("caps the list at 49", () => {
    const many = Array.from({ length: 60 }, (_, i) => `keyword${i}`);
    const { keywords, dropped } = cleanKeywords(many, []);
    expect(keywords).toHaveLength(49);
    expect(dropped.overLimit).toBe(11);
  });
});

describe("normalizeMetadata", () => {
  const raw = { title: "Pumpkin, leaves", keywords: ["pumpkin", "nike"], category: "graphic resources", needsRelease: false };

  it("fixes the category case and reports changes", () => {
    const { metadata, notes } = normalizeMetadata(raw, ["nike"]);
    expect(metadata.title).toBe("Pumpkin leaves");
    expect(metadata.keywords).toEqual(["pumpkin"]);
    expect(metadata.category).toBe("Graphic resources");
    expect(notes.join(" ")).toContain("keyword terlarang");
  });

  it("falls back to Graphic resources for an unknown category", () => {
    const { metadata, notes } = normalizeMetadata({ ...raw, category: "Gadgets" }, []);
    expect(metadata.category).toBe("Graphic resources");
    expect(notes.join(" ")).toContain("Gadgets");
  });

  it("passes needsRelease through", () => {
    expect(normalizeMetadata({ ...raw, needsRelease: true }, []).metadata.needsRelease).toBe(true);
  });
});
