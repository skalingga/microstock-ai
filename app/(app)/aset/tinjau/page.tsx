import { ArrowLeft, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { ReviewQueue, type ReviewItem } from "./review-queue";

/** One sitting rarely gets through more than this; the rest load on the next visit. */
export const metadata: Metadata = { title: "Tinjau Adobe" };

const QUEUE_LIMIT = 200;

const dayFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

export default async function HalamanTinjauAdobe({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job: jobParam } = await searchParams;
  const job = jobParam && UUID_RE.test(jobParam) ? jobParam : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("assets")
    .select("id, title, concept, keywords, svg_path, kind, preview_path, exported_at", { count: "exact" })
    .not("exported_at", "is", null)
    .is("adobe_status", null)
    // Oldest export first: Adobe reviews in upload order.
    .order("exported_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(QUEUE_LIMIT);
  if (job) query = query.eq("job_id", job);
  const { data: rows, count, error } = await query;

  // A photo is shown through its preview JPEG: the full file is several MB.
  const fileOf = (r: { kind: string; svg_path: string | null; preview_path: string | null }) => (r.kind === "photo" ? r.preview_path : r.svg_path);
  const paths = (rows ?? []).flatMap((r) => {
    const path = fileOf(r);
    return path ? [path] : [];
  });
  const signed = paths.length > 0 ? await supabase.storage.from("assets").createSignedUrls(paths, SIGNED_URL_TTL_SEC) : null;
  const urlByPath = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]));

  const items: ReviewItem[] = (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title ?? r.concept ?? "Aset tanpa judul",
    keywordCount: r.keywords.length,
    svgUrl: (fileOf(r) && urlByPath.get(fileOf(r)!)) || null,
    exportedLabel: r.exported_at ? dayFormat.format(new Date(r.exported_at)) : "",
  }));
  const backHref = job ? `/aset?adobe=belum&job=${job}` : "/aset?adobe=belum";

  return (
    <div className="space-y-6 max-lg:space-y-3">
      {/* Focus mode on phones and tablets: the tab bar steps aside (app-nav.tsx, globals.css) and the header is one line. */}
      <div data-focus-mode hidden />
      <div className="-mt-2 flex items-center justify-between gap-3 lg:hidden">
        <h1 className="text-xl font-extrabold">Tinjau hasil Adobe</h1>
        <Link href={backHref} className={cn("inline-flex items-center gap-1.5 rounded-md px-2 text-sm font-semibold hover:bg-muted", tapTarget)}>
          <X className="size-4" />
          Tutup
        </Link>
      </div>
      <Link
        href={backHref}
        className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground max-lg:hidden", tapTarget)}
      >
        <ArrowLeft className="size-4" />
        Kembali ke galeri
      </Link>
      <PageHeader
        title="Tinjau hasil Adobe"
        description="Satu aset sekali, sesuai urutan ekspor. Catat keputusan dari email atau portal Adobe."
        className="max-lg:hidden"
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Daftar aset tidak bisa dimuat. Muat ulang halaman.
        </p>
      ) : (
        <ReviewQueue items={items} total={count ?? items.length} backHref={backHref} />
      )}
    </div>
  );
}
