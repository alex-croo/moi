import type { Ingredient, PantryLocation } from "./types";
import type { Locale } from "./locale";

export const aisles = ["produce", "meat", "fish", "dairy", "bakery", "dry", "seasoning", "frozen", "other"] as const;
export type Aisle = (typeof aisles)[number];
const labels: Record<Aisle, [string, string]> = {
  produce: ["Fruits et légumes", "Fruit & vegetables"], meat: ["Viandes et volailles", "Meat & poultry"],
  fish: ["Poissons et fruits de mer", "Fish & seafood"], dairy: ["Produits laitiers et œufs", "Dairy & eggs"],
  bakery: ["Boulangerie", "Bakery"], dry: ["Épicerie sèche et conserves", "Dry goods & canned food"],
  seasoning: ["Huiles, épices et condiments", "Oils, spices & condiments"], frozen: ["Surgelés", "Frozen food"], other: ["Autres", "Other"],
};
export const aisleLabel = (aisle: Aisle, locale: Locale) => labels[aisle][locale === "fr" ? 0 : 1];
// Taxonomy belongs to the canonical ingredient, independently of pantry location.
// Future catalog publications may set `aisle` directly in ingredient details.
const known: Record<string, Aisle> = {};
for (const [aisle, ids] of Object.entries({
  produce: "oignon-blanc-cru epinards-crus pommes-de-terre-crues oignon-rouge-cru mesclun-cru poivron-rouge-cru oignon-vert-cru tomates-roma-crues lime-crue ail-frais panais-crus echalote-crue onion-raw",
  meat: "boulettes-porc boeuf-hache-extra-maigre-cru poitrine-poulet-crue haut-surlonge-cru beef-95-raw",
  dairy: "parmesan-rape beurre-non-sale cheddar-marbre creme-sure lait-2pct",
  bakery: "pain-brioche-ace tortilla-farine",
  dry: "spaghetti-secs marinara panko sucre-blanc haricots-rouges-conserve-liquide tomates-conserve-jus cassonade pate-tomate bouillon-boeuf-concentre",
  seasoning: "sel poivre-noir origan-seche basilic-seche marjolaine-sechee ail-poudre romarin-seche persil-seche laurier-moulu mayonnaise sauce-bbq vinaigre-balsamique huile-canola paprika-fume chili-poudre cumin-moulu chipotle paprika-doux oignon-poudre coriandre-graines cayenne vinaigrette-cesar moutarde-graines celeri-graines thym-seche sauce-raifort moutarde-ancienne aneth-graines piment-flocons vinaigre-vin-rouge moutarde-dijon guacamole",
})) for (const id of ids.split(" ")) known[id] = aisle as Aisle;
export function ingredientAisle(ingredient: Ingredient): Aisle {
  const explicit = (ingredient as Ingredient & { aisle?: Aisle }).aisle;
  return explicit && aisles.includes(explicit) ? explicit : known[ingredient.id] || "other";
}
export function suggestedLocation(ingredient: Ingredient): PantryLocation {
  const aisle = ingredientAisle(ingredient);
  return aisle === "frozen" ? "freezer" : ["produce", "meat", "fish", "dairy"].includes(aisle) ? "fridge" : aisle === "seasoning" ? "spices" : "cupboard";
}
