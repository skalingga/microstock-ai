// Where to send the user after sign-in. Only same-site paths are accepted, so a crafted
// ?lanjut= link cannot bounce the user to another site.
export const DEFAULT_AFTER_LOGIN = "/generate";

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return DEFAULT_AFTER_LOGIN;
  // "//host" and "/\host" are protocol-relative URLs in browsers.
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_AFTER_LOGIN;
  if (value === "/" || value.startsWith("/login") || value.startsWith("/auth/")) return DEFAULT_AFTER_LOGIN;
  return value;
}
