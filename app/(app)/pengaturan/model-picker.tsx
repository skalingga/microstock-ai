"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { selectClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type ModelOption = { id: string; note: string; tested: boolean; paid: boolean; testNote: string | null };

const CUSTOM = "__custom__";

type Props = {
  id: string;
  /** Form field name: carried by whichever control is on screen, so FormData always has exactly one. */
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: ModelOption[];
  /** What an empty value means, shown as the first choice (e.g. "Bawaan: gemini-3.5-flash-lite"). */
  emptyLabel: string;
  /** aria-invalid / aria-describedby from the form's own helper. */
  aria?: Record<string, unknown>;
};

const label = (o: ModelOption) => (o.note ? `${o.id} · ${o.note}` : o.id);

/**
 * A real drop-down of models. The browser's own suggestion list (<datalist>) only shows names that match what is
 * already typed, so once a model was filled in the other choices looked gone. Models not in the list can still be
 * typed by hand through the last choice.
 */
export function ModelPicker({ id, name, value, onChange, options, emptyLabel, aria }: Props) {
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <div className="space-y-1.5">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={emptyLabel}
          className="font-mono md:text-sm"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          {...aria}
        />
        <button
          type="button"
          className="text-xs font-semibold text-foreground underline underline-offset-4"
          onClick={() => {
            setCustom(false);
            // A name that is not in the list stays selectable below, so nothing the user typed is lost.
          }}
        >
          Pilih dari daftar
        </button>
      </div>
    );
  }

  const known = options.some((o) => o.id === value);
  const tested = options.filter((o) => o.tested);
  const free = options.filter((o) => !o.tested && !o.paid);
  const paid = options.filter((o) => !o.tested && o.paid);

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM) setCustom(true);
        else onChange(e.target.value);
      }}
      className={cn(selectClass, "font-mono md:text-sm")}
      {...aria}
    >
      <option value="">{emptyLabel}</option>
      {value && !known && <option value={value}>{value} (di luar daftar)</option>}
      {tested.length > 0 && (
        <optgroup label="Sudah diuji">
          {tested.map((o) => (
            <option key={o.id} value={o.id}>
              {label(o)}
            </option>
          ))}
        </optgroup>
      )}
      {free.length > 0 && (
        <optgroup label="Gratis">
          {free.map((o) => (
            <option key={o.id} value={o.id}>
              {label(o)}
            </option>
          ))}
        </optgroup>
      )}
      {paid.length > 0 && (
        <optgroup label="Berbayar">
          {paid.map((o) => (
            <option key={o.id} value={o.id}>
              {label(o)}
            </option>
          ))}
        </optgroup>
      )}
      <option value={CUSTOM}>Ketik nama model sendiri...</option>
    </select>
  );
}
