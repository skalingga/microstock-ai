import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Title block at the top of every page: icon tile, title, one-line purpose, and optional actions on the right. */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground ring-1 ring-primary/10"
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
          {description && <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
