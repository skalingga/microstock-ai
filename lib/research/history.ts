// Research history: the themes that were turned into assets and what became of those assets (QC status and Adobe's
// verdict). Generate creates a fresh theme row for every batch and never links it to the research theme it came from
// (0 of 132 batches on 17 Oct 2026), so themes are matched by title, like the "sudah di-generate" mark on Riset.
// Pure; the database reads and the signed URLs are in app/(app)/riset/page.tsx.

export type HistoryRunRow = { id: string; createdAt: string; region: string };
export type HistoryThemeRow = { id: string; runId: string; title: string };
/** One batch with the title of the theme it was made for. */
export type HistoryJobRow = { id: string; themeTitle: string; style: string; createdAt: string };
export type HistoryAssetRow = {
  id: string;
  jobId: string;
  previewPath: string | null;
  qcStatus: string;
  adobeStatus: string | null;
};

export type HistoryAsset = { id: string; previewPath: string | null; qcStatus: string; adobeStatus: string | null };
export type HistoryTheme = {
  key: string;
  title: string;
  /** Style values of the batches made for this theme, once each. */
  styles: string[];
  assets: HistoryAsset[];
  /** Batch of the newest asset, for the "see in gallery" link. */
  latestJobId: string;
  lolos: number;
  accepted: number;
  rejected: number;
};
export type HistoryRun = {
  id: string;
  createdAt: string;
  region: string;
  themeCount: number;
  /** Themes of this run that were generated, with or without assets left. */
  generatedCount: number;
  /** Generated themes that still have assets, newest first. */
  themes: HistoryTheme[];
};
export type History = {
  runs: HistoryRun[];
  /** Themes typed in Generate that match no research theme, newest first. */
  own: HistoryTheme[];
};

/** Thumbnails shown per theme; the counts cover all of its assets. */
export const HISTORY_THUMBS = 8;
/** Themes listed under "buatan sendiri". */
export const HISTORY_OWN_MAX = 40;

export const themeKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, " ");

/** Jobs must arrive newest first, and assets newest first. */
export function buildHistory(input: {
  runs: HistoryRunRow[];
  themes: HistoryThemeRow[];
  jobs: HistoryJobRow[];
  assets: HistoryAssetRow[];
}): History {
  const jobsByKey = new Map<string, HistoryJobRow[]>();
  for (const job of input.jobs) {
    const key = themeKey(job.themeTitle);
    if (key) jobsByKey.set(key, [...(jobsByKey.get(key) ?? []), job]);
  }
  const assetsByJob = new Map<string, HistoryAssetRow[]>();
  for (const asset of input.assets) assetsByJob.set(asset.jobId, [...(assetsByJob.get(asset.jobId) ?? []), asset]);

  function themeOf(key: string): HistoryTheme | null {
    const jobs = jobsByKey.get(key) ?? [];
    const assets = jobs.flatMap((j) => assetsByJob.get(j.id) ?? []);
    if (assets.length === 0) return null;
    return {
      key,
      title: jobs[0].themeTitle.trim(),
      styles: [...new Set(jobs.map((j) => j.style))],
      assets: assets.map((a) => ({ id: a.id, previewPath: a.previewPath, qcStatus: a.qcStatus, adobeStatus: a.adobeStatus })),
      latestJobId: assets[0].jobId,
      lolos: assets.filter((a) => a.qcStatus === "lolos").length,
      accepted: assets.filter((a) => a.adobeStatus === "diterima").length,
      rejected: assets.filter((a) => a.adobeStatus === "ditolak").length,
    };
  }

  // A title that came up in several runs belongs to the newest one (runs arrive newest first).
  const claimed = new Set<string>();
  const runs = input.runs.map((run) => {
    const keys = [...new Set(input.themes.filter((t) => t.runId === run.id).map((t) => themeKey(t.title)))];
    const generatedKeys = keys.filter((k) => jobsByKey.has(k) && !claimed.has(k));
    for (const k of generatedKeys) claimed.add(k);
    return {
      id: run.id,
      createdAt: run.createdAt,
      region: run.region,
      themeCount: keys.length,
      generatedCount: generatedKeys.length,
      themes: generatedKeys.flatMap((k) => themeOf(k) ?? []),
    };
  });

  const own = [...jobsByKey.keys()]
    .filter((k) => !claimed.has(k))
    .flatMap((k) => themeOf(k) ?? [])
    .slice(0, HISTORY_OWN_MAX);
  return { runs, own };
}
