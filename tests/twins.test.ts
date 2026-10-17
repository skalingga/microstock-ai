import { describe, expect, it } from "vitest";
import { findTwins, mainTokens, sameMainSubject, twinSubject, type TwinCandidate } from "@/lib/subjects/twins";

// Concept subjects from the Adobe batches of 6-13 Oct 2026, as stored in assets.concept.
const pick = (id: string, subject: string, lolos = true): TwinCandidate => ({ id, subject, title: subject, lolos, media: "vector" });

describe("mainTokens", () => {
  it("keeps the object, not how it is drawn", () => {
    expect(mainTokens("Galloping wild horse in profile")).toEqual(["horse"]);
    expect(mainTokens("Black cat silhouette with wide green eyes")).toEqual(["cat"]);
    expect(mainTokens("A steaming ceramic coffee cup with saucer")).toEqual(["coffee", "cup"]);
  });

  it("drops people in general and the shot", () => {
    expect(mainTokens("Person sitting at a desk with a desktop computer and coffee mug")).toEqual([]);
    expect(mainTokens("Overhead flat lay of grilled street skewers")).toEqual(["street", "skewer"]);
  });

  it("stops at a verb after the object, keeps nouns that end like one", () => {
    expect(mainTokens("Victorian top hat launching mini bottle rockets")).toEqual(["hat"]);
    expect(mainTokens("Seedling sprouting from rich soil")).toEqual(["seedling"]);
    expect(mainTokens("Crossed pair of star-tipped sparkler wands")).toEqual(["star", "sparkler", "wand"]);
  });

  it("ends at the first comma", () => {
    expect(mainTokens("Great frigatebird soaring, wings in full M-shape")).toEqual(["great", "frigatebird"]);
  });
});

describe("sameMainSubject", () => {
  it("matches the twins Adobe rejected as similar", () => {
    expect(sameMainSubject("Ice cream cone with two rounded scoops", "Ice cream cone with two rounded scoops")).toBe(true);
    expect(sameMainSubject("Single slice of pepperoni pizza", "Single slice of pepperoni pizza")).toBe(true);
    expect(sameMainSubject("Galloping wild horse in profile", "Majestic horse head in three-quarter view")).toBe(true);
    expect(sameMainSubject("Black cat silhouette with arched back and crescent moon", "Black cat silhouette with wide green eyes")).toBe(true);
    expect(sameMainSubject("Classic coffee cup with steam rising", "Takeaway coffee cup with steam swirling above it")).toBe(true);
  });

  it("keeps different objects apart", () => {
    expect(sameMainSubject("Cone party popper with star confetti explosion", "1970s faceted disco ball with sharp ray burst")).toBe(false);
    expect(sameMainSubject("Bunch of ripe bananas on a stem", "Whole pineapple with textured leaves")).toBe(false);
    expect(sameMainSubject("Elderly vendor steaming dumplings before dawn", "A steaming ceramic coffee cup with saucer")).toBe(false);
    expect(sameMainSubject("Cone party popper with star confetti explosion", "Ice cream cone with two rounded scoops")).toBe(false);
    expect(sameMainSubject("Vintage champagne bottle with starburst cork pop", "Three-tier art deco champagne coupe tower")).toBe(false);
    expect(sameMainSubject("Person sitting at desk with laptop", "Person standing at height-adjustable desk working on dual monitors")).toBe(false);
  });
});

describe("findTwins", () => {
  it("keeps one of each twin group, preferring Lolos", () => {
    const groups = findTwins(
      [
        pick("h1", "Galloping wild horse in profile", false),
        pick("h2", "Majestic horse head in three-quarter view"),
        pick("h3", "Standing horse resting peacefully"),
        pick("b1", "Bunch of ripe bananas on a stem"),
      ],
      [],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("horse");
    expect(groups[0].keep).toBe("h2");
    expect(groups[0].drop).toEqual(["h1", "h3"]);
  });

  it("drops every pick whose object was already sent", () => {
    const groups = findTwins(
      [pick("p1", "Single slice of pepperoni pizza"), pick("t1", "Teapot with curved spout and handle")],
      [{ id: "old", subject: "Single slice of pepperoni pizza", title: "Pizza slice line art", media: "vector" }],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].keep).toBeNull();
    expect(groups[0].drop).toEqual(["p1"]);
    expect(groups[0].sent).toEqual([{ id: "old", title: "Pizza slice line art" }]);
  });

  it("ignores a sent asset that is itself picked again", () => {
    const groups = findTwins([pick("p1", "Single slice of pepperoni pizza")], [{ id: "p1", subject: "Single slice of pepperoni pizza", title: "x", media: "vector" }]);
    expect(groups).toEqual([]);
  });

  it("never pairs a vector with a photo", () => {
    const groups = findTwins(
      [pick("v", "Ceramic mug resting on a saucer"), { ...pick("f", "Plain mug on table, senior man"), media: "photo" }],
      [],
    );
    expect(groups).toEqual([]);
  });

  it("finds nothing in a batch of distinct subjects", () => {
    const groups = findTwins(
      [
        pick("a", "Cone party popper with star confetti explosion"),
        pick("b", "Round midnight countdown clock with star hands"),
        pick("c", "Feathered venetian masquerade mask with star crown"),
        pick("d", "Victorian top hat launching mini bottle rockets"),
      ],
      [],
    );
    expect(groups).toEqual([]);
  });
});

describe("twinSubject", () => {
  it("falls back to the title", () => {
    expect(twinSubject("", "Set of 9 retro motorcycles")).toBe("Set of 9 retro motorcycles");
    expect(twinSubject("Horse", "x")).toBe("Horse");
  });
});
