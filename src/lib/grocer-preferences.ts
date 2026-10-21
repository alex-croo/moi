import { aisles, aisleLabel, ingredientAisle } from "./grocery-aisles";
import type { Ingredient } from "./types";
import type { Grocer, GrocerCategory } from "./shopping-types";
import type { Locale } from "./locale";

export const grocerCategories = [...aisles, "beef", "pork", "poultry"] as const;
export const postalCodePattern = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] \d[ABCEGHJ-NPRSTV-Z]\d$/;
export function normalizePostalCode(value: string) {
  const compact = value.toUpperCase().replace(/\s/g, "");
  return compact.length === 6 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact;
}
export function grocerCategoryLabel(category: GrocerCategory, locale: Locale) {
  if (category === "beef") return locale === "fr" ? "Bœuf" : "Beef";
  if (category === "pork") return locale === "fr" ? "Porc" : "Pork";
  if (category === "poultry") return locale === "fr" ? "Volaille" : "Poultry";
  return aisleLabel(category, locale);
}
export function ingredientGrocerCategory(ingredient: Ingredient): GrocerCategory {
  const aisle = ingredientAisle(ingredient);
  if (aisle !== "meat") return aisle;
  const name = `${ingredient.id} ${ingredient.name} ${ingredient.nameEn}`.toLowerCase();
  if (/bœuf|boeuf|beef|surlonge|sirloin/.test(name)) return "beef";
  if (/porc|pork/.test(name)) return "pork";
  if (/poulet|chicken|dinde|turkey|volaille|poultry/.test(name)) return "poultry";
  return aisle;
}
export function preferredGrocer(ingredient: Ingredient, grocers: Grocer[]): Grocer | undefined {
  const category = ingredientGrocerCategory(ingredient);
  return grocers.find(g => g.categories?.includes(category))
    || grocers.find(g => g.categories?.includes(ingredientAisle(ingredient)))
    || grocers.find(g => g.favorite);
}
