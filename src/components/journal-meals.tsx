"use client";

import { useRef, useState } from "react";
import { Utensils } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { MealSlot, Recipe } from "@/lib/types";
import type { ShoppingWorkspace } from "@/lib/shopping-types";
import { mealKey, shoppingState } from "@/lib/shopping";
import { mealLabel, mealTimes } from "@/lib/planner";
import { RecipeImage } from "./recipes";

export function JournalMeals({ data, date, locale, onCook, onUndo, onOpen, onPlan, widget = false }: {
  widget?: boolean;
  data: ShoppingWorkspace;
  date: string;
  locale: Locale;
  onCook: (meal: MealSlot) => void;
  onUndo: (id: string) => Promise<void>;
  onOpen: (recipe: Recipe) => void;
  onPlan: () => void;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const meals = data.slots.filter(meal => meal.date === date)
    .sort((a, b) => mealTimes.indexOf(a.slot) - mealTimes.indexOf(b.slot));
  const cooked = shoppingState(data).cooked.filter(c => !c.undone);
  const completed = meals.filter(meal => cooked.some(c => mealKey(c.meal) === mealKey(meal))).length;
  const flight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  async function undo(id: string) {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(""); setStatus("");
    try { await onUndo(id); setStatus(t("Préparation annulée. Les quantités retirées sont rétablies dans vos réserves.", "Cooking undone. Deducted quantities have been restored to your pantry.")); }
    catch { setError(t("La préparation n’a pas pu être annulée. Réessayez ou rechargez si vos réserves ont changé dans une autre page.", "Cooking could not be undone. Retry or reload if your pantry changed in another page.")); }
    finally { flight.current = false; setBusy(false); }
  }
  return <section className={`journal-meals${widget ? " journal-widget journal-meals-widget" : ""}`} aria-label={t("Repas du journal", "Journal meals")}>
    <header><h2><Utensils size={16}/>{widget ? t("Mes recettes du jour", "My recipes today") : t("Mes repas du jour", "My meals today")}{meals.length > 0 && <span>{completed}/{meals.length}</span>}</h2><button className="text-button" onClick={onPlan}>{t("Voir mon menu", "View my menu")}</button></header>
    {meals.length ? <>
      {!widget && <p>{t("Cochez « Fait » après avoir cuisiné, puis confirmez les portions pour déduire les ingrédients de vos réserves. Décochez pour annuler.", "Check ‘Done’ after cooking, then confirm the servings to deduct ingredients from your pantry. Uncheck to undo.")}</p>}
      <ul>{meals.map(meal => {
        const recipe = data.recipes.find(r => r.id === meal.recipeId);
        const done = cooked.find(c => mealKey(c.meal) === mealKey(meal));
        const title = recipe ? (locale === "fr" ? recipe.title : recipe.titleEn) : t("Recette indisponible", "Recipe unavailable");
        return <li key={mealKey(meal)} className={done ? "is-cooked" : ""}>
          {widget && recipe && <button className="journal-meal-thumbnail" aria-label={`${t("Ouvrir la recette", "Open recipe")} · ${title}`} onClick={() => onOpen(recipe)}><RecipeImage recipe={recipe} alt=""/></button>}
          <span className="journal-meal-time">{mealLabel(meal.slot, locale)}</span>
          <div className="journal-meal-recipe"><button disabled={!recipe} onClick={() => recipe && onOpen(recipe)}>{title}</button>{done && <small>{done.portions.toLocaleString(locale)} {t("portions préparées · réserves mises à jour", "servings prepared · pantry updated")}</small>}</div>
          <label className="journal-meal-check"><input type="checkbox" checked={!!done} disabled={busy || (!done && !recipe)} aria-label={`${t("Fait", "Done")} · ${mealLabel(meal.slot, locale)} · ${title}`} onChange={() => {
            if (done) void undo(done.id);
            else { setError(""); setStatus(""); onCook(meal); }
          }}/><span>{t("Fait", "Done")}</span></label>
        </li>;
      })}</ul>
    </> : <p>{t("Aucun repas prévu pour cette journée. Retrouvez vos recettes dans votre menu pour les ajouter.", "No meals planned for this day. Open your menu to add recipes.")}</p>}
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
  </section>;
}
