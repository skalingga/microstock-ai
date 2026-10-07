import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small (i) that reveals a longer explanation on hover, keyboard focus, or tap.
 * Used so help text stays one step away instead of filling the screen.
 */
export function InfoTip({
  children,
  label = "Penjelasan",
  align = "center",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <span className={cn("group/tip relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none hover:text-primary focus-visible:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Info className="size-4" />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute top-full z-50 mt-1.5 w-72 max-w-[80vw] rounded-xl border bg-popover p-3 text-left text-xs leading-relaxed font-normal text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-hover/tip:visible group-hover/tip:opacity-100",
          align === "start" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "end" && "right-0",
        )}
      >
        {children}
      </span>
    </span>
  );
}
