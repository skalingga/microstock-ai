"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, postJson, type MetadataResponse } from "@/lib/generate/client";
import { applyMetadata, fetchHashPool, rerunQc, type StoredAsset } from "@/lib/qc/store";
import { parseNotes } from "@/lib/qc/types";
import type { StyleId } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/client";

type Props = {
  asset: StoredAsset;
  style: StyleId;
  theme: string;
  concept: string;
  bannedWords: string[];
};

/** Re-run QC on this asset. Sits under the QC notes. */
export function RerunQcButton({ asset, style, bannedWords }: Pick<Props, "asset" | "style" | "bannedWords">) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function runQc() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const verdict = await rerunQc(supabase, asset, style, await fetchHashPool(supabase), bannedWords);
      setMessage(
        verdict
          ? { text: "QC selesai dijalankan ulang." }
          : { text: "QC gagal dijalankan: file SVG tidak bisa diambil atau hasilnya tidak tersimpan. Coba lagi.", error: true },
      );
      router.refresh();
    } catch {
      setMessage({ text: "QC gagal dijalankan. Periksa koneksi lalu coba lagi.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={runQc} disabled={busy}>
        {busy ? "Menjalankan QC..." : "Jalankan QC ulang"}
      </Button>
      {message && (
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message.text}
        </p>
      )}
    </div>
  );
}

/** Have the AI write the metadata again. Replacing an existing title asks first: hand edits would be lost. */
export function RegenerateMetadataButton({ asset, style, theme, concept, bannedWords }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function regenerate() {
    setConfirming(false);
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson<MetadataResponse>("/api/generate/metadata", {
        theme: theme || "stock vector",
        style,
        concept: concept || "Stock vector asset.",
      });
      const visual = parseNotes(asset.qc_notes).filter((n) => n.check !== "metadata");
      const verdict = await applyMetadata(createClient(), asset.id, visual, res.metadata, bannedWords);
      setMessage(verdict ? { text: "Metadata baru dibuat. Periksa dan edit bila perlu." } : { text: "Metadata gagal disimpan. Coba lagi.", error: true });
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : "Metadata gagal dibuat. Coba lagi.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning-soft p-2 text-sm text-warning-foreground">
          <span>Judul, keyword, dan kategori sekarang akan diganti hasil AI. Editan yang belum disimpan ikut hilang.</span>
          <Button type="button" size="sm" onClick={regenerate}>
            Ganti dengan hasil AI
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
            Batal
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => (asset.title ? setConfirming(true) : regenerate())} disabled={busy}>
          {busy ? "Membuat metadata..." : asset.title ? "Buat ulang dengan AI" : "Buat metadata dengan AI"}
        </Button>
      )}
      {message && (
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
