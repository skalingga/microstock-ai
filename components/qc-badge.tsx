import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  menunggu: "Menunggu",
  lolos: "Lolos",
  perlu_cek: "Perlu cek",
  gagal: "Gagal",
};

const STYLE: Record<string, string> = {
  menunggu: "bg-muted text-muted-foreground",
  lolos: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  perlu_cek: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  gagal: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function QcBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium", STYLE[status] ?? STYLE.menunggu, className)}>
      {LABEL[status] ?? status}
    </span>
  );
}
