"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { tapTarget } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { daftar, lupaPassword, masuk, type AuthState } from "./actions";

const initialState: AuthState = {};

type Mode = "masuk" | "daftar" | "lupa";

export function LoginForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<Mode>("masuk");
  const [masukState, masukAction, masukPending] = useActionState(masuk, initialState);
  const [daftarState, daftarAction, daftarPending] = useActionState(daftar, initialState);
  const [lupaState, lupaAction, lupaPending] = useActionState(lupaPassword, initialState);

  const isMasuk = mode === "masuk";
  const isLupa = mode === "lupa";
  const state = isLupa ? lupaState : isMasuk ? masukState : daftarState;
  const pending = isLupa ? lupaPending : isMasuk ? masukPending : daftarPending;
  const action = isLupa ? lupaAction : isMasuk ? masukAction : daftarAction;

  return (
    // The key remounts the form per mode so each mode starts with its own fields.
    <form key={mode} action={action} className="space-y-4">
      {notice && mode === "masuk" && !state.error && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
        />
      </div>
      {isLupa ? (
        <p className="text-xs text-muted-foreground">
          Kami kirim tautan untuk membuat password baru. Buka tautannya di browser yang sama dengan yang kamu pakai sekarang.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {isMasuk && (
              <button
                type="button"
                onClick={() => setMode("lupa")}
                className={cn("inline-flex items-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground", tapTarget)}
              >
                Lupa password?
              </button>
            )}
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete={isMasuk ? "current-password" : "new-password"}
            minLength={8}
            required
          />
          {!isMasuk && <p className="text-xs text-muted-foreground">Minimal 8 karakter.</p>}
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.info && <p className="text-sm text-muted-foreground">{state.info}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Memproses..." : isLupa ? "Kirim tautan" : isMasuk ? "Masuk" : "Buat akun"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isLupa ? (
          <button
            type="button"
            onClick={() => setMode("masuk")}
            className={cn("inline-flex items-center font-semibold text-primary underline-offset-4 hover:underline", tapTarget)}
          >
            Kembali ke halaman masuk
          </button>
        ) : (
          <>
            {isMasuk ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              type="button"
              onClick={() => setMode(isMasuk ? "daftar" : "masuk")}
              className={cn("inline-flex items-center px-1 font-semibold text-primary underline-offset-4 hover:underline", tapTarget)}
            >
              {isMasuk ? "Daftar" : "Masuk"}
            </button>
          </>
        )}
      </p>
    </form>
  );
}
