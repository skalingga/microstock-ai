"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { daftar, masuk, type AuthState } from "./actions";

const initialState: AuthState = {};

export function LoginForm() {
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [masukState, masukAction, masukPending] = useActionState(masuk, initialState);
  const [daftarState, daftarAction, daftarPending] = useActionState(daftar, initialState);

  const isMasuk = mode === "masuk";
  const state = isMasuk ? masukState : daftarState;
  const pending = isMasuk ? masukPending : daftarPending;

  return (
    <form action={isMasuk ? masukAction : daftarAction} className="space-y-4">
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
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isMasuk ? "current-password" : "new-password"}
          minLength={8}
          required
        />
        {!isMasuk && (
          <p className="text-xs text-muted-foreground">Minimal 8 karakter.</p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.info && <p className="text-sm text-muted-foreground">{state.info}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Memproses..." : isMasuk ? "Masuk" : "Buat akun"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isMasuk ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
        <button
          type="button"
          onClick={() => setMode(isMasuk ? "daftar" : "masuk")}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {isMasuk ? "Daftar" : "Masuk"}
        </button>
      </p>
    </form>
  );
}
