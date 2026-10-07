import {
  ArrowLeft,
  BadgeCheck,
  CircleCheck,
  CircleX,
  Download,
  ShieldCheck,
  Tags,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { QcBadge } from "@/components/qc-badge";
import { SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { parseNotes, type NoteStatus } from "@/lib/qc/types";
import { STYLES, type StyleId } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AdobeResultForm } from "./adobe-result-form";
import { AssetActions } from "./asset-actions";
import { DeleteButton } from "./delete-button";
import { MetadataForm } from "./metadata-form";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const NOTE_MARK: Record<NoteStatus, { icon: LucideIcon; className: string }> = {
  ok: { icon: CircleCheck, className: "text-success" },
  cek: { icon: TriangleAlert, className: "text-warning-foreground" },
  gagal: { icon: CircleX, className: "text-destructive" },
};

function Section({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function HalamanDetailAset({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  if (!asset) notFound();

  const [{ data: job }, { data: settings }] = await Promise.all([
    supabase.from("generation_jobs").select("style, theme_id").eq("id", asset.job_id).maybeSingle(),
    supabase.from("user_settings").select("banned_words").maybeSingle(),
  ]);
  const { data: theme } = job?.theme_id
    ? await supabase.from("themes").select("title").eq("id", job.theme_id).maybeSingle()
    : { data: null };

  const style = (STYLES.find((s) => s.value === job?.style)?.value ?? "icon_set") as StyleId;
  const styleLabel = STYLES.find((s) => s.value === style)?.label ?? style;

  const storage = supabase.storage.from("assets");
  const [view, download] = await Promise.all([
    asset.svg_path ? storage.createSignedUrl(asset.svg_path, SIGNED_URL_TTL_SEC) : null,
    asset.svg_path ? storage.createSignedUrl(asset.svg_path, SIGNED_URL_TTL_SEC, { download: `aset-${asset.id.slice(0, 8)}.svg` }) : null,
  ]);

  const notes = parseNotes(asset.qc_notes);
  const rows: [string, string][] = [
    ["Tema", theme?.title ?? "-"],
    ["Gaya", styleLabel],
    ["Provider", asset.provider],
    ["Model", asset.model],
    ["Jumlah bentuk", asset.path_count === null ? "-" : String(asset.path_count)],
    ["Dibuat", dateFormat.format(new Date(asset.created_at))],
    ["Diekspor", asset.exported_at ? dateFormat.format(new Date(asset.exported_at)) : "Belum"],
  ];
  const svgUrl = view?.data?.signedUrl;

  return (
    <div className="space-y-6">
      <Link
        href={`/aset?job=${asset.job_id}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Kembali ke aset
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-2xl border shadow-sm">
            {svgUrl ? (
              // Shown through <img>, never inline, so scripts in an SVG can never run.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={svgUrl} alt={asset.title ?? asset.concept ?? "Aset SVG"} className="size-full object-contain" />
            ) : (
              <span className="text-sm text-muted-foreground">File SVG tidak tersedia.</span>
            )}
          </div>

          {style === "seamless_pattern" && svgUrl && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Uji tile 2×2</p>
              <div
                role="img"
                aria-label="Pola diulang 2 kali 2"
                className="aspect-square w-full max-w-xs rounded-xl border"
                style={{ backgroundImage: `url(${svgUrl})`, backgroundSize: "50% 50%", backgroundRepeat: "repeat" }}
              />
              <p className="text-xs text-muted-foreground">Cari garis sambungan di tengah. Pola yang baik tidak terlihat sambungannya.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <QcBadge status={asset.qc_status} />
            <h1 className="text-2xl font-bold">{asset.title ?? "Aset tanpa judul"}</h1>
            {asset.concept && <p className="leading-relaxed text-muted-foreground">{asset.concept}</p>}
          </div>

          <Section id="qc-heading" icon={ShieldCheck} title="Hasil QC">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">QC belum dijalankan untuk aset ini.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {notes.map((note, i) => (
                  <li key={`${note.check}-${i}`} className="flex gap-2">
                    {(() => {
                      const Mark = NOTE_MARK[note.status].icon;
                      return <Mark aria-hidden className={cn("mt-0.5 size-4 shrink-0", NOTE_MARK[note.status].className)} />;
                    })()}
                    <span>
                      <span className="sr-only">{note.status === "ok" ? "Lolos: " : note.status === "cek" ? "Perlu cek: " : "Gagal: "}</span>
                      {note.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!asset.title && asset.qc_status === "menunggu" && (
              <p className="text-sm text-muted-foreground">Menunggu metadata. Buat dengan AI atau isi manual di bawah.</p>
            )}
            <AssetActions
              asset={{
                id: asset.id,
                svg_path: asset.svg_path,
                qc_notes: asset.qc_notes,
                title: asset.title,
                keywords: asset.keywords,
                category: asset.category,
                needs_release: asset.needs_release,
              }}
              style={style}
              theme={theme?.title ?? ""}
              concept={asset.concept ?? ""}
              bannedWords={settings?.banned_words ?? []}
            />
          </Section>

          <Section id="meta-heading" icon={Tags} title="Metadata">
            <MetadataForm
              key={`${asset.title}-${asset.keywords.length}-${asset.category}`}
              id={asset.id}
              title={asset.title}
              keywords={asset.keywords}
              category={asset.category}
              needsRelease={asset.needs_release}
            />
          </Section>

          <Section id="adobe-heading" icon={BadgeCheck} title="Hasil review Adobe">
            <AdobeResultForm key={`${asset.adobe_status}-${asset.adobe_reason}`} id={asset.id} status={asset.adobe_status} reason={asset.adobe_reason} />
          </Section>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl border bg-card p-5 text-sm shadow-xs">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-start gap-3">
            {download?.data?.signedUrl && (
              <a href={download.data.signedUrl} className={buttonVariants({ variant: "outline" })}>
                <Download />
                Unduh SVG
              </a>
            )}
            <DeleteButton id={asset.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
