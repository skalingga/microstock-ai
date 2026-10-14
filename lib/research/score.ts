// Scores for one theme. All inputs are optional because each signal can be missing
// (Trends blocked, competition not entered yet); the result says which parts were real.

import { UPLOAD_LEAD_DAYS } from "./calendar";

export type ScoreInput = {
  /** Event weight from the calendar, 1 to 3. */
  eventWeight?: 1 | 2 | 3;
  /** Relative search interest from Google Trends, 0-100. */
  trendScore?: number | null;
  /** The model's own guess of demand, 0-100. Used only when Trends is missing. */
  aiDemand?: number | null;
  /** Number of results for the keyword on Adobe Stock, entered or fetched. */
  adobeResultCount?: number | null;
  /** The model's own guess of competition, 0-100. Used only when no count is known. */
  aiCompetition?: number | null;
  /** Days left until the upload deadline; negative when it has passed. Null for evergreen themes. */
  daysLeft?: number | null;
};

export type Scores = {
  demand: number;
  competition: number | null;
  opportunity: number;
  /** True when competition comes from real data rather than a guess or nothing. */
  competitionKnown: boolean;
  /** True when demand comes from Google Trends rather than the model's guess. */
  demandKnown: boolean;
};

/** Where an opportunity score comes from: both inputs measured, one of them, or none (only AI guesses). */
export type Provenance = "data" | "sebagian" | "perkiraan";

export function provenanceOf(s: Scores): Provenance {
  if (s.demandKnown && s.competitionKnown) return "data";
  return s.demandKnown || s.competitionKnown ? "sebagian" : "perkiraan";
}

/** Last useful upload, in days before the event. The user's experience (14 Oct 2026): one month ahead still sells. */
export const LAST_CHANCE_LEAD_DAYS = 30;

/** Days after the ideal deadline (UPLOAD_LEAD_DAYS before the event) during which an upload is late but still worth it. */
export const LATE_GRACE_DAYS = UPLOAD_LEAD_DAYS - LAST_CHANCE_LEAD_DAYS;

/** The last-chance date for an ideal upload deadline, as an ISO date. */
export function lastChanceDate(uploadBy: string): string {
  return new Date(Date.parse(`${uploadBy}T00:00:00Z`) + LATE_GRACE_DAYS * 86_400_000).toISOString().slice(0, 10);
}

/** Opportunity multiplier by time left: past the last chance halves it, late trims it more than tight. */
export function timingFactor(daysLeft: number | null | undefined): number {
  if (daysLeft === null || daysLeft === undefined) return 1;
  if (daysLeft < -LATE_GRACE_DAYS) return 0.5;
  if (daysLeft < 0) return 0.7;
  if (daysLeft < 14) return 0.85;
  return 1;
}

/** "telat": past the ideal deadline but not yet the last chance (one month before the event). */
export type DeadlineStatus = "terlewat" | "telat" | "mendesak" | "cukup";

export function deadlineStatus(daysLeft: number | null | undefined): DeadlineStatus | null {
  if (daysLeft === null || daysLeft === undefined) return null;
  if (daysLeft < -LATE_GRACE_DAYS) return "terlewat";
  if (daysLeft < 0) return "telat";
  return daysLeft < 14 ? "mendesak" : "cukup";
}

/** Whole days from today (UTC date) to an ISO date; negative when the date is past. */
export function daysUntil(isoDate: string, now: number = Date.now()): number {
  const today = Math.floor(now / 86_400_000);
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000) - today;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Maps an Adobe result count to 0-100 on a log scale: 1k results = 0, 10M+ = 100 (broad words reach millions). */
export function competitionFromCount(count: number): number {
  if (count <= 1_000) return 0;
  return clamp(((Math.log10(count) - 3) / 4) * 100);
}

/**
 * Turns an interest ratio against an anchor term into 0-100. Equal interest gives 50,
 * three times the anchor 75, a tenth of it about 9.
 */
export function demandFromRatio(themeMean: number, anchorMean: number): number {
  if (anchorMean <= 0) return themeMean > 0 ? 100 : 0;
  const ratio = themeMean / anchorMean;
  return clamp((100 * ratio) / (ratio + 1));
}

export function scoreTheme(input: ScoreInput): Scores {
  const weightBoost = ((input.eventWeight ?? 2) - 2) * 10; // -10, 0, +10
  const base = input.trendScore ?? input.aiDemand ?? 50;
  const demand = clamp(base + weightBoost);

  const hasCount = input.adobeResultCount !== null && input.adobeResultCount !== undefined;
  const competition = hasCount
    ? competitionFromCount(input.adobeResultCount as number)
    : (input.aiCompetition ?? null);

  // Unknown competition counts as middling so a theme is neither rewarded nor punished for it.
  const opportunity = clamp(((demand * (100 - (competition ?? 50))) / 100) * timingFactor(input.daysLeft));
  return { demand, competition, opportunity, competitionKnown: hasCount, demandKnown: input.trendScore != null };
}
