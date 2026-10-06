import { ADOBE } from "@/lib/adobe/rules";

/** Lowercase ascii words joined by hyphens, cut at a hyphen when it has to be shortened. */
export function slugify(title: string, maxLen: number): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLen) return slug || "asset";

  const cut = slug.slice(0, maxLen);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > maxLen * 0.5 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, "") || "asset";
}

const EXTENSION = ".svg";

/**
 * Adobe allows 30 characters including the extension, so the name is "slug-ab12.svg": a readable slug plus
 * the first characters of the asset id, which keeps names unique even for identical titles.
 * `used` collects the names handed out so far in this export.
 */
export function makeFilename(title: string, assetId: string, used: Set<string>): string {
  const id = assetId.replace(/-/g, "").toLowerCase();
  for (let suffixLen = 4; suffixLen <= 12; suffixLen++) {
    const room = ADOBE.filenameMaxChars - EXTENSION.length - 1 - suffixLen;
    const name = `${slugify(title, room)}-${id.slice(0, suffixLen)}${EXTENSION}`;
    if (name.length <= ADOBE.filenameMaxChars && !used.has(name)) {
      used.add(name);
      return name;
    }
  }
  // Practically unreachable: the id alone is unique.
  const fallback = `${id.slice(0, ADOBE.filenameMaxChars - EXTENSION.length)}${EXTENSION}`;
  used.add(fallback);
  return fallback;
}
