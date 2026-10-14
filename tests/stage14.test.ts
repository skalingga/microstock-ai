import { describe, expect, it } from "vitest";
import { centerOpaqueShare, checkCopySpace } from "@/lib/qc/checks";
import { QC, STYLE_RULES, complexityFor } from "@/lib/qc/config";
import { evaluateVisual } from "@/lib/qc/evaluate";
import { normalizeMetadata } from "@/lib/metadata/postprocess";
import { conceptsPrompt, metadataPrompt, svgPrompt } from "@/lib/providers/prompts";
import { STYLES, type StyleId } from "@/lib/settings/schema";
import type { Pixels } from "@/lib/qc/types";

const NEW_STYLES: StyleId[] = ["sticker", "isometric", "frame"];
const concept = { subject: "a happy coffee cup", composition: "centered", palette: ["#C8553D", "#F2A65A"] };

function pixels(size: number, opaque: (x: number, y: number) => boolean): Pixels {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (opaque(x, y)) data[(y * size + x) * 4 + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

describe("wave 1 styles", () => {
  it("are listed, with QC rules and complexity limits", () => {
    for (const id of NEW_STYLES) {
      expect(STYLES.some((s) => s.value === id)).toBe(true);
      expect(STYLE_RULES[id]).toBeDefined();
    }
    expect(complexityFor("sticker").warnShapes).toBe(60);
    expect(complexityFor("isometric").failShapes).toBe(220);
    expect(complexityFor("frame").minShapes).toBe(4);
  });

  it("tell the model to keep a transparent background and to write no text", () => {
    for (const id of NEW_STYLES) {
      const user = svgPrompt({ theme: "t", style: id, concept }).user;
      expect(user).toMatch(/TRANSPARENT background/);
      expect(user).toMatch(/No text/);
      expect(user).toMatch(/<svg xmlns=.*viewBox="0 0 \d+ \d+">/);
    }
  });

  it("gives the shape budget each style asks for", () => {
    expect(svgPrompt({ theme: "t", style: "sticker", concept }).user).toContain("under 60 shapes");
    expect(svgPrompt({ theme: "t", style: "isometric", concept }).user).toContain("under 80 shapes");
    expect(svgPrompt({ theme: "t", style: "frame", concept }).user).toContain("under 90 shapes");
  });

  it("keep the frame center empty in the prompt and the isometric light order", () => {
    expect(svgPrompt({ theme: "t", style: "frame", concept }).user).toContain("central square from 250,250 to 750,750");
    expect(svgPrompt({ theme: "t", style: "isometric", concept }).user).toMatch(/top face lightest/);
    expect(svgPrompt({ theme: "t", style: "sticker", concept }).user).toMatch(/die-cut/);
  });

  it("describe the asset to the metadata writer without the internal id", () => {
    for (const id of NEW_STYLES) {
      const user = metadataPrompt({ theme: "t", style: id, concept: "x" }).user;
      expect(user).toMatch(/Asset type: (a|an) /);
      expect(user).toMatch(/transparent background/);
    }
  });

  it("can be planned as concepts", () => {
    for (const id of NEW_STYLES) {
      const user = conceptsPrompt({ theme: "t", style: id, palette: ["#C8553D"], count: 3 }).user;
      expect(user).toContain("Propose exactly 3");
    }
  });

  it("file only frames under Graphic resources", () => {
    const raw = { title: "Happy cup", keywords: ["cup"], category: "Food", needsRelease: false };
    expect(normalizeMetadata(raw, [], "sticker").metadata.category).toBe("Food");
    expect(normalizeMetadata(raw, [], "isometric").metadata.category).toBe("Food");
    expect(normalizeMetadata(raw, [], "frame").metadata.category).toBe("Graphic resources");
  });
});

describe("checkCopySpace", () => {
  const size = 100;
  const edgeBand = (x: number, y: number) => x < 20 || x >= 80 || y < 20 || y >= 80;

  it("passes a frame whose center is empty", () => {
    const note = checkCopySpace(pixels(size, edgeBand));
    expect(note).toMatchObject({ check: "ruang", status: "ok" });
  });

  it("asks for a look when a few specks sit in the center", () => {
    const speck = (x: number, y: number) => edgeBand(x, y) || (x >= 45 && x < 55 && y >= 45 && y < 55);
    const share = centerOpaqueShare(pixels(size, speck));
    expect(share).toBeGreaterThan(QC.frame.centerOpaqueMax);
    expect(share).toBeLessThan(QC.frame.centerFailShare);
    expect(checkCopySpace(pixels(size, speck)).status).toBe("cek");
  });

  it("fails a drawing that fills the center", () => {
    expect(checkCopySpace(pixels(size, () => true)).status).toBe("gagal");
  });

  it("runs only for styles with copySpace in their rules", () => {
    const base = {
      stats: { shapeCount: 12, pointCount: 100, pathCount: 12, hasText: false, filledShapes: 12 },
      viewBox: { x: 0, y: 0, width: 1000, height: 1000 },
      bbox: { x: 20, y: 20, width: 960, height: 960 },
      sanitizeNotes: [],
      pool: [],
    };
    const filled = pixels(size, () => true);
    const frame = evaluateVisual({ ...base, style: "frame", pixels: filled });
    const sticker = evaluateVisual({ ...base, style: "sticker", pixels: filled });
    expect(frame.notes.some((n) => n.check === "ruang" && n.status === "gagal")).toBe(true);
    expect(sticker.notes.some((n) => n.check === "ruang")).toBe(false);
  });
});
