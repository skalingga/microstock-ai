"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { ubahPassword, type ResetState } from "./actions";

const initialState: ResetState = {};

export function ResetForm() {
  const [state, action, pending] = useActionState(ubahPassword, initialState);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Password baru</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-muted-foreground">Minimal 8 karakter.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Ulangi password baru</Label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Memproses..." : "Simpan password"}
      </Button>
    </form>
  );
}
