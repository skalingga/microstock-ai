// Stage 12: photos made by hand in Google Flow (docs/PLAN-mode-foto.md). The app writes the prompts and checks
// the uploads; Flow itself is never called.

/** Aspect ratios Flow offers for images (October 2026). */
export const PHOTO_ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16"] as const;
export type PhotoAspect = (typeof PHOTO_ASPECTS)[number];
export const DEFAULT_PHOTO_ASPECT: PhotoAspect = "4:3";

/**
 * What the prompts are for. A "background" is a picture with no subject (abstract, technology, gradient, texture)
 * that buyers put text or objects on; it follows the same Flow workflow but needs its own prompts, metadata words
 * and a looser similarity check (smooth pictures hash alike).
 */
export const PHOTO_VARIANTS = ["photo", "background", "illustration"] as const;
export type PhotoVariant = (typeof PHOTO_VARIANTS)[number];
export const DEFAULT_PHOTO_VARIANT: PhotoVariant = "photo";
/** Backgrounds are wide: desktop wallpapers and presentation slides. */
export const DEFAULT_BACKGROUND_ASPECT: PhotoAspect = "16:9";
/** Stage 16: a raster illustration (sticker, watercolor...) is a drawn picture, mostly one object; square suits it. */
export const DEFAULT_ILLUSTRATION_ASPECT: PhotoAspect = "1:1";

/**
 * Looks the user can ask for in illustration mode (docs/PLAN-mode-ilustrasi.md). `look` goes into the prompt writer as
 * the style every prompt must keep; one job is one style. JPEG has no transparency, so stickers sit on plain white.
 */
export const ILLUSTRATION_STYLES = [
  {
    value: "sticker",
    label: "Stiker kartun (die-cut)",
    look: "cute cartoon sticker illustration: bold clean outlines, flat vivid colors with simple cel shading, a thick white die-cut border around the subject, centered, isolated on a plain pure white background",
  },
  {
    value: "flat",
    label: "Ilustrasi datar berwarna",
    look: "modern flat illustration: clean geometric shapes, no outlines, a limited harmonious palette, subtle shading only, one clear subject, isolated on a plain light background",
  },
  {
    value: "watercolor",
    label: "Cat air",
    look: "soft watercolor illustration: visible paper texture, gentle color bleeds and wet edges, delicate details, one clear subject, isolated on a plain white paper background",
  },
  {
    value: "storybook",
    label: "Buku cerita anak",
    look: "warm children's storybook illustration: textured gouache and pencil feel, rounded friendly shapes, soft natural palette, one clear subject, isolated on a plain cream background",
  },
  {
    value: "isometric",
    label: "Isometrik",
    look: "detailed isometric illustration seen from a 30 degree angle: clean edges, soft lighting, a small tidy diorama of the subject, isolated on a plain pure white background",
  },
  {
    value: "retro_cartoon",
    label: "Kartun retro garis tebal",
    look: "retro mid-century cartoon illustration: thick uneven ink outlines, limited muted vintage palette with a slight print texture, one clear subject, isolated on a plain off-white background",
  },
  {
    value: "icon_set_3d",
    label: "Set ikon 3D (6 ikon per lembar)",
    look: "glossy 3D icon set: soft clay-like rounded shapes, smooth highlights, soft studio lighting, vivid harmonious colors, every icon fully visible and separate, evenly spaced in a tidy 3 by 2 grid on a clean pure white background",
  },
] as const;
export type IllustrationStyleId = (typeof ILLUSTRATION_STYLES)[number]["value"];
export const ILLUSTRATION_STYLE_IDS = ILLUSTRATION_STYLES.map((s) => s.value) as [IllustrationStyleId, ...IllustrationStyleId[]];
export const DEFAULT_ILLUSTRATION_STYLE: IllustrationStyleId = "sticker";

/**
 * Icon sheet look: one image holds several separate icons (the whole sheet is one asset, because a crop of a 2K sheet
 * is under Adobe's 4 MP minimum). It has its own prompt writer and metadata words.
 */
export const ICON_SET_STYLE: IllustrationStyleId = "icon_set_3d";
export const ICON_SET_SIZE = 6;
/** The sheet look works best wide; Flow's 16:9 2K Upscale is 4.2 MP. */
export const ICON_SET_ASPECT: PhotoAspect = "16:9";
/** Prompts written for the icon sheet say "N icons in one frame"; metadata uses it to know the picture is a sheet. */
export function isIconSetPrompt(prompt: string | undefined): boolean {
  return !!prompt && /\bicons? in one frame\b/i.test(prompt);
}

export const MAX_PHOTO_PROMPTS = 20;

/** Labels for assets.model: which Flow model made the photo, picked by the user on upload. */
export const FLOW_MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
  { value: "nano-banana-2.1", label: "Nano Banana 2.1" },
  { value: "nano-banana-2-lite", label: "Nano Banana 2 Lite" },
] as const;
export const DEFAULT_FLOW_MODEL = FLOW_MODELS[0].value;

// The original Labs address; it redirects to wherever Flow lives now.
export const FLOW_URL = "https://labs.google/fx/tools/flow";

/** Upload formats. JPEG is stored as it is; PNG and WebP are converted to JPEG in the browser. */
export const PHOTO_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const JPEG_QUALITY = 0.95;

/** The copy sent to the vision model for metadata: small enough for any request limit. */
export const VISION_MAX_SIDE = 1024;
export const VISION_JPEG_QUALITY = 0.85;
/** Base64 length cap for that copy on the server (about 1.5 MB of JPEG). */
export const VISION_MAX_DATA_URL = 2_000_000;

/** Gallery preview of a photo (long side, JPEG). */
export const PHOTO_PREVIEW_MAX_SIDE = 640;

/** Problems the vision model reports on a photo. Each one makes the photo "Perlu cek". */
export const PHOTO_PROBLEMS = {
  visible_text: "Ada teks atau huruf acak (papan, label, punggung buku, layar). Adobe menolak teks di foto AI.",
  logo_or_watermark: "Ada logo, merek, atau watermark.",
  deformed_people: "Wajah, tangan, atau tubuh orang terlihat cacat (jari, anggota badan).",
  real_person_or_brand: "Mirip orang terkenal, produk bermerek, atau desain bermerek dagang.",
  artifact: "Ada kejanggalan khas AI (benda meleleh, bentuk mustahil).",
} as const;
export type PhotoProblem = keyof typeof PHOTO_PROBLEMS;
export const PHOTO_PROBLEM_IDS = Object.keys(PHOTO_PROBLEMS) as PhotoProblem[];

/**
 * Storage of the Supabase Free plan (1 GB per common sources, 10 Oct 2026; check the Supabase dashboard when the plan
 * changes). Settings shows the use against it, since photos are about 1 MB each.
 */
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;
