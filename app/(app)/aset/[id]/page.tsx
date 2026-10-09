import { ChevronDown, Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QcBadge } from "@/components/qc-badge";
import { buttonVariants } from "@/components/ui/button";
import { SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { makeFilename } from "@/lib/export/slug";
import { parseNotes, type NoteStatus } from "@/lib/qc/types";
import { STYLES, type StyleId } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { applyGalleryFilter, galleryQuery, parseGalleryFilter, withQuery, type GalleryParams } from "../filters";
import { AdobeResultForm } from "./adobe-result-form";
import { RegenerateMetadataButton, RerunQcButton } from "./asset-actions";
import { DeleteButton } from "./delete-button";
import { DetailNav } from "./detail-nav";
import { MetadataForm } from "./metadata-form";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

// Square anchors in the status colours, the same mark as the QC badge.
const NOTE_ANCHOR: Record<NoteStatus, string> = {
  ok: "border-success bg-success",
  cek: "border-warning-foreground bg-warning",
  gagal: "border-destructive bg-destructive",
};
const NOTE_ORDER: Record<NoteStatus, number> = { gagal: 0, cek: 1, ok: 2 };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t pt-5" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function HalamanDetailAset({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<GalleryParams>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  // The gallery view the user came from: back, prev and next stay inside it.
  const filter = parseGalleryFilter(await searchParams);
  const query = galleryQuery(filter);

  const supabase = await createClient();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  if (!asset) notFound();

  const neighbour = (newer: boolean) =>
    applyGalleryFilter(
      supabase
        .from("assets")
        .select("id")
        [newer ? "gt" : "lt"]("created_at", asset.created_at)
        .order("created_at", { ascending: newer })
        .limit(1),
      filter,
    ).maybeSingle();

  const [{ data: job }, { data: settings }, { data: prev }, { data: next }] = await Promise.all([
    supabase.from("generation_jobs").select("style, theme_id").eq("id", asset.job_id).maybeSingle(),
    supabase.from("user_settings").select("banned_words").maybeSingle(),
    neighbour(true),
    neighbour(false),
  ]);
  const { data: theme } = job?.theme_id
    ? await supabase.from("themes").select("title").eq("id", job.theme_id).maybeSingle()
    : { data: null };

  const style = (STYLES.find((s) => s.value === job?.style)?.value ?? "icon_set") as StyleId;
  const styleLabel = STYLES.find((s) => s.value === style)?.label ?? style;

  // Same file name the export would give it, so a manual upload matches the CSV.
  const filename = asset.title ? makeFilename(asset.title, asset.id, new Set()) : `aset-${asset.id.slice(0, 8)}.svg`;
  const storage = supabase.storage.from("assets");
  const [view, download] = await Promise.all([
    asset.svg_path ? storage.createSignedUrl(asset.svg_path, SIGNED_URL_TTL_SEC) : null,
    asset.svg_path ? storage.createSignedUrl(asset.svg_path, SIGNED_URL_TTL_SEC, { download: filename }) : null,
  ]);

  const notes = parseNotes(asset.qc_notes).sort((a, b) => NOTE_ORDER[a.status] - NOTE_ORDER[b.status]);
  const problems = notes.filter((n) => n.status !== "ok");
  const passed = notes.filter((n) => n.status === "ok");
  const rows: [string, React.ReactNode][] = [
    ["Tema", theme?.title ?? "-"],
    ["Gaya", styleLabel],
    ["Provider", asset.provider],
    ["Model", <span key="m" className="font-mono text-xs">{asset.model}</span>],
    ["Jumlah bentuk (path)", asset.path_count === null ? "-" : String(asset.path_count)],
    ["Dibuat", dateFormat.format(new Date(asset.created_at))],
    ["Diekspor", asset.exported_at ? dateFormat.format(new Date(asset.exported_at)) : "Belum"],
    ["Nama file", <span key="f" className="font-mono text-xs break-all">{filename}</span>],
  ];
  const svgUrl = view?.data?.signedUrl;
  const exportable = Boolean(asset.title) && (asset.qc_status === "lolos" || asset.qc_status === "perlu_cek");
  // Why there is no Export button, so its absence is not a mystery.
  const exportBlockedReason = exportable
    ? null
    : asset.qc_status === "gagal"
      ? "Tidak bisa diekspor: status Gagal. Perbaiki lewat hasil QC di bawah, atau buat ulang asetnya."
      : !asset.title
        ? "Belum bisa diekspor: aset belum punya metadata."
        : "Belum bisa diekspor: QC belum Lolos atau Perlu cek.";
  const storedAsset = {
    id: asset.id,
    svg_path: asset.svg_path,
    qc_notes: asset.qc_notes,
    title: asset.title,
    keywords: asset.keywords,
    category: asset.category,
    needs_release: asset.needs_release,
  };

  const noteItem = (note: (typeof notes)[number], i: number) => (
    <li key={`${note.check}-${i}`} className="flex gap-2.5">
      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 border-[1.5px]", NOTE_ANCHOR[note.status])} />
      <span>
        <span className="sr-only">{note.status === "ok" ? "Lolos: " : note.status === "cek" ? "Perlu cek: " : "Gagal: "}</span>
        {note.message}
      </span>
    </li>
  );

  return (
    <div className="space-y-6">
      <DetailNav
        backHref={withQuery("/aset", query)}
        prevHref={prev ? withQuery(`/aset/${prev.id}`, query) : undefined}
        nextHref={next ? withQuery(`/aset/${next.id}`, query) : undefined}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-md border max-lg:max-h-[55vh] max-lg:w-auto">
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
                aria-label="Pola yang sama diulang 2 kali 2, untuk melihat sambungannya"
                className="aspect-square w-full max-w-xs rounded-md border"
                style={{ backgroundImage: `url(${svgUrl})`, backgroundSize: "50% 50%", backgroundRepeat: "repeat" }}
              />
              <p className="text-xs text-muted-foreground">Sambungan di tengah tidak boleh terlihat.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <QcBadge status={asset.qc_status} />
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight">{asset.title ?? "Aset tanpa judul"}</h1>
            {asset.concept && <p className="leading-relaxed text-muted-foreground">{asset.concept}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {exportable && (
                <Link href={`/ekspor?pilih=${asset.id}`} className={buttonVariants()}>
                  <Download />
                  Ekspor aset ini
                </Link>
              )}
              {download?.data?.signedUrl && (
                <a href={download.data.signedUrl} className={buttonVariants({ variant: "outline" })}>
                  <Download />
                  Unduh SVG
                </a>
              )}
              {next && (
                <Link href={withQuery(`/aset/${next.id}`, query)} className={buttonVariants({ variant: "ghost" })}>
                  Aset berikutnya
                </Link>
              )}
            </div>
            {exportBlockedReason && <p className="text-sm text-muted-foreground">{exportBlockedReason}</p>}
          </div>

          <Section id="qc-heading" title="Hasil QC">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {!asset.title && asset.qc_status === "menunggu" ? "QC dan metadata belum dijalankan." : "QC belum dijalankan untuk aset ini."}
              </p>
            ) : (
              <>
                {problems.length > 0 && <ul className="space-y-2 text-sm">{problems.map(noteItem)}</ul>}
                {passed.length > 0 && (
                  <details className="group text-sm" open={problems.length === 0}>
                    <summary className={cn("inline-flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground", tapTarget)}>
                      {passed.length} pemeriksaan lolos
                      <ChevronDown aria-hidden className="size-4 transition-transform duration-150 group-open:rotate-180" />
                    </summary>
                    <ul className="mt-1 space-y-2">{passed.map(noteItem)}</ul>
                  </details>
                )}
              </>
            )}
            <RerunQcButton asset={storedAsset} style={style} bannedWords={settings?.banned_words ?? []} />
          </Section>

          <Section id="meta-heading" title="Metadata">
            <MetadataForm
              key={`${asset.title}-${asset.keywords.length}-${asset.category}`}
              id={asset.id}
              title={asset.title}
              keywords={asset.keywords}
              category={asset.category}
              needsRelease={asset.needs_release}
            />
            <RegenerateMetadataButton
              asset={storedAsset}
              style={style}
              theme={theme?.title ?? ""}
              concept={asset.concept ?? ""}
              bannedWords={settings?.banned_words ?? []}
            />
          </Section>

          <Section id="adobe-heading" title="Hasil review Adobe">
            <AdobeResultForm
              key={`${asset.adobe_status}-${asset.adobe_reason}`}
              id={asset.id}
              status={asset.adobe_status}
              reason={asset.adobe_reason}
              reviewedAt={asset.adobe_reviewed_at}
            />
          </Section>

          <details className="group border-t pt-3">
            <summary className={cn("flex cursor-pointer list-none items-center justify-between font-bold", tapTarget)}>
              Detail teknis dan hapus
              <ChevronDown aria-hidden className="size-4 transition-transform duration-150 group-open:rotate-180" />
            </summary>
            <div className="space-y-4 pt-2">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              <DeleteButton id={asset.id} query={query} hasAdobeData={Boolean(asset.exported_at || asset.adobe_status)} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
