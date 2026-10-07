import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  indigo: { tile: "bg-secondary text-secondary-foreground", bar: "bg-primary" },
  amber: { tile: "bg-warning-soft text-warning-foreground", bar: "bg-warning" },
  emerald: { tile: "bg-success-soft text-success-foreground", bar: "bg-success" },
  rose: { tile: "bg-danger-soft text-danger-foreground", bar: "bg-destructive" },
  slate: { tile: "bg-muted text-muted-foreground", bar: "bg-muted-foreground" },
} as const;

export type StatTone = keyof typeof TONES;

/** One number with its label; optionally a bar for "used of limit" values. */
export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "indigo",
  progress,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: StatTone;
  /** 0..1 share of a limit; shown as a bar under the value. */
  progress?: number;
  className?: string;
}) {
  const t = TONES[tone];
  const pct = progress === undefined ? undefined : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-[0_1px_2px_oklch(0.2_0.04_266/0.04)]", className)}>
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", t.tile)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold tabular-nums">{value}</p>
        </div>
      </div>
      {pct !== undefined && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={label}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={cn("h-full rounded-full transition-[width] duration-300", pct >= 90 ? "bg-destructive" : t.bar)} style={{ width: `${pct}%` }} />
        </div>
      )}
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
