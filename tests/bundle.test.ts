import { describe, expect, it } from "vitest";
import { artboardFor } from "@/lib/export/artboard";
import { CELL, GAP, GRID_OPTIONS, bundleSize, composeBundle, gridFor } from "@/lib/bundle/compose";
import { bundleConcept } from "@/lib/bundle/make";
import { metadataRequestSchema } from "@/lib/generate/schemas";
import { metadataPrompt } from "@/lib/providers/prompts";
import { checkSimilarity } from "@/lib/qc/checks";
import { QC, scaleLimits } from "@/lib/qc/config";
import { evaluateVisual } from "@/lib/qc/evaluate";
import { hammingHex, unionBitsHex } from "@/lib/qc/hash";
import type { Pixels } from "@/lib/qc/types";

const square = (id: string, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>${id}</title>${extra}<rect id="body" width="100" height="100" fill="#f00"/></svg>`;

const members = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, svg: square(`m${i}`) }));

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, "image/svg+xml");
}

describe("grid options", () => {
  it("finds the grid for an exact member count", () => {
    expect(gridFor(25)?.id).toBe("5x5");
    expect(gridFor(24)?.id).toBe("6x4");
    expect(gridFor(16)?.id).toBe("4x4");
    expect(gridFor(9)?.id).toBe("3x3");
    expect(gridFor(10)).toBeNull();
  });

  it("every grid fits Adobe's artboard rules", () => {
    for (const g of GRID_OPTIONS) {
      const { width, height } = bundleSize(g);
      expect(artboardFor(width, height).ok, g.id).toBe(true);
    }
  });
});

describe("composeBundle", () => {
  it("places members left to right, top to bottom, each in its own group", () => {
    const result = composeBundle(members(4), { columns: 2, rows: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.width).toBe(2 * CELL + 3 * GAP);

    const doc = parse(result.svg);
    expect(doc.documentElement.getAttribute("viewBox")).toBe(`0 0 ${result.width} ${result.height}`);
    const groups = Array.from(doc.documentElement.children).filter((c) => c.localName === "g");
    expect(groups.map((g) => g.getAttribute("id"))).toEqual(["item-1", "item-2", "item-3", "item-4"]);

    // Cell 1 starts at GAP + padding; cell 2 one cell and one gap to the right; cell 3 one row down.
    const t = (i: number) => groups[i].getAttribute("transform");
    expect(t(0)).toMatch(/^translate\(48 48\) scale\(0\.938\)$/);
    expect(t(1)).toMatch(/^translate\(592 48\)/);
    expect(t(2)).toMatch(/^translate\(48 592\)/);
  });

  it("drops titles and keeps a transparent background", () => {
    const result = composeBundle(members(4), { columns: 2, rows: 2 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.svg).not.toContain("<title");
    expect(parse(result.svg).querySelectorAll("rect[width='1120']")).toHaveLength(0);
  });

  it("keeps ids unique and re-points references to the member's own ids", () => {
    const gradient =
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs><rect id="fill" width="50" height="50" fill="url(#g)"/>';
    const svgs = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, svg: square(`m${i}`, gradient) }));
    const result = composeBundle(svgs, { columns: 2, rows: 2 });
    if (!result.ok) throw new Error(result.reason);

    const doc = parse(result.svg);
    const ids = Array.from(doc.querySelectorAll("[id]")).map((e) => e.getAttribute("id"));
    expect(new Set(ids).size).toBe(ids.length);
    for (const rect of Array.from(doc.querySelectorAll("rect[fill^='url']"))) {
      const target = /url\(#([^)]+)\)/.exec(rect.getAttribute("fill") ?? "")?.[1] ?? "";
      expect(doc.getElementById(target)?.localName).toBe("linearGradient");
      // The gradient belongs to the same member as the rectangle that uses it.
      expect(rect.closest("g")?.contains(doc.getElementById(target))).toBe(true);
    }
  });

  it("scales a wide member to fit its cell", () => {
    const wide = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600"/></svg>`;
    const list = [{ id: "w", svg: wide }, ...members(3)];
    const result = composeBundle(list, { columns: 2, rows: 2 });
    if (!result.ok) throw new Error(result.reason);
    const first = parse(result.svg).querySelector("#item-1")?.getAttribute("transform") ?? "";
    expect(first).toMatch(/scale\(0\.6\)$/); // (512 - 32) / 800
  });

  it("refuses a wrong member count and broken SVG", () => {
    expect(composeBundle(members(3), { columns: 2, rows: 2 })).toMatchObject({ ok: false });
    expect(composeBundle([{ id: "x", svg: "<svg" }, ...members(3)], { columns: 2, rows: 2 })).toMatchObject({ ok: false });
  });

  it("gives each member its own copy of the classes used in <style>", () => {
    const styled = (n: number) => ({
      id: `s${n}`,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><style>.a, .b{fill:red}.c{stroke:#000}</style><rect class="a c" width="9" height="9"/><circle class="b" r="4"/></svg>`,
    });
    const result = composeBundle([styled(1), styled(2), ...members(2)], { columns: 2, rows: 2 });
    if (!result.ok) throw new Error(result.reason);
    const doc = parse(result.svg);
    const css = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent ?? "");
    expect(css).toHaveLength(2);
    expect(css[0]).toContain(".i01-a, .i01-b{fill:red}");
    expect(css[1]).toContain(".i02-c{stroke:#000}");
    const rects = Array.from(doc.querySelectorAll("rect[class]")).map((r) => r.getAttribute("class"));
    expect(rects).toEqual(["i01-a i01-c", "i02-a i02-c"]);
  });

  it("refuses <style> that could leak into other members", () => {
    for (const css of ["rect{fill:red}", "@media print{.a{fill:red}}", "svg .a{fill:red}"]) {
      const styled = { id: "s", svg: square("s", `<style>${css}</style>`) };
      const result = composeBundle([styled, ...members(3)], { columns: 2, rows: 2 });
      expect(result, css).toMatchObject({ ok: false });
      if (!result.ok) expect(result.reason).toContain("<style>");
    }
  });
});

describe("similarity of sparse pictures", () => {
  // Two 64-bit hashes as 16 hex digits. a and b differ in 4 bits but together set only 12: unrelated small objects.
  const sparseA = "0000000300030f00"; // 2 + 2 + 4 = 8 bits
  const sparseB = "0000000c000c0f00"; // other cells: 2 + 2 + 4 = 8 bits, distance 8 of union 12
  const dense = "ffffffff00000000"; // 32 bits
  const denseNear = "ffffff7f00000010"; // 2 bits apart, union 33

  it("does not call two unrelated sparse pictures 'the same'", () => {
    const note = checkSimilarity(sparseA, [{ id: "other-asset", phash: sparseB }]);
    expect(note.status).toBe("ok");
  });

  it("still flags a near copy of a sparse picture", () => {
    const nearCopy = "0000000300030f01"; // one bit off
    expect(checkSimilarity(sparseA, [{ id: "copy-asset", phash: nearCopy }]).status).toBe("cek");
  });

  it("keeps flagging dense look-alikes a few bits apart", () => {
    expect(checkSimilarity(dense, [{ id: "dense-copy", phash: denseNear }]).status).toBe("cek");
  });

  it("uses the share of set bits, not only the count", () => {
    expect(unionBitsHex(sparseA, sparseB)).toBe(12);
    expect(hammingHex(sparseA, sparseB)).toBe(8);
    expect(8 / 12).toBeGreaterThan(QC.similarity.maxRelative);
  });
});

describe("QC of a bundle", () => {
  const stats = { shapeCount: 600, pointCount: 9000, pathCount: 600, hasText: false, filledShapes: 600 };
  const base = {
    stats,
    viewBox: { x: 0, y: 0, width: 2752, height: 2752 },
    bbox: { x: 32, y: 32, width: 2688, height: 2688 },
    sanitizeNotes: [],
    pool: [],
  };
  const somePixels = (): Pixels => {
    const size = 64;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) if (i % 3 === 0) data[i * 4 + 3] = 255;
    return { data, width: size, height: size };
  };

  it("scales complexity limits with the number of members", () => {
    expect(scaleLimits({ minShapes: 3, warnShapes: 80, failShapes: 200, warnPoints: 2500 }, 25)).toEqual({
      minShapes: 75,
      warnShapes: 2000,
      failShapes: 5000,
      warnPoints: 62500,
    });
  });

  it("judges 600 shapes as too complex for one icon but fine for a bundle of 25", () => {
    const single = evaluateVisual({ ...base, style: "glyph_icon", pixels: somePixels() });
    expect(single.notes.find((n) => n.check === "kerumitan")?.status).toBe("gagal");
    const bundle = evaluateVisual({ ...base, style: "glyph_icon", pixels: somePixels(), members: 25 });
    expect(bundle.notes.find((n) => n.check === "kerumitan")?.status).toBe("ok");
  });
});

describe("metadata of a set", () => {
  it("tells the model the file is a set, and only then", () => {
    const set = metadataPrompt({ theme: "autumn", style: "line_icon", concept: "Bundle: 25 icons", setSize: 25 }).user;
    expect(set).toContain("grid of 25 separate matching items");
    expect(set).toContain('"Set of 25');
    const single = metadataPrompt({ theme: "autumn", style: "line_icon", concept: "A leaf" }).user;
    expect(single).not.toContain("grid of");
  });

  it("accepts a set size in the request and rejects nonsense", () => {
    const base = { theme: "autumn", style: "line_icon", concept: "Bundle" };
    expect(metadataRequestSchema.safeParse({ ...base, setSize: 25 }).success).toBe(true);
    expect(metadataRequestSchema.safeParse({ ...base, setSize: 1 }).success).toBe(false);
    expect(metadataRequestSchema.safeParse({ ...base, setSize: 500 }).success).toBe(false);
  });
});

describe("bundleConcept", () => {
  it("names the size and the first part of each member's concept, within the limit", () => {
    const text = bundleConcept(3, ["A red mug. Centered on a table", "A blue kettle. Side view", null]);
    expect(text).toContain("grid of 3 separate matching items");
    expect(text).toContain("A red mug; A blue kettle");
    const long = bundleConcept(25, Array.from({ length: 25 }, (_, i) => `Item number ${i} with a long description of the thing. More`));
    expect(long.length).toBeLessThanOrEqual(480);
  });
});
