// @vitest-environment node
import Jimp from "jimp";
import { describe, expect, it } from "vitest";
import { backgroundMask, fitCanvas, groupShapes, maskBounds, parseSubpaths, traceImage } from "@/lib/svg/trace";

/** White PNG with black pixels wherever paint(x, y) is true. */
async function png(width: number, height: number, paint: (x: number, y: number) => boolean): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (paint(x, y)) data[(y * width + x) * 4] = data[(y * width + x) * 4 + 1] = data[(y * width + x) * 4 + 2] = 0;
    }
  }
  return new Jimp({ data, width, height }).getBufferAsync(Jimp.MIME_PNG);
}

const ring = (x: number, y: number) => {
  const r = Math.hypot(x - 100, y - 100);
  return (r < 60 && r > 35) || r < 12; // ring with a dot in its hole
};
const square = (x: number, y: number) => x >= 220 && x < 280 && y >= 70 && y < 130;

describe("fitCanvas", () => {
  it("adds a margin and keeps a square drawing square", () => {
    const c = fitCanvas({ x: 100, y: 100, width: 200, height: 200 });
    expect(c.width).toBe(c.height);
    expect(c.width).toBeGreaterThan(200);
    expect(c.x).toBeLessThan(100);
  });

  it("pads a very wide drawing to 3:2 so Adobe's 15 MP stays reachable", () => {
    const c = fitCanvas({ x: 0, y: 300, width: 2000, height: 700 });
    expect(c.width / c.height).toBeCloseTo(1.5, 2);
    expect(c.y + c.height).toBeGreaterThan(1000); // grew vertically around the drawing
  });

  it("pads a tall drawing to 2:3", () => {
    const c = fitCanvas({ x: 0, y: 0, width: 300, height: 900 });
    expect(c.width / c.height).toBeCloseTo(2 / 3, 2);
  });
});

describe("masks", () => {
  it("finds the drawing bounds and the outside background", () => {
    const w = 10;
    const h = 10;
    const ink = new Uint8Array(w * h);
    // A closed 4x4 box outline at (3,3)..(6,6): its inside is not reachable from the border.
    for (let i = 3; i <= 6; i++) {
      ink[3 * w + i] = ink[6 * w + i] = ink[i * w + 3] = ink[i * w + 6] = 1;
    }
    expect(maskBounds(ink, w, h)).toEqual({ x: 3, y: 3, width: 4, height: 4 });
    const bg = backgroundMask(ink, w, h);
    expect(bg[0]).toBe(1);
    expect(bg[4 * w + 4]).toBe(0); // enclosed white stays part of the drawing
    expect(maskBounds(new Uint8Array(4), 2, 2)).toBeNull();
  });
});

describe("groupShapes", () => {
  it("keeps a hole with its outline and makes an island in the hole its own shape", () => {
    const outer = "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z";
    const hole = "M 20 20 L 80 20 L 80 80 L 20 80 L 20 20 Z";
    const island = "M 40 40 L 60 40 L 60 60 L 40 60 L 40 40 Z";
    const apart = "M 200 0 L 250 0 L 250 50 L 200 50 L 200 0 Z";
    const shapes = groupShapes(parseSubpaths(`${island} ${outer} ${apart} ${hole}`));
    expect(shapes).toHaveLength(3);
    expect(shapes[0]).toContain("M 0 0");
    expect(shapes[0]).toContain("M 20 20");
    expect(shapes.some((s) => s.startsWith("M 40 40") && !s.includes("M 0 0"))).toBe(true);
  });

  it("reads curve end points, not control points", () => {
    const [sub] = parseSubpaths("M 0 0 C 50 -40, 50 140, 100 100 L 0 100 Z");
    expect(sub.polygon).toEqual([
      [0, 0],
      [100, 100],
      [0, 100],
    ]);
  });
});

describe("traceImage", () => {
  it("traces a silhouette into separate black shapes on a padded canvas", async () => {
    const out = await traceImage(await png(320, 220, (x, y) => ring(x, y) || square(x, y)), "silhouette");
    expect(out.svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 \d+ \d+">/);
    expect(out.svg).not.toContain('id="fill"');
    // ring (with its hole), the dot inside the hole, and the square
    expect(out.shapes).toBe(3);
    expect(out.width / out.height).toBeCloseTo(1.5, 1);
  });

  it("adds a white fill behind line art", async () => {
    const out = await traceImage(await png(220, 220, ring), "line_art");
    expect(out.svg).toContain('<g id="fill"><path fill="#FFFFFF"');
    expect(out.svg).toContain('<g id="lines">');
  });

  it("rejects an empty picture", async () => {
    await expect(traceImage(await png(50, 50, () => false), "silhouette")).rejects.toThrow("kosong");
  });

  it("rejects bytes that are not an image", async () => {
    await expect(traceImage(Buffer.from("not an image"), "silhouette")).rejects.toThrow("tidak bisa dibaca");
  });
});
