import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  menunggu: "Menunggu",
  lolos: "Lolos",
  perlu_cek: "Perlu cek",
  gagal: "Gagal",
};

// Color plus a dot and the word itself, so the status never depends on color alone.
const STYLE: Record<string, { pill: string; dot: string }> = {
  menunggu: { pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/60" },
  lolos: { pill: "bg-success-soft text-success-foreground ring-success/20", dot: "bg-success" },
  perlu_cek: { pill: "bg-warning-soft text-warning-foreground ring-warning/30", dot: "bg-warning" },
  gagal: { pill: "bg-danger-soft text-danger-foreground ring-destructive/20", dot: "bg-destructive" },
};

export function QcBadge({ status, className }: { status: string; className?: string }) {
  const style = STYLE[status] ?? STYLE.menunggu;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        style.pill,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
      {LABEL[status] ?? status}
    </span>
  );
}
