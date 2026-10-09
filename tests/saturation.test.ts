import { describe, expect, it } from "vitest";
import { buildSaturated, isSimilarReason, matchSaturated, subjectOf, subjectsOverlap, subjectTokens } from "@/lib/subjects/saturation";

describe("subjectTokens", () => {
  it("drops style words and plurals", () => {
    expect(subjectTokens("Black and white ice cream cones, line art")).toEqual(["cone", "cream", "ice"]);
  });

  it("returns nothing for filler only", () => {
    expect(subjectTokens("vector icon set")).toEqual([]);
  });
});

describe("subjectOf", () => {
  it("takes the part before the composition", () => {
    expect(subjectOf("Ice cream cone with two scoops. Centered, side view.")).toBe("Ice cream cone with two scoops");
  });

  it("copes with a missing composition or no concept", () => {
    expect(subjectOf("Pumpkin.")).toBe("Pumpkin");
    expect(subjectOf(null)).toBe("");
  });
});

describe("subjectsOverlap", () => {
  it("matches when one subject contains the other", () => {
    expect(subjectsOverlap("horse", "Galloping wild horse")).toBe(true);
    expect(subjectsOverlap("ice cream icons", "Ice cream cone")).toBe(true);
  });

  it("keeps a specific variant apart from a generic one", () => {
    expect(subjectsOverlap("arabian stallion with silver saddle", "Galloping wild horse")).toBe(false);
    expect(subjectsOverlap("autumn leaves", "banana bunch")).toBe(false);
  });

  it("never matches an empty subject", () => {
    expect(subjectsOverlap("", "horse")).toBe(false);
  });
});

describe("isSimilarReason", () => {
  it("recognizes Adobe's wording and the Indonesian ones", () => {
    expect(isSimilarReason("Similar content in our collection")).toBe(true);
    expect(isSimilarReason("terlalu mirip")).toBe(true);
    expect(isSimilarReason("Quality")).toBe(false);
    expect(isSimilarReason(null)).toBe(false);
  });
});

describe("buildSaturated", () => {
  it("groups the same subject, counts it, and skips other reasons", () => {
    const out = buildSaturated([
      { concept: "Ice cream cone. Centered.", adobeReason: "Similar content" },
      { concept: "Ice cream cones with sprinkles. Side view.", adobeReason: "similar content" },
      { concept: "Banana bunch. Centered.", adobeReason: "Quality" },
      { concept: "Galloping wild horse. Side view.", adobeReason: "Similar content" },
    ]);
    expect(out).toEqual([
      { subject: "Galloping wild horse", count: 1 },
      { subject: "Ice cream cone", count: 1 },
      { subject: "Ice cream cones with sprinkles", count: 1 },
    ]);
  });

  it("counts identical subjects together", () => {
    const out = buildSaturated([
      { concept: "Ice cream cone. A.", adobeReason: "Similar" },
      { concept: "Ice cream cone. B.", adobeReason: "Similar" },
    ]);
    expect(out).toEqual([{ subject: "Ice cream cone", count: 2 }]);
  });
});

describe("matchSaturated", () => {
  it("returns the subjects a theme runs into", () => {
    const saturated = [
      { subject: "Ice cream cone", count: 2 },
      { subject: "Galloping wild horse", count: 1 },
    ];
    expect(matchSaturated("ice cream", saturated).map((s) => s.subject)).toEqual(["Ice cream cone"]);
    expect(matchSaturated("autumn harvest icons", saturated)).toEqual([]);
  });
});
