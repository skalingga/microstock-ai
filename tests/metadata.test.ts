import { describe, expect, it } from "vitest";
import { cleanKeywords, cleanTitle, normalizeMetadata, stripIconWords } from "@/lib/metadata/postprocess";
import { metadataPrompt } from "@/lib/providers/prompts";

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
    expect(dropped).toEqual({ banned: 1, invalid: 2, overLimit: 0, misleading: 0 });
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

  it("files icons, patterns, backgrounds and badges under Graphic resources", () => {
    const snow = { ...raw, category: "The environment" };
    expect(normalizeMetadata(snow, [], "icon_set").metadata.category).toBe("Graphic resources");
    expect(normalizeMetadata(snow, [], "seamless_pattern").metadata.category).toBe("Graphic resources");
    expect(normalizeMetadata(snow, [], "icon_set").notes.join(" ")).toContain("The environment");
  });

  it("keeps the AI category for illustrations", () => {
    expect(normalizeMetadata({ ...raw, category: "Food" }, [], "flat_illustration").metadata.category).toBe("Food");
  });

  it("passes needsRelease through", () => {
    expect(normalizeMetadata({ ...raw, needsRelease: true }, []).metadata.needsRelease).toBe(true);
  });
});

import { formatKeywordText, parseKeywordText } from "@/lib/metadata/keywords";

describe("parseKeywordText", () => {
  it("accepts lines and commas, lowercases, and drops duplicates", () => {
    expect(parseKeywordText("Pumpkin, autumn\nHarvest\n\n pumpkin ,  ")).toEqual(["pumpkin", "autumn", "harvest"]);
  });

  it("round-trips through formatKeywordText", () => {
    const list = ["a", "b c", "d"];
    expect(parseKeywordText(formatKeywordText(list))).toEqual(list);
  });
});

describe("icon words", () => {
  it("rewrites titles without breaking them", () => {
    expect(stripIconWords("Halloween bubbling cauldron with green potion skull and bone icon set")).toBe(
      "Halloween bubbling cauldron with green potion skull and bone set",
    );
    expect(stripIconWords("Angry Halloween pumpkin jack-o-lantern icon")).toBe("Angry Halloween pumpkin jack-o-lantern");
    expect(stripIconWords("Sleepy Crescent Moon Icon for Halloween")).toBe("Sleepy Crescent Moon for Halloween");
    expect(stripIconWords("Winter icons with a snowflake")).toBe("Winter with a snowflake");
    expect(stripIconWords("Icon")).toBe("Icon"); // never empty the title
    expect(stripIconWords("Iconic castle")).toBe("Iconic castle"); // whole words only
  });

  it("drops keywords that call the picture an icon", () => {
    const { keywords, dropped } = cleanKeywords(
      ["pumpkin", "icon", "icon set", "ui icon", "pictogram", "glyph", "iconic", "autumn"],
      [],
    );
    expect(keywords).toEqual(["pumpkin", "iconic", "autumn"]);
    expect(dropped.misleading).toBe(5);
  });

  it("applies both in normalizeMetadata and reports it", () => {
    const { metadata, notes } = normalizeMetadata(
      { title: "Wrapped gift box icon", keywords: ["gift", "icon set", "ribbon"], category: "Graphic resources", needsRelease: false },
      [],
      "icon_set",
    );
    expect(metadata.title).toBe("Wrapped gift box");
    expect(metadata.keywords).toEqual(["gift", "ribbon"]);
    expect(notes.join(" ")).toContain("kata icon dibuang dari judul");
    expect(notes.join(" ")).toContain("keyword bertema icon dibuang");
  });
});

describe("metadataPrompt", () => {
  const prompt = metadataPrompt({ theme: "halloween icons", style: "icon_set", concept: "A pumpkin." }).user;

  it("never leaks the internal style id and describes the picture as clipart", () => {
    expect(prompt).not.toContain("icon_set");
    expect(prompt).toContain("clipart illustration");
  });

  it("forbids the icon words and no longer asks for them", () => {
    expect(prompt).toContain("Never use the words icon, icons, icon set, pictogram or glyph");
    expect(prompt).not.toContain('"flat vector" or "icon"');
  });

  it("describes every style without internal ids", () => {
    for (const style of ["icon_set", "seamless_pattern", "flat_illustration", "badge_label", "abstract_background"] as const) {
      const text = metadataPrompt({ theme: "t", style, concept: "c" }).user;
      expect(text).not.toContain(style);
      expect(text).toMatch(/Asset type: (a|an) /);
    }
  });
});
