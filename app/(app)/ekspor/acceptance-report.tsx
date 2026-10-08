import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { buildReport, type Group, type ReviewedAsset } from "@/lib/adobe/stats";
import { STYLES } from "@/lib/settings/schema";
import { QC_LABEL } from "@/lib/assets";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/** Below this many decisions a rate is too noisy to act on. */
const MIN_SAMPLE = 30;
/** Rows with fewer decisions than this get an asterisk. */
const SMALL_GROUP = 5;

function GroupTable({ title, column, groups, label }: { title: string; column: string; groups: Group[]; label?: (g: string) => string }) {
  if (groups.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <caption className="pb-1 text-left text-sm font-semibold">{title}</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1 pr-2 font-semibold">
              {column}
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-semibold">
              Diterima
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-semibold">
              Ditolak
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              % diterima
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label} className="border-t">
              <th scope="row" className="py-1 pr-2 text-left font-normal">
                {label ? label(g.label) : g.label}
              </th>
              <td className="py-1 pr-2 text-right">{g.accepted}</td>
              <td className="py-1 pr-2 text-right">{g.rejected}</td>
              <td className="py-1 text-right font-semibold">
                {percent(g.rate)}
                {g.accepted + g.rejected < SMALL_GROUP && <span className="font-normal text-muted-foreground">*</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stage 6: how often Adobe Stock accepted our assets, split by what we control. Folded: it tunes QC, it is not the export task. */
export function AcceptanceReport({ rows, awaiting }: { rows: ReviewedAsset[]; awaiting: number }) {
  const report = buildReport(rows);
  const styleLabel = (v: string) => STYLES.find((s) => s.value === v)?.label ?? v;
  const { overall } = report;
  const anySmall = [report.byProvider, report.byStyle, report.byQc, report.byShapes].some((groups) =>
    groups.some((g) => g.accepted + g.rejected < SMALL_GROUP),
  );

  return (
    <details className="group rounded-md border bg-card">
      <summary className={cn("flex cursor-pointer list-none items-center gap-3 px-5 py-3", tapTarget, "min-h-13")}>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Penerimaan Adobe</span>
          <span className="block text-sm text-muted-foreground">
            {overall.total === 0
              ? "Belum ada keputusan yang dicatat"
              : `${percent(overall.rate)} diterima (${overall.accepted} dari ${overall.total})`}
            {awaiting > 0 && ` · ${awaiting} belum dicatat`}
          </span>
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180" />
      </summary>

      <div className="space-y-5 px-5 pb-5">
        <p className="text-sm text-muted-foreground">
          Catat keputusan Adobe untuk setiap aset yang sudah diunggah. Datanya dipakai untuk menyetel batas QC.
          {awaiting > 0 && (
            <>
              {" "}
              <Link href="/aset?adobe=belum" className="font-semibold text-foreground underline underline-offset-4 hover:decoration-2">
                Catat {awaiting} aset yang belum
              </Link>
            </>
          )}
        </p>

        {overall.total > 0 && (
          <>
            {overall.total < MIN_SAMPLE && (
              <p className="text-sm">
                Baru {overall.total} keputusan. Angka di bawah belum bisa dijadikan patokan sampai sekitar {MIN_SAMPLE}.
              </p>
            )}
            <div className="grid gap-6 md:grid-cols-2">
              <GroupTable title="Per provider dan model" column="Model" groups={report.byProvider} />
              <GroupTable title="Per gaya" column="Gaya" groups={report.byStyle} label={styleLabel} />
              <GroupTable title="Per status QC kita" column="Status QC" groups={report.byQc} label={(v) => QC_LABEL[v] ?? v} />
              <GroupTable title="Per jumlah bentuk (path)" column="Bentuk" groups={report.byShapes} />
            </div>
            {anySmall && <p className="text-xs text-muted-foreground">* kurang dari {SMALL_GROUP} keputusan</p>}
            {report.reasons.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Alasan penolakan terbanyak</h3>
                <ul className="list-disc pl-5 text-sm">
                  {report.reasons.map((r) => (
                    <li key={r.reason}>
                      {r.reason} <span className="text-muted-foreground tabular-nums">({r.count})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
