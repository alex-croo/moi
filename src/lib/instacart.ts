import { z } from "zod";
import type { Quantity } from "./types";
import { normalizePostalCode, postalCodePattern } from "./grocer-preferences";

const quantity = z.object({
  kind: z.enum(["mass", "volume", "spoon", "count"]),
  value: z.number().finite().positive().max(1000000),
  label: z.string().max(80).optional(), labelEn: z.string().max(80).optional(),
}).strict();
export const instacartInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retailers"), postalCode: z.string().max(12).transform(normalizePostalCode).refine(v => postalCodePattern.test(v)), locale: z.enum(["fr", "en"]) }).strict(),
  z.object({
    action: z.literal("export"), locale: z.enum(["fr", "en"]),
    items: z.array(z.object({ name: z.string().trim().min(1).max(200), quantity }).strict()).min(1).max(300),
  }).strict(),
]);
export type InstacartInput = z.infer<typeof instacartInput>;
export type InstacartRetailer = { name: string; retailer_key: string };

// Canonical quantities are grams or millilitres, independent of display preferences.
export function instacartMeasurement(q: Quantity) {
  if (q.kind === "mass") return [{ quantity: q.value, unit: "gram" }];
  if (q.kind === "volume" || q.kind === "spoon") return [{ quantity: q.value, unit: "milliliter" }];
  const label = (q.labelEn || q.label || "").trim().toLowerCase();
  const units: Record<string, string> = {
    "": "each", each: "each", unit: "each", units: "each", unité: "each", unités: "each",
    can: "can", cans: "can", boîte: "can", boîtes: "can",
    package: "package", packages: "package", paquet: "package", paquets: "package",
    bunch: "bunch", bunches: "bunch", botte: "bunch", bottes: "bunch",
    head: "head", heads: "head", tête: "head", têtes: "head",
  };
  // Do not misrepresent a clove, slice or unknown package as a whole product.
  return units[label] ? [{ quantity: q.value, unit: units[label] }] : undefined;
}
export function instacartListBody(input: Extract<InstacartInput, { action: "export" }>) {
  return {
    title: input.locale === "fr" ? "Ma liste d’épicerie Tred’meal" : "My Tred’meal grocery list",
    link_type: "shopping_list", expires_in: 7,
    line_items: input.items.map(item => ({
      name: item.name,
      display_text: `${item.name} — ${item.quantity.value} ${item.quantity.kind === "mass" ? "g" : item.quantity.kind !== "count" ? "ml" : (input.locale === "fr" ? item.quantity.label : item.quantity.labelEn) || (input.locale === "fr" ? "unité(s)" : "unit(s)")}`,
      ...(instacartMeasurement(item.quantity) ? { line_item_measurements: instacartMeasurement(item.quantity) } : {}),
    })),
  };
}
export function isInstacartLink(value: string, development = false) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password &&
      ["instacart.com", "instacart.ca", ...(development ? ["instacart.tools"] : [])]
        .some(host => u.hostname === host || u.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
