import type { BenchModel } from "./benchmark";
import type { StyleId } from "@/lib/settings/schema";

// Starting points for /uji-model: the themes and models the form opens with, a pool to draw fresh themes from, and
// the saved model list (kept per browser). Pure data and small helpers so they can be tested.

export type BenchTheme = { theme: string; style: StyleId };

// One theme per style, so every model is tried on every kind of asset it can draw. Fresh subjects, not ones the
// gallery already holds many of, so the similarity check does not mark every model down alike.
export const DEFAULT_THEMES: BenchTheme[] = [
  { theme: "kitchen baking tools", style: "icon_set" },
  { theme: "home office workspace", style: "line_icon" },
  { theme: "weather forecast symbols", style: "glyph_icon" },
  { theme: "tropical monstera leaves", style: "seamless_pattern" },
  { theme: "moroccan star tiles", style: "geometric_tile" },
  { theme: "rooftop garden in the city", style: "flat_illustration" },
  { theme: "artisan bakery emblem", style: "badge_label" },
  { theme: "flowing liquid shapes", style: "abstract_background" },
  { theme: "wild birds in flight", style: "silhouette" },
  { theme: "wildflower bouquet", style: "line_art" },
];

/** Themes to draw from when the user asks for fresh ones. English, specific, and free of brands or real people. */
export const THEME_POOL: Record<StyleId, string[]> = {
  icon_set: [
    "kitchen baking tools",
    "garden tools and plants",
    "camping gear essentials",
    "coffee shop equipment",
    "school supplies",
    "sewing and craft tools",
    "bicycle repair tools",
    "picnic basket items",
    "pet care supplies",
    "travel packing items",
    "zero waste household",
    "farmers market produce",
    "science lab equipment",
    "photography gear",
  ],
  line_icon: [
    "home office workspace",
    "smart home devices",
    "gym and fitness",
    "public transport",
    "online learning",
    "healthy eating",
    "personal finance",
    "online shopping",
    "customer support",
    "cybersecurity basics",
    "renewable energy",
    "travel booking",
    "photo editing tools",
    "remote team meeting",
  ],
  glyph_icon: [
    "weather forecast symbols",
    "first aid and medical",
    "navigation and maps",
    "checkout and payment",
    "kitchen appliances",
    "hardware and tools",
    "sports equipment",
    "camera controls",
    "audio player controls",
    "document and file management",
    "nature and outdoors",
    "baby and parenting",
  ],
  seamless_pattern: [
    "tropical monstera leaves",
    "autumn mushrooms and leaves",
    "retro kitchen utensils",
    "scattered citrus slices",
    "wildflower meadow",
    "folk art birds",
    "starry night sky",
    "seashells and starfish",
    "coffee beans and cups",
    "paper kites and clouds",
    "cacti and succulents",
    "botanical herb sprigs",
    "cherry blossom branches",
    "ocean waves and boats",
  ],
  geometric_tile: [
    "moroccan star tiles",
    "art deco fans",
    "japanese wave pattern",
    "hexagon honeycomb mosaic",
    "scandinavian geometric motif",
    "mid-century modern shapes",
    "triangle mosaic",
    "interlaced knot tiles",
    "bauhaus circles and squares",
    "isometric cubes",
    "mandala tiles",
    "portuguese azulejo tiles",
  ],
  flat_illustration: [
    "rooftop garden in the city",
    "cozy reading nook",
    "farmers market stall",
    "mountain camping scene",
    "coffee roastery workshop",
    "lighthouse at sunset",
    "city bike commute",
    "balcony herb garden",
    "seaside fishing village",
    "greenhouse interior",
    "street food cart",
    "rainy day cafe window",
  ],
  badge_label: [
    "artisan bakery emblem",
    "craft brewery badge",
    "organic farm label",
    "barber shop emblem",
    "surf club badge",
    "mountain outfitters patch",
    "ice cream parlor label",
    "handmade soap label",
    "specialty coffee roasters badge",
    "vintage garage emblem",
    "florist shop label",
    "camping club patch",
  ],
  abstract_background: [
    "flowing liquid shapes",
    "soft gradient waves",
    "overlapping translucent circles",
    "paper cut layered mountains",
    "topographic contour lines",
    "organic pastel blobs",
    "diagonal color stripes",
    "sunset gradient mesh",
    "angular low poly crystals",
    "wavy ribbon flow",
    "halftone dot fade",
    "layered ocean tides",
  ],
  silhouette: [
    "wild birds in flight",
    "pine forest at dusk",
    "horses galloping",
    "city skyline at night",
    "mountain climbers",
    "deer in a meadow",
    "sailboats on waves",
    "palm trees at sunset",
    "wolf howling at the moon",
    "butterflies over flowers",
    "hot air balloons",
    "cats on a rooftop",
  ],
  sticker: [
    "happy coffee cup",
    "sleepy house cat",
    "smiling avocado",
    "grumpy cactus in a pot",
    "cheerful donut",
    "chubby baby penguin",
    "friendly houseplant",
    "tiny astronaut cat",
    "sunny lemon slice",
    "sleepy panda with a blanket",
    "baking mitten and whisk",
    "rainy day umbrella",
  ],
  isometric: [
    "warehouse with delivery boxes",
    "solar panel farm",
    "home office desk",
    "small coffee shop",
    "server room racks",
    "greenhouse with plants",
    "wind turbines on a hill",
    "electric car charging station",
    "online shopping parcel hub",
    "city rooftop garden",
    "recycling sorting plant",
    "tiny library building",
  ],
  frame: [
    "eucalyptus wreath",
    "art deco corner border",
    "tropical leaf border",
    "laurel wreath",
    "wildflower garland",
    "geometric hexagon frame",
    "christmas pine garland border",
    "vintage ornamental frame",
    "olive branch circle",
    "floral corner ornaments",
    "wave and shell border",
    "autumn leaf border",
  ],
  line_art: [
    "wildflower bouquet",
    "monstera and pothos plants",
    "sleeping cat curled up",
    "coffee cup with steam",
    "butterfly and moth",
    "mountain range panorama",
    "botanical herb branches",
    "hot air balloon",
    "seashell collection",
    "peony flower",
    "fox in a forest",
    "ceramic vases with branches",
  ],
};

/**
 * A theme of this style that is not on screen and was not shown recently. When the pool runs dry the recent
 * list is ignored (but never the themes on screen), so the button always finds something while the pool has a spare.
 */
export function freshTheme(
  style: StyleId,
  onScreen: string[],
  recent: string[] = [],
  random: () => number = Math.random,
): string | null {
  const pool = THEME_POOL[style] ?? [];
  const taken = new Set([...onScreen, ...recent].map((t) => t.trim().toLowerCase()));
  const onScreenOnly = new Set(onScreen.map((t) => t.trim().toLowerCase()));
  let options = pool.filter((t) => !taken.has(t.toLowerCase()));
  if (options.length === 0) options = pool.filter((t) => !onScreenOnly.has(t.toLowerCase()));
  if (options.length === 0) return null;
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

/** Every row gets a new theme of its own style; rows that cannot get one keep theirs. */
export function freshThemes(themes: BenchTheme[], recent: string[] = [], random: () => number = Math.random): BenchTheme[] {
  const used = themes.map((t) => t.theme);
  const out: BenchTheme[] = [];
  for (const t of themes) {
    const next = freshTheme(t.style, [...used, ...out.map((o) => o.theme)], recent, random);
    out.push(next ? { ...t, theme: next } : t);
  }
  return out;
}

// Text models: the incumbents (gemini-3.5-flash-lite, muse-spark) plus the upgrades Kenari listed on 14 Oct 2026
// (deepseek-v4-1-flash is about a tenth of v4-flash's price). Tested 15 Oct 2026 and left out: gemini-3.7-flash (503 on
// all 16 calls) and gemini-4-argon (never finished a call on the free tier). Both stay in the "add model" list. Image models: the default, its cheap
// sibling, a free one, and a cheap newcomer; they only draw the Siluet and Line art themes.
export const DEFAULT_MODELS: BenchModel[] = [
  { provider: "gemini", model: "gemini-3.5-flash-lite" },
  { provider: "kenari", model: "muse-spark-1-3-contributor:free" },
  { provider: "kenari", model: "agnes-3-0-flash:free" },
  { provider: "kenari", model: "deepseek-v4-1-flash" },
  { provider: "kenari", model: "gpt-image-2" },
  { provider: "kenari", model: "nano-banana-2-lite" },
  { provider: "kenari", model: "agnes-image-2-5-flash:free" },
  { provider: "kenari", model: "qwen-image-3.0-pro" },
];

/** Bump when DEFAULT_MODELS changes meaningfully: saved lists from an older version are dropped for the new defaults. */
export const MODEL_PREFS_VERSION = 2;
export const MODEL_PREFS_KEY = "uji-model:models";
export const RECENT_THEMES_KEY = "uji-model:recent-themes";
export const RECENT_THEMES_MAX = 40;

export type ModelPrefs = {
  /** Models in the compared list. */
  models: BenchModel[];
  /** Keys ("provider|model") of the ticked ones. */
  checked: string[];
  /** Keys hidden from the "add model" dropdown. */
  hidden: string[];
};

const isModel = (m: unknown): m is BenchModel =>
  typeof m === "object" &&
  m !== null &&
  ((m as BenchModel).provider === "kenari" || (m as BenchModel).provider === "gemini") &&
  typeof (m as BenchModel).model === "string" &&
  (m as BenchModel).model.length > 0 &&
  (m as BenchModel).model.length <= 120;

/** Reads what was saved in the browser; null for anything missing, from another version, or malformed. */
export function parseModelPrefs(raw: string | null): ModelPrefs | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { v?: number; models?: unknown; checked?: unknown; hidden?: unknown };
    if (data.v !== MODEL_PREFS_VERSION || !Array.isArray(data.models)) return null;
    const models = data.models.filter(isModel).map((m) => ({ provider: m.provider, model: m.model }));
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, 500) : []);
    return { models, checked: strings(data.checked), hidden: strings(data.hidden) };
  } catch {
    return null;
  }
}

export function serializeModelPrefs(prefs: ModelPrefs): string {
  return JSON.stringify({ v: MODEL_PREFS_VERSION, ...prefs });
}
