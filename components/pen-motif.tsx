import { cn } from "@/lib/utils";

// The pen-tool motif from DESIGN.md: square anchor points and bezier handles, as drawn in a vector editor.

/** A square anchor point. Filled (vermilion) marks the selected or active one. */
export function Anchor({ filled = false, className }: { filled?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 border-[1.5px]", filled ? "border-brand bg-brand" : "border-current bg-card", className)}
    />
  );
}

/** The app mark: one bezier segment, its start anchor selected with a handle pulled out. */
export function BezierMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0 text-foreground", className)} fill="none">
      <path d="M6 26C6 14 26 18 26 6" stroke="currentColor" strokeWidth="2.25" />
      <path d="M6 26V14" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="6" cy="13" r="2" className="fill-card" stroke="currentColor" strokeWidth="1.25" />
      <rect x="3" y="23" width="6" height="6" className="fill-brand stroke-brand" strokeWidth="1.5" />
      <rect x="23" y="3" width="6" height="6" className="fill-card" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const HANDLE_SPOTS = [
  "-top-1 -left-1",
  "-top-1 left-1/2 -translate-x-1/2",
  "-top-1 -right-1",
  "top-1/2 -right-1 -translate-y-1/2",
  "-right-1 -bottom-1",
  "-bottom-1 left-1/2 -translate-x-1/2",
  "-bottom-1 -left-1",
  "top-1/2 -left-1 -translate-y-1/2",
];

/** Bounding box with eight handles, like a selected object in Illustrator. Place inside a relative parent. */
export function SelectionHandles() {
  return (
    <span aria-hidden className="pointer-events-none absolute -inset-px border border-brand">
      {HANDLE_SPOTS.map((spot) => (
        <span key={spot} className={cn("absolute size-2 border-[1.5px] border-brand bg-card", spot)} />
      ))}
    </span>
  );
}

/** Progress as an ink stroke being drawn, with the pen's anchor at its tip. */
export function ProgressLine({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="relative h-2.5">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <div className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-foreground transition-[width] duration-300" style={{ width: `${pct}%` }} />
      <span
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 border-[1.5px] border-brand bg-brand transition-[left] duration-300"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

/** A loose bezier path with three anchors; the drawing for empty states and the sign-in page. */
export function PenPath({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 80" aria-hidden className={cn("h-auto w-full text-muted-foreground", className)} fill="none">
      <path d="M12 64C40 64 80 40 120 40S200 16 228 16" stroke="currentColor" strokeWidth="1.75" />
      <path d="M80 40H160" stroke="currentColor" strokeWidth="1" />
      <circle cx="80" cy="40" r="3" className="fill-card" stroke="currentColor" strokeWidth="1" />
      <circle cx="160" cy="40" r="3" className="fill-card" stroke="currentColor" strokeWidth="1" />
      <rect x="8" y="60" width="8" height="8" className="fill-card" stroke="currentColor" strokeWidth="1.5" />
      <rect x="116" y="36" width="8" height="8" className="fill-brand stroke-brand" strokeWidth="1.5" />
      <rect x="224" y="12" width="8" height="8" className="fill-card" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
