import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWorkspace } from "./workspace";
import type { PersonalData } from "./private-types";
export async function loadPersonalWorkspace(db: SupabaseClient) {
  const [
    { data: vault, error: vaultError },
    { data: standard, error: standardError },
  ] = await Promise.all([
    db.from("personal_vaults").select("envelope,revision").maybeSingle(),
    db.from("standard_workspaces").select("data,revision").maybeSingle(),
  ]);
  if (vaultError || standardError) throw Error("unavailable");
  const { recipes, ingredients, ...legacy } = await loadWorkspace(db);
  return {
    envelope: vault?.envelope ?? null,
    standard: vault
      ? null
      : ((standard?.data ?? {
          ...legacy,
          program: { completed: {}, reflections: {} },
        }) as PersonalData | null),
    standardRevision: vault ? null : (standard?.revision ?? 0),
    catalog: {
      ingredients,
      recipes: recipes.map((r) => ({
        ...r,
        source: /^https:\/\/(docs|drive)\.google\.com\//.test(r.source)
          ? ""
          : r.source,
      })),
    },
  };
}
