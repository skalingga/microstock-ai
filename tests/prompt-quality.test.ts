import { describe, expect, it } from "vitest";
import { unifyPalettes } from "@/lib/generate/concept";
import { retryFeedback } from "@/lib/generate/retry";
import { SVG_EXAMPLES, SVG_EXAMPLE_NOTES } from "@/lib/providers/examples";
import { conceptsPrompt, svgPrompt } from "@/lib/providers/prompts";
import { PRESET_PALETTES, withPresetPalettes } from "@/lib/settings/palettes";
import { sanitizeSvg } from "@/lib/svg/sanitize";
import { analyzeSvg } from "@/lib/svg/stats";

describe("reference SVG example", () => {
  it("only the seamless pattern and the frame have one, each with a note", () => {
    expect(Object.keys(SVG_EXAMPLES)).toEqual(["seamless_pattern", "frame"]);
    expect(Object.keys(SVG_EXAMPLE_NOTES)).toEqual(Object.keys(SVG_EXAMPLES));
  });

  it("the pattern example is clean and grouped", () => {
    const svg = SVG_EXAMPLES.seamless_pattern!;
    expect(sanitizeSvg(svg).ok).toBe(true);
    expect(svg).not.toMatch(/<text|<image|<style|<script|stroke=/);
    expect(svg).toContain("<g id=");
    expect(analyzeSvg(svg).shapeCount).toBeGreaterThanOrEqual(5);
  });
});

describe("frame example", () => {
  const svg = SVG_EXAMPLES.frame!;

  it("is clean, grouped, transparent and within the frame shape budget", () => {
    expect(sanitizeSvg(svg).ok).toBe(true);
    expect(svg).not.toMatch(/<text|<image|<style|<script|stroke=|<rect/);
    expect(svg).toContain("<g id=");
    expect(analyzeSvg(svg).shapeCount).toBeLessThanOrEqual(90);
  });

  it("keeps the central square empty and the decoration 40 px from the edge", () => {
    const centers = [...svg.matchAll(/<(?:circle|ellipse) cx="(\d+)" cy="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(centers.length).toBeGreaterThan(40);
    for (const [x, y] of centers) {
      expect(x > 250 && x < 750 && y > 250 && y < 750).toBe(false);
      expect(Math.min(x, y, 1000 - x, 1000 - y)).toBeGreaterThanOrEqual(70);
    }
  });
});

describe("svgPrompt", () => {
  const concept = { subject: "A leaf", composition: "centered", palette: ["#C8553D"] };

  it("shows the frame example with its own note", () => {
    const frame = svgPrompt({ theme: "spring", style: "frame", concept }).user;
    expect(frame).toContain(SVG_EXAMPLES.frame!);
    expect(frame).toContain("central square left completely empty");
    expect(frame).not.toContain("opposite edge");
  });

  it("shows the example for patterns", () => {
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

describe("conceptsPrompt: similar content", () => {
  const base = { theme: "ice cream", style: "line_art" as const, palette: [], count: 4 };

  it("asks for specific subjects with one differentiator and no repeated main object", () => {
    const prompt = conceptsPrompt(base).user;
    expect(prompt).toContain("specific and distinctive");
    expect(prompt).toContain("No two concepts may share the same main object");
    expect(prompt).not.toContain("Prefer generic subjects");
  });

  it("lists the subjects Adobe refused only when there are some", () => {
    expect(conceptsPrompt(base).user).not.toContain("already refused");
    const prompt = conceptsPrompt({ ...base, avoid: ["Ice cream cone", "Galloping wild horse"] }).user;
    expect(prompt).toContain("already refused");
    expect(prompt).toContain("Ice cream cone; Galloping wild horse");
  });
});
