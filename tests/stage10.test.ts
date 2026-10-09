import { describe, expect, it } from "vitest";
import { unifyPalettes } from "@/lib/generate/concept";
import { cleanKeywords, normalizeMetadata } from "@/lib/metadata/postprocess";
import { conceptsPrompt, metadataPrompt, svgPrompt } from "@/lib/providers/prompts";
import { checkOutline, checkSimilarity } from "@/lib/qc/checks";
import { QC, STYLE_RULES, complexityFor } from "@/lib/qc/config";
import { STYLES, colorRangeFor, isIconStyle } from "@/lib/settings/schema";
import { analyzeSvg } from "@/lib/svg/stats";

const concept = { subject: "Leaf", composition: "Centered", palette: ["#228B22"] };

describe("stage 10 styles", () => {
  it("lists the three new styles and knows the icon ones", () => {
    const ids = STYLES.map((s) => s.value);
    expect(ids).toEqual(expect.arrayContaining(["line_icon", "glyph_icon", "geometric_tile"]));
    expect(isIconStyle("line_icon")).toBe(true);
    expect(isIconStyle("glyph_icon")).toBe(true);
    expect(isIconStyle("icon_set")).toBe(false);
    expect(isIconStyle("geometric_tile")).toBe(false);
  });

  it("has QC rules and complexity limits for each", () => {
    expect(STYLE_RULES.line_icon).toMatchObject({ transparentBackground: true, outline: true });
    expect(STYLE_RULES.glyph_icon.transparentBackground).toBe(true);
    expect(STYLE_RULES.geometric_tile.transparentBackground).toBe(false);
    expect(complexityFor("line_icon").warnShapes).toBe(40);
    expect(complexityFor("geometric_tile").warnShapes).toBe(QC.complexity.warnShapes);
  });
});

describe("svgPrompt for the new styles", () => {
  const prompt = (style: "line_icon" | "glyph_icon" | "geometric_tile" | "icon_set") =>
    svgPrompt({ theme: "eco", style, concept }).user;

  it("asks for uniform strokes and no fills on outline icons, and not for fills without outlines", () => {
    const text = prompt("line_icon");
    expect(text).toContain("stroke-width");
    expect(text).toContain('fill="none"');
    expect(text).toContain("#228B22");
    expect(text).not.toContain("flat solid fills and no outlines");
    expect(text).not.toContain("At most one or two simple linear gradients");
  });

  it("asks for solid shapes without strokes on glyph icons", () => {
    const text = prompt("glyph_icon");
    expect(text).toContain("No strokes and no gradients");
    expect(text).toContain("TRANSPARENT background");
  });

  it("asks for a square symmetric tile that fills the canvas", () => {
    const text = prompt("geometric_tile");
    expect(text).toContain("fills the whole canvas");
    expect(text).toContain("symmetric");
  });

  it("leaves the existing styles on their old rules", () => {
    const text = prompt("icon_set");
    expect(text).toContain("flat solid fills and no outlines");
    expect(text).toContain("At most one or two simple linear gradients");
  });
});

describe("conceptsPrompt: variations and color range", () => {
  const base = { theme: "tropical fish", style: "glyph_icon" as const, palette: ["#111111", "#2255CC"], count: 6 };

  it("asks for one subject drawn many ways, and drops the no-shared-object rule", () => {
    const text = conceptsPrompt({ ...base, variations: true }).user;
    expect(text).toContain("variations of ONE subject");
    expect(text).not.toContain("No two concepts may share the same main object");
    expect(text).toContain("Never change the style");
  });

  it("keeps the set rule when variations is off", () => {
    const text = conceptsPrompt(base).user;
    expect(text).toContain("No two concepts may share the same main object");
    expect(text).not.toContain("variations of ONE subject");
  });

  it("still lists refused subjects in variations mode", () => {
    expect(conceptsPrompt({ ...base, variations: true, avoid: ["Ice cream cone"] }).user).toContain("Ice cream cone");
  });

  it("asks for one palette color on outline icons and one or two on glyph icons", () => {
    expect(conceptsPrompt({ ...base, style: "line_icon" }).user).toContain("exactly 1 hex color");
    expect(conceptsPrompt(base).user).toContain("1 to 2 hex colors");
    expect(conceptsPrompt({ ...base, style: "icon_set" }).user).toContain("2 to 5 hex colors");
  });
});

describe("unifyPalettes with a color range", () => {
  const available = ["#111111", "#2255CC", "#EEEEEE"];
  const make = (palette: string[]) => ({ subject: "s", composition: "c", palette });

  it("accepts a single color for outline icons instead of falling back to the palette", () => {
    const [out] = unifyPalettes([make(["#2255cc"])], available, colorRangeFor("line_icon"));
    expect(out.palette).toEqual(["#2255CC"]);
  });

  it("trims to the style's maximum and falls back to its size", () => {
    expect(unifyPalettes([make(["#111111", "#2255CC", "#EEEEEE"])], available, colorRangeFor("line_icon"))[0].palette).toHaveLength(1);
    expect(unifyPalettes([make(["#abcdef"])], available, colorRangeFor("glyph_icon"))[0].palette).toEqual(["#111111", "#2255CC"]);
  });
});

describe("analyzeSvg filledShapes", () => {
  const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;

  it("counts a shape with no fill attribute (black by default) but not fill none", () => {
    expect(analyzeSvg(wrap('<path d="M0 0"/><path d="M1 1" fill="none" stroke="#000"/>')).filledShapes).toBe(1);
  });

  it("follows the fill of the nearest group and ignores lines", () => {
    const svg = wrap('<g fill="none" stroke="#000"><path d="M0 0"/><circle r="1"/><circle r="1" fill="#f00"/></g><line x1="0" y1="0" x2="1" y2="1"/>');
    expect(analyzeSvg(svg).filledShapes).toBe(1);
  });

  it("reads an inline style fill", () => {
    expect(analyzeSvg(wrap('<path d="M0 0" style="fill:none"/>')).filledShapes).toBe(0);
  });
});

describe("checkOutline", () => {
  it("passes an icon drawn with strokes, with one filled dot allowed", () => {
    expect(checkOutline({ shapeCount: 6, filledShapes: 0 }).status).toBe("ok");
    expect(checkOutline({ shapeCount: 6, filledShapes: 1 }).status).toBe("ok");
  });

  it("asks for a look when most of the shapes carry a fill", () => {
    const note = checkOutline({ shapeCount: 6, filledShapes: 5 });
    expect(note.status).toBe("cek");
    expect(note.check).toBe("kontur");
  });
});

describe("checkSimilarity in a variations batch", () => {
  const hash = "f0f0f0f0f0f0f0f0";
  const near = "f0f0f0f0f0f0f0f1"; // 1 bit away
  const mid = "f0f0f0f0f0f0f0ff"; // 4 bits away

  it("flags a batch mate 4 bits away only with the normal limit", () => {
    expect(checkSimilarity(hash, [{ id: "a", phash: mid, batch: true }]).status).toBe("cek");
    expect(checkSimilarity(hash, [{ id: "a", phash: mid, batch: true }], undefined, QC.similarity.maxHammingVariations).status).toBe("ok");
  });

  it("still flags a near copy inside the batch", () => {
    expect(checkSimilarity(hash, [{ id: "a", phash: near, batch: true }], undefined, QC.similarity.maxHammingVariations).status).toBe("cek");
  });

  it("keeps the normal limit against earlier batches", () => {
    expect(checkSimilarity(hash, [{ id: "a", phash: mid }], undefined, QC.similarity.maxHammingVariations).status).toBe("cek");
  });
});

describe("metadata for icon styles", () => {
  const raw = { title: "Leaf outline icon", keywords: ["leaf", "icon", "icon set", "nature"], category: "Graphic resources", needsRelease: false };

  it("keeps the icon words on the icon styles", () => {
    const { metadata } = normalizeMetadata(raw, [], "line_icon");
    expect(metadata.title).toBe("Leaf outline icon");
    expect(metadata.keywords).toEqual(["leaf", "icon", "icon set", "nature"]);
    expect(cleanKeywords(["icon"], [], true).keywords).toEqual(["icon"]);
  });

  it("still strips them from clipart", () => {
    const { metadata } = normalizeMetadata(raw, [], "icon_set");
    expect(metadata.title).toBe("Leaf outline");
    expect(metadata.keywords).toEqual(["leaf", "nature"]);
  });

  it("allows the icon words in the prompt for icon styles only", () => {
    const icon = metadataPrompt({ theme: "t", style: "glyph_icon", concept: "c" }).user;
    expect(icon).toContain('the words "icon" and "icon set" are right');
    expect(icon).not.toContain("Never use the words icon");
    expect(metadataPrompt({ theme: "t", style: "icon_set", concept: "c" }).user).toContain("Never use the words icon");
    for (const style of ["line_icon", "glyph_icon", "geometric_tile"] as const) {
      const text = metadataPrompt({ theme: "t", style, concept: "c" }).user;
      expect(text).not.toContain(style);
      expect(text).toMatch(/Asset type: (a|an) /);
    }
  });
});
