import { describe, expect, it } from "vitest";
import { unifyPalettes } from "@/lib/generate/concept";
import { SVG_EXAMPLES } from "@/lib/providers/examples";
import { conceptsPrompt, svgPrompt } from "@/lib/providers/prompts";
import { PRESET_PALETTES, withPresetPalettes } from "@/lib/settings/palettes";
import { STYLES } from "@/lib/settings/schema";
import { sanitizeSvg } from "@/lib/svg/sanitize";
import { analyzeSvg } from "@/lib/svg/stats";

describe("reference SVG examples", () => {
  for (const { value: style } of STYLES) {
    it(`${style}: is clean, grouped and clears the minimum shape count`, () => {
      const svg = SVG_EXAMPLES[style];
      const clean = sanitizeSvg(svg);
      expect(clean.ok).toBe(true);
      expect(svg).not.toMatch(/<text|<image|<style|<script|stroke=/);
      expect(svg).toContain("<g id=");
      expect(analyzeSvg(svg).shapeCount).toBeGreaterThanOrEqual(5);
    });
  }
});

describe("svgPrompt", () => {
  it("shows the example of the chosen style only and says not to copy its subject", () => {
    const prompt = svgPrompt({
      theme: "autumn",
      style: "badge_label",
      concept: { subject: "A leaf badge", composition: "centered", palette: ["#C8553D"] },
    }).user;
    expect(prompt).toContain(SVG_EXAMPLES.badge_label);
    expect(prompt).not.toContain(SVG_EXAMPLES.icon_set);
    expect(prompt).toContain("Do NOT copy its subject");
  });
});

describe("conceptsPrompt", () => {
  it("asks for one cohesive set drawn from the palette", () => {
    const prompt = conceptsPrompt({ theme: "autumn", style: "icon_set", palette: ["#C8553D", "#F2A65A"], count: 4 }).user;
    expect(prompt).toContain("ONE cohesive set");
    expect(prompt).toContain("Never invent a color");
  });
});

describe("unifyPalettes", () => {
  const concept = (palette: string[]) => ({ subject: "s", composition: "c", palette });

  it("keeps palette colors and drops invented ones, ignoring case", () => {
    const [out] = unifyPalettes([concept(["#c8553d", "#123456", "#F2A65A"])], ["#C8553D", "#F2A65A", "#E9C46A"]);
    expect(out.palette).toEqual(["#C8553D", "#F2A65A"]);
  });

  it("falls back to the whole palette when too few colors are left", () => {
    const [out] = unifyPalettes([concept(["#111111", "#222222"])], ["#C8553D", "#F2A65A", "#E9C46A"]);
    expect(out.palette).toEqual(["#C8553D", "#F2A65A", "#E9C46A"]);
  });

  it("leaves concepts alone when no palette is chosen", () => {
    const input = [concept(["#111111"])];
    expect(unifyPalettes(input, [])).toBe(input);
  });
});

describe("withPresetPalettes", () => {
  it("lists own palettes first and skips presets with a taken name", () => {
    const own = [{ name: "halloween", colors: ["#000000"] }];
    const all = withPresetPalettes(own);
    expect(all[0]).toBe(own[0]);
    expect(all.filter((p) => p.name.toLowerCase() === "halloween")).toHaveLength(1);
    expect(all).toHaveLength(PRESET_PALETTES.length);
  });

  it("only offers valid hex colors", () => {
    for (const p of PRESET_PALETTES) for (const c of p.colors) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
