export type Meal = {
  title: string;
  titleEn: string;
  minutes: number;
  portions: number;
  kind: "bowl" | "salmon" | "pasta" | "taco";
  kcal?: number | null;
};
export type MenuDay = {
  date: string;
  lunch: Meal | null;
  dinner: Meal | null;
} & Partial<Record<MealTime, Meal | null>>;
export type MenuPlan = {
  id: string;
  title: string;
  titleEn: string;
  startDate: string;
  days: MenuDay[];
};
export type WeightEntry = {
  id: string;
  date: string;
  value: number;
  unit: "lb" | "kg";
};
export type JournalEntry = {
  id: string;
  date: string;
  text: string;
  mood: number;
  title?: string;
  revision?: number;
};
export type DocumentLink = {
  id: string;
  title: string;
  url: string;
  kind: "menu" | "recipe" | "journal" | "other";
};
export type WorkspaceData = {
  plans: MenuPlan[];
  weights: WeightEntry[];
  journal: JournalEntry[];
  documents: DocumentLink[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  slots: MealSlot[];
  preferences: UnitPreferences;
  groceryChecks: GroceryCheck[];
  pantry: PantryItem[];
};

export type UnitPreferences = {
  bodyMass: "lb" | "kg";
  ingredientMass: "g" | "kg" | "oz" | "lb";
  volume: "ml" | "l" | "cup" | "cup_metric" | "fl_oz";
  spoons: "spoon" | "ml";
  temperature: "C" | "F";
  length: "cm" | "in";
};
export type Nutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Ingredient = {
  stockId?: string;
  translations?: Record<string, Record<string, string>>;
  id: string;
  name: string;
  nameEn: string;
  state: string;
  nutrition: Nutrition;
  source: string;
  sourceLabel: string;
  sourceDescription: string;
  estimated: boolean;
};
export type Quantity = {
  unit?: "piece" | "clove" | "bulb" | "can" | "pack" | "bunch" | "slice";
  // Weight per counted item: information, never a license to invent a piece count.
  gramsPerItem?: number;
  weightBasis?: "measured" | "package" | "estimated";
  content?: { kind: "mass" | "volume"; value: number; basis: "net" | "drained" };
  basis?: "net" | "drained";
  kind: "mass" | "volume" | "spoon" | "count";
  value: number;
  label?: string;
  labelEn?: string;
};
export type RecipeIngredient = {
  ingredientId: string;
  grams: number;
  quantity: Quantity;
  note?: string;
  optional?: boolean;
};
export type Recipe = {
  importVersion?: 2;
  translations?: Record<string, Record<string, string>>;
  provenance?: { importedAt: string; original: unknown; decisions: string[] };
  id: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  minutes: number;
  servings: number;
  image: string;
  source: string;
  ingredients: RecipeIngredient[];
  steps: {
    title: string;
    titleEn: string;
    text: string;
    textEn: string;
    image?: string;
  }[];
  note?: string;
  noteEn?: string;
};
export type MealSlot = {
  date: string;
  slot: MealTime;
  recipeId: string;
};
export type MealTime =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "dinner"
  | "evening_snack";
export type GroceryCheck = {
  week: string;
  ingredientId: string;
  checked: boolean;
};
export type PantryLocation = "cupboard" | "fridge" | "freezer" | "spices";
export type PantryItem = {
  id: string;
  ingredientId: string | null;
  name: string;
  location: PantryLocation;
  quantity: Quantity | null;
  note: string;
  inStock: boolean;
};
