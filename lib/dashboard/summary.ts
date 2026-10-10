import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { daysUntil, deadlineStatus, type DeadlineStatus } from "@/lib/research/score";

// What the Meja page (/meja) shows: the work waiting for the user, counted straight from the assets table.

/** Themes with an upload deadline in the next this many days are listed on Meja. */
export const DEADLINE_WINDOW_DAYS = 30;
const MAX_DEADLINES = 3;

export type Deadline = { title: string; uploadBy: string; daysLeft: number; status: DeadlineStatus };

/** The nearest upcoming upload deadlines from the latest research run; passed ones and themes without a date drop out. */
export function pickDeadlines(themes: { title: string; upload_by: string | null }[], now: number = Date.now()): Deadline[] {
  return themes
    .flatMap((t) => {
      if (!t.upload_by) return [];
      const daysLeft = daysUntil(t.upload_by, now);
      const status = deadlineStatus(daysLeft);
      if (!status || status === "terlewat" || daysLeft > DEADLINE_WINDOW_DAYS) return [];
      return [{ title: t.title, uploadBy: t.upload_by, daysLeft, status }];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title))
    .slice(0, MAX_DEADLINES);
}

/** Share of recorded Adobe decisions that were accepted, as a whole percent; null before any decision. */
export function acceptanceRate(accepted: number, rejected: number): number | null {
  const total = accepted + rejected;
  return total > 0 ? Math.round((accepted / total) * 100) : null;
}

export type DeskSummary = {
  /** Exported, Adobe's decision not recorded yet: the review queue. */
  adobePending: number;
  /** Lolos with metadata, never exported. */
  readyToExport: number;
  /** Perlu cek and never exported: needs a manual look before export. */
  needsCheck: number;
  accepted: number;
  rejected: number;
  deadlines: Deadline[];
  /** True when one of the counts could not be read; the page says so instead of showing a wrong zero. */
  failed: boolean;
};

export async function fetchDeskSummary(supabase: SupabaseClient<Database>, now: number = Date.now()): Promise<DeskSummary> {
  const head = () => supabase.from("assets").select("id", { count: "exact", head: true });
  const [pending, ready, check, accepted, rejected, run] = await Promise.all([
    head().not("exported_at", "is", null).is("adobe_status", null),
    head().eq("qc_status", "lolos").is("exported_at", null).not("title", "is", null),
    head().eq("qc_status", "perlu_cek").is("exported_at", null),
    head().eq("adobe_status", "diterima"),
    head().eq("adobe_status", "ditolak"),
    supabase.from("research_runs").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const themes = run.data
    ? await supabase.from("themes").select("title, upload_by").eq("run_id", run.data.id).not("upload_by", "is", null).limit(50)
    : null;

  return {
    adobePending: pending.count ?? 0,
    readyToExport: ready.count ?? 0,
    needsCheck: check.count ?? 0,
    accepted: accepted.count ?? 0,
    rejected: rejected.count ?? 0,
    deadlines: pickDeadlines(themes?.data ?? [], now),
    failed: [pending, ready, check, accepted, rejected].some((r) => r.error) || Boolean(run.error || themes?.error),
  };
}
