import { cn } from "@/lib/utils";

/** Title block at the top of every page: a poster-weight title, one-line purpose, and optional actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="text-4xl leading-none font-extrabold sm:text-5xl">{title}</h1>
          {description && <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
