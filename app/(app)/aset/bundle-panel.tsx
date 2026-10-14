"use client";

import { Loader2, Package } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GRID_OPTIONS, gridCells, gridFor } from "@/lib/bundle/compose";
import { makeBundle } from "@/lib/bundle/make";
import { createClient } from "@/lib/supabase/client";

/** Choices a bundle can have, as text: "9, 16, 24 atau 25". */
const SIZES = GRID_OPTIONS.map((g) => gridCells(g)).sort((a, b) => a - b);
const sizesText = `${SIZES.slice(0, -1).join(", ")} atau ${SIZES.at(-1)}`;

type Props = {
  /** Picked assets, in the order they become grid cells. */
  ids: string[];
  /** How many of them are not a Lolos vector (photos, bundles, held, or not yet Lolos). */
  invalidCount: number;
  /** How many were exported before. */
  exportedCount: number;
  bannedWords: string[];
  onCancel: () => void;
  onDone: (result: { assetId: string; text: string; error?: boolean }) => void;
};

/** The "Buat bundle" step of the gallery bar: checks the pick, then composes, checks and stores the bundle. */
export function BundlePanel({ ids, invalidCount, exportedCount, bannedWords, onCancel, onDone }: Props) {
  const grid = gridFor(ids.length);
  const [allowExported, setAllowExported] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const blocked =
    !grid
      ? `Pilih tepat ${sizesText} aset. Sekarang ${ids.length}.`
      : invalidCount > 0
        ? `${invalidCount} aset tidak bisa masuk bundle: harus vektor berstatus Lolos yang belum masuk bundle lain.`
        : null;
  const needsConfirm = exportedCount > 0 && !allowExported;

  async function create() {
    if (!grid || blocked || needsConfirm || running) return;
    setRunning(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setError("Sesi berakhir. Masuk lagi.");
        return;
      }
      const result = await makeBundle({
        supabase,
        userId: data.user.id,
        memberIds: ids,
        grid,
        bannedWords,
        allowExported,
        onStep: setStep,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const status =
        result.status === "lolos" ? "Lolos" : result.status === "perlu_cek" ? "Perlu cek" : result.status === "gagal" ? "Gagal QC" : "menunggu metadata";
      onDone({
        assetId: result.assetId,
        text: `Bundle ${ids.length} aset dibuat (${status}). Anggotanya ditahan dari ekspor.${result.note ? ` ${result.note}` : ""}`,
        error: result.status === "gagal",
      });
    } finally {
      setRunning(false);
      setStep("");
    }
  }

  return (
    <div className="space-y-2 border-t pt-2">
      <p>
        {grid ? (
          <>
            Gabungkan {ids.length} aset jadi satu SVG grid {grid.columns} × {grid.rows}, dengan metadata set. Urutan sel mengikuti urutan pilihanmu. Anggotanya{" "}
            <strong>ditahan dari ekspor</strong> sampai kamu melepasnya lagi dari galeri.
          </>
        ) : (
          <>Bundle butuh tepat {sizesText} aset.</>
        )}
      </p>

      {blocked && <p className="text-warning-foreground">{blocked}</p>}

      {!blocked && exportedCount > 0 && (
        <label className="flex cursor-pointer items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-2 text-warning-foreground">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-foreground" checked={allowExported} onChange={(e) => setAllowExported(e.target.checked)} />
          <span>
            {exportedCount} anggota sudah pernah diekspor. Satuannya mungkin sudah ada di Adobe, jadi bundle ini berisiko dianggap konten serupa. Tetap buat dan
            tahan semuanya.
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {running && step && (
        <p role="status" className="text-muted-foreground">
          {step}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={create} disabled={!grid || !!blocked || needsConfirm || running}>
          {running ? <Loader2 className="animate-spin" /> : <Package />}
          {running ? "Membuat..." : "Buat bundle"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={running}>
          Batal
        </Button>
      </div>
    </div>
  );
}
