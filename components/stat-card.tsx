import { cn } from "@/lib/utils";

/** One number with its label; optionally a bar for "used of limit" values. */
export function StatCard({
  label,
  value,
  detail,
  progress,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  /** 0..1 share of a limit; shown as a bar under the value, turning red from 90%. */
  progress?: number;
  className?: string;
}) {
  const pct = progress === undefined ? undefined : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-3xl leading-none font-extrabold tabular-nums">{value}</p>
      {pct !== undefined && (
        <div className="mt-3 h-1 bg-muted" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={cn("h-full transition-[width] duration-300", pct >= 90 ? "bg-destructive" : "bg-foreground")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
