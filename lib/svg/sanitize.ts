import DOMPurify from "dompurify";

// Runs in the browser only (needs DOMParser). AI output is never trusted (CLAUDE.md rule 6):
// every SVG goes through here before it is rendered, uploaded, or saved.

export type SanitizeResult =
  | { ok: true; svg: string; notes: string[] }
  | { ok: false; reason: string };

// <text> is left alone on purpose: QC (stage 3) must see it and fail the asset.
const FORBIDDEN_TAGS = ["script", "foreignObject", "image", "iframe", "object", "embed", "audio", "video", "a"];

const NOTE_LABELS: Record<string, string> = {
  script: "script dihapus",
  foreignobject: "foreignObject dihapus",
  image: "gambar raster tertanam dihapus",
  iframe: "iframe dihapus",
  object: "object dihapus",
  embed: "embed dihapus",
  audio: "audio dihapus",
  video: "video dihapus",
  a: "link <a> dihapus",
};

const EXTERNAL_URL = /url\(\s*['"]?\s*(?!#)/i;

function cleanCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)\s*(?!#)[^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

let hooksInstalled = false;
function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook("uponSanitizeElement", (node) => {
    if (node.nodeName.toLowerCase() === "style" && node.textContent) {
      node.textContent = cleanCss(node.textContent);
    }
  });

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!node.getAttributeNames) return;
    for (const name of node.getAttributeNames()) {
      const value = node.getAttribute(name) ?? "";
      const lower = name.toLowerCase();

      // Only same-document references (#id) are allowed: no external files, no data: payloads.
      if ((lower === "href" || lower === "xlink:href") && !value.trim().startsWith("#")) {
        node.removeAttribute(name);
      } else if (lower === "style") {
        node.setAttribute(name, cleanCss(value));
      } else if (EXTERNAL_URL.test(value)) {
        node.removeAttribute(name); // e.g. fill="url(https://...)"
      }
    }
  });
}

function parseSvg(source: string): Document | null {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  return doc.getElementsByTagName("parsererror").length > 0 ? null : doc;
}

function ensureViewBox(root: Element): boolean {
  if (root.hasAttribute("viewBox")) return true;
  const w = parseFloat(root.getAttribute("width") ?? "");
  const h = parseFloat(root.getAttribute("height") ?? "");
  if (w > 0 && h > 0) {
    root.setAttribute("viewBox", `0 0 ${w} ${h}`);
    return true;
  }
  return false;
}

export function sanitizeSvg(raw: string): SanitizeResult {
  installHooks();
  const notes: string[] = [];

  // Models often leave a bare "&" in text or URLs, which breaks strict XML parsing.
  let doc = parseSvg(raw);
  if (!doc) {
    doc = parseSvg(raw.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;"));
  }
  if (!doc) return { ok: false, reason: "SVG tidak valid (XML rusak)." };
  if (doc.documentElement.localName !== "svg") return { ok: false, reason: "Elemen utama bukan <svg>." };

  const lowerForbidden = FORBIDDEN_TAGS.map((t) => t.toLowerCase());
  for (const el of Array.from(doc.getElementsByTagName("*"))) {
    const tag = el.localName.toLowerCase();
    const note = lowerForbidden.includes(tag) ? NOTE_LABELS[tag] : undefined;
    if (note && !notes.includes(note)) notes.push(note);
  }

  const cleaned = DOMPurify.sanitize(new XMLSerializer().serializeToString(doc.documentElement), {
    USE_PROFILES: { svg: true },
    PARSER_MEDIA_TYPE: "image/svg+xml",
    FORBID_TAGS: FORBIDDEN_TAGS,
  });
  if (!cleaned) return { ok: false, reason: "SVG kosong setelah disanitasi." };

  const out = parseSvg(String(cleaned));
  if (!out || out.documentElement.localName !== "svg") {
    return { ok: false, reason: "SVG tidak valid setelah disanitasi." };
  }
  if (!ensureViewBox(out.documentElement)) {
    return { ok: false, reason: "SVG tidak punya viewBox." };
  }

  return { ok: true, svg: new XMLSerializer().serializeToString(out.documentElement), notes };
}
