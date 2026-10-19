import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceData } from "./types";
export async function loadWorkspace(
  db: SupabaseClient,
): Promise<WorkspaceData> {
  const results = await Promise.all([
    db
      .from("menu_plans")
      .select("id,title,title_en,start_date,days")
      .order("start_date", { ascending: false }),
    db.from("weight_entries").select("id,date,value,unit").order("date"),
    db
      .from("journal_entries")
      .select("id,date,text,mood")
      .order("date", { ascending: false }),
    db
      .from("document_links")
      .select("id,title,url,kind")
      .order("created_at", { ascending: false }),
  ]);
  if (results.some((r) => r.error))
    throw new Error("Unable to load private workspace");
  return {
    plans: (results[0].data || []).map((r) => ({
      id: r.id,
      title: r.title,
      titleEn: r.title_en,
      startDate: r.start_date,
      days: r.days,
    })),
    weights: results[1].data || [],
    journal: results[2].data || [],
    documents: results[3].data || [],
  };
}
