import { UUID_RE } from "@/lib/assets";

export const FILTERS = [
  { value: "semua", label: "Semua" },
  { value: "menunggu", label: "Menunggu" },
  { value: "lolos", label: "Lolos" },
  { value: "perlu_cek", label: "Perlu cek" },
  { value: "gagal", label: "Gagal" },
] as const;

export type FilterValue = (typeof FILTERS)[number]["value"];

// Stage 12: photos from Google Flow sit in the same gallery as the vectors.
// Stage 15: a background is a photo (kind) whose photo_variant says it has no subject.
export const KINDS = [
  { value: "semua", label: "Semua jenis", kind: null, variant: null },
  { value: "vektor", label: "Vektor", kind: "vector", variant: null },
  { value: "foto", label: "Foto", kind: "photo", variant: "photo" },
  { value: "background", label: "Background", kind: "photo", variant: "background" },
  // Stage 16: raster illustrations (sticker, watercolor...) made in Flow, exported as JPEG.
  { value: "ilustrasi", label: "Ilustrasi", kind: "photo", variant: "illustration" },
  { value: "bundle", label: "Bundle", kind: "bundle", variant: null },
] as const;
export type KindValue = (typeof KINDS)[number]["value"];

/** The badge text of a photo-kind asset. Rows from before photo_variant existed count as photos. */
export function photoLabel(variant: string | null | undefined): string {
  return variant === "background" ? "Background" : variant === "illustration" ? "Ilustrasi" : "Foto";
}

/** What the gallery is showing. Carried into the detail page so "back" and prev/next stay in the same view. */
export type GalleryFilter = {
  job?: string;
  status: FilterValue;
  kind: KindValue;
  /** Exported assets still waiting for Adobe's decision. */
  adobePending: boolean;
  /** Text to find in the title; empty = no search. */
  q: string;
  page: number;
};

export type GalleryParams = { job?: string; status?: string; page?: string; adobe?: string; q?: string; jenis?: string };

export const MAX_SEARCH_LENGTH = 80;

export function parseGalleryFilter(params: GalleryParams): GalleryFilter {
  return {
    job: params.job && UUID_RE.test(params.job) ? params.job : undefined,
    status: (FILTERS.find((f) => f.value === params.status)?.value ?? "semua") as FilterValue,
    kind: (KINDS.find((k) => k.value === params.jenis)?.value ?? "semua") as KindValue,
    adobePending: params.adobe === "belum",
    q: (params.q ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    page: Math.max(1, Math.floor(Number(params.page)) || 1),
  };
}

/** Query string (without "?") for a filter; empty for the plain gallery. */
export function galleryQuery(filter: GalleryFilter, over: Partial<GalleryFilter> = {}): string {
  const f = { ...filter, ...over };
  const qs = new URLSearchParams();
  if (f.job) qs.set("job", f.job);
  if (f.kind !== "semua") qs.set("jenis", f.kind);
  if (f.adobePending) qs.set("adobe", "belum");
  if (f.q) qs.set("q", f.q);
  if (f.status !== "semua") qs.set("status", f.status);
  if (f.page > 1) qs.set("page", String(f.page));
  return qs.toString();
}

export function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

type Filterable<Q> = {
  eq(column: string, value: string): Q;
  not(column: string, operator: string, value: null): Q;
  is(column: string, value: null): Q;
  ilike(column: string, pattern: string): Q;
};

/** Applies the gallery filter to an assets query. */
export function applyGalleryFilter<Q extends Filterable<Q>>(query: Q, filter: GalleryFilter, opts: { status?: boolean } = {}): Q {
  let q = query;
  if (filter.job) q = q.eq("job_id", filter.job);
  const picked = KINDS.find((k) => k.value === filter.kind);
  if (picked?.kind) q = q.eq("kind", picked.kind);
  if (picked?.variant) q = q.eq("photo_variant", picked.variant);
  if (filter.adobePending) q = q.not("exported_at", "is", null).is("adobe_status", null);
  // LIKE wildcards in the search text are literal characters.
  if (filter.q) q = q.ilike("title", `%${filter.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (opts.status !== false && filter.status !== "semua") q = q.eq("qc_status", filter.status);
  return q;
}
