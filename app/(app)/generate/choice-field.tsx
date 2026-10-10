"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { SelectionHandles } from "@/components/pen-motif";
import { Sheet } from "@/components/sheet";
import { cn } from "@/lib/utils";

export type Choice = {
  value: string;
  label: string;
  /** Small picture: a style example or palette swatches. */
  visual?: React.ReactNode;
  /** Choices with the same group sit under one heading; the first group has none. */
  group?: string;
};

/**
 * One choice from a short visual list. Larger screens show the tiles in the form; phones show a single row
 * (label, current value, picture) that opens the same tiles in a bottom sheet, so the form stays short.
 */
export function ChoiceField({
  id,
  label,
  value,
  onChange,
  choices,
  disabled,
  hint,
  gridClass = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: Choice[];
  disabled?: boolean;
  /** One line under the field, e.g. what the chosen style is for. */
  hint?: React.ReactNode;
  gridClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = choices.find((c) => c.value === value);

  return (
    <div className="space-y-2">
      <fieldset className="space-y-2 max-sm:hidden" disabled={disabled}>
        <legend className="mb-2 text-sm font-medium">{label}</legend>
        <ChoiceTiles name={`${id}-tiles`} value={value} onChange={onChange} choices={choices} gridClass={gridClass} />
      </fieldset>

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-input bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-muted-foreground">{label}</span>
          <span className="block truncate font-bold">{current?.label ?? "Pilih"}</span>
        </span>
        {current?.visual && <span className="flex shrink-0 items-center">{current.visual}</span>}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}

      <Sheet open={open} onClose={() => setOpen(false)} title={`Pilih ${label.toLowerCase()}`} className="sm:hidden">
        <ChoiceTiles
          name={`${id}-sheet`}
          value={value}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
          choices={choices}
          gridClass="grid-cols-2"
        />
      </Sheet>
    </div>
  );
}

function ChoiceTiles({
  name,
  value,
  onChange,
  choices,
  gridClass,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  choices: Choice[];
  gridClass: string;
}) {
  const groups = [...new Set(choices.map((c) => c.group ?? ""))];
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group || "utama"} className="space-y-2">
          {group && (
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground after:h-px after:flex-1 after:bg-border">{group}</p>
          )}
          <div className={cn("grid gap-2", gridClass)}>
            {choices
              .filter((c) => (c.group ?? "") === group)
              .map((choice) => {
                const picked = choice.value === value;
                return (
                  <label
                    key={choice.value}
                    className={cn(
                      "relative flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md border bg-card px-2.5 py-2 text-sm leading-tight transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
                      picked ? "font-semibold" : "hover:border-foreground/40",
                    )}
                  >
                    {/* Picked tile: a selected object with its bounding-box handles (DESIGN.md motif). */}
                    {picked && <SelectionHandles />}
                    <input type="radio" name={name} value={choice.value} checked={picked} onChange={() => onChange(choice.value)} className="sr-only" />
                    {choice.visual && <span className="flex shrink-0 items-center">{choice.visual}</span>}
                    <span className="min-w-0">{choice.label}</span>
                  </label>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Palette swatches for a choice tile or row. */
export function Swatches({ colors, className }: { colors: string[]; className?: string }) {
  if (colors.length === 0) return null;
  return (
    <span className={cn("flex", className)} aria-hidden>
      {colors.slice(0, 5).map((c, i) => (
        <span key={`${c}-${i}`} className="size-3.5 border border-foreground/10" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}
