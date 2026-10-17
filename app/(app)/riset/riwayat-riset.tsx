import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { QcBadge } from "@/components/qc-badge";
import { HISTORY_THUMBS, type HistoryAsset, type History, type HistoryTheme } from "@/lib/research/history";
import { STYLES } from "@/lib/settings/schema";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/** Short style names for the line under a theme: "Line art", not "Line art (gambar AI, berbayar)". */
const styleLabel = (value: string) =>
  value === "photo" ? "Foto" : (STYLES.find((s) => s.value === value)?.label ?? value).replace(/\s*\(.*\)$/, "");

const VERDICT = {
  diterima: { text: "Diterima Adobe", ring: "ring-success" },
  ditolak: { text: "Ditolak Adobe", ring: "ring-destructive" },
} as const;

function Thumb({ asset, url }: { asset: HistoryAsset; url: string | null }) {
  const verdict = asset.adobeStatus === "diterima" || asset.adobeStatus === "ditolak" ? VERDICT[asset.adobeStatus] : null;
  return (
    <Link
      href={`/aset/${asset.id}`}
      title={[verdict?.text, `QC ${asset.qcStatus.replace("_", " ")}`].filter(Boolean).join(" · ")}
      className={cn(
        "bg-checker relative size-14 shrink-0 overflow-hidden rounded-sm border sm:size-16",
        verdict && cn("ring-2 ring-offset-1", verdict.ring),
      )}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={verdict ? verdict.text : "Aset"} className="size-full object-contain" loading="lazy" />
      )}
      <span className="sr-only">{`${verdict?.text ?? "Belum ada keputusan Adobe"}, QC ${asset.qcStatus.replace("_", " ")}`}</span>
    </Link>
  );
}

function ThemeRow({ theme, urls }: { theme: HistoryTheme; urls: Map<string, string> }) {
  const shown = theme.assets.slice(0, HISTORY_THUMBS);
  const more = theme.assets.length - shown.length;
  const waiting = theme.assets.filter((a) => a.qcStatus !== "lolos").length;
  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 font-semibold">{theme.title}</p>
        <p className="text-xs text-muted-foreground">{theme.styles.map(styleLabel).join(" · ")}</p>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{theme.assets.length} aset</span>
        {theme.lolos > 0 && (
          <span className="inline-flex items-center gap-1">
            <QcBadge status="lolos" />
            <span className="tabular-nums">{theme.lolos}</span>
          </span>
        )}
        {waiting > 0 && <span>{waiting} belum Lolos</span>}
        {theme.accepted > 0 && <span className="font-semibold text-success-foreground">{theme.accepted} diterima</span>}
        {theme.rejected > 0 && <span className="font-semibold text-danger-foreground">{theme.rejected} ditolak</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((a) => (
          <Thumb key={a.id} asset={a} url={a.previewPath ? (urls.get(a.previewPath) ?? null) : null} />
        ))}
        {more > 0 && (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-sm border text-xs font-semibold text-muted-foreground sm:size-16">
            +{more}
          </span>
        )}
      </div>
      <Link href={`/aset?job=${theme.latestJobId}`} className={cn("inline-flex items-center text-xs font-semibold underline underline-offset-4", tapTarget)}>
        Buka batch terbaru di galeri
      </Link>
    </li>
  );
}

/** Past research runs and, per theme that was generated, thumbnails of its assets with their QC and Adobe results. */
export function RiwayatRiset({ history, urls }: { history: History; urls: Map<string, string> }) {
  const withAssets = history.runs.filter((r) => r.themes.length > 0);
  const nothing = withAssets.length === 0 && history.own.length === 0;
  return (
    <section className="space-y-3" aria-labelledby="riwayat-riset-heading">
      <div>
        <h2 id="riwayat-riset-heading" className="text-lg font-bold">
          Riwayat riset
        </h2>
        <p className="text-sm text-muted-foreground">
          Tema yang sudah dijadikan aset, dikelompokkan per riset (dicocokkan lewat judul tema). Bingkai hijau = diterima Adobe,
          merah = ditolak.
        </p>
      </div>
      {nothing ? (
        <p className="text-sm text-muted-foreground">Belum ada tema riset yang dijadikan aset. Setelah generate dari tema, hasilnya muncul di sini.</p>
      ) : (
        <ul className="divide-y rounded-md border bg-card">
          {withAssets.map((run, index) => {
            const total = run.themes.reduce((n, t) => n + t.assets.length, 0);
            const accepted = run.themes.reduce((n, t) => n + t.accepted, 0);
            const rejected = run.themes.reduce((n, t) => n + t.rejected, 0);
            return (
              <li key={run.id}>
                <details className="group" open={index === 0}>
                  <summary className={cn("flex cursor-pointer list-none items-center gap-3 px-4", tapTarget, "min-h-12")}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{dateFormat.format(new Date(run.createdAt))}</span>
                      <span className="block text-xs text-muted-foreground">
                        {run.generatedCount} dari {run.themeCount} tema di-generate · {total} aset
                        {accepted + rejected > 0 && ` · ${accepted} diterima, ${rejected} ditolak`}
                      </span>
                    </span>
                    <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180" />
                  </summary>
                  <ul className="divide-y border-t">
                    {run.themes.map((theme) => (
                      <ThemeRow key={theme.key} theme={theme} urls={urls} />
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {history.own.length > 0 && (
        <details className="group rounded-md border bg-card">
          <summary className={cn("flex cursor-pointer list-none items-center gap-3 px-4", tapTarget, "min-h-12")}>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Tema buatan sendiri</span>
              <span className="block text-xs text-muted-foreground">
                {history.own.length} tema yang judulnya tidak ada di hasil riset mana pun
              </span>
            </span>
            <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <ul className="divide-y border-t">
            {history.own.map((theme) => (
              <ThemeRow key={theme.key} theme={theme} urls={urls} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
