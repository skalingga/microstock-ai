"use client";

import { Input } from "@/components/ui/input";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type AdobeDecisionValue = "diterima" | "ditolak";

const CHOICES: { value: AdobeDecisionValue; label: string }[] = [
  { value: "diterima", label: "Diterima" },
  { value: "ditolak", label: "Ditolak" },
];

/**
 * Adobe's decision as two pills plus the rejection reason. The same control on the detail page, in bulk, and in review
 * mode. Nothing is preselected unless a decision is already recorded, so a stray tap never records one.
 */
export function AdobeDecision({
  name,
  value,
  onChange,
  reason,
  onReasonChange,
  disabled,
  legend,
}: {
  name: string;
  value: AdobeDecisionValue | null;
  onChange: (value: AdobeDecisionValue) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  disabled?: boolean;
  legend: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <fieldset className="space-y-1" disabled={disabled}>
        <legend className="text-xs font-semibold text-muted-foreground">{legend}</legend>
        <div className="flex flex-wrap gap-1">
          {CHOICES.map((c) => (
            <label
              key={c.value}
              className={cn(
                "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm",
                tapTarget,
                value === c.value ? "border-foreground bg-secondary font-semibold" : "hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={c.value}
                checked={value === c.value}
                onChange={() => onChange(c.value)}
                className="accent-foreground"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      {value === "ditolak" && (
        <label className="min-w-48 flex-1 space-y-1">
          <span className="block text-xs font-semibold text-muted-foreground">Alasan (opsional, salin dari email Adobe)</span>
          <Input
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            maxLength={500}
            disabled={disabled}
            placeholder="mis. Similar content, Quality"
          />
        </label>
      )}
    </div>
  );
}
