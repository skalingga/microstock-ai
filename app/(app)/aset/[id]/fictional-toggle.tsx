"use client";

import { useState, useTransition } from "react";
import { FICTIONAL_LABEL } from "@/lib/adobe/rules";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { ubahOrangFiktif } from "../actions";

/** Stage 12: marks a photo for Adobe's "People and Property are fictional" box. Saved right away. */
export function FictionalToggle({ id, initial }: { id: string; initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(value: boolean) {
    setChecked(value);
    setError(null);
    startTransition(async () => {
      const res = await ubahOrangFiktif(id, value);
      if (!res.ok) {
        setChecked(!value);
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-1">
      <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", tapTarget)}>
        <input
          type="checkbox"
          className="size-4 accent-foreground"
          checked={checked}
          disabled={pending}
          onChange={(e) => change(e.target.checked)}
        />
        Ada orang atau properti fiktif
      </label>
      <p className="text-sm text-muted-foreground">
        Bila dicentang, saat unggah ke Adobe centang juga &quot;{FICTIONAL_LABEL}&quot;.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
