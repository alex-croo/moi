import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultUnits } from "./units";
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
      .select("id,date,text,mood,title,revision")
      .order("date", { ascending: false }),
    db
      .from("document_links")
      .select("id,title,url,kind")
      .order("created_at", { ascending: false }),
    db.from("recipes").select("id,details").order("id"),
    db.from("ingredients").select("id,details").order("id"),
    db
      .from("recipe_ingredients")
      .select("recipe_id,ingredient_id,grams,quantity,note,optional,position")
      .order("position"),
    db.from("meal_slots").select("date,slot,recipe_id").order("date"),
    db.from("unit_preferences").select("units").maybeSingle(),
    db.from("grocery_checks").select("week_start,ingredient_id,checked"),
    db
      .from("pantry_items")
      .select("id,ingredient_id,name,location,quantity,note,in_stock")
      .order("name"),
  ] as const);
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
    recipes: (results[4].data || []).map((r) => ({
      ...r.details,
      id: r.id,
      ingredients: (results[6].data || [])
        .filter((l) => l.recipe_id === r.id)
        .map((l) => ({
          ingredientId: l.ingredient_id,
          grams: Number(l.grams),
          quantity: l.quantity,
          note: l.note,
          optional: l.optional,
        })),
    })),
    ingredients: (results[5].data || []).map((r) => ({
      ...r.details,
      id: r.id,
    })),
    slots: (results[7].data || []).map((r) => ({
      date: r.date,
      slot: r.slot,
      recipeId: r.recipe_id,
    })),
    preferences: { ...defaultUnits, ...results[8].data?.units },
    groceryChecks: (results[9].data || []).map((r) => ({
      week: r.week_start,
      ingredientId: r.ingredient_id,
      checked: r.checked,
    })),
    pantry: (results[10].data || []).map((r) => ({
      id: r.id,
      ingredientId: r.ingredient_id,
      name: r.name,
      location: r.location,
      quantity: r.quantity,
      note: r.note,
      inStock: r.in_stock,
    })),
  };
}
