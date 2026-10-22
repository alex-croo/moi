import type { Quantity } from "./types";

// Canadian Nutrient File, food 2394: edible portion, 3 g/clove, 24 g/bulb.
// https://food-nutrition.canada.ca/cnf-fce/serving-portion?id=2394
// These are estimates, and only apply to explicitly named pieces, never packages.
const measures: Record<string, { label: string; labelEn: string; grams: number; aliases: string[] }[]> = {
  "ail-frais": [
    { label: "gousses", labelEn: "cloves", grams: 3, aliases: ["gousse", "gousses", "clove", "cloves"] },
    { label: "têtes", labelEn: "bulbs", grams: 24, aliases: ["tete", "tetes", "bulbe", "bulbes", "bulb", "bulbs"] },
  ],
};
const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
export const countMeasures = (ingredientId: string | null) => measures[ingredientId || ""] || [];
export function countMeasure(ingredientId: string | null, quantity: Quantity) {
  if (quantity.kind !== "count") return undefined;
  const labels = [quantity.label, quantity.labelEn].filter((label): label is string => !!label?.trim());
  return countMeasures(ingredientId).find(m => labels.length > 0 && labels.every(label => m.aliases.includes(normalize(label))));
}
export function countLabels(ingredientId: string | null, label: string) {
  const measure = countMeasure(ingredientId, { kind: "count", value: 1, label });
  return measure ? { label: measure.label, labelEn: measure.labelEn } : { label, labelEn: label };
}
