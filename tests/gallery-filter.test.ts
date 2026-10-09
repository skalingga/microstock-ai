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
