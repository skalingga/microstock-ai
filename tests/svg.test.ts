import { describe, expect, it } from "vitest";
import { extractJson, extractSvg } from "@/lib/svg/extract";
import { sanitizeSvg } from "@/lib/svg/sanitize";
import { analyzeSvg } from "@/lib/svg/stats";

const MALICIOUS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)">
  <script>alert(1)</script>
  <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject>
  <image href="https://evil.test/a.png" width="10" height="10"/>
  <image href="data:image/png;base64,AAAA" width="10" height="10"/>
  <a href="https://evil.test"><rect width="5" height="5"/></a>
  <use href="https://evil.test/x.svg#a"/>
  <rect width="10" height="10" fill="url(https://evil.test/x)" style="fill:url(http://evil.test/y);stroke:red"/>
  <style>@import url(https://evil.test/x.css); .a{fill:red}</style>
  <path d="M0 0L10 10" fill="red" onclick="steal()"/>
</svg>`;

describe("extractSvg", () => {
  it("pulls the svg out of markdown fences and chatter", () => {
    const reply = 'Here you go!\n```svg\n<svg viewBox="0 0 10 10"><path d="M0 0h10"/></svg>\n```\nEnjoy.';
    const svg = extractSvg(reply);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox/);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).not.toContain("Enjoy");
  });

  it("returns null when there is no complete svg", () => {
    expect(extractSvg("Sorry, I cannot do that.")).toBeNull();
    expect(extractSvg('<svg viewBox="0 0 1 1"><path d="M0 0"')).toBeNull();
  });

  it("rejects oversized output", () => {
    expect(extractSvg(`<svg xmlns="http://www.w3.org/2000/svg">${"x".repeat(310_000)}</svg>`)).toBeNull();
  });
});

describe("extractJson", () => {
  it("reads json inside fences and ignores text around it", () => {
    expect(extractJson('Sure:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('prefix {"a":{"b":2}} suffix')).toEqual({ a: { b: 2 } });
  });

  it("returns null for broken json", () => {
    expect(extractJson("{nope")).toBeNull();
    expect(extractJson("no json at all")).toBeNull();
  });
});

describe("sanitizeSvg", () => {
  it("strips scripts, foreignObject, images, links, handlers, and external references", () => {
    const result = sanitizeSvg(MALICIOUS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const svg = result.svg;
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/foreignObject/i);
    expect(svg).not.toMatch(/<image/i);
    expect(svg).not.toMatch(/<a[\s>]/i);
    expect(svg).not.toMatch(/onload|onclick/i);
    expect(svg).not.toContain("evil.test");
    expect(svg).not.toContain("@import");
    expect(svg).not.toContain("data:image");

    // Harmless drawing survives.
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toMatch(/<path[^>]*d="M0 0L10 10"/);

    expect(result.notes).toEqual(
      expect.arrayContaining(["script dihapus", "foreignObject dihapus", "gambar raster tertanam dihapus"]),
    );
  });

  it("keeps local references such as gradients", () => {
    const result = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.svg).toContain('fill="url(#g)"');
      expect(result.svg).toContain("linearGradient");
    }
  });

  it("repairs a bare ampersand instead of failing the whole asset", () => {
    const result = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>Fish & Chips</title><rect width="5" height="5"/></svg>`,
    );
    expect(result.ok).toBe(true);
  });

  it("derives a viewBox from width and height, and rejects an svg without either", () => {
    const withSize = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="5" height="5"/></svg>`);
    expect(withSize.ok && withSize.svg).toContain('viewBox="0 0 40 20"');

    const without = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5"/></svg>`);
    expect(without).toEqual({ ok: false, reason: "SVG tidak punya viewBox." });
  });

  it("rejects broken xml and non-svg roots", () => {
    expect(sanitizeSvg("<svg><rect></svg>").ok).toBe(false);
    expect(sanitizeSvg("<html xmlns='http://www.w3.org/1999/xhtml'></html>").ok).toBe(false);
  });

  it("leaves <text> in place so QC can fail it later", () => {
    const result = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="5">Hi</text></svg>`,
    );
    expect(result.ok && result.svg).toContain("<text");
  });
});

describe("analyzeSvg", () => {
  it("counts paths, shapes, and detects text", () => {
    const stats = analyzeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g><path d="M0 0"/><path d="M1 1"/><circle r="1"/></g><text>x</text></svg>`,
    );
    expect(stats).toMatchObject({ pathCount: 2, shapeCount: 3, pointCount: 2, hasText: true });
  });
});
