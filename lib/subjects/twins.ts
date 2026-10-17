// Twin subjects in one export. Adobe data of Oct 2026: 18 of 20 rejections were "Similar content", and nearly all of them
// had a sibling with the same main object in the same submission (2 ice cream cones, 2 pizza slices, 3 horses, 2 black
// cats). Perceptual hash misses these because the drawings differ; what matches is the main object. Pure helpers.

import { subjectWord } from "./saturation";

/** How far back an earlier export still counts as "already sent". */
export const TWIN_LOOKBACK_DAYS = 30;

/** The main object ends at the first preposition: "horse head IN three-quarter view", "cat silhouette WITH green eyes". */
const PREPOSITIONS = new Set([
  "with", "in", "on", "at", "beside", "by", "from", "near", "under", "over", "above", "below", "against", "before", "after",
  "during", "for", "to", "into", "onto", "inside", "behind", "next", "while", "among", "around", "through", "across", "along",
]);

/** Words that describe the object or the shot, not what it is. Kept out so "wild horse" and "majestic horse" meet on "horse". */
const NOT_IDENTIFYING = new Set([
  // people and hands in general: what they do tells pictures apart, not that someone is there
  "person", "people", "man", "men", "woman", "women", "friend", "adult", "guy", "girl", "boy", "hand",
  // shot and composition
  "view", "side", "top", "down", "close", "up", "closeup", "overhead", "profile", "front", "back", "angle", "three", "quarter",
  "full", "body", "lay", "shot", "centered", "macro", "scene", "frame", "pair", "group", "five", "four", "horizontal",
  "vertical", "symmetrical", "diagonal",
  // looks, age, era, weather, light
  "wild", "majestic", "classic", "vintage", "retro", "victorian", "hot", "cold", "open", "small", "large", "big", "tiny",
  "little", "mini", "cute", "friendly", "spooky", "scary", "elderly", "young", "old", "new", "modern", "whole", "ripe", "fresh",
  "sleepy", "futuristic", "domestic", "rainy", "sunny", "snowy", "cozy", "rustic", "wooden", "ceramic", "dark", "light",
  "bright", "blank", "plain", "unbranded", "unlabeled", "empty", "beautiful", "elegant", "happy", "funny", "abstract",
  "detailed", "realistic", "traditional", "night", "morning", "evening", "dawn", "winter", "summer", "autumn", "fall",
  "peacefully", "gently", "slightly", "red", "green", "blue", "yellow", "pink", "purple", "brown", "gray", "grey", "golden",
  "gold", "silver", "colorful",
]);

/** Nouns that only look like a verb or a participle. */
const NOT_PARTICIPLE = new Set([
  "building", "painting", "wedding", "pudding", "ceiling", "clothing", "frosting", "icing", "stocking", "earring", "offering",
  "string", "spring", "swing", "thing", "sling", "steed", "speed", "breed", "tweed",
]);

/** "galloping", "steaming", "grilled", "viewed": how the object is shown. "-ling" nouns (dumpling, seedling) stay. */
function isParticiple(word: string): boolean {
  if (NOT_PARTICIPLE.has(word)) return false;
  if (word.length > 5 && word.endsWith("ing") && !word.endsWith("ling")) return true;
  return word.length > 4 && word.endsWith("ed");
}

export type MainSubject = {
  /** Words naming the main object: "Galloping wild horse in profile" -> ["horse"]. */
  tokens: string[];
  /** The head noun of each part joined by "and": the last word of "ice cream cone", "laptop" and "smartphone". */
  heads: string[];
};

/**
 * The main object of a subject. It ends at the first comma, at a preposition ("of" excepted: "slice of pizza" is still the
 * object), or at a verb after the object ("top hat LAUNCHING rockets", "kettle POURING coffee").
 */
export function mainSubject(subject: string): MainSubject {
  const words = (subject.split(",")[0] ?? "").toLowerCase().replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter(Boolean);
  const tokens: string[] = [];
  const heads: string[] = [];
  let last: string | null = null;
  for (const [i, raw] of words.entries()) {
    if (i > 0 && PREPOSITIONS.has(raw)) break;
    if (raw === "and") {
      if (last) heads.push(last);
      last = null;
      continue;
    }
    if (isParticiple(raw)) {
      // A verb after the object starts a new clause; "grilled" or "-ed" before a noun only describes it.
      if (tokens.length > 0 && raw.endsWith("ing")) break;
      continue;
    }
    const word = subjectWord(raw);
    if (!word || NOT_IDENTIFYING.has(word) || isParticiple(word)) continue;
    tokens.push(word);
    last = word;
  }
  if (last) heads.push(last);
  return { tokens: [...new Set(tokens)], heads: [...new Set(heads)] };
}

/** The words naming the main object, for tests and labels. */
export function mainTokens(subject: string): string[] {
  return mainSubject(subject).tokens;
}

function sameMain(a: MainSubject, b: MainSubject): boolean {
  if (a.tokens.length === 0 || b.tokens.length === 0) return false;
  if (a.heads.some((h) => b.heads.includes(h))) return true;
  const [small, large] = a.tokens.length <= b.tokens.length ? [a.tokens, b.tokens] : [b.tokens, a.tokens];
  return small.every((t) => large.includes(t));
}

/** Same main object: the same head noun ("coffee cup" and "takeaway coffee cup"), or one contains the other ("horse" and "horse head"). */
export function sameMainSubject(a: string, b: string): boolean {
  return sameMain(mainSubject(a), mainSubject(b));
}

/** media: Adobe compares like with like, so a vector is never the twin of a photo. */
export type TwinCandidate = { id: string; subject: string; title: string; lolos: boolean; media: string };
export type SentAsset = { id: string; subject: string; title: string; media: string };

export type TwinGroup = {
  /** The shared word(s) naming the object, for the warning: "horse", "coffee cup". */
  label: string;
  /** Picked assets of this group, in the order given. */
  chosen: { id: string; title: string }[];
  /** Assets sent in the last TWIN_LOOKBACK_DAYS with the same object. */
  sent: { id: string; title: string }[];
  /** The one picked asset to keep, or null when the object was already sent. */
  keep: string | null;
  /** Picked assets that would go out as a twin. */
  drop: string[];
};

/**
 * Groups the picked assets by main object, against each other and against what was sent recently. A group needs at least
 * two picked assets, or one picked asset and one sent. Only picked assets join groups directly, so a long history cannot
 * chain unrelated subjects together; sent assets are attached to the groups they match.
 */
export function findTwins(chosen: TwinCandidate[], sent: SentAsset[]): TwinGroup[] {
  const main = new Map(chosen.map((c) => [c.id, mainSubject(c.subject)]));
  const parent = new Map(chosen.map((c) => [c.id, c.id]));
  const root = (id: string): string => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      if (chosen[i].media !== chosen[j].media) continue;
      if (sameMain(main.get(chosen[i].id)!, main.get(chosen[j].id)!)) parent.set(root(chosen[j].id), root(chosen[i].id));
    }
  }

  const members = new Map<string, TwinCandidate[]>();
  for (const c of chosen) members.set(root(c.id), [...(members.get(root(c.id)) ?? []), c]);

  const pickedIds = new Set(chosen.map((c) => c.id));
  const sentMain = sent.filter((s) => !pickedIds.has(s.id)).map((s) => ({ ...s, main: mainSubject(s.subject) }));
  const groups: TwinGroup[] = [];
  for (const items of members.values()) {
    const matches = sentMain.filter((s) => items.some((c) => c.media === s.media && sameMain(main.get(c.id)!, s.main)));
    if (items.length < 2 && matches.length === 0) continue;
    const keepItem = matches.length > 0 ? null : (items.find((c) => c.lolos) ?? items[0]);
    groups.push({
      label: labelOf([...items.map((c) => main.get(c.id)!.tokens), ...matches.map((s) => s.main.tokens)]),
      chosen: items.map((c) => ({ id: c.id, title: c.title })),
      sent: matches.map((s) => ({ id: s.id, title: s.title })),
      keep: keepItem?.id ?? null,
      drop: items.filter((c) => c.id !== keepItem?.id).map((c) => c.id),
    });
  }
  return groups;
}

/** The words most members share, in the order they first appear: "coffee cup". */
function labelOf(all: string[][]): string {
  const count = new Map<string, number>();
  for (const list of all) for (const t of new Set(list)) count.set(t, (count.get(t) ?? 0) + 1);
  const best = Math.max(...count.values());
  const order = all.flat();
  return [...new Set(order)].filter((t) => count.get(t) === best && best > 1).join(" ") || order[0] || "";
}

/** The subject to compare: the concept's subject part, else the title (photos uploaded without a concept, bundles). */
export function twinSubject(subject: string, title: string): string {
  return subject.trim() || title;
}
