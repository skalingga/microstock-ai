// Kenari prices image models per picture, and its public catalog (GET /v1/models) shows 0 for them,
// so the prices live here. Source: Kenari dashboard, Model > Gambar, read on 2026-10-07. Check it again when
// Kenari changes prices: a missing or stale price makes the monthly budget wrong.

export const KENARI_IMAGE_FALLBACK_MODEL = "gpt-image-2";

/** Rupiah per generated picture. */
export const KENARI_IMAGE_PRICES_IDR: Record<string, number> = {
  "gpt-image-2": 125,
  "gpt-image-2-5-flare": 550,
  "gpt-image-2-5-sunburst": 750,
  "grok-imagine-image": 300,
  "grok-imagine-image-2-0": 900,
  "grok-imagine-image-quality": 750,
  "hunyuan-image-alpha": 350,
  "hunyuan-image-v2.0": 150,
  "hunyuan-image-v3.0": 250,
  "hunyuan-image-v3.0-art": 300,
  "nano-banana": 150,
  "nano-banana-2": 250,
  "nano-banana-2-1": 300,
  "nano-banana-2-lite": 150,
  "nano-banana-pro": 350,
};

export function imagePriceIdr(model: string): number | undefined {
  return KENARI_IMAGE_PRICES_IDR[model];
}
