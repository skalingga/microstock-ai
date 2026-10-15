import { ADOBE, ADOBE_CATEGORIES } from "@/lib/adobe/rules";
import { colorRangeFor, isIconStyle, isImageStyle, type ImageStyleId, type StyleId } from "@/lib/settings/schema";
import { SVG_EXAMPLES, SVG_EXAMPLE_NOTES } from "./examples";
import {
  DEFAULT_ILLUSTRATION_STYLE,
  ICON_SET_SIZE,
  ICON_SET_STYLE,
  ILLUSTRATION_STYLES,
  PHOTO_PROBLEM_IDS,
  isIconSetPrompt,
} from "@/lib/photo/config";
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
  /** Shape budget told to the model. Defaults to 60; scenes and frames need more. */
  maxShapes?: number;
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
  // Stage 14 wave 1.
  sticker: {
    viewBox: "0 0 512 512",
    brief:
      "One cartoon sticker: a single cute, simple object, animal, food item or plant, drawn with a bold dark outline (stroke-width 10, round line joins) and flat colors, with at most one small highlight shape. Add a thick white die-cut border: FIRST draw one smooth white shape that follows the silhouette about 20 px outside the artwork (this is the cut line), THEN draw the artwork on top of it. Center it with at least 40 px of margin. TRANSPARENT background: do not draw any background rectangle. No text, no letters.",
    consistency:
      "Set consistency: the same outline width (10) and the same near-black outline color, the same white border width and the same level of detail in every sticker, so this sticker sits well next to the rest of its set.",
    fills: "- Flat solid fills; the dark outline is a stroke of one constant width, and the die-cut border is a white fill. No gradients.",
    colors: (palette) =>
      `Colors: use only these colors for the fills: ${palette}. The outline is one near-black color and the die-cut border is white.`,
  },
  isometric: {
    viewBox: "0 0 800 600",
    brief:
      "One isometric object or a small isometric scene (an object on a small platform), seen from above: horizontal edges become 30 degree lines, no perspective, no vanishing points. Build every solid from parallelograms with three visible faces: the top face lightest, the left face medium, the right face darkest, all tints and shades of the same hue. No outlines. A flat, soft ground shadow is allowed. The object or scene fills about 70 percent of the canvas width: do not draw it small. Centered with a margin of at least 60 px. TRANSPARENT background: do not draw any background rectangle. No text, no letters, no screens or signs showing writing.",
    consistency:
      "Set consistency: the same isometric angle (30 degrees), the same light direction (top lightest, left medium, right darkest) and the same level of detail in every asset, so this asset sits well next to the rest of its set.",
    fills: "- Flat solid fills only: every face is its own flat polygon. No outlines and no gradients.",
    colors: (palette) => `Colors: build the faces from these colors and from darker and lighter shades of them: ${palette}.`,
    maxShapes: 80,
  },
  frame: {
    viewBox: "0 0 1000 1000",
    brief:
      "A decorative frame, wreath or border for stock use. Put all decoration in the outer band of the canvas and fill that band richly, from 40 px to about 220 px away from every edge: dense, bold ornament, never a thin hairline (no stroke thinner than 8). The central square from 250,250 to 750,750 must stay completely empty, with nothing drawn in it, so a buyer can place text or a photo there. Balanced, symmetric or rhythmic composition built from simple shapes (leaves, flowers, geometric ornaments, lines), colored with the palette (never white or near-white decoration on its own). TRANSPARENT background: do not draw any background rectangle or filled panel. No text, no letters.",
    consistency:
      "Set consistency: the same decoration style, line weight and level of detail in every frame, so this frame sits well next to the rest of its set.",
    fills: "- Flat solid fills; thin ornament lines may use strokes of one constant width. No gradients.",
    maxShapes: 90,
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
      `- Use simple <path>, <rect>, <circle>, <ellipse>, <polygon> elements and <g> groups. Keep it under ${spec.maxShapes ?? 60} shapes in total.`,
      spec.fills ?? DEFAULT_FILLS,
      "- NO <text>, <image>, <foreignObject>, <script>, <style>, filters, masks, or external links.",
      "- Use short coordinates (integers, at most one decimal) and keep every shape inside the viewBox.",
      "- Organize the drawing into a few <g> groups with short descriptive id attributes (for example id=\"leaf\", id=\"body\"), so it is easy to edit as a layered vector.",
      ...SAFETY_RULES.map((rule) => `- ${rule}`),
      "",
      ...(example
        ? ["", `Reference for structure only (${SVG_EXAMPLE_NOTES[input.style]}). Do NOT copy its subject; draw the concept above:`, example]
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
  sticker: "a cartoon sticker illustration with a thick white die-cut border on a transparent background",
  isometric: "an isometric vector illustration of an object or small scene on a transparent background",
  frame: "a decorative vector frame or border with an empty center on a transparent background",
};

export function metadataPrompt(input: MetadataInput): { system: string; user: string } {
  return {
    system:
      "You write search metadata for Adobe Stock vector assets. " +
      "You answer with a single JSON object and nothing else.",
    user: [
      `Theme (the wording the creator typed, which can be loose): ${input.theme}`,
      input.setSize
        ? `Asset type: ONE vector file that holds a grid of ${input.setSize} separate matching items of the same set. Each item is ${METADATA_STYLE[input.style]}.`
        : `Asset type: ${METADATA_STYLE[input.style]}`,
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
      ...(input.setSize
        ? [
            `This file is a set of ${input.setSize}: the title must say so (for example "Set of ${input.setSize} ..." or "... collection") and the keywords must include "set", "collection", "bundle" or "pack" together with the shared subject and style words. Do not list the items one by one.`,
          ]
        : []),
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

// Backgrounds (abstract, technology, gradient, texture) have no subject: buyers lay text, UI or objects over them.
// The category is the most crowded on Adobe Stock, so the prompts must be specific about technique and color.
const BACKGROUND_RULES = [
  "No people, no animals, no faces, no recognizable objects, no landmarks. The picture is a surface or an atmosphere, never a scene with a main subject.",
  "No text anywhere: no letters, numbers, symbols, code, interface, charts, screens with writing, logos, brand names, or watermarks. For technology themes use only abstract forms: light trails, glowing lines, particles, grids, glass, circuit-like patterns without readable parts.",
  "Never name or imitate brands, trademarks, artists, characters, or recognizable artworks.",
];

function backgroundPromptsPrompt(input: PhotoPromptsInput): { system: string; user: string } {
  return {
    system:
      "You are a stock art director planning AI-generated background images for Adobe Stock. " +
      "You write prompts for an image model and answer with a single JSON object and nothing else.",
    user: [
      `Theme: ${input.theme}`,
      `Aspect ratio of every image: ${input.aspect}`,
      "",
      ...(input.variations
        ? [
            `Write exactly ${input.count} prompts for ONE design direction: the look of the theme. Each prompt keeps the same technique and mood but changes the color pair, the light direction, the scale of the pattern or where the calm area sits, so the set is cohesive yet no two images look alike.`,
          ]
        : [
            `Write exactly ${input.count} prompts for clearly different backgrounds about this theme. Vary the technique, the color pair, the light and the composition so no two images look alike.`,
          ]),
      // Adobe refuses "similar content"; "blue abstract gradient" is already in its collection many times over.
      "Backgrounds are the most crowded category: never write the plain version (a blue gradient, generic bokeh, generic waves). Give every prompt a distinct technique AND a named color pair AND a mood or use. Techniques to draw from: blurred gradient mesh, soft bokeh light, flowing glass or liquid waves, frosted glass layers, low-poly facets, layered paper cut, halftone dots, fine grain or film texture, brushed metal, marble or ink swirls, light rays, glowing line grids, particle fields, fabric folds, watercolor wash. No two prompts may share the same technique and color pair.",
      ...(input.avoid && input.avoid.length > 0
        ? [`Adobe already refused these as too similar to existing content. Do not propose them or close variants: ${input.avoid.join("; ")}.`]
        : []),
      "Each prompt describes ONE image in 40 to 80 words of plain English: the technique or material, 2 to 4 specific colors, the light and depth, the composition, and the mood. Smooth, high resolution, clean and sharp, no noise artifacts.",
      "In at least half of the prompts, keep one side or the center calm and uncluttered for buyers who add text or a product, and say where it is.",
      ...BACKGROUND_RULES,
      "",
      'Reply with JSON only, in this exact shape: {"prompts":[{"subject":"...","prompt":"..."}]}',
      "- subject: the look in a few words, max 10 words (technique + colors), for example: frosted glass waves in teal and amber.",
      "- prompt: the full prompt for the image model. Never mention Adobe, stock, AI, or these instructions in it.",
    ].join("\n"),
  };
}

// Raster illustrations (stickers, watercolor...): drawn pictures of one clear subject. The category is crowded, and
// Adobe refuses copied styles and IP, so every prompt needs a concrete differentiator and no names.
const ILLUSTRATION_RULES = [
  "No text anywhere: no letters, numbers, speech bubbles, signs, labels, banners, logos, brand names, signatures, or watermarks. A sticker has no caption.",
  "Never name or imitate brands, trademarks, artists, illustrators, studios, fictional characters, mascots, or recognizable artworks, and never write 'in the style of' anyone. Describe the look with technique and materials only.",
  "Prefer animals, objects, plants, food, vehicles, places, and generic friendly characters. If a person appears it is a simple generic cartoon character, never a real or famous person or a lookalike.",
  "Never show or imply a real news event, disaster, protest, or politics.",
];

// Icon sheets: one image of ICON_SET_SIZE separate icons. Things that carry writing are the usual failure (badges, signed
// papers, stamps, signs, clock numerals, price tags), and Adobe refuses embedded text, so they are named and banned.
const ICON_SET_RULES = [
  "No text anywhere: no letters, numbers, words, labels, names, captions, logos, brand names, signatures, or watermarks, and no icon that normally carries writing. Avoid ID badges, certificates, contracts or agreements, stamps, signs, banners, price tags, book covers, calendars with dates, and clocks or rulers with numerals; if a clock appears it has plain tick marks only.",
  "Never name or imitate brands, trademarks, artists, studios, fictional characters, or mascots, and never write 'in the style of' anyone. Describe the look with technique and materials only.",
  "Use objects, tools, symbols, plants, animals, and buildings. No people, faces, or realistic body parts; a plain hand is the only exception.",
  "Never show or imply a real news event, disaster, protest, or politics.",
];

function iconSetPromptsPrompt(input: PhotoPromptsInput): { system: string; user: string } {
  const style = ILLUSTRATION_STYLES.find((s) => s.value === ICON_SET_STYLE)!;
  const n = ICON_SET_SIZE;
  return {
    system:
      "You are a stock illustration art director planning AI-generated raster icon sheets for Adobe Stock. " +
      "You write prompts for an image model and answer with a single JSON object and nothing else.",
    user: [
      `Theme: ${input.theme}`,
      `Aspect ratio of every image: ${input.aspect}`,
      `Look every prompt must keep: ${style.look}.`,
      "",
      ...(input.variations
        ? [
            `Write exactly ${input.count} prompts for ONE topic: the topic of the theme. Each prompt picks a different group of ${n} icons within that topic and may change the color palette, so every sheet is new yet the sheets belong together.`,
          ]
        : [
            `Write exactly ${input.count} prompts, each for a clearly different sub-topic within this theme (for the theme "business": entrepreneurship, office equipment, teamwork, marketing, sales, project management...). Each sheet has its own sub-topic.`,
          ]),
      `Each prompt describes ONE sheet of exactly ${n} different icons of the same sub-topic, drawn as separate objects. Name all ${n} icons in the prompt. No icon repeats inside a sheet, and no two prompts share more than one icon.`,
      "Every icon must be specific and commercially useful, never the most generic object of the topic, and the icons must be easy to tell apart at a small size. Name a palette of 2 to 4 specific colors for the sheet.",
      ...(input.avoid && input.avoid.length > 0
        ? [`Adobe already refused these subjects as too similar to existing content. Do not propose them or close variants: ${input.avoid.join("; ")}.`]
        : []),
      `Write each prompt as ONE single line of plain English, 30 to 70 words, with no line breaks, in this order: "3D <sub-topic> icons, ${n} icons in one frame: <the ${n} icons separated by commas>, <the look above in a few words and the palette>, clean white background, evenly spaced grid."`,
      ...ICON_SET_RULES,
      "",
      'Reply with JSON only, in this exact shape: {"prompts":[{"subject":"...","prompt":"..."}]}',
      "- subject: the sub-topic and its main icons, max 10 words.",
      "- prompt: the full one-line prompt for the image model. Never mention Adobe, stock, AI, or these instructions in it.",
    ].join("\n"),
  };
}

function illustrationPromptsPrompt(input: PhotoPromptsInput): { system: string; user: string } {
  if (input.illustrationStyle === ICON_SET_STYLE) return iconSetPromptsPrompt(input);
  const style = ILLUSTRATION_STYLES.find((s) => s.value === input.illustrationStyle) ?? ILLUSTRATION_STYLES.find((s) => s.value === DEFAULT_ILLUSTRATION_STYLE)!;
  return {
    system:
      "You are a stock illustration art director planning AI-generated raster illustrations for Adobe Stock. " +
      "You write prompts for an image model and answer with a single JSON object and nothing else.",
    user: [
      `Theme: ${input.theme}`,
      `Aspect ratio of every image: ${input.aspect}`,
      `Look every prompt must keep: ${style.look}.`,
      "",
      ...(input.variations
        ? [
            `Write exactly ${input.count} prompts for ONE subject: the subject of the theme. Each prompt keeps the same look and changes the pose, the angle, the accessories, the details or the color palette, so the set is cohesive yet no two images look alike.`,
          ]
        : [
            `Write exactly ${input.count} prompts for clearly different subjects within this theme, all in the same look. Vary the subject, the pose, the details and the palette so no two images look alike.`,
          ]),
      // Adobe refuses "similar content": the plain version of a popular subject is already in its collection many times over.
      "Every subject must be specific and commercially useful, never the most generic version of the theme. Give each one a concrete differentiator: a particular variety, era, material, activity, season, or an unusual but believable detail. Name a palette of 2 to 4 specific colors. No two prompts may share the same subject and palette.",
      ...(input.avoid && input.avoid.length > 0
        ? [`Adobe already refused these subjects as too similar to existing content. Do not propose them or close variants: ${input.avoid.join("; ")}.`]
        : []),
      "Each prompt describes ONE illustration in 40 to 80 words of plain English: the subject and its pose, the look above, the colors, the details, and the background. Clean, sharp, high resolution, one centered subject, generous margin around it, nothing cropped at the edges.",
      ...ILLUSTRATION_RULES,
      "",
      'Reply with JSON only, in this exact shape: {"prompts":[{"subject":"...","prompt":"..."}]}',
      "- subject: what the illustration shows, max 10 words.",
      "- prompt: the full prompt for the image model. Never mention Adobe, stock, AI, or these instructions in it.",
    ].join("\n"),
  };
}

export function photoPromptsPrompt(input: PhotoPromptsInput): { system: string; user: string } {
  if (input.variant === "background") return backgroundPromptsPrompt(input);
  if (input.variant === "illustration") return illustrationPromptsPrompt(input);
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
  const background = input.variant === "background";
  const illustration = input.variant === "illustration";
  const noun = background ? "picture" : illustration ? "illustration" : "photo";
  return {
    system:
      `You write search metadata for Adobe Stock ${background ? "background images" : illustration ? "raster illustrations" : "photos"} and check them for defects before upload. ` +
      `You look at the attached ${noun} and answer with a single JSON object and nothing else.`,
    user: [
      `Theme (the wording the creator typed, which can be loose): ${input.theme}`,
      ...(input.prompt ? [`Prompt the ${noun} was made from (the ${noun} may differ; describe the ${noun}): ${input.prompt}`] : []),
      "",
      `Write the metadata a buyer would search for. Describe what the ${noun} actually shows.`,
      `- title: a short, descriptive phrase of at most ${ADOBE.titleMaxChars} characters. Plain text: no commas, no quotes, no special characters. Do not mention AI or how the ${noun} was made.`,
      background
        ? '- keywords: 25 to 40 keywords ordered from most to least important (the first ten matter most). Single words or short phrases of at most three words. This is a background with no subject: include "background", "backdrop" or "wallpaper" as fitting, the style or technique (gradient, bokeh, glass, texture, geometric...), the dominant colors, the mood, the uses (presentation, website banner, social media, technology, business...), and "copy space" when an area is left empty. No brand, artist, character, or celebrity names, and no words about AI.'
        : illustration
          ? '- keywords: 25 to 40 keywords ordered from most to least important (the first ten matter most). Single words or short phrases of at most three words. Include the subject, "illustration", the art style (cartoon, sticker, watercolor, flat, isometric, retro...), the technique or materials, the dominant colors, the mood, the uses (print, card, scrapbook, children, decoration, social media...), and "isolated" or "white background" when it applies. Never use the word "vector": this is a raster image. No brand, artist, character, or celebrity names, and no words about AI.'
          : "- keywords: 25 to 40 keywords ordered from most to least important (the first ten matter most). Single words or short phrases of at most three words. Include the subject, the action, the setting, the mood, concepts the photo can illustrate, and, when people appear, how many and their age group. No brand, artist, character, or celebrity names, and no words about AI.",
      ...(illustration && isIconSetPrompt(input.prompt)
        ? [
            '- This picture is a sheet of several separate 3D icons. In the title and keywords name the sub-topic and the main icons shown, and use "3D icons", "icon set" and "icon collection" among the keywords. Describe only icons you can see. Any writing on an icon (letters, numbers, names) is visible_text.',
          ]
        : []),
      `- category: exactly one of: ${ADOBE_CATEGORIES.join(" | ")}`,
      "- has_people: true if any person or part of a person is visible, otherwise false.",
      `- problems: the defects you see, as a list using only these ids: ${PHOTO_PROBLEM_IDS.join(", ")}. visible_text = any readable or garbled letters, numbers, signs, labels or book titles. logo_or_watermark = any logo, brand mark or watermark. deformed_people = extra, missing or merged fingers, distorted faces, impossible limbs. real_person_or_brand = looks like a celebrity, a branded product or a trademarked design. artifact = melted or impossible objects and other obvious AI glitches. Be strict and report anything you notice; use an empty list only when the ${noun} is clean.`,
      "Never describe a real news event, and never mention trademarks, logos, or copyrighted characters in the metadata.",
      "",
      'Reply with JSON only, in this exact shape: {"title":"...","keywords":["..."],"category":"...","has_people":false,"problems":[]}',
    ].join("\n"),
  };
}
