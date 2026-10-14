// Stage 11: composes several finished SVGs into one grid SVG (a bundle). Pure DOM work, runs in the browser
// (DOMParser); tested under jsdom. The members were sanitized when they were created and the result goes through
// the sanitizer again before it is stored, so nothing here needs to trust the input.

export type GridOption = { id: string; columns: number; rows: number };

/** Square grids and one 3:2 grid: all fit Adobe's artboard rules (15 to 65 MP, longest side 4800 px). */
export const GRID_OPTIONS: GridOption[] = [
  { id: "3x3", columns: 3, rows: 3 },
  { id: "4x4", columns: 4, rows: 4 },
  { id: "5x5", columns: 5, rows: 5 },
  { id: "6x4", columns: 6, rows: 4 },
];

/** User's choice (15 Oct 2026): 25 assets per bundle unless told otherwise. */
export const DEFAULT_GRID_ID = "5x5";

/** Side of one cell, the gap around cells, and the margin inside a cell, in viewBox units. */
export const CELL = 512;
export const GAP = 32;
export const CELL_PADDING = 16;

export const gridCells = (g: Pick<GridOption, "columns" | "rows">) => g.columns * g.rows;

/** The grid that holds exactly this many members, if there is one. */
export function gridFor(count: number): GridOption | null {
  return GRID_OPTIONS.find((g) => gridCells(g) === count) ?? null;
}

export function bundleSize(g: Pick<GridOption, "columns" | "rows">): { width: number; height: number } {
  return {
    width: g.columns * CELL + (g.columns + 1) * GAP,
    height: g.rows * CELL + (g.rows + 1) * GAP,
  };
}

export type BundleMember = { id: string; svg: string };

export type ComposeResult =
  | { ok: true; svg: string; width: number; height: number }
  | { ok: false; reason: string };

const SVG_NS = "http://www.w3.org/2000/svg";
const DROPPED_CHILDREN = new Set(["title", "desc", "metadata"]);
const URL_REF = /url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g;

const round = (n: number) => Math.round(n * 1000) / 1000;

function viewBoxOf(root: Element): { x: number; y: number; width: number; height: number } | null {
  const parts = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }
  const width = parseFloat(root.getAttribute("width") ?? "");
  const height = parseFloat(root.getAttribute("height") ?? "");
  return width > 0 && height > 0 ? { x: 0, y: 0, width, height } : null;
}

/** Gives every id of one member a unique prefix and points every reference (url(#id), href) at the new id. */
function prefixIds(root: Element, prefix: string): void {
  const elements = Array.from(root.querySelectorAll("*"));
  const renamed = new Map<string, string>();
  for (const el of elements) {
    const id = el.getAttribute("id");
    if (id) renamed.set(id, `${prefix}-${id}`);
  }
  if (renamed.size === 0) return;

  for (const el of elements) {
    for (const name of el.getAttributeNames()) {
      const value = el.getAttribute(name) ?? "";
      if (name === "id") {
        el.setAttribute(name, renamed.get(value) ?? value);
      } else if (name === "href" || name === "xlink:href") {
        const target = value.startsWith("#") ? renamed.get(value.slice(1)) : undefined;
        if (target) el.setAttribute(name, `#${target}`);
      } else if (value.includes("url(")) {
        el.setAttribute(
          name,
          value.replace(URL_REF, (whole, quote: string, id: string) => {
            const target = renamed.get(id);
            return target ? `url(${quote}#${target}${quote})` : whole;
          }),
        );
      }
    }
  }
}

const CLASS_ONLY_SELECTORS = /^\s*\.[A-Za-z_][\w-]*(\s*,\s*\.[A-Za-z_][\w-]*)*\s*$/;

/**
 * Models sometimes style shapes with a `<style>` block and classes. Inside a bundle those classes would collide
 * between members, so every class of one member gets the member's prefix, in the CSS and in the `class`
 * attributes. Only plain class selectors are supported; anything else (element selectors, @rules) could leak
 * into the other members, so the member is refused. Returns an error text, or null when the CSS was scoped.
 */
function scopeStyles(root: Element, prefix: string): string | null {
  const styles = Array.from(root.getElementsByTagName("style"));
  if (styles.length === 0) return null;

  for (const style of styles) {
    const css = (style.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (css.includes("@")) return "memakai aturan CSS @ (media, keyframes, import) di <style>";
    let scoped = "";
    for (const rule of css.split("}")) {
      if (rule.trim() === "") continue;
      const open = rule.indexOf("{");
      if (open === -1) return "punya <style> yang tidak bisa dibaca";
      const selectors = rule.slice(0, open);
      if (!CLASS_ONLY_SELECTORS.test(selectors)) return "memakai selektor <style> selain kelas (.nama)";
      scoped += `${selectors.replace(/\.([A-Za-z_][\w-]*)/g, `.${prefix}-$1`)}{${rule.slice(open + 1)}}`;
    }
    style.textContent = scoped;
  }

  for (const el of Array.from(root.querySelectorAll("[class]"))) {
    const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    el.setAttribute("class", classes.map((c) => `${prefix}-${c}`).join(" "));
  }
  return null;
}

/**
 * Lays the members out left to right, top to bottom. Each one is scaled to fit its cell and wrapped in its own
 * `<g id="item-N">`, so the bundle stays an editable layered vector. The background stays transparent.
 */
export function composeBundle(members: BundleMember[], grid: Pick<GridOption, "columns" | "rows">): ComposeResult {
  const cells = gridCells(grid);
  if (members.length !== cells) {
    return { ok: false, reason: `Grid ${grid.columns} × ${grid.rows} butuh tepat ${cells} aset, tetapi ada ${members.length}.` };
  }

  const { width, height } = bundleSize(grid);
  const out = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${height}"/>`, "image/svg+xml");
  const outRoot = out.documentElement;
  const inner = CELL - 2 * CELL_PADDING;

  for (const [index, member] of members.entries()) {
    const label = `Aset ke-${index + 1}`;
    const doc = new DOMParser().parseFromString(member.svg, "image/svg+xml");
    const root = doc.documentElement;
    if (doc.getElementsByTagName("parsererror").length > 0 || root.localName !== "svg") {
      return { ok: false, reason: `${label} bukan SVG yang valid.` };
    }
    const box = viewBoxOf(root);
    if (!box) return { ok: false, reason: `${label} tidak punya viewBox.` };

    const prefix = `i${String(index + 1).padStart(2, "0")}`;
    const styleProblem = scopeStyles(root, prefix);
    if (styleProblem) return { ok: false, reason: `${label} ${styleProblem}; bundle butuh kelas yang aman dipakai bersama.` };
    prefixIds(root, prefix);

    const scale = Math.min(inner / box.width, inner / box.height);
    const col = index % grid.columns;
    const row = Math.floor(index / grid.columns);
    const x = GAP + col * (CELL + GAP) + CELL_PADDING + (inner - box.width * scale) / 2 - box.x * scale;
    const y = GAP + row * (CELL + GAP) + CELL_PADDING + (inner - box.height * scale) / 2 - box.y * scale;

    const group = out.createElementNS(SVG_NS, "g");
    group.setAttribute("id", `item-${index + 1}`);
    group.setAttribute("transform", `translate(${round(x)} ${round(y)}) scale(${round(scale)})`);
    for (const child of Array.from(root.childNodes)) {
      if (child.nodeType === 1 && DROPPED_CHILDREN.has((child as Element).localName)) continue;
      group.appendChild(out.importNode(child, true));
    }
    outRoot.appendChild(group);
  }

  return { ok: true, svg: new XMLSerializer().serializeToString(outRoot), width, height };
}
