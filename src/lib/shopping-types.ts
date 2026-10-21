import type { Ingredient, MealSlot, PantryItem, PantryLocation, Quantity, Recipe, WorkspaceData } from "./types";
import type { Aisle } from "./grocery-aisles";

export type GrocerCategory = Aisle | "beef" | "pork" | "poultry";
export type Grocer = {
  id: string; name: string; url: string; fulfillment: "delivery" | "pickup"; favorite: boolean;
  categories?: GrocerCategory[];
};
export type PurchaseLine = {
  id?: string; ingredientId: string | null; name?: string;
  quantity: Quantity; location: PantryLocation;
  purchaseLabel?: string; priceCents?: number;
};
export type DeliveryWindow = { start: string; end: string; timeZone: "America/Toronto" };
export type Purchase = {
  id: string; mode: "store" | "online"; grocer: string; expectedDate: string;
  fulfillment: "delivery" | "pickup"; status: "pending" | "received" | "cancelled";
  lines: PurchaseLine[]; received?: PurchaseLine[]; createdAt: string; receivedAt?: string;
  deliveryWindow?: DeliveryWindow;
};
export type CookedMeal = {
  id: string; meal: MealSlot; portions: number; at: string; undone?: boolean;
  deductions: { item: PantryItem; amount: number }[];
  missing: { ingredientId: string; quantity: Quantity }[];
};
export type ShoppingState = {
  grocers: Grocer[]; orders: Purchase[]; cooked: CookedMeal[];
  range?: { start: string; end: string };
  selections: Record<string, string[]>;
  postalCode?: string;
  thawed?: string[];
};
export type ShoppingWorkspace = WorkspaceData & { shopping?: ShoppingState };
export type ShoppingCatalog = { recipes: Recipe[]; ingredients: Ingredient[] };
export type ShoppingPersonal = Pick<ShoppingWorkspace, "pantry" | "slots" | "groceryChecks" | "shopping">;
