import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODELS,
  DEFAULT_THEMES,
  MODEL_PREFS_VERSION,
  THEME_POOL,
  freshTheme,
  freshThemes,
  parseModelPrefs,
  serializeModelPrefs,
} from "@/lib/generate/benchmark-presets";
import { isImageModel } from "@/lib/generate/benchmark";
import { fetchModelCatalog } from "@/lib/providers/kenari-pricing";
import { STYLES } from "@/lib/settings/schema";

describe("theme pool", () => {
  it("covers every style with enough distinct themes", () => {
    for (const s of STYLES) {
      const pool = THEME_POOL[s.value];
      expect(pool?.length, s.value).toBeGreaterThanOrEqual(10);
      expect(new Set(pool.map((t) => t.toLowerCase())).size, s.value).toBe(pool.length);
    }
  });

  it("holds the default themes, so a reroll can move away from them", () => {
    for (const d of DEFAULT_THEMES) expect(THEME_POOL[d.style]).toContain(d.theme);
  });

  it("gives a theme of the same style that is not on screen or recent", () => {
    const style = "silhouette";
    const [first, second] = THEME_POOL[style];
    for (const r of [0, 0.5, 0.999]) {
      const next = freshTheme(style, [first], [second], () => r);
      expect(next).not.toBeNull();
      expect([first, second]).not.toContain(next);
      expect(THEME_POOL[style]).toContain(next);
    }
  });

  it("ignores the recent list when the pool runs dry, but never the themes on screen", () => {
    const pool = THEME_POOL.line_art;
    const next = freshTheme("line_art", [pool[0]], pool.slice(1), () => 0);
    expect(next).not.toBeNull();
    expect(next).not.toBe(pool[0]);
  });

  it("returns null when nothing else is left", () => {
    expect(freshTheme("line_art", THEME_POOL.line_art, [], () => 0)).toBeNull();
  });

  it("rerolls every row to a different theme of its own style, without duplicates", () => {
    const next = freshThemes(DEFAULT_THEMES, [], () => 0.3);
    expect(next).toHaveLength(DEFAULT_THEMES.length);
    next.forEach((t, i) => {
      expect(t.style).toBe(DEFAULT_THEMES[i].style);
      expect(t.theme).not.toBe(DEFAULT_THEMES[i].theme);
    });
    expect(new Set(next.map((t) => t.theme)).size).toBe(next.length);
  });
});

describe("default models", () => {
  it("lists each model once and splits text from image models", () => {
    const keys = DEFAULT_MODELS.map((m) => `${m.provider}|${m.model}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(DEFAULT_MODELS.some((m) => isImageModel(m))).toBe(true);
    expect(DEFAULT_MODELS.some((m) => !isImageModel(m))).toBe(true);
  });

  it("only offers priced image models, so the budget stays correct", () => {
    for (const m of DEFAULT_MODELS.filter((x) => isImageModel(x))) expect(m.provider).toBe("kenari");
  });
});

describe("model prefs saved in the browser", () => {
  const prefs = {
    models: [
      { provider: "kenari" as const, model: "deepseek-v4-1-flash" },
      { provider: "gemini" as const, model: "gemini-3.7-flash" },
    ],
    checked: ["kenari|deepseek-v4-1-flash"],
    hidden: ["kenari|kokoro-tts"],
  };

  it("round-trips", () => {
    expect(parseModelPrefs(serializeModelPrefs(prefs))).toEqual(prefs);
  });

  it("drops missing, malformed, and old-version data", () => {
    expect(parseModelPrefs(null)).toBeNull();
    expect(parseModelPrefs("{not json")).toBeNull();
    expect(parseModelPrefs(JSON.stringify({ v: MODEL_PREFS_VERSION + 1, models: [] }))).toBeNull();
    expect(parseModelPrefs(JSON.stringify({ v: MODEL_PREFS_VERSION, models: "x" }))).toBeNull();
  });

  it("keeps only well-formed models", () => {
    const raw = JSON.stringify({
      v: MODEL_PREFS_VERSION,
      models: [{ provider: "kenari", model: "ok" }, { provider: "evil", model: "x" }, { provider: "gemini" }, null, "str"],
      checked: ["a", 3],
      hidden: [],
    });
    expect(parseModelPrefs(raw)).toEqual({ models: [{ provider: "kenari", model: "ok" }], checked: ["a"], hidden: [] });
  });
});

describe("catalog kinds", () => {
  it("marks chat and image models from the endpoints, so speech and video stay out of the picker", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "text-a", endpoints: ["chat"] },
            { id: "pic-a", endpoints: ["images"] },
            { id: "voice-a", endpoints: ["audio_speech"] },
            { id: "old-style" },
          ],
        }),
      )) as unknown as typeof fetch;
    const models = await fetchModelCatalog({ fetchImpl, baseUrl: "https://x.test/v1" });
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));
    expect(byId["text-a"]).toMatchObject({ chat: true, image: false });
    expect(byId["pic-a"]).toMatchObject({ chat: false, image: true });
    expect(byId["voice-a"]).toMatchObject({ chat: false, image: false });
    expect(byId["old-style"]).toMatchObject({ chat: true, image: false });
  });
});
