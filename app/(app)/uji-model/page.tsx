import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { SIGNED_URL_TTL_SEC, UUID_RE } from "@/lib/assets";
import { parseCells, type BenchSetup } from "@/lib/generate/benchmark";
import { createClient } from "@/lib/supabase/server";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { BenchmarkRunner, BenchResults } from "./benchmark-client";

const STATUS_LABEL: Record<string, string> = {
  berjalan: "berjalan / terputus",
  selesai: "selesai",
  dihentikan: "dihentikan",
  gagal: "berhenti",
};

export default async function HalamanUjiModel({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: settings }, { data: runs, error: runsError }] = await Promise.all([
    supabase.from("user_settings").select("banned_words").maybeSingle(),
    supabase.from("model_benchmarks").select("id, status, setup, results, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  const selected = runs?.find((r) => r.id === (run && UUID_RE.test(run) ? run : undefined)) ?? runs?.[0];
  const cells = selected ? parseCells(selected.results) : [];

  // Previews of the selected run, signed like the gallery's.
  const previews: Record<string, string> = {};
  const ids = cells.map((c) => c.assetId).filter((id): id is string => !!id);
  if (ids.length > 0) {
    const { data: assets } = await supabase.from("assets").select("id, preview_path").in("id", ids);
    const paths = (assets ?? []).map((a) => a.preview_path).filter((p): p is string => !!p);
    const { data: signed } = paths.length
      ? await supabase.storage.from("assets").createSignedUrls(paths, SIGNED_URL_TTL_SEC)
      : { data: null };
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const a of assets ?? []) {
      const url = a.preview_path ? urlByPath.get(a.preview_path) : undefined;
      if (url) previews[a.id] = url;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uji model"
        description="Konsep yang sama digambar beberapa model, lalu dinilai QC."
      />

      <BenchmarkRunner userId={user.id} bannedWords={settings?.banned_words ?? []} />

      {runsError && (
        <p role="alert" className="text-sm text-destructive">
          Hasil uji tersimpan tidak bisa dimuat. Muat ulang halaman.
        </p>
      )}

      {selected && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold">Hasil uji tersimpan</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {runs!.map((r) => (
                <Link
                  key={r.id}
                  href={`/uji-model?run=${r.id}`}
                  className={cn(
                    "inline-flex items-center rounded-md border bg-card px-3 py-1.5 transition-colors duration-150",
                    tapTarget,
                    r.id === selected.id ? "border-primary bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}{" "}
                  · {STATUS_LABEL[r.status] ?? r.status}
                </Link>
              ))}
            </div>
          </div>
          <BenchResults setup={selected.setup as unknown as BenchSetup} cells={cells} previews={previews} />
        </section>
      )}
    </div>
  );
}
