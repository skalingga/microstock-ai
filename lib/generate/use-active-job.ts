"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { POLL_MS, fetchActiveJob, type ActiveJob } from "./active-job";

/** Without a running batch, look for a new one this often (it may have been started on the PC). */
const IDLE_POLL_MS = 60_000;

/**
 * The latest batch, kept fresh for the navigation badge: every POLL_MS while it runs, every minute otherwise,
 * and right away when the tab becomes visible again. A hidden tab does not poll.
 */
export function useActiveJob(initial: ActiveJob | null): ActiveJob | null {
  const [job, setJob] = useState(initial);
  const running = job?.state === "berjalan";

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetchActiveJob(createClient()).then(
        (next) => !cancelled && setJob(next),
        () => undefined, // a failed read keeps the last known state
      );
    };
    const timer = setInterval(refresh, running ? POLL_MS : IDLE_POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [running]);

  return job;
}
