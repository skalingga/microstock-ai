import { Brand } from "@/components/brand";
import { Anchor, PenPath } from "@/components/pen-motif";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const STEPS = ["Riset tema berpeluang", "Generate variasi SVG", "QC otomatis", "Ekspor ZIP + CSV untuk Adobe"];

/** Split screen for the sign-in pages: what the app does on the left, the form on the right. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className="hidden flex-col justify-between border-r bg-card p-12 lg:flex">
        <Brand />
        <div className="max-w-xl space-y-10">
          {/* The page's h1 is the form heading; this is the pitch beside it. */}
          <p className="text-5xl leading-[0.95] font-extrabold tracking-tight text-balance xl:text-6xl">
            Dari satu tema ke aset vektor <span className="text-brand">siap unggah.</span>
          </p>
          {/* The four steps sit on one path, each an anchor point. */}
          <ol className="relative space-y-5 pl-1">
            <span aria-hidden className="absolute top-2 bottom-2 left-[9.5px] w-px bg-foreground/40" />
            {STEPS.map((step) => (
              <li key={step} className="relative flex items-center gap-4">
                <Anchor className="size-3 text-foreground" />
                <span className="text-lg font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <PenPath className="max-w-md" />
      </section>

      <section className="flex flex-col p-4 sm:p-8">
        <div className="flex items-center justify-between lg:justify-end">
          <Brand className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center space-y-6 py-8">
          {/* On phones the pitch panel is hidden; this strip keeps the pen-tool drawing above the form. */}
          <PenPath className="max-w-48 lg:hidden" />
          {children}
        </div>
      </section>
    </main>
  );
}

/** The form's title. It is the page's h1 and takes focus when the form changes mode. */
export function AuthHeading({
  title,
  description,
  headingRef,
}: {
  title: string;
  description: string;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="space-y-2">
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-balance outline-none sm:text-4xl">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function AuthCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border bg-card p-6", className)}>{children}</div>;
}
