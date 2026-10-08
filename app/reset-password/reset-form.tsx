"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { AuthCard, AuthHeading } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { ubahPassword, type ResetState } from "./actions";

const initialState: ResetState = {};

export function ResetForm() {
  const [state, action, pending] = useActionState(ubahPassword, initialState);
  // Controlled, so a mismatch does not wipe what was typed.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const passwordError = state.fieldErrors?.password;
  const confirmError = state.fieldErrors?.confirm;

  useEffect(() => {
    // Field errors are not live regions; focusing the first invalid field reads its message out.
    const invalid = state.fieldErrors?.password ? "password" : state.fieldErrors?.confirm ? "confirm" : null;
    if (invalid) document.getElementById(invalid)?.focus();
  }, [state]);

  return (
    <>
      <AuthHeading title="Buat password baru" description="Isi password baru untuk akunmu." />
      <AuthCard>
        {/* noValidate: the server's Indonesian messages replace the browser's own validation bubbles. */}
        <form action={action} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password baru</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={cn(passwordError && "password-error", "password-hint")}
            />
            {passwordError && (
              <p id="password-error" className="text-sm text-destructive">
                {passwordError}
              </p>
            )}
            <p id="password-hint" className="text-sm text-muted-foreground">
              Minimal 8 karakter.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Ulangi password baru</Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              enterKeyHint="done"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={confirmError ? "confirm-error" : undefined}
            />
            {confirmError && (
              <p id="confirm-error" className="text-sm text-destructive">
                {confirmError}
              </p>
            )}
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Memproses..." : "Simpan password"}
          </Button>
          {/* The email link already signed the user in, so skipping goes straight into the app. */}
          <Link
            href="/generate"
            className={cn(
              "inline-flex items-center text-sm font-semibold underline underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-2 focus-visible:ring-ring",
              tapTarget,
            )}
          >
            Lewati, buka aplikasi
          </Link>
        </form>
      </AuthCard>
    </>
  );
}
