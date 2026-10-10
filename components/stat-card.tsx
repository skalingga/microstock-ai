import { cn } from "@/lib/utils";

/** One number with its label; optionally a bar for "used of limit" values. */
export function StatCard({
  label,
  value,
  detail,
  progress,
  tone = "limit",
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  /** 0..1 share of a limit or goal; shown as a bar under the value. */
  progress?: number;
  /** limit: the bar turns red from 90% (spending). goal: a full bar is good news (daily target). */
  tone?: "limit" | "goal";
  className?: string;
}) {
  const pct = progress === undefined ? undefined : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl leading-none font-extrabold tabular-nums sm:text-3xl">{value}</p>
      {pct !== undefined && (
        <div className="mt-3 h-1 bg-muted" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={cn(
              "h-full origin-left transition-transform duration-300",
              tone === "limit" && pct >= 90 ? "bg-destructive" : "bg-foreground",
            )}
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
      )}
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
