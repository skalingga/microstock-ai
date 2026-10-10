import { ADOBE, ADOBE_CATEGORIES } from "@/lib/adobe/rules";
import { colorRangeFor, isIconStyle, isImageStyle, type ImageStyleId, type StyleId } from "@/lib/settings/schema";
import { SVG_EXAMPLES } from "./examples";
import { PHOTO_PROBLEM_IDS } from "@/lib/photo/config";
import type { ConceptInput, MetadataInput, PhotoMetadataInput, PhotoPromptsInput, SvgInput, ThemesInput } from "./types";

// Prompts to the AI are in English (CLAUDE.md).

type StyleSpec = {
  viewBox: string;
  brief: string;
  /** What keeps the assets of one set looking alike. Defaults to flat fills without outlines. */
  consistency?: string;
  /** Fill and stroke rule in the technical list. Defaults to flat fills with at most two gradients. */
  fills?: string;
  /** Which colors to use, as a sentence. Defaults to "only these colors (plus white or near-black)". */
  colors?: (palette: string) => string;
};

const DEFAULT_CONSISTENCY = "Set consistency: flat solid fills and no outlines, so this asset sits well next to the rest of its set.";
const DEFAULT_FILLS = "- Flat solid fills. At most one or two simple linear gradients if really needed.";

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
  // Stage 10: interface-style icons and tiles, written by the text model. 512 grid, 48 px padding.
  line_icon: {
    viewBox: "0 0 512 512",
    brief:
      "One outline icon made of strokes only: stroke-width 24 on the 512 grid, stroke-linecap round, stroke-linejoin round, fill none. One color, centered with 48 px padding. TRANSPARENT background: do not draw any background rectangle or backdrop shape. Simple geometry that stays readable at 32px.",
    consistency:
      "Set consistency: every shape uses the same stroke width (24), round line caps, round line joins and the same single stroke color, so this icon sits well next to the rest of its set.",
    fills: '- Outline only: every shape has fill="none" and a stroke. No gradients and no filled areas (a tiny solid dot such as an eye is fine).',
    colors: (palette) => `Color: draw every stroke in this one color: ${palette.split(", ")[0]}.`,
  },
  glyph_icon: {
    viewBox: "0 0 512 512",
    brief:
      "One solid glyph icon: bold filled shapes in one or two colors, no outlines, centered with 48 px padding. TRANSPARENT background: do not draw any background rectangle or backdrop shape. Simple geometry that stays readable at 32px.",
    consistency:
      "Set consistency: solid filled shapes only, no outlines, the same visual weight and the same corner rounding in every icon, so this icon sits well next to the rest of its set.",
    fills: "- Flat solid fills in one or two colors. No strokes and no gradients.",
    colors: (palette) => `Colors: use only these colors: ${palette}.`,
  },
  geometric_tile: {
    viewBox: "0 0 512 512",
    brief:
      "One square geometric tile that fills the whole canvas: a solid rounded square (corner radius 48) with a bold symmetric motif built from lines and simple shapes (mirror or rotational symmetry). No text.",
    consistency:
      "Set consistency: the same tile shape, frame width and motif density in every tile, so this tile sits well next to the rest of its set.",
    fills: "- Flat solid fills; the motif may use strokes of one constant width. No gradients.",
    colors: (palette) => `Colors: use only these colors: ${palette}.`,
  },
  // Drawn by an image model and traced (stage 7): the viewBox is unused, the brief steers the concepts.
  silhouette: {
    viewBox: "0 0 1024 1024",
    brief:
      "A solid black silhouette with a strong, instantly readable outline and no interior detail. Either one subject or a small set of 3 to 6 variations of it (different poses or sizes) on one artboard.",
  },
  line_art: {
    viewBox: "0 0 1024 1024",
    brief:
      "Black ink line art with clean bold outlines and a few solid black areas, white inside, no shading or hatching. One subject, side or three-quarter view.",
  },
};

// What the image model is asked to draw for each traced style. The tracer keeps only dark pixels, so the picture
// must be pure black on pure white, with nothing else around the subject.
const IMAGE_STYLE_PROMPT: Record<ImageStyleId, string> = {
  silhouette:
    "solid flat black silhouette, completely filled with black, no interior lines, no highlights, smooth clean edges, like a vector cut-out",
  line_art:
    "black and white vector line art, clean bold black outlines with a few solid black areas, white fills inside, no shading, no hatching, no cross-hatching, no gradients, no grey tones",
};

const SAFETY_RULES = [
  "Never depict or reference brands, logos, trademarks, celebrities, real people, artists, fictional characters, or any other copyrighted or trademarked material.",
  "Avoid realistic people.",
];

export function conceptsPrompt(input: ConceptInput): { system: string; user: string } {
  const spec = STYLE_SPECS[input.style];
  const traced = isImageStyle(input.style);
  // Traced styles are always black, so there is no palette to plan with.
  const palette = traced ? "black only" : input.palette.length > 0 ? input.palette.join(", ") : "any harmonious flat colors";
  const range = colorRangeFor(input.style);
  const icons = isIconStyle(input.style);

  return {
    system:
      "You are a creative director planning vector stock assets for Adobe Stock. " +
      "You answer with a single JSON object and nothing else.",
    user: [
      `Theme: ${input.theme}`,
      `Asset style: ${input.style} (${spec.brief})`,
      `Available palette: ${palette}`,
      "",
      ...(input.variations
        ? [
            `Propose exactly ${input.count} variations of ONE subject: the subject of the theme. Every concept keeps the same kind of subject and the same visual language, but differs clearly in pose or direction, proportions, level of detail, pattern or decoration, so no two assets look alike. Never change the style.`,
            // Adobe refuses "similar content": each variation still needs its own recognizable difference.
            "Name each variation by what makes it different, for example the pattern, the pose or the accessory.",
          ]
        : [
            `Propose exactly ${input.count} clearly different concepts for this theme. Vary subject, composition, and color combination so no two assets look alike.`,
            // Adobe refuses "similar content": the plain version of a common object is already in its collection many times over.
            "Every subject must be specific and distinctive, never the plain, most common version of an everyday object. Give each one a concrete differentiator: a particular variety, breed, or era, an unusual pairing of objects, or a distinctive pose or composition. No two concepts may share the same main object.",
          ]),
      ...(input.avoid && input.avoid.length > 0
        ? [`Adobe already refused these subjects as too similar to existing content. Do not propose them or close variants: ${input.avoid.join("; ")}.`]
        : []),
      traced
        ? "Each concept must read clearly in black and white alone: a recognizable outline, no fine texture."
        : icons
          ? "Each concept must be one simple, instantly readable symbol that works at 32px."
          : "Each concept must be easy to draw with a handful of flat vector shapes.",
      traced
        ? "The concepts form ONE cohesive set sold together: the same visual language and level of detail. Vary the subject and composition, never the style. Subjects must be recognizable but specific; never a specific real product model."
        : "The concepts form ONE cohesive set sold together: the same visual language, the same level of detail, and colors only from the available palette. Vary the subject and composition, never the style.",
      ...SAFETY_RULES,
      "",
      'Reply with JSON only, in this exact shape: {"concepts":[{"subject":"...","composition":"...","palette":["#RRGGBB","#RRGGBB"]}]}',
      "- subject: what is drawn, max 12 words.",
      "- composition: layout and arrangement, max 20 words.",
      traced
        ? '- palette: always ["#000000"].'
        : `- palette: ${
            range.max === 1
              ? "exactly 1 hex color copied exactly from the available palette, the same color in every concept"
              : `${range.min === range.max ? range.min : `${range.min} to ${range.max}`} hex colors copied exactly from the available palette`
          }. Never invent a color.`,
    ].join("\n"),
  };
}

export function svgPrompt(input: SvgInput): { system: string; user: string } {
  const spec = STYLE_SPECS[input.style];
  const example = SVG_EXAMPLES[input.style];
  const palette = input.concept.palette.length > 0 ? input.concept.palette.join(", ") : "harmonious flat colors";

  return {
    system:
      "You are an expert vector illustrator who writes clean, hand-editable SVG code for stock marketplaces. " +
      "You reply with the SVG code only: no explanation and no markdown.",
    user: [
      `Theme: ${input.theme}`,
      `Concept: ${input.concept.subject}. ${input.concept.composition}`,
      `Style: ${spec.brief}`,
      spec.colors ? spec.colors(palette) : `Colors: use only these colors (plus white or near-black if needed): ${palette}`,
      "",
      spec.consistency ?? DEFAULT_CONSISTENCY,
      "",
      "Technical rules:",
      `- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="${spec.viewBox}">.`,
      "- Use simple <path>, <rect>, <circle>, <ellipse>, <polygon> elements and <g> groups. Keep it under 60 shapes in total.",
      spec.fills ?? DEFAULT_FILLS,
      "- NO <text>, <image>, <foreignObject>, <script>, <style>, filters, masks, or external links.",
      "- Use short coordinates (integers, at most one decimal) and keep every shape inside the viewBox.",
      "- Organize the drawing into a few <g> groups with short descriptive id attributes (for example id=\"leaf\", id=\"body\"), so it is easy to edit as a layered vector.",
      ...SAFETY_RULES.map((rule) => `- ${rule}`),
      "",
      ...(example
        ? ["", "Reference for structure only (how shapes crossing an edge are repeated on the opposite edge). Do NOT copy its subject; draw the concept above:", example]
        : []),
      ...(input.feedback
        ? ["", `Your previous attempt was rejected by the quality check: ${input.feedback} Fix this in the new version.`]
        : []),
      "",
      "Output the complete SVG now.",
    ].join("\n"),
  };
}

/** Prompt for the image model behind the traced styles (silhouette, line art). English, one paragraph. */
export function imagePrompt(input: SvgInput & { style: ImageStyleId }): string {
  return [
    `${input.concept.subject}. ${input.concept.composition}.`,
    `Theme: ${input.theme}.`,
    `Style: ${IMAGE_STYLE_PROMPT[input.style]}.`,
    "Isolated on a pure white background with nothing else in the picture: no ground line, no cast shadow, no frame, no text, no letters, no numbers, no watermark, no logo.",
    "Generic design: not a specific real product, car model, brand, character, celebrity or person.",
    "Stock vector clipart, crisp edges, the subject fills most of the picture with a small even margin.",
  ].join(" ");
}

// How each style is described to the metadata writer. The internal style id (for example "icon_set") must never
// reach the model: it made titles and keywords call clipart an "icon", but Adobe reserves that label for interface
// symbols and the app has no icon mode.
const METADATA_STYLE: Record<StyleId, string> = {
  icon_set: "a single flat vector clipart illustration on a transparent background",
  seamless_pattern: "a seamless repeating pattern tile",
  flat_illustration: "a flat vector illustration",
  badge_label: "a badge or label emblem",
  abstract_background: "an abstract geometric background",
  silhouette: "a solid black vector silhouette on a transparent background",
  line_art: "a black and white vector line art illustration on a transparent background",
  line_icon: "a single outline vector icon with uniform stroke width on a transparent background",
  glyph_icon: "a single solid glyph vector icon on a transparent background",
  geometric_tile: "a square geometric vector tile with a symmetric motif",
};

export function metadataPrompt(input: MetadataInput): { system: string; user: string } {
  return {
    system:
      "You write search metadata for Adobe Stock vector assets. " +
      "You answer with a single JSON object and nothing else.",
    user: [
      `Theme (the wording the creator typed, which can be loose): ${input.theme}`,
      `Asset type: ${METADATA_STYLE[input.style]}`,
      `What the vector shows: ${input.concept}`,
      "",
      "Write the metadata a buyer would search for. Describe what the picture actually shows.",
      `- title: a short, descriptive phrase of at most ${ADOBE.titleMaxChars} characters. Plain text: no commas, no quotes, no special characters.`,
      `- keywords: 25 to 35 keywords ordered from most to least important (the first ten matter most). Single words or short phrases of at most three words. Include the subject, colors, style words such as "flat vector", "vector illustration" or "clipart", and likely use cases. No brand, artist, character, or celebrity names.`,
      `- category: exactly one of: ${ADOBE_CATEGORIES.join(" | ")}`,
      "- needs_release: true only if the picture shows a realistic person or a real private property, otherwise false.",
      isIconStyle(input.style)
        ? 'This picture is an interface-style icon, so the words "icon" and "icon set" are right for the title and keywords. Do not use "pictogram".'
        : "Never use the words icon, icons, icon set, pictogram or glyph in the title or keywords, even if the theme above uses them: Adobe reserves them for interface symbols, and this picture is an illustration.",
      "Never describe a real news event, and never mention trademarks, logos, or copyrighted characters.",
      "",
      'Reply with JSON only, in this exact shape: {"title":"...","keywords":["..."],"category":"...","needs_release":false}',
    ].join("\n"),
  };
}

export function themesPrompt(input: ThemesInput): { system: string; user: string } {
  const events =
    input.events.length > 0
      ? input.events.map((e) => `- ${e.name} (${e.date}, importance ${e.weight}/3)`).join("\n")
      : "- (no dated events in this period)";

  return {
    system:
      "You are a stock-content market analyst advising a contributor who sells flat vector assets (icons, seamless patterns, flat illustrations, badges, abstract backgrounds) on Adobe Stock. " +
      "You answer with a single JSON object and nothing else.",
    user: [
      `Market: ${input.region}`,
      input.category ? `Focus: ${input.category}` : "",
      "Upcoming events in the chosen period:",
      events,
      "",
      `Propose exactly ${input.count} distinct, specific theme ideas that buyers in this market will search for around these events or in this season. Mix event themes and a few evergreen themes.`,
      "Each theme must be drawable as simple flat vector shapes. Prefer specific themes (\"autumn harvest pumpkins\") over vague ones (\"autumn\").",
      "Theme titles and keywords are in English. A title names the SUBJECT only (e.g. \"Easter egg hunt\"); never put an asset style such as icons, seamless pattern, flat vector, set, or background in a title.",
      ...SAFETY_RULES,
      "Never use event names that are trademarked brands. Do not reference real news events.",
      "",
      'Reply with JSON: {"themes":[{"title":"...","event":"<exact event name from the list, or empty string>","keywords":["5 to 10 search keywords, most important first"],"demand_guess":0-100,"competition_guess":0-100}]}',
      "demand_guess is how much buyers search for it; competition_guess is how crowded Adobe Stock likely is. These are rough estimates.",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

// Stage 12: prompts for photos the user makes by hand in Google Flow (Nano Banana), and metadata for the uploads.
// Photos may show people, but only fictional ones (Adobe: "People and Property are fictional").
const PHOTO_RULES = [
  "People, when present, are fictional ordinary adults of diverse backgrounds with natural expressions; never a real or famous person, never a lookalike. Keep hands relaxed or simply posed: avoid complex finger gestures and hands holding small objects close to the camera.",
  "No text anywhere in the picture: no signs, labels, posters, screens with writing, book titles, packaging, logos, brand names, watermarks, or captions. Books have plain spines, packaging is plain and unbranded.",
  "Never name or depict brands, trademarks, celebrities, artists, fictional characters, recognizable artworks, or private property that could need a release.",
  "Never show or imply a real news event, disaster, protest, politics, or anything that looks like documentary coverage of a real event.",
];

export function photoPromptsPrompt(input: PhotoPromptsInput): { system: string; user: string } {
  return {
    system:
      "You are a stock photography art director planning AI-generated photos for Adobe Stock. " +
      "You write prompts for a photorealistic image model and answer with a single JSON object and nothing else.",
    user: [
      `Theme: ${input.theme}`,
      `Aspect ratio of every photo: ${input.aspect}`,
      "",
      ...(input.variations
        ? [
            `Write exactly ${input.count} prompts that show ONE subject: the subject of the theme. Each prompt changes the setting, action, camera angle, time of day or people, so no two photos look alike.`,
          ]
        : [
            `Write exactly ${input.count} prompts for clearly different photos about this theme. Vary the scene, the action, the setting, the camera angle and the lighting so no two photos look alike.`,
          ]),
      // Adobe refuses "similar content": the plain version of a common scene is already in its collection many times over.
      "Every scene must be specific and commercially useful, never the most generic version of the theme. Give each one a concrete differentiator: a particular place, activity, season, age group, or an unusual but believable situation. No two prompts may share the same main scene.",
      ...(input.avoid && input.avoid.length > 0
        ? [`Adobe already refused these subjects as too similar to existing content. Do not propose them or close variants: ${input.avoid.join("; ")}.`]
        : []),
      "Each prompt describes one photorealistic stock photo in 40 to 80 words of plain English: subject and action, setting, lighting, camera angle and lens feel, mood, and color palette. Natural, candid, high detail, sharp focus.",
      "In about a third of the prompts, leave calm empty space on one side of the frame for buyers who add their own text.",
      ...PHOTO_RULES,
      "",
      'Reply with JSON only, in this exact shape: {"prompts":[{"subject":"...","prompt":"..."}]}',
      "- subject: what the photo shows, max 10 words.",
      "- prompt: the full prompt for the image model. Never mention Adobe, stock, AI, or these instructions in it.",
    ].join("\n"),
  };
}

export function photoMetadataPrompt(input: Omit<PhotoMetadataInput, "image">): { system: string; user: string } {
  return {
    system:
      "You write search metadata for Adobe Stock photos and check them for defects before upload. " +
      "You look at the attached photo and answer with a single JSON object and nothing else.",
    user: [
      `Theme (the wording the creator typed, which can be loose): ${input.theme}`,
      ...(input.prompt ? [`Prompt the photo was made from (the photo may differ; describe the photo): ${input.prompt}`] : []),
      "",
      "Write the metadata a buyer would search for. Describe what the photo actually shows.",
      `- title: a short, descriptive phrase of at most ${ADOBE.titleMaxChars} characters. Plain text: no commas, no quotes, no special characters. Do not mention AI or how the photo was made.`,
      "- keywords: 25 to 40 keywords ordered from most to least important (the first ten matter most). Single words or short phrases of at most three words. Include the subject, the action, the setting, the mood, concepts the photo can illustrate, and, when people appear, how many and their age group. No brand, artist, character, or celebrity names, and no words about AI.",
      `- category: exactly one of: ${ADOBE_CATEGORIES.join(" | ")}`,
      "- has_people: true if any person or part of a person is visible, otherwise false.",
      `- problems: the defects you see, as a list using only these ids: ${PHOTO_PROBLEM_IDS.join(", ")}. visible_text = any readable or garbled letters, numbers, signs, labels or book titles. logo_or_watermark = any logo, brand mark or watermark. deformed_people = extra, missing or merged fingers, distorted faces, impossible limbs. real_person_or_brand = looks like a celebrity, a branded product or a trademarked design. artifact = melted or impossible objects and other obvious AI glitches. Be strict and report anything you notice; use an empty list only when the photo is clean.`,
      "Never describe a real news event, and never mention trademarks, logos, or copyrighted characters in the metadata.",
      "",
      'Reply with JSON only, in this exact shape: {"title":"...","keywords":["..."],"category":"...","has_people":false,"problems":[]}',
    ].join("\n"),
  };
}
