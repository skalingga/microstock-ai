"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { hapusAset } from "../actions";

export function DeleteButton({ id, query, hasAdobeData }: { id: string; /** Gallery filter to return to. */ query: string; /** Exported or reviewed: deleting loses that record too. */ hasAdobeData: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await hapusAset(id, query); // redirects to the gallery on success
      if (result && !result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            Hapus aset ini secara permanen?{hasAdobeData && " Aset ini sudah diekspor atau punya keputusan Adobe; datanya ikut hilang."}
          </span>
          <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={pending}>
            {pending ? "Menghapus..." : "Ya, hapus"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
            Batal
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>
          Hapus aset
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
