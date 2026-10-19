import { demoIngredients, demoRecipes } from "./demo-recipes";
import { defaultUnits } from "./units";
import type { Meal, WorkspaceData } from "./types";

const meals: Meal[] = [
  {
    title: "Bol de poulet façon fajitas",
    titleEn: "Chicken fajita bowl",
    minutes: 30,
    portions: 2,
    kind: "bowl",
  },
  {
    title: "Saumon croustillant au citron",
    titleEn: "Crispy lemon salmon",
    minutes: 35,
    portions: 2,
    kind: "salmon",
  },
  {
    title: "Pâtes crémeuses au citron",
    titleEn: "Creamy lemon pasta",
    minutes: 25,
    portions: 2,
    kind: "pasta",
  },
  {
    title: "Tacos de bœuf et avocat",
    titleEn: "Beef and avocado tacos",
    minutes: 30,
    portions: 2,
    kind: "taco",
  },
  {
    title: "Burgers de dinde tex-mex",
    titleEn: "Tex-Mex turkey burgers",
    minutes: 30,
    portions: 2,
    kind: "bowl",
  },
  {
    title: "Bœuf et brocoli sur riz à l’ail",
    titleEn: "Beef and broccoli with garlic rice",
    minutes: 25,
    portions: 2,
    kind: "bowl",
  },
  {
    title: "Steak, champignons et balsamique",
    titleEn: "Steak with balsamic mushrooms",
    minutes: 35,
    portions: 2,
    kind: "bowl",
  },
  {
    title: "Tacos de steak carne asada",
    titleEn: "Carne asada steak tacos",
    minutes: 30,
    portions: 2,
    kind: "taco",
  },
];
// Fictional demonstration only. No health data or private Drive identifiers from the owner's project.
export const demoData: WorkspaceData = {
  plans: [
    {
      id: "demo-week",
      title: "Une semaine qui fait du bien",
      titleEn: "A week that feels good",
      startDate: "2026-10-26",
      days: Array.from({ length: 6 }, (_, i) => ({
        date: `2026-10-${26 + i}`,
        lunch: i < 4 ? meals[i * 2] : null,
        dinner: i < 4 ? meals[i * 2 + 1] : null,
      })),
    },
  ],
  weights: [
    { id: "w1", date: "2026-10-01", value: 187.2, unit: "lb" },
    { id: "w2", date: "2026-10-05", value: 186.8, unit: "lb" },
    { id: "w3", date: "2026-10-09", value: 187.0, unit: "lb" },
    { id: "w4", date: "2026-10-13", value: 186.1, unit: "lb" },
    { id: "w5", date: "2026-10-17", value: 186.4, unit: "lb" },
    { id: "w6", date: "2026-10-21", value: 185.6, unit: "lb" },
  ],
  journal: [],
  documents: [],
  recipes: demoRecipes,
  ingredients: demoIngredients,
  slots: [],
  preferences: defaultUnits,
};
export const emptyData: WorkspaceData = {
  plans: [],
  weights: [],
  journal: [],
  documents: [],
  recipes: [],
  ingredients: [],
  slots: [],
  preferences: defaultUnits,
};
