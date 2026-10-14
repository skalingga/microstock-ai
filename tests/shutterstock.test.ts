import { describe, expect, it } from "vitest";
import { ADOBE_CATEGORIES } from "@/lib/adobe/rules";
import { buildShutterstockCsv, shutterstockProblems } from "@/lib/export/csv";
import { SHUTTERSTOCK, SHUTTERSTOCK_CATEGORIES, shutterstockCategories } from "@/lib/shutterstock/rules";

describe("shutterstockCategories", () => {
  it("maps every Adobe category to a listed Shutterstock category", () => {
    for (const adobe of ADOBE_CATEGORIES) {
      const [main] = shutterstockCategories(adobe);
      expect(SHUTTERSTOCK_CATEGORIES).toContain(main);
    }
  });

  it("adds People for photos with people, never twice", () => {
    expect(shutterstockCategories("Food", true)).toEqual(["Food and drink", "People"]);
    expect(shutterstockCategories("Lifestyle", true)).toEqual(["People"]);
    expect(shutterstockCategories("Business", false)).toEqual(["Business/Finance"]);
  });

  it("falls back to Miscellaneous for an unknown or missing category", () => {
    expect(shutterstockCategories(null)).toEqual(["Miscellaneous"]);
    expect(shutterstockCategories("Nonsense")).toEqual(["Miscellaneous"]);
  });
});

describe("buildShutterstockCsv", () => {
  it("writes the exact header and quotes keywords and two categories", () => {
    const csv = buildShutterstockCsv([
      { filename: "green-tea-a1b2.jpg", description: "Green tea on a wooden table", keywords: ["tea", "green", "cup"], categories: ["Food and drink", "People"] },
    ]);
    const [header, row] = csv.trimEnd().split("\n");
    expect(header).toBe(SHUTTERSTOCK.csvHeader.join(","));
    expect(header).toBe("Filename,Description,Keywords,Categories,Illustration,Mature Content,Editorial");
    expect(row).toBe('green-tea-a1b2.jpg,Green tea on a wooden table,"tea, green, cup","Food and drink,People",No,No,No');
  });

  it("keeps at most two categories", () => {
    const csv = buildShutterstockCsv([{ filename: "a.jpg", description: "A", keywords: ["a"], categories: ["Nature", "People", "Arts"] }]);
    expect(csv).toContain('"Nature,People"');
    expect(csv).not.toContain("Arts");
  });
});

describe("shutterstockProblems", () => {
  it("flags rows outside 7 to 50 keywords", () => {
    const few = { filename: "few.jpg", description: "x", keywords: ["a", "b"], categories: ["Nature"] };
    const ok = { filename: "ok.jpg", description: "x", keywords: Array.from({ length: 20 }, (_, i) => `k${i}`), categories: ["Nature"] };
    const problems = shutterstockProblems([few, ok]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("few.jpg");
  });
});
