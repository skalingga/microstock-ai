import { describe, expect, it } from "vitest";
import { exportLabel } from "@/lib/export/label";

describe("exportLabel", () => {
  it("names an export by its themes, most frequent first", () => {
    expect(exportLabel(["Coffee", "Autumn", "Autumn"])).toBe("Autumn, Coffee");
  });
  it("counts the themes beyond the first two", () => {
    expect(exportLabel(["A", "B", "C", "D"])).toBe("A, B +2");
  });
  it("is empty for no assets", () => {
    expect(exportLabel([])).toBe("");
  });
});
