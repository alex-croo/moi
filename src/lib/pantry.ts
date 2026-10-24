import { tr as regionalTr, intlLocale } from "@/lib/locale";
import type { Locale } from "./locale";
import { ingredientAisle, type Aisle } from "./grocery-aisles";
import { quantityLabel } from "./units";
import type {
  Ingredient,
  PantryItem,
  PantryLocation,
  Quantity,
  UnitPreferences,
} from "./types";

export type PantryEntry = PantryItem & { aisle?: Aisle };
export function pantryAisle(item: PantryEntry, ingredients: Ingredient[]): Aisle {
  const ingredient = ingredients.find(i => i.id === item.ingredientId);
  return item.aisle || (ingredient ? ingredientAisle(ingredient) : "other");
}
export function pantryQuantityLabel(q: Quantity, units: UnitPreferences, locale: Locale, translate?: (fr:string,en:string)=>string) {
  return quantityLabel(q.kind === "count" && !q.label && !q.labelEn
    ? { ...q, label: "unités", labelEn: "items" } : q, units, locale, 1, translate);
}

export const pantryLocations: PantryLocation[] = [
  "cupboard",
  "fridge",
  "freezer",
  "spices",
];
export const pantryLabel = (location: PantryLocation, locale: Locale) => {
  const labels = ({
    cupboard: ["Garde-manger", "Cupboard"],
    fridge: ["Réfrigérateur", "Fridge"],
    freezer: ["Congélateur", "Freezer"],
    spices: ["Épices et condiments", "Spices & seasonings"],
  })[location];
 return regionalTr(locale, labels[0], labels[1]);
};
export function pantryName(
  item: PantryItem,
  ingredients: Ingredient[],
  locale: Locale,
) {
  const ingredient = ingredients.find((i) => i.id === item.ingredientId);
  return ingredient
    ? regionalTr(locale, ingredient.name, ingredient.nameEn)
    : item.name;
}
export function pantryForIngredient(
  pantry: PantryItem[],
  ingredientId: string,
) {
  return pantry.filter((p) => p.inStock && p.ingredientId === ingredientId);
}
// Values are stored in grams or millilitres, just like recipe quantities.
export function pantryFactor(kind: Quantity["kind"], units: UnitPreferences) {
  if (kind === "mass") return units.ingredientMass === "oz" ? 28.349523125 : 1;
  if (kind === "volume")
    return units.volume === "cup"
      ? 236.5882365
      : units.volume === "fl_oz"
        ? 29.5735295625
        : 1;
  if (kind === "spoon") return units.spoons === "spoon" ? 15 : 1;
  return 1;
}
export function pantryUnit(
  kind: Quantity["kind"],
  units: UnitPreferences,
  locale: Locale,
) {
  if (kind === "mass") return units.ingredientMass;
  if (kind === "volume")
    return units.volume === "cup"
      ? regionalTr(locale, "tasses US", "US cups")
      : units.volume === "fl_oz"
        ? "fl oz US"
        : "ml";
  if (kind === "spoon")
    return units.spoons === "ml"
      ? "ml"
      : regionalTr(locale, "c. à soupe", "tbsp");
  return regionalTr(locale, "unités", "items");
}
