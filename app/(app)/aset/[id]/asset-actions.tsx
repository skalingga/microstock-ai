"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, postJson, type MetadataResponse } from "@/lib/generate/client";
import { PhotoReadError, visionCopy } from "@/lib/photo/process";
import { photoContentNotes } from "@/lib/qc/photo";
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
  /** Stage 12: a photo is described by a vision model looking at the stored JPEG. */
  photo?: { imagePath: string; prompt?: string };
};

type PhotoMetadataReply = Omit<MetadataResponse, "metadata"> & {
  metadata: MetadataResponse["metadata"] & { hasPeople: boolean; problems: Parameters<typeof photoContentNotes>[0] };
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
export function RegenerateMetadataButton({ asset, style, theme, concept, bannedWords, photo }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function regenerate() {
    setConfirming(false);
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      let verdict;
      if (photo) {
        const file = await supabase.storage.from("assets").download(photo.imagePath);
        if (file.error || !file.data) throw new ApiError("storage", "Foto tersimpan tidak bisa diambil. Coba lagi.");
        const res = await postJson<PhotoMetadataReply>("/api/generate/photo-metadata", {
          theme: theme || "stock photo",
          ...(photo.prompt ? { prompt: photo.prompt } : {}),
          image: await visionCopy(file.data),
        });
        const { hasPeople, problems, ...meta } = res.metadata;
        // What the vision model saw is replaced too; size, file and similarity notes stay.
        const kept = parseNotes(asset.qc_notes).filter((n) => !["metadata", "isi", "orang"].includes(n.check));
        await supabase.from("assets").update({ fictional_people: hasPeople }).eq("id", asset.id);
        verdict = await applyMetadata(supabase, asset.id, [...kept, ...photoContentNotes(problems, hasPeople)], meta, bannedWords);
      } else {
        const res = await postJson<MetadataResponse>("/api/generate/metadata", {
          theme: theme || "stock vector",
          style,
          concept: concept || "Stock vector asset.",
        });
        const visual = parseNotes(asset.qc_notes).filter((n) => n.check !== "metadata");
        verdict = await applyMetadata(supabase, asset.id, visual, res.metadata, bannedWords);
      }
      setMessage(verdict ? { text: "Metadata baru dibuat. Periksa dan edit bila perlu." } : { text: "Metadata gagal disimpan. Coba lagi.", error: true });
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof ApiError || err instanceof PhotoReadError ? err.message : "Metadata gagal dibuat. Coba lagi.", error: true });
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
