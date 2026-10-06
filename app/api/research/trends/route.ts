import { NextResponse } from "next/server";
import { REGIONS } from "@/lib/research/calendar";
import { trendsRequestSchema } from "@/lib/research/schemas";
import { demandScores } from "@/lib/research/trends";
import { createClient } from "@/lib/supabase/server";

// Google Trends (unofficial) is slow and can fail; the client treats any failure as "no data".
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sesi berakhir. Silakan masuk lagi." } }, { status: 401 });
  }

  const parsed = trendsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Input tidak valid." } },
      { status: 400 },
    );
  }

  const geo = REGIONS.find((r) => r.value === parsed.data.region)?.trendsGeo ?? "";
  try {
    return NextResponse.json({ scores: await demandScores(parsed.data.terms, geo) });
  } catch (err) {
    console.error("trends failed", err);
    // Not an error for the user: scores simply stay on the calendar and AI estimates.
    return NextResponse.json({ scores: {}, unavailable: true });
  }
}
