"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/lib/ui";
import { simpanHasilAdobe } from "../actions";

type Status = "belum" | "diterima" | "ditolak";

/** Records whether Adobe Stock accepted or rejected this asset (stage 6 data). */
export function AdobeResultForm({
  id,
  status,
  reason,
}: {
  id: string;
  status: string | null;
  reason: string | null;
}) {
  const [value, setValue] = useState<Status>(status === "diterima" || status === "ditolak" ? status : "belum");
  const [text, setText] = useState(reason ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await simpanHasilAdobe(id, { status: value, reason: text });
      if (result.ok) toast.success("Hasil review disimpan.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="adobe-status">Keputusan Adobe Stock</Label>
        <select
          id="adobe-status"
          value={value}
          onChange={(e) => setValue(e.target.value as Status)}
          disabled={pending}
          className={selectClass}
        >
          <option value="belum">Belum diketahui</option>
          <option value="diterima">Diterima</option>
          <option value="ditolak">Ditolak</option>
        </select>
      </div>
      {value === "ditolak" && (
        <div className="space-y-2">
          <Label htmlFor="adobe-reason">Alasan penolakan (salin dari email Adobe)</Label>
          <Input
            id="adobe-reason"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            disabled={pending}
            placeholder="mis. Similar content, Intellectual property, Quality"
          />
        </div>
      )}
      <Button size="sm" onClick={save} disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan hasil review"}
      </Button>
    </div>
  );
}
