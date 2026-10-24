import { tr } from "./locale";
import type { Ingredient, MealSlot, MealTime, Recipe } from "./types";
import type { Locale } from "./locale";
import { recipeNutrition } from "./units";

export const mealTimes: MealTime[] = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
  "evening_snack",
];
const labels: Record<MealTime, [string, string]> = {
  breakfast: ["Déjeuner", "Breakfast"],
  morning_snack: ["Collation du matin", "Morning snack"],
  lunch: ["Dîner", "Lunch"],
  afternoon_snack: ["Collation de l’après-midi", "Afternoon snack"],
  dinner: ["Souper", "Dinner"],
  evening_snack: ["Collation du soir", "Evening snack"],
};
export const mealLabel = (slot: MealTime, locale: Locale) =>
  tr(locale, ...labels[slot]);

// A day contains one serving of each chosen recipe. Round only the final total.
export function dailyCalories(
  date: string,
  slots: MealSlot[],
  recipes: Recipe[],
  ingredients: Ingredient[],
) {
  let kcal = 0,
    missing = 0,
    meals = 0;
  for (const slot of slots.filter((s) => s.date === date)) {
    meals++;
    const recipe = recipes.find((r) => r.id === slot.recipeId);
    const nutrition = recipe && recipeNutrition(recipe, ingredients);
    if (nutrition) kcal += nutrition.kcal;
    else missing++;
  }
  return { kcal, missing, meals };
}
