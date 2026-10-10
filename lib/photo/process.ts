import { dHash } from "@/lib/qc/hash";
import { QC } from "@/lib/qc/config";
import { photoRejection } from "@/lib/qc/photo";
import {
  JPEG_QUALITY,
  PHOTO_INPUT_TYPES,
  PHOTO_PREVIEW_MAX_SIDE,
  VISION_JPEG_QUALITY,
  VISION_MAX_SIDE,
} from "./config";

// Browser only. Reads one uploaded photo and makes everything the queue needs from it, without any network call.

export type ReadPhoto = {
  /** The file to store: the original JPEG untouched, or a JPEG made from a PNG/WebP. */
  jpeg: Blob;
  converted: boolean;
  width: number;
  height: number;
  preview: Blob;
  /** Small JPEG for the vision model, as a data URL. */
  visionImage: string;
  phash: string;
};

export class PhotoReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoReadError";
  }
}

function fit(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
}

function draw(bitmap: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new PhotoReadError("Canvas tidak tersedia di browser ini.");
  // JPEG has no transparency: a transparent PNG becomes white, not black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoReadError("Gagal membuat JPEG."))), "image/jpeg", quality),
  );
}

export async function readPhoto(file: File): Promise<ReadPhoto> {
  if (!(PHOTO_INPUT_TYPES as readonly string[]).includes(file.type)) {
    throw new PhotoReadError(`Format ${file.type || "tidak dikenal"} tidak didukung. Pakai JPEG, PNG, atau WebP dari Flow.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoReadError("File tidak bisa dibaca sebagai gambar.");
  }

  try {
    const { width, height } = bitmap;
    const converted = file.type !== "image/jpeg";
    // Checked on the original size first; a PNG may still grow past the limit as JPEG, so check again below.
    const early = photoRejection({ width, height, bytes: converted ? 0 : file.size });
    if (early) throw new PhotoReadError(early);

    // A JPEG from Flow is already compressed: saving it again would only lose quality.
    const jpeg = converted ? await toBlob(draw(bitmap, width, height), JPEG_QUALITY) : file;
    const late = photoRejection({ width, height, bytes: jpeg.size });
    if (late) throw new PhotoReadError(late);

    const small = fit(width, height, QC.renderSize);
    const smallCanvas = draw(bitmap, small.w, small.h);
    const pixels = smallCanvas.getContext("2d")!.getImageData(0, 0, small.w, small.h);
    const phash = dHash({ data: pixels.data, width: small.w, height: small.h });

    const p = fit(width, height, PHOTO_PREVIEW_MAX_SIDE);
    const preview = await toBlob(draw(bitmap, p.w, p.h), 0.85);

    const v = fit(width, height, VISION_MAX_SIDE);
    const visionImage = draw(bitmap, v.w, v.h).toDataURL("image/jpeg", VISION_JPEG_QUALITY);

    return { jpeg, converted, width, height, preview, visionImage, phash };
  } finally {
    bitmap.close();
  }
}
