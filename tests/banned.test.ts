import { describe, expect, it } from "vitest";
import { findBannedWords } from "@/lib/settings/banned";

const words = ["disney", "star wars", "coca-cola", "nike"];

describe("findBannedWords", () => {
  it("matches whole words and phrases case-insensitively", () => {
    expect(findBannedWords("Cute DISNEY castle icons", words)).toEqual(["disney"]);
    expect(findBannedWords("star wars inspired pattern", words)).toEqual(["star wars"]);
    expect(findBannedWords("a coca-cola bottle", words)).toEqual(["coca-cola"]);
  });

  it("does not trigger inside a longer word", () => {
    expect(findBannedWords("technike lighting", words)).toEqual([]);
    expect(findBannedWords("disneyland-style", ["disney"])).toEqual([]);
  });

  it("returns every hit and ignores empty entries", () => {
    expect(findBannedWords("nike meets disney", ["nike", "", "  ", "disney"])).toEqual(["nike", "disney"]);
  });

  it("treats regex characters in a word literally", () => {
    expect(findBannedWords("a.b", ["a.b"])).toEqual(["a.b"]);
    expect(findBannedWords("axb", ["a.b"])).toEqual([]);
  });
});
