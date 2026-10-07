import { PackageCheck, ShieldCheck, Sparkles, Telescope } from "lucide-react";
import { Brand } from "@/components/brand";

const STEPS = [
  { icon: Telescope, title: "Riset tema", text: "Event dan musim yang dicari pembeli, diurutkan menurut peluang." },
  { icon: Sparkles, title: "Generate SVG", text: "Variasi ikon, pola, ilustrasi, siluet, dan line art dari satu tema." },
  { icon: ShieldCheck, title: "QC otomatis", text: "Teks, kerumitan, tile pola, latar, dan kemiripan diperiksa sebelum diunggah." },
  { icon: PackageCheck, title: "Siap Adobe Stock", text: "ZIP berisi SVG plus CSV judul dan keyword dalam satu klik." },
];

/** Split screen for the sign-in pages: what the app does on the left, the form on the right. */
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <section className="bg-brand-glow relative hidden flex-col justify-between overflow-hidden border-r bg-card p-12 lg:flex">
        <Brand />
        <div className="max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl leading-tight font-bold">
              Dari satu tema ke aset vektor{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">siap jual</span>.
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Buat, periksa, dan ekspor SVG untuk Adobe Stock tanpa pindah aplikasi.
            </p>
          </div>
          <ul className="space-y-4">
            {STEPS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm ring-1 ring-border">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Aset dibuat dengan AI: centang label generative AI saat mengunggah.</p>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-[0_8px_30px_-12px_oklch(0.2_0.04_266/0.18)]">{children}</div>
        </div>
      </section>
    </main>
  );
}
