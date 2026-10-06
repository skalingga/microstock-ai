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

/** Re-run QC on this asset, or have the AI write its metadata again. */
export function AssetActions({ asset, style, theme, concept, bannedWords }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "qc" | "metadata">(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runQc() {
    setBusy("qc");
    setMessage(null);
    try {
      const supabase = createClient();
      const verdict = await rerunQc(supabase, asset, style, await fetchHashPool(supabase), bannedWords);
      setMessage(verdict ? "QC selesai dijalankan ulang." : "QC gagal dijalankan.");
      router.refresh();
    } catch {
      setMessage("QC gagal dijalankan.");
    } finally {
      setBusy(null);
    }
  }

  async function regenerateMetadata() {
    setBusy("metadata");
    setMessage(null);
    try {
      const res = await postJson<MetadataResponse>("/api/generate/metadata", {
        theme: theme || "stock vector",
        style,
        concept: concept || "Stock vector asset.",
      });
      const visual = parseNotes(asset.qc_notes).filter((n) => n.check !== "metadata");
      const verdict = await applyMetadata(createClient(), asset.id, visual, res.metadata, bannedWords);
      setMessage(verdict ? "Metadata baru dibuat. Periksa dan edit bila perlu." : "Metadata gagal disimpan.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Metadata gagal dibuat.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={runQc} disabled={busy !== null}>
          {busy === "qc" ? "Menjalankan QC..." : "Jalankan QC ulang"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={regenerateMetadata} disabled={busy !== null}>
          {busy === "metadata" ? "Membuat metadata..." : asset.title ? "Buat ulang metadata (AI)" : "Buat metadata (AI)"}
        </Button>
      </div>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
