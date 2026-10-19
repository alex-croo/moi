"use client";
import { useState } from "react";
import { ArrowRight, Copy, ShoppingBasket } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type {
  Ingredient,
  MealSlot,
  Recipe,
  UnitPreferences,
  PantryItem,
  GroceryCheck,
} from "@/lib/types";
import { pantryForIngredient, pantryLabel } from "@/lib/pantry";
import { weeklyGroceries, groceriesAfterPantry } from "@/lib/groceries";
import { quantityLabel, addDays } from "@/lib/units";
import { WeekNavigation } from "./week-navigation";

export function GroceryList({
  recipes,
  ingredients,
  slots,
  units,
  locale,
  week,
  onWeekChange,
  onPlan,
  onOpen,
  checks,
  pantry,
  onCheck,
  onPantry,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  slots: MealSlot[];
  units: UnitPreferences;
  locale: Locale;
  week: string;
  onWeekChange: (week: string) => void;
  onPlan: () => void;
  onOpen: (recipe: Recipe) => void;
  checks: GroceryCheck[];
  pantry: PantryItem[];
  onCheck: (check: GroceryCheck) => Promise<void>;
  onPantry: () => void;
}) {
  const [includeOptional, setIncludeOptional] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const {
    items: plannedItems,
    meals,
    missing,
  } = weeklyGroceries(recipes, ingredients, slots, week, includeOptional);
  const items = groceriesAfterPantry(plannedItems, pantry);
  const name = (ingredient: Ingredient) =>
    locale === "fr" ? ingredient.name : ingredient.nameEn;
  items.sort((a, b) =>
    name(a.ingredient).localeCompare(name(b.ingredient), locale),
  );
  const hasEstimates = items.some((item) => item.estimated);
  const isChecked = (id: string) =>
    checks.some((c) => c.week === week && c.ingredientId === id && c.checked);
  const isReady = (item: (typeof items)[number]) =>
    item.quantity.value === 0 || isChecked(item.ingredient.id);
  const ready = items.filter(isReady).length;
  const visibleItems = items.filter((item) => showReady || !isReady(item));
  async function toggle(ingredientId: string, checked: boolean) {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await onCheck({ week, ingredientId, checked });
      setStatus(
        t(
          "Votre liste est enregistrée pour cette semaine.",
          "Your list is saved for this week.",
        ),
      );
    } catch {
      setError(
        t(
          "La case n’a pas pu être enregistrée. Réessayez; votre liste reste inchangée.",
          "The checkbox could not be saved. Please retry; your list is unchanged.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        [
          t("Ma liste d’épicerie", "My grocery list"),
          `${week} — ${addDays(week, 6)}`,
          ...items
            .filter((item) => !isReady(item))
            .map(
              (item) =>
                `[ ] ${name(item.ingredient)} : ${item.estimated ? "≈ " : ""}${quantityLabel(item.quantity, units, locale)}${item.needsStockCheck ? t(" · Réserve à vérifier", " · Check pantry quantity") : ""}`,
            ),
          ...(hasEstimates
            ? [
                t(
                  "≈ Poids estimé à partir des quantités des recettes.",
                  "≈ Estimated weight based on the recipe quantities.",
                ),
              ]
            : []),
          ...(missing
            ? [
                t(
                  "Attention : liste incomplète, une recette ou un ingrédient est indisponible.",
                  "Warning: incomplete list, a recipe or ingredient is unavailable.",
                ),
              ]
            : []),
        ].join("\n"),
      );
      setStatus(t("Liste copiée.", "List copied."));
    } catch {
      setStatus(
        t(
          "La copie n’a pas abouti. Vous pouvez sélectionner le texte de la liste.",
          "Copy failed. You can select the list text instead.",
        ),
      );
    }
  }
  return (
    <section className="grocery-page">
      <div className="page-heading">
        <span className="eyebrow">
          {t("AVANT DE PASSER À TABLE", "BEFORE SITTING DOWN TO EAT")}
        </span>
        <h1>{t("Ma liste d’épicerie.", "My grocery list.")}</h1>
        <p>
          {t(
            "Tout ce qu’il faut pour les repas de votre semaine, rassemblé au même endroit.",
            "Everything you need for this week’s meals, gathered in one place.",
          )}
        </p>
      </div>
      <WeekNavigation
        week={week}
        locale={locale}
        onChange={(value) => {
          setStatus("");
          setError("");
          onWeekChange(value);
        }}
      />
      <div className="grocery-toolbar">
        <label className="grocery-optional">
          <input
            type="checkbox"
            checked={showReady}
            onChange={(e) => setShowReady(e.target.checked)}
          />
          {t("Afficher les aliments déjà prêts", "Show foods already ready")}
        </label>
        <button className="text-button" onClick={onPantry}>
          {t("Voir mes réserves", "View my pantry")}
        </button>
        <label className="grocery-optional">
          <input
            type="checkbox"
            checked={includeOptional}
            onChange={(e) => {
              setIncludeOptional(e.target.checked);
              setStatus("");
            }}
          />
          {t(
            "Inclure les ingrédients facultatifs",
            "Include optional ingredients",
          )}
        </label>
        <button className="text-button" onClick={onPlan}>
          {t("Voir les repas", "View meals")}
          <ArrowRight size={16} />
        </button>
        {items.length > 0 && (
          <button className="text-button" onClick={() => void copy()}>
            <Copy size={16} />
            {t("Copier la liste", "Copy list")}
          </button>
        )}
      </div>
      {status && (
        <p className="grocery-status" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {missing > 0 && (
        <p className="form-error" role="alert">
          {t(
            "La liste est incomplète : une recette ou un ingrédient du menu n’est plus disponible.",
            "This list is incomplete: a planned recipe or ingredient is no longer available.",
          )}
        </p>
      )}
      {items.length ? (
        <div className="grocery-paper">
          <header className="grocery-summary">
            <ShoppingBasket size={24} />
            <div>
              <h2>{t("Ce qu’il me manque", "What I still need")}</h2>
              <p>
                {meals}{" "}
                {t(
                  meals === 1 ? "repas prévu" : "repas prévus",
                  meals === 1 ? "planned meal" : "planned meals",
                )}{" "}
                · {items.length}{" "}
                {t(
                  items.length === 1 ? "ingrédient" : "ingrédients",
                  items.length === 1 ? "ingredient" : "ingredients",
                )}
              </p>
            </div>
          </header>
          <p className="grocery-explanation">
            {t(
              "Pour les portions prévues dans chaque recette. Chaque repas répété est compté à nouveau.",
              "For the servings specified in each recipe. Each repeated meal is counted again.",
            )}
          </p>
          <div className="grocery-progress">
            <span>
              {t("Déjà à la maison ou acheté", "Already at home or bought")} ·{" "}
              {ready} / {items.length}
            </span>
            <progress
              max={items.length}
              value={ready}
              aria-label={t("Ingrédients prêts", "Ingredients ready")}
            />
            <p>
              {t(
                "Vos réserves sont déduites des quantités à cuisiner. Cochez vos achats : ils seront gardés pour cette semaine. Une réserve sans quantité ou mesurée autrement reste à vérifier. Vos réserves ne sont pas modifiées par ce calcul.",
                "Pantry quantities are deducted from what you need to cook. Check off your purchases: they are saved for this week. Stock without a quantity or with a different measure needs checking. This calculation does not change your pantry.",
              )}
            </p>
          </div>
          {!visibleItems.length && (
            <p className="grocery-all-ready" role="status">
              {t(
                "Tout est prêt pour les repas prévus cette semaine.",
                "Everything is ready for this week’s planned meals.",
              )}
            </p>
          )}
          <ul
            className="grocery-items"
            aria-label={t("Ingrédients à acheter", "Ingredients to buy")}
          >
            {visibleItems.map((item) => (
              <li
                className={`grocery-item ${isChecked(item.ingredient.id) ? "grocery-checked" : ""}`}
                key={item.ingredient.id}
              >
                <input
                  className="grocery-check"
                  type="checkbox"
                  aria-label={`${t("Prêt pour la semaine", "Ready for the week")} : ${name(item.ingredient)}`}
                  checked={isChecked(item.ingredient.id)}
                  disabled={saving}
                  onChange={(e) =>
                    void toggle(item.ingredient.id, e.target.checked)
                  }
                />
                <div className="grocery-item-body">
                  <h3>{name(item.ingredient)}</h3>
                  {pantryForIngredient(pantry, item.ingredient.id).map((p) => (
                    <p className="pantry-badge" key={p.id}>
                      {t("Dans vos réserves", "In your pantry")} ·{" "}
                      {pantryLabel(p.location, locale)}
                      {p.quantity
                        ? ` · ${quantityLabel(p.quantity, units, locale)}`
                        : ""}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  ))}
                  {item.deducted > 0 && (
                    <p className="grocery-calculation">
                      {t("Pour cuisiner", "To cook")} :{" "}
                      {quantityLabel(item.required, units, locale)} ·{" "}
                      {t("Déduit des réserves", "Deducted from pantry")} :{" "}
                      {quantityLabel(
                        { ...item.required, value: item.deducted },
                        units,
                        locale,
                      )}
                    </p>
                  )}
                  {item.needsStockCheck && (
                    <p className="grocery-stock-warning">
                      {t(
                        "À vérifier dans vos réserves : indiquez une quantité avec la même mesure pour la déduire.",
                        "Check your pantry: enter a quantity using the same measure to deduct it.",
                      )}
                    </p>
                  )}
                  <details>
                    <summary>
                      {t("Voir les recettes", "View recipes")} (
                      {item.uses.length})
                    </summary>
                    <ul>
                      {item.uses.map(({ recipe, meals: uses }) => (
                        <li key={recipe.id}>
                          <button
                            className="text-button"
                            onClick={() => onOpen(recipe)}
                          >
                            {locale === "fr" ? recipe.title : recipe.titleEn}
                          </button>
                          <span> × {uses}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                <div className="grocery-quantity">
                  <strong>
                    {item.estimated ? "≈ " : ""}
                    {item.quantity.value === 0
                      ? t("Déjà à la maison", "Already at home")
                      : quantityLabel(item.quantity, units, locale)}
                  </strong>
                  {item.estimated && (
                    <small>{t("Poids estimé", "Estimated weight")}</small>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {hasEstimates && (
            <p className="grocery-explanation">
              {t(
                "≈ Certains ingrédients sont mesurés différemment d’une recette à l’autre. Leur total utilise les équivalents en poids estimés dans les fiches.",
                "≈ Some ingredients use different measures across recipes. Their totals use the estimated weight equivalents from the recipe cards.",
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="grocery-empty">
          <ShoppingBasket size={36} strokeWidth={1.3} />
          <h2>
            {t(
              "Votre épicerie commence par vos repas.",
              "Your groceries start with your meals.",
            )}
          </h2>
          <p>
            {t(
              "Choisissez des recettes pour cette semaine : les ingrédients s’ajouteront ici automatiquement.",
              "Choose recipes for this week and their ingredients will appear here automatically.",
            )}
          </p>
          <button className="primary" onClick={onPlan}>
            {t("Choisir mes repas", "Choose my meals")}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
