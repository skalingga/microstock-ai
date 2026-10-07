import { NextResponse } from "next/server";
import { fetchModelCatalog } from "@/lib/providers/kenari-pricing";
import { createClient } from "@/lib/supabase/server";

// Model list for the picker on /generate. Read-only, from Kenari's public catalog.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sesi berakhir. Silakan masuk lagi." } }, { status: 401 });
  }
  return NextResponse.json({ models: await fetchModelCatalog() });
}
