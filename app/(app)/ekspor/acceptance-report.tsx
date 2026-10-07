import { BadgeCheck } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { buildReport, type Group, type ReviewedAsset } from "@/lib/adobe/stats";
import { STYLES } from "@/lib/settings/schema";
import { QC_LABEL } from "@/lib/assets";

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function GroupTable({ title, groups, label }: { title: string; groups: Group[]; label?: (g: string) => string }) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2 font-normal">Kelompok</th>
            <th className="py-1 pr-2 text-right font-normal">Diterima</th>
            <th className="py-1 pr-2 text-right font-normal">Ditolak</th>
            <th className="py-1 text-right font-normal">Tingkat</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label} className="border-t">
              <td className="py-1 pr-2">{label ? label(g.label) : g.label}</td>
              <td className="py-1 pr-2 text-right">{g.accepted}</td>
              <td className="py-1 pr-2 text-right">{g.rejected}</td>
              <td className="py-1 text-right font-medium">{percent(g.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stage 6: how often Adobe Stock accepted our assets, split by what we control. */
export function AcceptanceReport({ rows, awaiting }: { rows: ReviewedAsset[]; awaiting: number }) {
  const report = buildReport(rows);
  const styleLabel = (v: string) => STYLES.find((s) => s.value === v)?.label ?? v;

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby="acceptance-heading">
      <div className="space-y-1">
        <h2 id="acceptance-heading" className="flex items-center gap-2 font-semibold">
          <BadgeCheck className="size-4 text-primary" />
          Tingkat penerimaan Adobe
          <InfoTip align="start">Isi keputusan Adobe di halaman detail tiap aset. Data ini dipakai untuk menyetel batas QC.</InfoTip>
        </h2>
        {awaiting > 0 && (
          <p className="text-sm text-muted-foreground">{awaiting} aset diekspor, keputusan Adobe belum dicatat.</p>
        )}
      </div>

      {report.overall.total === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada keputusan yang dicatat.</p>
      ) : (
        <>
          <p className="text-sm">
            Semua: <strong>{percent(report.overall.rate)}</strong> diterima ({report.overall.accepted} dari{" "}
            {report.overall.total}).
            {report.overall.total < 30 && " Contoh masih sedikit, jadi angka ini belum bisa dijadikan patokan."}
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <GroupTable title="Per provider dan model" groups={report.byProvider} />
            <GroupTable title="Per gaya" groups={report.byStyle} label={styleLabel} />
            <GroupTable title="Per status QC kita" groups={report.byQc} label={(v) => QC_LABEL[v] ?? v} />
            <GroupTable title="Per jumlah bentuk" groups={report.byShapes} />
          </div>
          {report.reasons.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Alasan penolakan terbanyak</h3>
              <ul className="list-disc pl-5 text-sm">
                {report.reasons.map((r) => (
                  <li key={r.reason}>
                    {r.reason} <span className="text-muted-foreground">({r.count})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
