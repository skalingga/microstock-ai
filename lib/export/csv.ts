import { ADOBE } from "@/lib/adobe/rules";
import { SHUTTERSTOCK } from "@/lib/shutterstock/rules";

export type CsvRow = {
  filename: string;
  title: string;
  keywords: string[];
  /** Adobe category number, or null to leave the column empty. */
  categoryNumber: number | null;
  /** Release filenames, if any. */
  releases?: string[];
};

/** RFC 4180: quote a field when it holds a comma, quote, or line break. */
export function csvField(value: string): string {
  const flat = value.replace(/\r?\n/g, " ");
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}

/** Adobe Stock upload CSV: exact header from their template, UTF-8, keywords in one quoted field. */
export function buildAdobeCsv(rows: CsvRow[]): string {
  const lines: string[] = [ADOBE.csvHeader.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvField(row.filename),
        csvField(row.title),
        csvField(row.keywords.join(", ")),
        row.categoryNumber === null ? "" : String(row.categoryNumber),
        csvField((row.releases ?? []).join(", ")),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export type ShutterstockRow = {
  filename: string;
  /** Shutterstock calls the title "Description". */
  description: string;
  keywords: string[];
  categories: string[];
};

/** Shutterstock upload CSV (photos only): header from their sample, flags always "No". */
export function buildShutterstockCsv(rows: ShutterstockRow[]): string {
  const lines: string[] = [SHUTTERSTOCK.csvHeader.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvField(row.filename),
        csvField(row.description),
        csvField(row.keywords.join(", ")),
        csvField(row.categories.slice(0, SHUTTERSTOCK.categoriesMax).join(",")),
        "No",
        "No",
        "No",
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

/** Rows Shutterstock would refuse for their keyword count. */
export function shutterstockProblems(rows: ShutterstockRow[]): string[] {
  return rows
    .filter((r) => r.keywords.length < SHUTTERSTOCK.keywordsMin || r.keywords.length > SHUTTERSTOCK.keywordsMax)
    .map((r) => `${r.filename}: ${r.keywords.length} keyword (Shutterstock meminta ${SHUTTERSTOCK.keywordsMin} sampai ${SHUTTERSTOCK.keywordsMax}).`);
}

/** Adobe's file limits for a CSV upload. */
export function csvProblems(csv: string, rowCount: number): string[] {
  const problems: string[] = [];
  if (rowCount > ADOBE.csvMaxRows) problems.push(`CSV berisi ${rowCount} baris (maksimal ${ADOBE.csvMaxRows}).`);
  const bytes = new TextEncoder().encode(csv).length;
  if (bytes > ADOBE.csvMaxBytes) problems.push(`Ukuran CSV ${bytes} byte (maksimal ${ADOBE.csvMaxBytes}).`);
  return problems;
}
