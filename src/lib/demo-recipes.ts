import type { Recipe, Ingredient } from "./types";
// Public, fictional demo content. Personal recipe cards are never bundled.
export const demoIngredients: Ingredient[] = [
  {
    id: "beef-95-raw",
    name: "Bœuf haché extra maigre",
    nameEn: "Extra lean ground beef",
    state: "raw",
    nutrition: { kcal: 137, protein: 21.41, carbs: 0, fat: 5 },
    source: "https://fdc.nal.usda.gov/food-details/171790/nutrients",
    sourceLabel: "USDA FDC 171790",
    sourceDescription: "Beef, ground, 95% lean meat / 5% fat, raw",
    estimated: true,
  },
  {
    id: "onion-raw",
    name: "Oignon",
    nameEn: "Onion",
    state: "raw",
    nutrition: { kcal: 40, protein: 1.1, carbs: 9.34, fat: 0.1 },
    source: "https://fdc.nal.usda.gov/food-details/170000/nutrients",
    sourceLabel: "USDA FDC 170000",
    sourceDescription: "Onions, raw",
    estimated: true,
  },
];
export const demoRecipes: Recipe[] = [
  {
    id: "demo-beef",
    title: "Bœuf et oignons",
    titleEn: "Beef and onions",
    subtitle: "Une recette fictive pour explorer le carnet",
    subtitleEn: "A fictional recipe to explore the book",
    minutes: 25,
    servings: 2,
    image: "",
    source: "https://fdc.nal.usda.gov/",
    ingredients: [
      {
        ingredientId: "beef-95-raw",
        grams: 250,
        quantity: { kind: "mass", value: 250 },
      },
      {
        ingredientId: "onion-raw",
        grams: 100,
        quantity: { kind: "mass", value: 100 },
      },
    ],
    steps: [
      {
        title: "Préparer",
        titleEn: "Prepare",
        text: "Couper l’oignon en dés de {{length:1}}.",
        textEn: "Dice the onion into {{length:1}} pieces.",
        image: "",
      },
      {
        title: "Cuire",
        titleEn: "Cook",
        text: "Cuire le bœuf et l’oignon à la poêle, jusqu’à {{temp:71}} au centre de la viande. Ajouter {{volume:60}} d’eau au besoin.",
        textEn:
          "Cook the beef and onion in a skillet until the meat reaches {{temp:71}}. Add {{volume:60}} water as needed.",
        image: "",
      },
    ],
    note: "Exemple de conversion : {{spoon:15}} et {{volume:240}}.",
    noteEn: "Conversion example: {{spoon:15}} and {{volume:240}}.",
  },
];
