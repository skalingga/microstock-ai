// Pure string helpers, safe to run on the server. They do NOT make an SVG safe:
// sanitizing happens in the browser (lib/svg/sanitize.ts).

export const MAX_SVG_CHARS = 300_000;

/** Pulls the <svg>...</svg> block out of a model reply (markdown fences, chatter, reasoning). */
export function extractSvg(text: string): string | null {
  const start = text.search(/<svg[\s>]/i);
  if (start === -1) return null;
  const end = text.toLowerCase().lastIndexOf("</svg>");
  if (end === -1 || end < start) return null;

  let svg = text.slice(start, end + "</svg>".length).trim();
  if (svg.length > MAX_SVG_CHARS) return null;

  // Models sometimes forget the namespace, which makes the XML parser reject the file.
  if (!/<svg[^>]*\sxmlns\s*=/i.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

/** Pulls the first JSON object out of a model reply, tolerating fences and surrounding text. */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
