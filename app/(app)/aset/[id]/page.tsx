import Link from "next/link";
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

const NOTE_MARK: Record<NoteStatus, { symbol: string; className: string }> = {
  ok: { symbol: "✓", className: "text-emerald-600" },
  cek: { symbol: "!", className: "text-amber-600" },
  gagal: { symbol: "✕", className: "text-red-600" },
};

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
      <Link href={`/aset?job=${asset.job_id}`} className="text-sm underline underline-offset-4">
        ← Kembali ke aset
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-lg border">
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
                className="aspect-square w-full max-w-xs rounded-md border"
                style={{ backgroundImage: `url(${svgUrl})`, backgroundSize: "50% 50%", backgroundRepeat: "repeat" }}
              />
              <p className="text-xs text-muted-foreground">Cari garis sambungan di tengah. Pola yang baik tidak terlihat sambungannya.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{asset.title ?? "Aset tanpa judul"}</h1>
              <QcBadge status={asset.qc_status} />
            </div>
            {asset.concept && <p className="text-muted-foreground">{asset.concept}</p>}
          </div>

          <section className="space-y-2" aria-labelledby="qc-heading">
            <h2 id="qc-heading" className="font-medium">
              Hasil QC
            </h2>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">QC belum dijalankan untuk aset ini.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {notes.map((note, i) => (
                  <li key={`${note.check}-${i}`} className="flex gap-2">
                    <span aria-hidden className={cn("w-4 shrink-0 text-center font-bold", NOTE_MARK[note.status].className)}>
                      {NOTE_MARK[note.status].symbol}
                    </span>
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
          </section>

          <section className="space-y-3" aria-labelledby="meta-heading">
            <h2 id="meta-heading" className="font-medium">
              Metadata
            </h2>
            <MetadataForm
              key={`${asset.title}-${asset.keywords.length}-${asset.category}`}
              id={asset.id}
              title={asset.title}
              keywords={asset.keywords}
              category={asset.category}
              needsRelease={asset.needs_release}
            />
          </section>

          <section className="space-y-3" aria-labelledby="adobe-heading">
            <h2 id="adobe-heading" className="font-medium">
              Hasil review Adobe
            </h2>
            <AdobeResultForm key={`${asset.adobe_status}-${asset.adobe_reason}`} id={asset.id} status={asset.adobe_status} reason={asset.adobe_reason} />
          </section>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-start gap-3">
            {download?.data?.signedUrl && (
              <a
                href={download.data.signedUrl}
                className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
              >
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
