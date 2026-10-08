"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ADOBE, ADOBE_CATEGORIES, normalizeCategory } from "@/lib/adobe/rules";
import { QC_LABEL } from "@/lib/assets";
import { formatKeywordText, parseKeywordText } from "@/lib/metadata/keywords";
import { selectClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { simpanMetadata } from "../actions";

type Props = {
  id: string;
  title: string | null;
  keywords: string[];
  category: string | null;
  needsRelease: boolean;
};

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={cn("text-xs tabular-nums", value > max ? "font-medium text-destructive" : "text-muted-foreground")}>
      {value}/{max}
    </span>
  );
}

export function MetadataForm(props: Props) {
  const [title, setTitle] = useState(props.title ?? "");
  const [keywordText, setKeywordText] = useState(formatKeywordText(props.keywords));
  const [category, setCategory] = useState(normalizeCategory(props.category) ?? props.category ?? "");
  const [needsRelease, setNeedsRelease] = useState(props.needsRelease);
  const [error, setError] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const keywordCount = parseKeywordText(keywordText).length;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await simpanMetadata(props.id, { title, keywords: keywordText, category, needsRelease });
      if (result.ok) {
        setError(null);
        // Saving re-runs the metadata checks, so the QC status can change: say so where the user is looking.
        setSavedStatus(result.status);
      } else {
        setSavedStatus(null);
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="title">Judul</Label>
          <Counter value={title.trim().length} max={ADOBE.titleMaxChars} />
        </div>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short descriptive title"
          aria-invalid={title.includes(",") || undefined}
          aria-describedby="title-hint"
        />
        <p id="title-hint" className={cn("text-xs", title.includes(",") ? "text-destructive" : "text-muted-foreground")}>
          {title.includes(",") ? "Hapus koma dari judul: Adobe tidak menerimanya." : "Bahasa Inggris, tanpa koma atau karakter khusus."}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="keywords">Keyword (terpenting di atas)</Label>
          <Counter value={keywordCount} max={ADOBE.keywordsMax} />
        </div>
        <Textarea
          id="keywords"
          rows={8}
          value={keywordText}
          onChange={(e) => setKeywordText(e.target.value)}
          placeholder={"pumpkin\nautumn\nharvest"}
        />
        <p className="text-xs text-muted-foreground">Satu per baris. Yang paling atas paling penting.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Kategori Adobe</Label>
        <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">Pilih kategori</option>
          {ADOBE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm max-sm:min-h-11 pointer-coarse:min-h-11">
        <input type="checkbox" className="size-4 accent-foreground" checked={needsRelease} onChange={(e) => setNeedsRelease(e.target.checked)} />
        Perlu Release (menggambarkan orang atau properti nyata)
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan metadata"}
        </Button>
        {savedStatus && !pending && (
          <p role="status" className="text-sm text-muted-foreground">
            Tersimpan. Status QC sekarang: <strong className="text-foreground">{QC_LABEL[savedStatus] ?? savedStatus}</strong>.
          </p>
        )}
      </div>
    </form>
  );
}
