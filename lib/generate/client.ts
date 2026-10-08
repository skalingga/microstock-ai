import type { Concept, RateLimit } from "@/lib/providers/types";

// Browser-side helpers for talking to our own /api/generate/* routes.

export type ApiErrorCode =
  | "unauthenticated"
  | "invalid_input"
  | "banned_words"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "network"
  | "bad_output" // provider reply was unusable
  | "bad_svg" // reply parsed, but sanitizing or rendering failed in the browser
  | "auth"
  | "model_unavailable"
  | "budget_exceeded"
  | "not_implemented"
  | "storage"
  | "internal";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryAfterSec?: number;

  constructor(code: ApiErrorCode, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Errors that make every later call fail too, so the whole queue should stop. */
export function isFatal(code: ApiErrorCode): boolean {
  return (
    code === "unauthenticated" ||
    code === "auth" ||
    code === "model_unavailable" ||
    code === "budget_exceeded" ||
    code === "not_implemented"
  );
}

export type ConceptsResponse = { concepts: Concept[]; model: string; provider: string; rateLimit?: RateLimit };
export type MetadataResponse = {
  metadata: { title: string; keywords: string[]; category: string; needsRelease: boolean };
  /** What the server tidied or dropped, e.g. "2 keyword terlarang dibuang". */
  notes: string[];
  model: string;
  provider: string;
  rateLimit?: RateLimit;
};
export type SvgResponse = { svg: string; model: string; provider: string; costIdr?: number; rateLimit?: RateLimit };

export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError("network", "Koneksi ke server terputus.");
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { error?: undefined })
    | { error: { code: ApiErrorCode; message: string; retryAfterSec?: number } }
    | null;

  // A redirect to an HTML page means the session ended (the proxy normally answers 401 JSON first).
  if (res.redirected) throw new ApiError("unauthenticated", "Sesi berakhir. Silakan masuk lagi.");

  if (res.ok && data && !("error" in data && data.error)) return data as T;

  if (data && "error" in data && data.error) {
    throw new ApiError(data.error.code, data.error.message, data.error.retryAfterSec);
  }
  // Vercel answers with plain text/HTML when it kills a function that ran too long.
  if (res.status === 504) throw new ApiError("timeout", "Server terlalu lama menjawab.");
  throw new ApiError("upstream", `Server mengembalikan error ${res.status}.`);
}

export type ResearchThemeResult = {
  title: string;
  event: string;
  eventDate: string | null;
  uploadBy: string | null;
  eventWeight: 1 | 2 | 3;
  keywords: string[];
  demandGuess: number;
  competitionGuess: number;
};
export type ThemesResponse = { themes: ResearchThemeResult[]; model: string; provider: string; costIdr?: number };
export type TrendsResponse = { scores: Record<string, number>; unavailable?: boolean };
