import { Brand } from "@/components/brand";
import { Anchor, PenPath } from "@/components/pen-motif";
import { ThemeToggle } from "@/components/theme-toggle";

const STEPS = ["Riset tema berpeluang", "Generate variasi SVG", "QC otomatis", "Ekspor ZIP + CSV untuk Adobe"];

/** Split screen for the sign-in pages: what the app does on the left, the form on the right. */
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className="hidden flex-col justify-between border-r bg-card p-12 lg:flex">
        <Brand />
        <div className="max-w-xl space-y-10">
          <h1 className="text-6xl leading-[0.95] font-extrabold xl:text-7xl">
            Dari satu tema ke aset vektor <span className="text-brand">siap jual.</span>
          </h1>
          {/* The four steps sit on one path, each an anchor point; the generate step is the selected one. */}
          <ol className="relative space-y-5 pl-1">
            <span aria-hidden className="absolute top-2 bottom-2 left-[9.5px] w-px bg-foreground/40" />
            {STEPS.map((step, i) => (
              <li key={step} className="relative flex items-center gap-4">
                <Anchor filled={i === 1} className="size-3 text-foreground" />
                <span className="text-lg font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <PenPath className="max-w-md" />
      </section>

      <section className="flex flex-col p-4 sm:p-8">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center space-y-6 py-6">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-2xl border bg-card p-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
