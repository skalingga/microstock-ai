"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AuthCard, AuthHeading } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { Anchor } from "@/components/pen-motif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { daftar, lupaPassword, masuk, type AuthState } from "./actions";

const initialState: AuthState = {};

type Mode = "masuk" | "daftar" | "lupa";

const COPY: Record<Mode, { title: string; description: string; submit: string }> = {
  masuk: { title: "Masuk", description: "Lanjut membuat aset vektor untuk Adobe Stock.", submit: "Masuk" },
  lupa: {
    title: "Lupa password",
    description: "Kami kirim tautan ke emailmu untuk membuat password baru.",
    submit: "Kirim tautan",
  },
  daftar: { title: "Buat akun", description: "Satu akun untuk riset, generate, dan ekspor.", submit: "Buat akun" },
};

export type LoginNotice = { tone: "info" | "error"; text: string };

const linkClass = cn(
  "inline-flex items-center font-semibold text-foreground underline underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-2 focus-visible:ring-ring",
  tapTarget,
);

export function LoginForm({ notice, next, signup }: { notice?: LoginNotice; next?: string; signup: boolean }) {
  const [mode, setMode] = useState<Mode>("masuk");
  // Controlled, so both fields survive a mode switch and a failed attempt.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [masukState, masukAction, masukPending] = useActionState(masuk, initialState);
  const [daftarState, daftarAction, daftarPending] = useActionState(daftar, initialState);
  const [lupaState, lupaAction, lupaPending] = useActionState(lupaPassword, initialState);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const switched = useRef(false);
  useEffect(() => {
    // Move focus to the new heading so keyboard and screen reader users hear that the form changed.
    if (switched.current) headingRef.current?.focus();
  }, [mode]);

  function switchTo(next: Mode) {
    switched.current = true;
    setMode(next);
  }

  const isMasuk = mode === "masuk";
  const isLupa = mode === "lupa";
  const state = isLupa ? lupaState : isMasuk ? masukState : daftarState;
  const pending = isLupa ? lupaPending : isMasuk ? masukPending : daftarPending;
  const action = isLupa ? lupaAction : isMasuk ? masukAction : daftarAction;
  const copy = COPY[mode];
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  useEffect(() => {
    // Field errors are not live regions; focusing the first invalid field reads its message out.
    const invalid = state.fieldErrors?.email ? "email" : state.fieldErrors?.password ? "password" : null;
    if (invalid) document.getElementById(invalid)?.focus();
  }, [state]);

  return (
    <>
      <AuthHeading title={copy.title} description={copy.description} headingRef={headingRef} />
      <AuthCard>
        {/* noValidate: the server's Indonesian messages replace the browser's own validation bubbles. */}
        <form action={action} noValidate className="space-y-4">
          {next && <input type="hidden" name="lanjut" value={next} />}
          {notice && isMasuk && !state.error && (
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={cn("flex items-baseline gap-2.5 text-sm", notice.tone === "error" ? "text-destructive" : "text-foreground")}
            >
              <Anchor filled={notice.tone === "info"} className="translate-y-px" />
              {notice.text}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint={isLupa ? "send" : "next"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "email-error" : undefined}
            />
            {emailError && (
              <p id="email-error" className="text-sm text-destructive">
                {emailError}
              </p>
            )}
          </div>

          {isLupa ? (
            <p className="text-sm text-muted-foreground">Buka tautannya di browser yang sama dengan yang kamu pakai sekarang.</p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete={isMasuk ? "current-password" : "new-password"}
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={cn(passwordError && "password-error", !isMasuk && "password-hint") || undefined}
              />
              {passwordError && (
                <p id="password-error" className="text-sm text-destructive">
                  {passwordError}
                </p>
              )}
              {!isMasuk && (
                <p id="password-hint" className="text-sm text-muted-foreground">
                  Minimal 8 karakter.
                </p>
              )}
            </div>
          )}

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}{" "}
              {state.code === "invalid_credentials" && (
                <button type="button" onClick={() => switchTo("lupa")} className={cn(linkClass, "font-medium")}>
                  Buat password baru
                </button>
              )}
            </p>
          )}
          <p role="status" className="text-sm text-foreground empty:hidden">
            {state.info}
          </p>

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Memproses..." : copy.submit}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm text-muted-foreground">
            {isMasuk ? (
              <button type="button" onClick={() => switchTo("lupa")} className={linkClass}>
                Lupa password?
              </button>
            ) : (
              <button type="button" onClick={() => switchTo("masuk")} className={linkClass}>
                Kembali ke halaman masuk
              </button>
            )}
            {signup && isMasuk && (
              <button type="button" onClick={() => switchTo("daftar")} className={linkClass}>
                Buat akun
              </button>
            )}
          </div>
        </form>
      </AuthCard>
    </>
  );
}
