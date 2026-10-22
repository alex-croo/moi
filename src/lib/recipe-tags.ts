import type { Recipe } from "./types";
export type RecipeTag = { id: string; label: string; label_en: string; category: "diet" | "type" | "tag" };
export const defaultRecipeTags: RecipeTag[] = [
  { id: "omnivore", label: "Omnivore", label_en: "Omnivore", category: "diet" },
  { id: "vegetarian", label: "Végétarien", label_en: "Vegetarian", category: "diet" },
  { id: "vegan", label: "Végétalien", label_en: "Vegan", category: "diet" },
  ...[
    ["main", "Plat principal", "Main course"], ["pasta", "Pâtes et nouilles", "Pasta & noodles"],
    ["bowl", "Bols et riz", "Bowls & rice"], ["sandwich", "Burgers et sandwichs", "Burgers & sandwiches"],
    ["soup", "Soupes et mijotés", "Soups & stews"], ["salad", "Salades", "Salads"],
    ["flatbread", "Pains plats et tortillas", "Flatbreads & tortillas"],
  ].map(([id, label, label_en]) => ({ id, label, label_en, category: "type" as const })),
  ...[
    ["chicken", "Poulet", "Chicken"], ["beef", "Bœuf", "Beef"], ["pork", "Porc", "Pork"],
    ["turkey", "Dinde", "Turkey"], ["quick", "30 min ou moins", "30 minutes or less"],
  ].map(([id, label, label_en]) => ({ id, label, label_en, category: "tag" as const })),
];
// Curated catalog assignments. New tags can be created by admins; assignments
// are reviewed and shipped with the catalog, never inferred from private data.
export const recipeTagAssignments: Record<string, string[]> = {
  "diy-01": [
    "omnivore",
    "main",
    "beef",
    "pasta"
  ],
  "diy-02": [
    "omnivore",
    "main",
    "beef",
    "sandwich"
  ],
  "diy-03": [
    "omnivore",
    "main",
    "beef",
    "soup"
  ],
  "diy-04": [
    "omnivore",
    "main",
    "chicken",
    "salad"
  ],
  "diy-05": [
    "omnivore",
    "main",
    "beef",
    "sandwich"
  ],
  "diy-06": [
    "omnivore",
    "main",
    "beef"
  ],
  "diy-07": [
    "omnivore",
    "main",
    "chicken"
  ],
  "diy-08": [
    "omnivore",
    "main",
    "beef",
    "flatbread"
  ],
  "maison-50-01": [
    "omnivore",
    "main",
    "chicken",
    "soup"
  ],
  "maison-50-02": [
    "omnivore",
    "main",
    "chicken"
  ],
  "maison-50-03": [
    "omnivore",
    "main",
    "chicken",
    "pasta"
  ],
  "maison-50-04": [
    "omnivore",
    "main",
    "chicken"
  ],
  "maison-50-05": [
    "omnivore",
    "main",
    "chicken",
    "pasta"
  ],
  "maison-50-06": [
    "omnivore",
    "main",
    "chicken"
  ],
  "maison-50-07": [
    "omnivore",
    "main",
    "chicken"
  ],
  "maison-50-08": [
    "omnivore",
    "main",
    "chicken",
    "soup"
  ],
  "maison-50-09": [
    "omnivore",
    "main",
    "chicken",
    "pasta"
  ],
  "maison-50-10": [
    "omnivore",
    "main",
    "chicken",
    "pasta"
  ],
  "maison-50-11": [
    "omnivore",
    "main",
    "chicken",
    "soup"
  ],
  "maison-50-12": [
    "omnivore",
    "main",
    "chicken",
    "bowl"
  ],
  "maison-50-13": [
    "omnivore",
    "main",
    "chicken",
    "pasta"
  ],
  "maison-50-14": [
    "omnivore",
    "main",
    "chicken"
  ],
  "maison-50-15": [
    "omnivore",
    "main",
    "chicken",
    "sandwich"
  ],
  "maison-50-16": [
    "omnivore",
    "main",
    "chicken",
    "pasta"
  ],
  "maison-50-17": [
    "omnivore",
    "main",
    "chicken"
  ],
  "maison-50-18": [
    "omnivore",
    "main",
    "chicken",
    "bowl"
  ],
  "maison-50-19": [
    "omnivore",
    "main",
    "chicken",
    "pasta"
  ],
  "maison-50-20": [
    "omnivore",
    "main",
    "chicken",
    "flatbread"
  ],
  "maison-50-21": [
    "omnivore",
    "main",
    "beef",
    "pasta"
  ],
  "maison-50-22": [
    "omnivore",
    "main",
    "beef"
  ],
  "maison-50-23": [
    "omnivore",
    "main",
    "beef",
    "pasta"
  ],
  "maison-50-24": [
    "omnivore",
    "main",
    "beef"
  ],
  "maison-50-25": [
    "omnivore",
    "main",
    "beef",
    "soup"
  ],
  "maison-50-26": [
    "omnivore",
    "main",
    "beef",
    "bowl"
  ],
  "maison-50-27": [
    "omnivore",
    "main",
    "beef",
    "pasta"
  ],
  "maison-50-28": [
    "omnivore",
    "main",
    "beef",
    "bowl"
  ],
  "maison-50-29": [
    "omnivore",
    "main",
    "beef"
  ],
  "maison-50-30": [
    "omnivore",
    "main",
    "beef",
    "soup"
  ],
  "maison-50-31": [
    "omnivore",
    "main",
    "beef",
    "bowl"
  ],
  "maison-50-32": [
    "omnivore",
    "main",
    "beef",
    "pasta"
  ],
  "maison-50-33": [
    "omnivore",
    "main",
    "beef",
    "bowl"
  ],
  "maison-50-34": [
    "omnivore",
    "main",
    "beef"
  ],
  "maison-50-35": [
    "omnivore",
    "main",
    "beef",
    "sandwich"
  ],
  "maison-50-36": [
    "omnivore",
    "main",
    "beef"
  ],
  "maison-50-37": [
    "omnivore",
    "main",
    "pork"
  ],
  "maison-50-38": [
    "omnivore",
    "main",
    "pork"
  ],
  "maison-50-39": [
    "omnivore",
    "main",
    "pork"
  ],
  "maison-50-40": [
    "omnivore",
    "main",
    "pork",
    "pasta"
  ],
  "maison-50-41": [
    "omnivore",
    "main",
    "pork",
    "flatbread"
  ],
  "maison-50-42": [
    "omnivore",
    "main",
    "pork"
  ],
  "maison-50-43": [
    "omnivore",
    "main",
    "pork",
    "bowl"
  ],
  "maison-50-44": [
    "omnivore",
    "main",
    "pork",
    "bowl"
  ],
  "maison-50-45": [
    "omnivore",
    "main",
    "pork"
  ],
  "maison-50-46": [
    "omnivore",
    "main",
    "pork"
  ],
  "maison-50-47": [
    "omnivore",
    "main",
    "turkey",
    "bowl"
  ],
  "maison-50-48": [
    "omnivore",
    "main",
    "turkey"
  ],
  "maison-50-49": [
    "omnivore",
    "main",
    "turkey",
    "bowl"
  ],
  "maison-50-50": [
    "omnivore",
    "main",
    "turkey",
    "sandwich"
  ]
};
export const normalizeRecipeSearch = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
export function recipeTagIds(recipe: Recipe) {
  return [...new Set([...(recipeTagAssignments[recipe.id] || []), ...(recipe.minutes <= 30 ? ["quick"] : [])])];
}
export function matchesRecipe(recipe: Recipe, filters: { query: string; diet: string; type: string; tags: string[] }, vocabulary: RecipeTag[]) {
  const ids = recipeTagIds(recipe);
  const haystack = normalizeRecipeSearch([recipe.title, recipe.titleEn, recipe.subtitle, recipe.subtitleEn, ...vocabulary.filter(tag => ids.includes(tag.id)).flatMap(tag => [tag.label, tag.label_en])].join(" "));
  return haystack.includes(normalizeRecipeSearch(filters.query.trim())) && (!filters.diet || ids.includes(filters.diet)) && (!filters.type || ids.includes(filters.type)) && filters.tags.every(id => ids.includes(id));
}
export function mergeRecipeTags(tags: RecipeTag[]) {
  return [...new Map([...defaultRecipeTags, ...tags].map(tag => [tag.id, tag])).values()];
}
