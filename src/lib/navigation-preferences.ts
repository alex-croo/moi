import { z } from "zod";

export const dashboardSections = ["overview", "recipes", "menus", "inventoryMeals", "inventoryCatalog", "inventoryHistory", "groceries", "orders", "pantry", "weight", "journal", "library", "settings", "program", "circles", "admin"] as const;
const section = z.enum(dashboardSections), date = z.iso.date();
const text = z.string().max(2000);
const schemas: Record<string, z.ZodType> = {
  section, "menus:week": date,
  "learning-admin:filter": text, "circles:selected": text,
  "recipe-book:tab": z.enum(["recipes", "blends"]),
  "pantry:filter": z.enum(["all", "cupboard", "fridge", "freezer", "spices"]),
  "pantry:empty": z.boolean(), "groceries:optional": z.boolean(),
  "groceries:filter": z.enum(["all", "buy", "covered", "pending", "check"]),
  "journal:layout": z.enum(["grid", "list"]), "journal:drafts": z.boolean(),
  "journal:screen": z.enum(["library", "editor"]), "journal:date": date,
  "journal:tabs": z.array(date).max(100),
};
for (const scope of ["recipes", "recipe-picker", "pantry", "groceries", "journal", "inventory", "blends"]) schemas[`${scope}:query`] = text;
for (const scope of ["recipes", "recipe-picker"]) {
  schemas[`${scope}:diet`] = text; schemas[`${scope}:type`] = text;
  schemas[`${scope}:tags`] = z.array(z.string().max(100)).max(100);
}
const pages = new Set(["recipes", "recipe-picker", "pantry", "groceries", "journal", "weights", "documents", "blends", "foods", "planned-meals", "stock-events", "stock-activity", "pending-orders", "received-orders", "circle-incoming", "circles", "circle-events", "circle-members", "circle-invites", "admin-members", "admin-invitations", "learning-admin", "learning-days", "memories"]);
export function navigationPreference(key: string, value: unknown): unknown {
  const schema = schemas[key]
    || (key.startsWith("scroll:") && section.safeParse(key.slice(7)).success ? z.number().min(0).max(10_000_000) : undefined)
    || (key.startsWith("page:") && pages.has(key.slice(5)) ? z.object({ filter: z.string().max(10000), page: z.number().int().min(1).max(100000) }).strict() : undefined);
  const parsed = schema?.safeParse(value);
  return parsed?.success ? parsed.data : undefined;
}

// This format contains navigation only. API responses, journals and form drafts
// must never be persisted through the navigation cache.
export function readNavigation(raw: string | null): [string, unknown][] {
  try {
    if (!raw || raw.length > 100000) return [];
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.slice(0, 150).flatMap((entry: unknown) => {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") return [];
      const value = navigationPreference(entry[0], entry[1]);
      return value === undefined ? [] : [[entry[0], value] as [string, unknown]];
    });
  } catch { return []; }
}
export const navigationStorageKey = (owner: string) => `tredmeal:navigation:v1:${owner}`;
