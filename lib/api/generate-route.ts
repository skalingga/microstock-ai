import { NextResponse } from "next/server";
import type { z } from "zod";
import { formatIdr, startOfMonthWib } from "@/lib/budget";
import { ProviderError, httpStatusFor } from "@/lib/providers/errors";
import { isFreeModel } from "@/lib/providers/kenari-pricing";
import { runWithFallback, type UsageKind } from "@/lib/providers";
import type { SvgProvider } from "@/lib/providers/types";
import { findBannedWords } from "@/lib/settings/banned";
import { toProviderOrder } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";

type Ctx = { bannedWords: string[] };

type Options<S extends z.ZodTypeAny, R extends { model: string; costUsd?: number; costIdr?: number }> = {
  request: Request;
  schema: S;
  kind: UsageKind;
  /** Text the user controls; checked against the banned-word list before any AI call. */
  textToCheck: (input: z.infer<S>) => string;
  run: (provider: SvgProvider, input: z.infer<S>, ctx: Ctx) => Promise<R>;
};

function fail(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * Shared shell for the generate endpoints: login check, input validation, banned-word filter,
 * provider fallback and usage logging. One AI call per request (CLAUDE.md rule 2).
 */
export async function handleGenerate<
  S extends z.ZodTypeAny,
  R extends { model: string; costUsd?: number; costIdr?: number },
>(
  opts: Options<S, R>,
): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthenticated", "Sesi berakhir. Silakan masuk lagi.");

  const raw = await opts.request.json().catch(() => null);
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) {
    return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  const input = parsed.data as z.infer<S>;

  const { data: settings } = await supabase.from("user_settings").select("*").maybeSingle();
  if (!settings) return fail(500, "settings_missing", "Pengaturan akun tidak ditemukan.");

  const hits = findBannedWords(opts.textToCheck(input), settings.banned_words);
  if (hits.length > 0) {
    return fail(
      400,
      "banned_words",
      `Mengandung kata terlarang: ${hits.join(", ")}. Ubah teksnya, atau sesuaikan daftar di Pengaturan.`,
    );
  }

  try {
    const result = await runWithFallback(
      toProviderOrder(settings.provider_order),
      opts.kind,
      (provider) => opts.run(provider, input, { bannedWords: settings.banned_words }),
      async (entry) => {
        // A logging failure must never break the generation itself.
        await supabase
          .from("provider_usage")
          .insert({
            provider: entry.provider,
            model: entry.model,
            kind: entry.kind,
            ok: entry.ok,
            cost_usd: entry.costUsd ?? 0,
            cost_idr: entry.costIdr ?? 0,
          })
          .then(() => undefined, () => undefined);
      },
      // Paid Kenari models stop once this month's spending reaches the cap. Free models never do.
      async ({ provider, model }) => {
        if (provider !== "kenari" || isFreeModel(model)) return;
        const budget = settings.kenari_monthly_budget_idr;
        const { data, error } = await supabase.rpc("provider_cost_since", {
          p_provider: "kenari",
          p_since: startOfMonthWib(),
        });
        // Fail closed: when the spend cannot be read, a paid call must not slip through.
        if (error) {
          throw new ProviderError("budget_exceeded", "Batas biaya Kenari tidak bisa diperiksa saat ini. Coba lagi.");
        }
        if (Number(data ?? 0) >= budget) {
          throw new ProviderError(
            "budget_exceeded",
            `Batas biaya Kenari bulan ini (${formatIdr(budget)}) sudah tercapai. Naikkan batas di Pengaturan atau pakai model gratis.`,
          );
        }
      },
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProviderError) {
      return fail(httpStatusFor(err.code), err.code, err.message, { retryAfterSec: err.retryAfterSec });
    }
    console.error("generate route failed", err);
    return fail(500, "internal", "Terjadi kesalahan di server.");
  }
}
