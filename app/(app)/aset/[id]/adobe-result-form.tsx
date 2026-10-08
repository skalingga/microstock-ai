"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { simpanHasilAdobe } from "../actions";
import { AdobeDecision, type AdobeDecisionValue } from "../adobe-decision";

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

/** Records whether Adobe Stock accepted or rejected this asset (stage 6 data). */
export function AdobeResultForm({
  id,
  status,
  reason,
  reviewedAt,
}: {
  id: string;
  status: string | null;
  reason: string | null;
  reviewedAt: string | null;
}) {
  const saved: AdobeDecisionValue | null = status === "diterima" || status === "ditolak" ? status : null;
  const [value, setValue] = useState<AdobeDecisionValue | null>(saved);
  const [text, setText] = useState(reason ?? "");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = value !== saved || (value === "ditolak" && text !== (reason ?? ""));

  function save(next: AdobeDecisionValue | "belum") {
    startTransition(async () => {
      const result = await simpanHasilAdobe(id, { status: next, reason: text });
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      if (next === "belum") {
        setValue(null);
        setText("");
      }
      setMessage({ text: next === "belum" ? "Catatan Adobe dihapus." : "Hasil review disimpan." });
    });
  }

  return (
    <div className="space-y-3">
      <AdobeDecision
        name="adobe-detail"
        legend="Keputusan Adobe Stock"
        value={value}
        onChange={(v) => {
          setValue(v);
          setMessage(null);
        }}
        reason={text}
        onReasonChange={setText}
        disabled={pending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => value && save(value)} disabled={pending || !value || !dirty}>
          {pending ? "Menyimpan..." : "Simpan hasil review"}
        </Button>
        {saved && (
          <button
            type="button"
            onClick={() => save("belum")}
            disabled={pending}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Hapus catatan
          </button>
        )}
      </div>
      {message ? (
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message.text}
        </p>
      ) : (
        saved &&
        reviewedAt && <p className="text-xs text-muted-foreground">Dicatat {dateFormat.format(new Date(reviewedAt))}.</p>
      )}
    </div>
  );
}
