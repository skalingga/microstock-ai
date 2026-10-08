// v1 has a single owner, so the sign-up form stays hidden until AUTH_SIGNUP_ENABLED=true (Tahap 9).
export function signupEnabled() {
  return process.env.AUTH_SIGNUP_ENABLED === "true";
}
