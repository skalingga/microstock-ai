import { PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

/** The app's mark: an indigo tile with a vector pen, the tool behind every asset. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30",
        className,
      )}
    >
      <PenTool className="size-[18px]" strokeWidth={2.25} />
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">MicroStock</span>
        <span className="block text-xs font-medium text-muted-foreground">Vector AI</span>
      </span>
    </span>
  );
}
