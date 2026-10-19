import type {
  Ingredient,
  MealSlot,
  Quantity,
  Recipe,
  RecipeIngredient,
} from "./types";
import { addDays } from "./units";

export type GroceryItem = {
  ingredient: Ingredient;
  quantity: Quantity;
  estimated: boolean;
  uses: { recipe: Recipe; meals: number }[];
};

// Add source quantities before formatting: display rounding must never affect totals.
function totalQuantity(
  lines: RecipeIngredient[],
): Pick<GroceryItem, "quantity" | "estimated"> {
  const kinds = new Set(lines.map((line) => line.quantity.kind));
  if ([...kinds].every((kind) => kind === "volume" || kind === "spoon")) {
    return {
      quantity: {
        kind: kinds.has("volume") ? "volume" : "spoon",
        value: lines.reduce((sum, line) => sum + line.quantity.value, 0),
      },
      estimated: false,
    };
  }
  const first = lines[0].quantity;
  const sameCountUnit = lines.every(
    ({ quantity: q }) =>
      (q.label || "").trim().toLowerCase() ===
        (first.label || "").trim().toLowerCase() &&
      (q.labelEn || "").trim().toLowerCase() ===
        (first.labelEn || "").trim().toLowerCase(),
  );
  if (kinds.size === 1 && (first.kind === "mass" || sameCountUnit)) {
    return {
      quantity: {
        ...first,
        value: lines.reduce((sum, line) => sum + line.quantity.value, 0),
      },
      estimated: false,
    };
  }
  // Count, volume and mass cannot be added directly. Use each recipe's documented
  // gram equivalent, never assume a universal density or a fixed item size.
  return {
    quantity: {
      kind: "mass",
      value: lines.reduce((sum, line) => sum + line.grams, 0),
    },
    estimated: true,
  };
}

export function weeklyGroceries(
  recipes: Recipe[],
  ingredients: Ingredient[],
  slots: MealSlot[],
  week: string,
  includeOptional = false,
) {
  const end = addDays(week, 6);
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const ingredientById = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const groups = new Map<
    string,
    {
      lines: RecipeIngredient[];
      uses: Map<string, { recipe: Recipe; meals: number }>;
    }
  >();
  let meals = 0;
  let missing = 0;
  for (const slot of slots.filter((s) => s.date >= week && s.date <= end)) {
    const recipe = recipeById.get(slot.recipeId);
    if (!recipe) {
      missing++;
      continue;
    }
    meals++;
    const used = new Set<string>();
    for (const line of recipe.ingredients) {
      if (line.optional && !includeOptional) continue;
      if (!ingredientById.has(line.ingredientId)) {
        missing++;
        continue;
      }
      const group = groups.get(line.ingredientId) || {
        lines: [] as RecipeIngredient[],
        uses: new Map<string, { recipe: Recipe; meals: number }>(),
      };
      group.lines.push(line);
      if (!used.has(line.ingredientId)) {
        const use = group.uses.get(recipe.id);
        group.uses.set(recipe.id, { recipe, meals: (use?.meals || 0) + 1 });
        used.add(line.ingredientId);
      }
      groups.set(line.ingredientId, group);
    }
  }
  const items: GroceryItem[] = Array.from(groups, ([id, group]) => ({
    ingredient: ingredientById.get(id)!,
    ...totalQuantity(group.lines),
    uses: Array.from(group.uses.values()),
  }));
  return { items, meals, missing };
}
