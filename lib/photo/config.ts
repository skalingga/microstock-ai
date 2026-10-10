// Stage 12: photos made by hand in Google Flow (docs/PLAN-mode-foto.md). The app writes the prompts and checks
// the uploads; Flow itself is never called.

/** Aspect ratios Flow offers for images (October 2026). */
export const PHOTO_ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16"] as const;
export type PhotoAspect = (typeof PHOTO_ASPECTS)[number];
export const DEFAULT_PHOTO_ASPECT: PhotoAspect = "4:3";

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
