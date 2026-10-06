import type { StyleId } from "@/lib/settings/schema";
import type { ConceptInput, SvgInput } from "./types";

// Prompts to the AI are in English (CLAUDE.md).

type StyleSpec = { viewBox: string; brief: string };

const STYLE_SPECS: Record<StyleId, StyleSpec> = {
  icon_set: {
    viewBox: "0 0 512 512",
    brief:
      "One simple flat icon, centered with comfortable margin. TRANSPARENT background: do not draw any background rectangle or backdrop shape. Bold, simple shapes that stay readable at 64px.",
  },
  seamless_pattern: {
    viewBox: "0 0 512 512",
    brief:
      "A seamless repeating pattern tile. Elements that cross an edge must continue on the opposite edge so the tile joins perfectly when repeated. A full-size background rectangle is allowed.",
  },
  flat_illustration: {
    viewBox: "0 0 800 600",
    brief:
      "A simple flat illustration with a clear focal subject. Flat shapes only, no outlines needed. No realistic people: use objects, plants, animals, or abstract figures.",
  },
  badge_label: {
    viewBox: "0 0 512 512",
    brief:
      "A badge or label emblem built from shapes (ribbon, shield, circle, banner). The badge MUST contain NO text and NO letters or numbers; use icons or decorative shapes instead.",
  },
  abstract_background: {
    // 3:2, not 16:9: Adobe wants at least 15 MP but at most 4800 px per side, which a 16:9 canvas cannot satisfy.
    viewBox: "0 0 1500 1000",
    brief:
      "An abstract geometric background that fills the whole canvas edge to edge. Overlapping simple shapes, balanced composition, calm area for placing text later.",
  },
};

const SAFETY_RULES = [
  "Never depict or reference brands, logos, trademarks, celebrities, real people, artists, fictional characters, or any other copyrighted or trademarked material.",
  "Avoid realistic people.",
];

export function conceptsPrompt(input: ConceptInput): { system: string; user: string } {
  const spec = STYLE_SPECS[input.style];
  const palette = input.palette.length > 0 ? input.palette.join(", ") : "any harmonious flat colors";

  return {
    system:
      "You are a creative director planning vector stock assets for Adobe Stock. " +
      "You answer with a single JSON object and nothing else.",
    user: [
      `Theme: ${input.theme}`,
      `Asset style: ${input.style} (${spec.brief})`,
      `Available palette: ${palette}`,
      "",
      `Propose exactly ${input.count} clearly different concepts for this theme. Vary subject, composition, and color combination so no two assets look alike.`,
      "Each concept must be easy to draw with a handful of flat vector shapes.",
      ...SAFETY_RULES,
      "",
      'Reply with JSON only, in this exact shape: {"concepts":[{"subject":"...","composition":"...","palette":["#RRGGBB","#RRGGBB"]}]}',
      "- subject: what is drawn, max 12 words.",
      "- composition: layout and arrangement, max 20 words.",
      "- palette: 2 to 5 hex colors chosen from the available palette.",
    ].join("\n"),
  };
}

export function svgPrompt(input: SvgInput): { system: string; user: string } {
  const spec = STYLE_SPECS[input.style];
  const palette = input.concept.palette.length > 0 ? input.concept.palette.join(", ") : "harmonious flat colors";

  return {
    system:
      "You are an expert vector illustrator who writes clean, hand-editable SVG code for stock marketplaces. " +
      "You reply with the SVG code only: no explanation and no markdown.",
    user: [
      `Theme: ${input.theme}`,
      `Concept: ${input.concept.subject}. ${input.concept.composition}`,
      `Style: ${spec.brief}`,
      `Colors: use only these colors (plus white or near-black if needed): ${palette}`,
      "",
      "Technical rules:",
      `- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="${spec.viewBox}">.`,
      "- Use simple <path>, <rect>, <circle>, <ellipse>, <polygon> elements and <g> groups. Keep it under 60 shapes in total.",
      "- Flat solid fills. At most one or two simple linear gradients if really needed.",
      "- NO <text>, <image>, <foreignObject>, <script>, <style>, filters, masks, or external links.",
      "- Use short coordinates (integers, at most one decimal) and keep every shape inside the viewBox.",
      "- Organize the drawing into a few <g> groups with short descriptive id attributes (for example id=\"leaf\", id=\"body\"), so it is easy to edit as a layered vector.",
      ...SAFETY_RULES.map((rule) => `- ${rule}`),
      "",
      "Output the complete SVG now.",
    ].join("\n"),
  };
}
