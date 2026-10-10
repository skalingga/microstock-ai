import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// The queue lives in one browser tab, but every asset it makes is stored right away. Reading the latest job and its
// assets lets any other device (the HP) follow the batch without a second queue.

/** No new asset for this long means the tab running the queue was closed or slept. */
export const STALE_AFTER_MS = 10 * 60 * 1000;
/** A finished batch stays on the page this long, so its result can still be checked from another device. */
const SHOW_FINISHED_MS = 2 * 60 * 60 * 1000;
/** How often another device re-reads a running batch. */
export const POLL_MS = 15_000;

export type ActiveJob = {
  id: string;
  theme: string;
  style: string;
  count: number;
  /** berjalan = still running; terputus = marked running but nothing new for STALE_AFTER_MS; selesai = finished. */
  state: "berjalan" | "terputus" | "selesai";
  made: number;
  lolos: number;
  perluCek: number;
  gagal: number;
  /** Stored but without metadata yet. */
  menunggu: number;
  lastActivityAt: string;
  checkedAt: string;
};

export async function fetchActiveJob(supabase: SupabaseClient<Database>, now = Date.now()): Promise<ActiveJob | null> {
  const { data: job, error } = await supabase
    .from("generation_jobs")
    .select("id, count, status, style, created_at, themes(title)")
    // Photo jobs only hold prompts for Google Flow; their uploads are not a queue to follow from another device.
    .neq("style", "photo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !job) return null;

  const { data: assets } = await supabase.from("assets").select("qc_status, created_at").eq("job_id", job.id);
  const rows = assets ?? [];
  const lastActivityAt = rows.reduce((latest, a) => (a.created_at > latest ? a.created_at : latest), job.created_at);
  const idleMs = now - new Date(lastActivityAt).getTime();

  const running = job.status === "berjalan";
  if (!running && idleMs > SHOW_FINISHED_MS) return null;

  return {
    id: job.id,
    theme: job.themes?.title ?? "Tanpa tema",
    style: job.style,
    count: job.count,
    state: running ? (idleMs > STALE_AFTER_MS ? "terputus" : "berjalan") : "selesai",
    made: rows.length,
    lolos: rows.filter((a) => a.qc_status === "lolos").length,
    perluCek: rows.filter((a) => a.qc_status === "perlu_cek").length,
    gagal: rows.filter((a) => a.qc_status === "gagal").length,
    menunggu: rows.filter((a) => a.qc_status === "menunggu").length,
    lastActivityAt,
    checkedAt: new Date(now).toISOString(),
  };
}
