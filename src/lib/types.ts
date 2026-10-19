export type Meal = {
  title: string;
  titleEn: string;
  minutes: number;
  portions: number;
  kind: "bowl" | "salmon" | "pasta" | "taco";
};
export type MenuDay = { date: string; lunch: Meal | null; dinner: Meal | null };
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
};

export type UnitPreferences = {
  bodyMass: "lb" | "kg";
  ingredientMass: "g" | "oz";
  volume: "ml" | "cup" | "fl_oz";
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
    image: string;
  }[];
  note?: string;
  noteEn?: string;
};
export type MealSlot = {
  date: string;
  slot: "lunch" | "dinner";
  recipeId: string;
};
