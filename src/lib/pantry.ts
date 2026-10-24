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
 if(kind==="mass")return {g:1,kg:1000,oz:28.349523125,lb:453.59237}[units.ingredientMass];
 if(kind==="volume")return {ml:1,l:1000,cup:236.5882365,cup_metric:250,fl_oz:29.5735295625}[units.volume];
 if(kind==="spoon")return units.spoons==="ml"?1:15;
 return 1;
}
export function pantryUnit(kind: Quantity["kind"], units: UnitPreferences, locale: Locale) {
 if(kind==="mass")return units.ingredientMass;
 if(kind==="volume")return {ml:"ml",l:"L",cup:regionalTr(locale,"tasse US","US cup"),cup_metric:regionalTr(locale,"tasse de 250 ml","250 ml cup"),fl_oz:"fl oz US"}[units.volume];
 if(kind==="spoon")return units.spoons==="ml"?"ml":regionalTr(locale,"c. à soupe","tbsp");
 return regionalTr(locale,"unités","items");
}
