import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { buildSaturated, type SaturatedSubject } from "./saturation";

/** Subjects of this user's assets that Adobe rejected as similar content. An error means "no data", not "none". */
export async function fetchSaturatedSubjects(supabase: SupabaseClient<Database>): Promise<SaturatedSubject[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("concept, adobe_reason")
    .eq("adobe_status", "ditolak")
    .or("adobe_reason.ilike.%similar%,adobe_reason.ilike.%serupa%,adobe_reason.ilike.%mirip%")
    .limit(500);
  if (error) return [];
  return buildSaturated((data ?? []).map((r) => ({ concept: r.concept, adobeReason: r.adobe_reason })));
}
