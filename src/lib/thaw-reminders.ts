import type { ShoppingCatalog, ShoppingPersonal } from "./shopping-types";
import type { Quantity } from "./types";
import { mealHours, mealKey, shoppingNeeds } from "./shopping";

// Fixed meal landmarks in the account's current planning timezone; Intl handles DST.
export function mealInstant(date: string, time: string) {
  const wall = Date.parse(`${date}T${time}:00Z`);
  let instant = wall;
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(format.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const displayed = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    instant += wall - displayed;
  }
  return instant;
}
export type ThawReminder = { id: string; itemId: string; ingredientId: string; quantity: Quantity; recipeId: string; meal: ShoppingPersonal["slots"][number]; mealAt: number; dueAt: number };
export function thawReminders(data: ShoppingPersonal, catalog: ShoppingCatalog, now = Date.now()) {
  const end = data.slots.reduce((max, slot) => slot.date > max ? slot.date : max, "0000-01-01");
  const reports = shoppingNeeds(data, catalog, "0000-01-01", end).availability;
  const reminders = new Map<string, ThawReminder>();
  for (const report of Object.values(reports)) {
    const mealAt = mealInstant(report.meal.date, mealHours[report.meal.slot]);
    if (mealAt <= now) continue;
    for (const frozen of report.frozen) {
      const id = `${mealKey(report.meal)}:${frozen.itemId}`, existing = reminders.get(id);
      if (existing) existing.quantity.value += frozen.quantity.value;
      else reminders.set(id, { ...frozen, id, recipeId: report.meal.recipeId, meal: report.meal, mealAt, dueAt: mealAt - 24 * 60 * 60 * 1000 });
    }
  }
  return [...reminders.values()].sort((a,b) => a.mealAt - b.mealAt);
}
