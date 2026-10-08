import { BezierMark } from "@/components/pen-motif";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BezierMark />
      <span className="leading-none">
        <span className="block text-base font-extrabold tracking-tight">MicroStock</span>
        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">Vector AI</span>
      </span>
    </span>
  );
}
