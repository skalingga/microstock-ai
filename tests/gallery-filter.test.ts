import { describe, expect, it } from "vitest";
import { applyGalleryFilter, galleryQuery, parseGalleryFilter } from "@/app/(app)/aset/filters";

function recorder() {
  const calls: unknown[][] = [];
  const q = {
    eq: (...a: unknown[]) => (calls.push(["eq", ...a]), q),
    not: (...a: unknown[]) => (calls.push(["not", ...a]), q),
    is: (...a: unknown[]) => (calls.push(["is", ...a]), q),
    ilike: (...a: unknown[]) => (calls.push(["ilike", ...a]), q),
  };
  return { q, calls };
}

describe("gallery filter search", () => {
  it("trims and caps the search text and carries it in the query string", () => {
    const f = parseGalleryFilter({ q: `  ${"a".repeat(200)}  ` });
    expect(f.q).toHaveLength(80);
    expect(galleryQuery(parseGalleryFilter({ q: " autumn leaf ", status: "lolos" }))).toBe("q=autumn+leaf&status=lolos");
    expect(galleryQuery(parseGalleryFilter({}))).toBe("");
  });

  it("treats LIKE wildcards in the search as literal text", () => {
    const { q, calls } = recorder();
    const bs = String.fromCharCode(92);
    applyGalleryFilter(q, parseGalleryFilter({ q: `50%_off${bs}` }));
    expect(calls).toEqual([["ilike", "title", `%50${bs}%${bs}_off${bs}${bs}%`]]);
  });
});

describe("gallery filter by kind", () => {
  it("filters photos and backgrounds by kind and photo_variant, and carries the kind in the URL", () => {
    const photo = recorder();
    applyGalleryFilter(photo.q, parseGalleryFilter({ jenis: "foto" }));
    expect(photo.calls).toEqual([
      ["eq", "kind", "photo"],
      ["eq", "photo_variant", "photo"],
    ]);

    const background = recorder();
    applyGalleryFilter(background.q, parseGalleryFilter({ jenis: "background" }));
    expect(background.calls).toEqual([
      ["eq", "kind", "photo"],
      ["eq", "photo_variant", "background"],
    ]);
    expect(galleryQuery(parseGalleryFilter({ jenis: "background" }))).toBe("jenis=background");
  });

  it("leaves vectors, bundles and the unfiltered gallery without a variant", () => {
    const vector = recorder();
    applyGalleryFilter(vector.q, parseGalleryFilter({ jenis: "vektor" }));
    expect(vector.calls).toEqual([["eq", "kind", "vector"]]);
    const all = recorder();
    applyGalleryFilter(all.q, parseGalleryFilter({}));
    expect(all.calls).toEqual([]);
    expect(parseGalleryFilter({ jenis: "nonsense" }).kind).toBe("semua");
  });
});
