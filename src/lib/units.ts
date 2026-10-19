import type { Locale } from "./locale";
import type {
  Ingredient,
  Nutrition,
  Quantity,
  Recipe,
  UnitPreferences,
} from "./types";

export const defaultUnits: UnitPreferences = {
  bodyMass: "lb",
  ingredientMass: "g",
  volume: "ml",
  spoons: "spoon",
  temperature: "C",
  length: "cm",
};
const n = (value: number, locale: Locale, digits = 1) =>
  value.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", {
    maximumFractionDigits: digits,
  });
export function bodyWeight(value: number, from: "kg" | "lb", to: "kg" | "lb") {
  return from === to
    ? value
    : from === "kg"
      ? value / 0.45359237
      : value * 0.45359237;
}
export function measure(
  kind: Quantity["kind"] | "temp" | "length",
  value: number,
  units: UnitPreferences,
  locale: Locale,
): string {
  if (kind === "mass")
    return units.ingredientMass === "g"
      ? `${n(value, locale)} g`
      : `${n(value / 28.349523125, locale, 2)} oz`;
  if (kind === "temp")
    return `${n(units.temperature === "C" ? value : (value * 9) / 5 + 32, locale, 0)} °${units.temperature}`;
  if (kind === "length")
    return units.length === "cm"
      ? `${n(value, locale)} cm`
      : `${n(value / 2.54, locale, 2)} ${locale === "fr" ? "po" : "in"}`;
  if (kind === "spoon") {
    if (units.spoons === "ml") return `${n(value, locale, 2)} ml`;
    const tbsp = value >= 15 && Number.isInteger((value / 15) * 4);
    return `${n(value / (tbsp ? 15 : 5), locale, 2)} ${locale === "fr" ? (tbsp ? "c. à soupe" : "c. à thé") : tbsp ? "tbsp" : "tsp"}`;
  }
  if (kind === "volume") {
    if (units.volume === "cup")
      return `${n(value / 236.5882365, locale, 2)} ${locale === "fr" ? "tasse US" : "US cup"}`;
    if (units.volume === "fl_oz")
      return `${n(value / 29.5735295625, locale, 2)} fl oz US`;
    return `${n(value, locale)} ml`;
  }
  return n(value, locale, 2);
}
export function quantityLabel(
  q: Quantity,
  units: UnitPreferences,
  locale: Locale,
  scale = 1,
) {
  const label = locale === "fr" ? q.label : q.labelEn || q.label;
  return `${measure(q.kind, q.value * scale, units, locale)}${q.kind === "count" && label ? ` ${label}` : ""}`;
}
// Stored instructions use SI tokens so a preference change never mutates source quantities.
export function instructionText(
  text: string,
  units: UnitPreferences,
  locale: Locale,
  scale = 1,
) {
  return text.replace(
    /\{\{(mass|volume|spoon|temp|length):([\d.]+)\}\}/g,
    (_, kind, value) =>
      measure(
        kind,
        Number(value) *
          (["mass", "volume", "spoon"].includes(kind) ? scale : 1),
        units,
        locale,
      ),
  );
}
export function recipeNutrition(
  recipe: Recipe,
  ingredients: Ingredient[],
  servings = recipe.servings,
): Nutrition | null {
  const total: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const line of recipe.ingredients.filter((i) => !i.optional)) {
    const ingredient = ingredients.find((i) => i.id === line.ingredientId);
    if (!ingredient) return null;
    for (const key of Object.keys(total) as (keyof Nutrition)[])
      total[key] += (ingredient.nutrition[key] * line.grams) / 100 / servings;
  }
  return total;
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function monday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(day + 6) % 7);
}
