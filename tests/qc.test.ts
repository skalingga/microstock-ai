import { describe, expect, it } from "vitest";
import {
  checkBounds,
  checkComplexity,
  checkEmpty,
  checkSeamless,
  checkSimilarity,
  checkText,
  checkTransparentBackground,
  overflowRatio,
} from "@/lib/qc/checks";
import { combine, evaluateVisual } from "@/lib/qc/evaluate";
import { dHash, hammingHex } from "@/lib/qc/hash";
import { checkMetadata } from "@/lib/qc/metadata-checks";
import { seamScore, seamsOk } from "@/lib/qc/tile";
import { parseNotes, type MetadataFields, type Pixels, type QcNote } from "@/lib/qc/types";

type Rgba = [number, number, number, number];

function make(w: number, h: number, fn: (x: number, y: number) => Rgba): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  }
  return { data, width: w, height: h };
}

const WHITE: Rgba = [255, 255, 255, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const CLEAR: Rgba = [0, 0, 0, 0];
const RED: Rgba = [220, 40, 40, 255];

describe("dHash", () => {
  it("is 16 hex characters and stable for the same picture", () => {
    const img = make(64, 64, (x) => (x < 32 ? BLACK : WHITE));
    expect(dHash(img)).toMatch(/^[0-9a-f]{16}$/);
    expect(hammingHex(dHash(img), dHash(img))).toBe(0);
  });

  it("treats transparent like white", () => {
    expect(dHash(make(64, 64, () => CLEAR))).toBe(dHash(make(64, 64, () => WHITE)));
  });

  it("keeps a lightly changed picture close and a different picture far", () => {
    const base = make(64, 64, (x, y) => ((x - 32) ** 2 + (y - 32) ** 2 < 300 ? RED : CLEAR));
    const noisy = make(64, 64, (x, y) => ((x - 32) ** 2 + (y - 32) ** 2 < 300 || (x === 5 && y === 5) ? RED : CLEAR));
    const other = make(64, 64, (x, y) => (x > 8 && x < 20 && y > 5 && y < 60 ? RED : CLEAR));
    expect(hammingHex(dHash(base), dHash(noisy))).toBeLessThanOrEqual(2);
    expect(hammingHex(dHash(base), dHash(other))).toBeGreaterThan(8);
  });
});

describe("hammingHex", () => {
  it("counts differing bits", () => {
    expect(hammingHex("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(hammingHex("0000000000000001", "0000000000000000")).toBe(1);
    expect(hammingHex("abc", "abcd")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("seamless tile test", () => {
  const SIZE = 64;

  it("accepts stripes and a checkerboard that are periodic across the tile", () => {
    const stripes = make(SIZE, SIZE, (x) => (Math.floor(x / 8) % 2 === 0 ? RED : WHITE));
    const checker = make(SIZE, SIZE, (x, y) => ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? RED : WHITE));
    expect(seamsOk(seamScore(stripes))).toBe(true);
    expect(seamsOk(seamScore(checker))).toBe(true);
  });

  it("accepts a shape that is fully inside the tile", () => {
    const inside = make(SIZE, SIZE, (x, y) => ((x - 32) ** 2 + (y - 32) ** 2 < 100 ? RED : WHITE));
    expect(seamsOk(seamScore(inside))).toBe(true);
  });

  it("accepts a shape that is cut by the edge and continues on the opposite side", () => {
    const wrapped = make(SIZE, SIZE, (x, y) => (x ** 2 + (y - 32) ** 2 < 400 || (x - SIZE) ** 2 + (y - 32) ** 2 < 400 ? RED : WHITE));
    expect(seamsOk(seamScore(wrapped))).toBe(true);
  });

  it("rejects a shape that is cut by the edge without a continuation", () => {
    const cut = make(SIZE, SIZE, (x, y) => (x ** 2 + (y - 32) ** 2 < 400 ? RED : WHITE));
    const result = seamScore(cut);
    expect(seamsOk(result)).toBe(false);
    expect(checkSeamless(cut).status).toBe("gagal");
  });

  it("rejects the same problem on the top and bottom edges", () => {
    const cut = make(SIZE, SIZE, (x, y) => ((x - 32) ** 2 + y ** 2 < 400 ? RED : WHITE));
    expect(seamsOk(seamScore(cut))).toBe(false);
  });
});

describe("complexity", () => {
  it("grades by shape and point count", () => {
    expect(checkComplexity({ shapeCount: 12, pointCount: 80 }).status).toBe("ok");
    expect(checkComplexity({ shapeCount: 2, pointCount: 4 }).status).toBe("cek");
    expect(checkComplexity({ shapeCount: 90, pointCount: 400 }).status).toBe("cek");
    expect(checkComplexity({ shapeCount: 30, pointCount: 3000 }).status).toBe("cek");
    expect(checkComplexity({ shapeCount: 250, pointCount: 400 }).status).toBe("gagal");
  });
});

describe("text", () => {
  it("fails when text is present", () => {
    expect(checkText(true).status).toBe("gagal");
    expect(checkText(false).status).toBe("ok");
  });
});

describe("bounds", () => {
  const vb = { x: 0, y: 0, width: 100, height: 100 };

  it("measures how far content sticks out", () => {
    expect(overflowRatio({ x: 10, y: 10, width: 80, height: 80 }, vb)).toBe(0);
    expect(overflowRatio({ x: -10, y: 10, width: 50, height: 50 }, vb)).toBeCloseTo(0.1);
    expect(overflowRatio({ x: 50, y: 50, width: 100, height: 60 }, vb)).toBeCloseTo(0.5);
  });

  it("grades overflow", () => {
    expect(checkBounds({ x: 5, y: 5, width: 90, height: 90 }, vb).status).toBe("ok");
    expect(checkBounds({ x: -10, y: 0, width: 60, height: 60 }, vb).status).toBe("cek");
    expect(checkBounds({ x: -40, y: 0, width: 60, height: 60 }, vb).status).toBe("gagal");
    expect(checkBounds(null, vb).status).toBe("cek");
  });
});

describe("empty and transparent background", () => {
  it("fails an empty picture", () => {
    expect(checkEmpty(make(32, 32, () => CLEAR)).status).toBe("gagal");
    expect(checkEmpty(make(32, 32, (x, y) => (x > 8 && x < 24 && y > 8 && y < 24 ? RED : CLEAR))).status).toBe("ok");
  });

  it("accepts a transparent border and flags a solid background", () => {
    const icon = make(32, 32, (x, y) => (x > 6 && x < 26 && y > 6 && y < 26 ? RED : CLEAR));
    const solid = make(32, 32, () => WHITE);
    const touching = make(32, 32, (x) => (x < 16 ? RED : CLEAR));
    expect(checkTransparentBackground(icon).status).toBe("ok");
    expect(checkTransparentBackground(solid).status).toBe("cek");
    expect(checkTransparentBackground(touching).status).toBe("cek");
  });
});

describe("similarity", () => {
  const hash = "f0f0f0f0f0f0f0f0";

  it("flags a near duplicate and names it", () => {
    const note = checkSimilarity(hash, [{ id: "abcdef12-0000", phash: "f0f0f0f0f0f0f0f1" }]);
    expect(note.status).toBe("cek");
    expect(note.message).toContain("abcdef12");
  });

  it("ignores distant hashes, missing hashes, and itself", () => {
    expect(checkSimilarity(hash, [{ id: "a", phash: "0f0f0f0f0f0f0f0f" }]).status).toBe("ok");
    expect(checkSimilarity(hash, [{ id: "a", phash: null }]).status).toBe("ok");
    expect(checkSimilarity(hash, [{ id: "me", phash: hash }], "me").status).toBe("ok");
    expect(checkSimilarity(hash, []).status).toBe("ok");
  });
});

describe("metadata checks", () => {
  const good: MetadataFields = {
    title: "Orange pumpkin with green leaves",
    keywords: ["pumpkin", "autumn", "harvest"],
    category: "Graphic resources",
    needsRelease: false,
  };
  const banned = ["disney", "nike"];

  it("accepts good metadata", () => {
    const notes = checkMetadata(good, banned);
    expect(notes).toHaveLength(1);
    expect(notes[0].status).toBe("ok");
  });

  const messages = (m: Partial<MetadataFields>) => checkMetadata({ ...good, ...m }, banned).map((n) => n.message).join(" | ");

  it("flags each problem", () => {
    expect(messages({ title: "" })).toContain("Judul belum diisi");
    expect(messages({ title: "x".repeat(71) })).toContain("71 karakter");
    expect(messages({ title: "Pumpkin, leaves" })).toContain("koma");
    expect(messages({ keywords: [] })).toContain("Keyword belum diisi");
    expect(messages({ keywords: Array.from({ length: 50 }, (_, i) => `kw${i}`) })).toContain("50 keyword");
    expect(messages({ title: "Disney pumpkin" })).toContain("disney");
    expect(messages({ keywords: ["pumpkin", "nike shoes"] })).toContain("nike");
    expect(messages({ title: "Breaking news pumpkin" })).toContain("berita");
    expect(messages({ category: "Gadgets" })).toContain("Kategori");
    expect(messages({ category: null })).toContain("Kategori");
    expect(messages({ needsRelease: true })).toContain("Release");
  });
});

describe("evaluateVisual and combine", () => {
  const icon = make(64, 64, (x, y) => ((x - 32) ** 2 + (y - 32) ** 2 < 300 ? RED : CLEAR));
  const stats = { pathCount: 5, shapeCount: 8, pointCount: 40, hasText: false };
  const viewBox = { x: 0, y: 0, width: 512, height: 512 };
  const inside = { x: 100, y: 100, width: 300, height: 300 };
  const base = { stats, viewBox, bbox: inside, pixels: icon, sanitizeNotes: [] as string[], pool: [] };
  const checks = (style: Parameters<typeof evaluateVisual>[0]["style"]) =>
    evaluateVisual({ ...base, style }).notes.map((n) => n.check);

  it("applies the checks that belong to each style", () => {
    expect(checks("icon_set")).toEqual(expect.arrayContaining(["latar", "kanvas"]));
    expect(checks("icon_set")).not.toContain("pola");
    expect(checks("seamless_pattern")).toContain("pola");
    expect(checks("seamless_pattern")).not.toContain("latar");
    expect(checks("seamless_pattern")).not.toContain("kanvas");
    expect(checks("abstract_background")).not.toContain("kanvas");
    expect(checks("flat_illustration")).toContain("kanvas");
  });

  it("records what the sanitizer removed", () => {
    const { notes } = evaluateVisual({ ...base, style: "icon_set", sanitizeNotes: ["script dihapus"] });
    expect(notes.find((n) => n.check === "sanitasi")?.message).toContain("script dihapus");
  });

  const good: MetadataFields = { title: "Round red icon", keywords: ["icon"], category: "Graphic resources", needsRelease: false };

  it("waits for metadata before it can pass, but fails early", () => {
    const { notes } = evaluateVisual({ ...base, style: "icon_set" });
    expect(combine(notes, null, []).status).toBe("menunggu");
    expect(combine(notes, good, []).status).toBe("lolos");

    const failing: QcNote[] = [...notes, { check: "teks", status: "gagal", message: "x" }];
    expect(combine(failing, null, []).status).toBe("gagal");
  });

  it("downgrades to perlu_cek on a metadata problem and replaces old metadata notes", () => {
    const { notes } = evaluateVisual({ ...base, style: "icon_set" });
    const first = combine(notes, { ...good, title: "Pumpkin, leaves" }, []);
    expect(first.status).toBe("perlu_cek");
    const fixed = combine(first.notes, good, []);
    expect(fixed.status).toBe("lolos");
    expect(fixed.notes.filter((n) => n.check === "metadata")).toHaveLength(1);
  });
});

describe("parseNotes", () => {
  it("keeps valid notes and drops junk", () => {
    expect(
      parseNotes([
        { check: "teks", status: "ok", message: "x" },
        { check: "nope", status: "ok", message: "x" },
        { check: "teks", status: "weird", message: "x" },
        "string",
        null,
      ]),
    ).toEqual([{ check: "teks", status: "ok", message: "x" }]);
    expect(parseNotes(null)).toEqual([]);
  });
});
