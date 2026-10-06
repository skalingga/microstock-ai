export type ProviderErrorCode =
  | "rate_limit" // provider quota hit: wait, or fall back
  | "timeout" // provider too slow
  | "model_unavailable" // model removed or renamed
  | "upstream" // provider 5xx or network failure
  | "auth" // missing or rejected API key
  | "bad_output" // reply was not usable SVG / JSON
  | "budget_exceeded" // monthly spending cap reached for this provider
  | "not_implemented"; // provider adapter does not exist yet

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryAfterSec?: number;

  constructor(code: ProviderErrorCode, message: string, opts?: { retryAfterSec?: number }) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryAfterSec = opts?.retryAfterSec;
  }
}

// Codes where trying the next provider in the user's order makes sense.
export function canFallBack(code: ProviderErrorCode): boolean {
  return (
    code === "rate_limit" ||
    code === "timeout" ||
    code === "model_unavailable" ||
    code === "upstream" ||
    code === "budget_exceeded"
  );
}

export function httpStatusFor(code: ProviderErrorCode): number {
  switch (code) {
    case "rate_limit":
      return 429;
    case "budget_exceeded":
      return 402;
    case "timeout":
      return 504;
    case "bad_output":
      return 422;
    case "auth":
    case "model_unavailable":
    case "not_implemented":
      return 503;
    default:
      return 502;
  }
}
