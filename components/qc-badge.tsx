import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  menunggu: "Menunggu",
  lolos: "Lolos",
  perlu_cek: "Perlu cek",
  gagal: "Gagal",
};

// Color plus a square anchor and the word itself, so the status never depends on color alone.
const STYLE: Record<string, { pill: string; anchor: string }> = {
  menunggu: { pill: "bg-muted text-muted-foreground", anchor: "border-muted-foreground bg-card" },
  lolos: { pill: "bg-success-soft text-success-foreground", anchor: "border-success bg-success" },
  perlu_cek: { pill: "bg-warning-soft text-warning-foreground", anchor: "border-warning-foreground bg-warning" },
  gagal: { pill: "bg-danger-soft text-danger-foreground", anchor: "border-destructive bg-destructive" },
};

export function QcBadge({ status, className }: { status: string; className?: string }) {
  const style = STYLE[status] ?? STYLE.menunggu;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-semibold", style.pill, className)}>
      <span aria-hidden className={cn("size-1.5 border", style.anchor)} />
      {LABEL[status] ?? status}
    </span>
  );
}
