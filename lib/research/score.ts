// Scores for one theme. All inputs are optional because each signal can be missing
// (Trends blocked, competition not entered yet); the result says which parts were real.

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
};

/** Opportunity multiplier by time left: a missed deadline halves it, a tight one trims it. */
export function timingFactor(daysLeft: number | null | undefined): number {
  if (daysLeft === null || daysLeft === undefined) return 1;
  if (daysLeft < 0) return 0.5;
  if (daysLeft < 14) return 0.85;
  return 1;
}

export type DeadlineStatus = "terlewat" | "mendesak" | "cukup";

export function deadlineStatus(daysLeft: number | null | undefined): DeadlineStatus | null {
  if (daysLeft === null || daysLeft === undefined) return null;
  if (daysLeft < 0) return "terlewat";
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
  return { demand, competition, opportunity, competitionKnown: hasCount };
}
