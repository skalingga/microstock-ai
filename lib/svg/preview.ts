const PREVIEW_MAX_SIDE = 512;

/** Browser only. Rasterizes an already sanitized SVG to a transparent PNG for the gallery. */
export async function renderPreviewPng(svg: string, maxSide = PREVIEW_MAX_SIDE): Promise<Blob> {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;

  // Give the image explicit pixel size so every browser draws it at the same scale.
  const [, , vbW, vbH] = (root.getAttribute("viewBox") ?? "0 0 512 512").split(/[\s,]+/).map(Number);
  const ratio = vbW > 0 && vbH > 0 ? vbW / vbH : 1;
  const width = ratio >= 1 ? maxSide : Math.round(maxSide * ratio);
  const height = ratio >= 1 ? Math.round(maxSide / ratio) : maxSide;
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));

  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(root)], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("SVG tidak bisa dirender."));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    ctx.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat preview PNG."))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
