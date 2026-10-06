import { describe, expect, it } from "vitest";
import { describeConcept } from "@/lib/generate/concept";

describe("describeConcept", () => {
  it("joins subject and composition without doubled punctuation", () => {
    expect(describeConcept({ subject: "A wooden crate with apples.", composition: "Front view, stacked layering." })).toBe(
      "A wooden crate with apples. Front view, stacked layering.",
    );
  });

  it("adds missing full stops and trims whitespace", () => {
    expect(describeConcept({ subject: "  Pumpkin ", composition: "centered  " })).toBe("Pumpkin. centered.");
  });
});
