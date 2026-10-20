"use client";
import { useState } from "react";
import {
  ArrowRight,
  Copy,
  ShoppingBasket,
  PackageCheck,
} from "lucide-react";
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
      <div className="grocery-heading">
        <div className="page-heading">
          <h1>{t("Ma liste d’épicerie.", "My grocery list.")}</h1>
          <p>
            {t(
              "Les ingrédients de votre semaine, vos réserves déjà déduites.",
              "This week’s ingredients, with your pantry already deducted.",
            )}
          </p>
        </div>
        <div className="grocery-actions">
          <button className="secondary" onClick={onPantry}>
            <PackageCheck size={17} />
            {t("Voir mes réserves", "View my pantry")}
          </button>
          <button className="text-button" onClick={onPlan}>
            {t("Voir les repas", "View meals")}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <div className="grocery-controls">
        <div className="grocery-week">
          <WeekNavigation
            week={week}
            locale={locale}
            onChange={(value) => {
              setStatus("");
              setError("");
              onWeekChange(value);
            }}
          />
        </div>
        <div className="grocery-toolbar">
          <label className="grocery-optional">
            <input
              type="checkbox"
              aria-label={t(
                "Afficher les aliments déjà prêts",
                "Show foods already ready",
              )}
              aria-describedby="grocery-ready-help"
              checked={showReady}
              onChange={(e) => setShowReady(e.target.checked)}
            />
            <span>
              <strong>
                {t(
                  "Déjà prêts",
                  "Already ready",
                )}
              </strong>
              <small id="grocery-ready-help">
                {t(
                  "Ce que vous avez à la maison ou déjà acheté.",
                  "What you have at home or have already bought.",
                )}
              </small>
            </span>
          </label>
          <label className="grocery-optional">
            <input
              type="checkbox"
              aria-label={t(
                "Inclure les ingrédients facultatifs",
                "Include optional ingredients",
              )}
              aria-describedby="grocery-optional-help"
              checked={includeOptional}
              onChange={(e) => {
                setIncludeOptional(e.target.checked);
                setStatus("");
              }}
            />
            <span>
              <strong>
                {t(
                  "Ingrédients facultatifs",
                  "Optional ingredients",
                )}
              </strong>
              <small id="grocery-optional-help">
                {t(
                  "Les petits extras proposés dans vos recettes.",
                  "The little extras suggested in your recipes.",
                )}
              </small>
            </span>
          </label>
        </div>
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
            <div className="grocery-summary-title">
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
            </div>
            <button className="secondary" onClick={() => void copy()}>
              <Copy size={16} />
              {t("Copier la liste", "Copy list")}
            </button>
          </header>
          <div className="grocery-progress">
            <span>
              <strong>{items.length - ready}</strong> {t("à acheter", "to buy")}
              <span className="grocery-progress-separator">·</span>
              {ready} / {items.length} {t("déjà prêts", "already ready")}
            </span>
            <progress
              max={items.length}
              value={ready}
              aria-label={t("Ingrédients prêts", "Ingredients ready")}
            />
          </div>
          {!visibleItems.length && (
            <p className="grocery-all-ready" role="status">
              {t(
                "Tout est prêt pour les repas prévus cette semaine.",
                "Everything is ready for this week’s planned meals.",
              )}
            </p>
          )}
          {visibleItems.length > 0 && (
            <div className="grocery-column-headings" aria-hidden="true">
              <span>{t("Ingrédient", "Ingredient")}</span>
              <span>{t("Pour ces recettes", "For these recipes")}</span>
              <span>{t("À acheter", "To buy")}</span>
            </div>
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
                  id={`grocery-${item.ingredient.id}`}
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
                  <h3>
                    <label htmlFor={`grocery-${item.ingredient.id}`}>
                      {name(item.ingredient)}
                    </label>
                  </h3>
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
                </div>
                <ul
                  className="grocery-recipes"
                  aria-label={t("Pour ces recettes", "For these recipes")}
                >
                  {item.uses.map(({ recipe, meals: uses }) => (
                    <li key={recipe.id}>
                      <button onClick={() => onOpen(recipe)}>
                        <span>{locale === "fr" ? recipe.title : recipe.titleEn}</span>
                        {uses > 1 && <span className="grocery-recipe-count">× {uses}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
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
          <details className="grocery-help">
            <summary>
              {t(
                "Comment les quantités sont-elles calculées?",
                "How are quantities calculated?",
              )}
            </summary>
            <p>
              {t(
                "Les quantités couvrent les portions de chaque recette; un repas répété est compté à nouveau. Vos réserves sont déduites sans être modifiées. Une réserve sans quantité ou mesurée autrement reste à vérifier. Vos achats cochés sont enregistrés pour la semaine.",
                "Quantities cover each recipe’s servings; a repeated meal is counted again. Pantry quantities are deducted without changing your stock. Stock without a quantity or with a different measure needs checking. Checked purchases are saved for the week.",
              )}
            </p>
          </details>
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
        <div className="grocery-empty grocery-empty-planner">
          <div className="grocery-empty-icon">
            <ShoppingBasket size={40} strokeWidth={1.3} />
          </div>
          <div className="grocery-empty-copy">
            <span className="eyebrow">
              {t("UNE SEMAINE À COMPOSER", "A WEEK TO MAKE YOUR OWN")}
            </span>
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
            <div className="grocery-empty-note">
              <PackageCheck size={16} />
              <span>
                {t(
                  "Vos réserves à la maison seront prises en compte.",
                  "Your pantry at home will be taken into account.",
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
