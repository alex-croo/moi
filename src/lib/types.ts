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
};
