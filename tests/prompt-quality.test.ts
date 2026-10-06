import { describe, expect, it } from "vitest";
import { unifyPalettes } from "@/lib/generate/concept";
import { retryFeedback } from "@/lib/generate/retry";
import { SVG_EXAMPLES } from "@/lib/providers/examples";
import { conceptsPrompt, svgPrompt } from "@/lib/providers/prompts";
import { PRESET_PALETTES, withPresetPalettes } from "@/lib/settings/palettes";
import { sanitizeSvg } from "@/lib/svg/sanitize";
import { analyzeSvg } from "@/lib/svg/stats";

describe("reference SVG example", () => {
  it("only the seamless pattern has one, and it is clean and grouped", () => {
    expect(Object.keys(SVG_EXAMPLES)).toEqual(["seamless_pattern"]);
    const svg = SVG_EXAMPLES.seamless_pattern!;
    expect(sanitizeSvg(svg).ok).toBe(true);
    expect(svg).not.toMatch(/<text|<image|<style|<script|stroke=/);
    expect(svg).toContain("<g id=");
    expect(analyzeSvg(svg).shapeCount).toBeGreaterThanOrEqual(5);
  });
});

describe("svgPrompt", () => {
  const concept = { subject: "A leaf", composition: "centered", palette: ["#C8553D"] };

  it("shows the example for patterns only", () => {
    const pattern = svgPrompt({ theme: "autumn", style: "seamless_pattern", concept }).user;
    expect(pattern).toContain(SVG_EXAMPLES.seamless_pattern!);
    expect(pattern).toContain("Do NOT copy its subject");
    expect(svgPrompt({ theme: "autumn", style: "badge_label", concept }).user).not.toContain("Reference for structure");
  });

  it("adds the QC feedback on a retry", () => {
    const user = svgPrompt({ theme: "t", style: "icon_set", concept, feedback: "It was empty." }).user;
    expect(user).toContain("previous attempt was rejected");
    expect(user).toContain("It was empty.");
  });
});

describe("retryFeedback", () => {
  it("turns failing checks into instructions and ignores the rest", () => {
    const notes = [
      { check: "pola" as const, status: "gagal" as const, message: "x" },
      { check: "kemiripan" as const, status: "cek" as const, message: "x" },
      { check: "kosong" as const, status: "ok" as const, message: "x" },
    ];
    expect(retryFeedback(notes)).toContain("did not join at the seams");
    expect(retryFeedback(notes)).not.toContain("empty");
  });

  it("returns null when nothing a retry can fix has failed", () => {
    expect(retryFeedback([{ check: "kemiripan", status: "cek", message: "x" }])).toBeNull();
    expect(retryFeedback([{ check: "validitas", status: "gagal", message: "x" }])).toBeNull();
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
