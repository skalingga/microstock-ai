import { NextResponse } from "next/server";
import { fetchGeminiModels } from "@/lib/providers/gemini";
import { fetchModelCatalog } from "@/lib/providers/kenari-pricing";
import { createClient } from "@/lib/supabase/server";

// Model list for the picker on /generate. Read-only: Kenari's public catalog plus the Gemini models
// this server's key can use (the key itself never leaves the server).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sesi berakhir. Silakan masuk lagi." } }, { status: 401 });
  }
  const [models, geminiModels] = await Promise.all([fetchModelCatalog(), fetchGeminiModels()]);
  return NextResponse.json({ models, geminiModels });
}
