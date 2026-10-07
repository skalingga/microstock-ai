"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ADOBE, ADOBE_CATEGORIES, normalizeCategory } from "@/lib/adobe/rules";
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
  const [pending, startTransition] = useTransition();

  const keywordCount = parseKeywordText(keywordText).length;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await simpanMetadata(props.id, { title, keywords: keywordText, category, needsRelease });
      if (result.ok) {
        setError(null);
        toast.success("Metadata disimpan.");
      } else {
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
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short descriptive title" />
        <p className="text-xs text-muted-foreground">Bahasa Inggris, tanpa koma atau karakter khusus.</p>
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

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={needsRelease} onChange={(e) => setNeedsRelease(e.target.checked)} />
        Perlu Release (menggambarkan orang atau properti nyata)
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan metadata"}
      </Button>
    </form>
  );
}
