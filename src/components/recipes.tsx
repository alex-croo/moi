"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  Clock3,
  Plus,
  Search,
  ShoppingBasket,
  X,
} from "lucide-react";
import { Plate } from "./plate";
import { WeekNavigation } from "./week-navigation";
import { RecipeExport } from "./recipe-export";
import type {
  Ingredient,
  MealSlot,
  MealTime,
  Recipe,
  UnitPreferences,
} from "@/lib/types";
import type { Locale } from "@/lib/locale";
import {
  addDays,
  instructionText,
  localToday,
  quantityLabel,
  recipeNutrition,
} from "@/lib/units";
import { mealTimes, mealLabel, dailyCalories } from "@/lib/planner";
import { MealAvailability } from "./meal-availability";
import { mealKey, type MealAvailability as Availability } from "@/lib/shopping";
import type { CookedMeal } from "@/lib/shopping-types";

export function RecipeImage({
  recipe,
  image,
  alt,
}: {
  recipe?: Recipe;
  image?: string;
  alt?: string;
}) {
  const src = image || recipe?.image;
  return src ? (
    <img src={src} alt={alt || recipe?.title || ""} loading="lazy" />
  ) : (
    <Plate kind="bowl" />
  );
}
export function RecipeLibrary({
  recipes,
  locale,
  onOpen,
  onChoose,
  ingredients,
  units,
}: {
  recipes: Recipe[];
  locale: Locale;
  onOpen: (r: Recipe) => void;
  onChoose?: (r: Recipe) => void;
  ingredients?: Ingredient[];
  units?: UnitPreferences;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const filtered = recipes.filter((r) =>
    `${r.title} ${r.titleEn} ${r.subtitle}`
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .includes(
        query
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase(),
      ),
  );
  return (
    <>
      {!onChoose && ingredients && units && (
        <div className="recipe-export-toolbar">
          <button
            className="text-button"
            onClick={() =>
              setSelected(
                filtered.every((r) => selected.includes(r.id))
                  ? selected.filter((id) => !filtered.some((r) => r.id === id))
                  : [...new Set([...selected, ...filtered.map((r) => r.id)])],
              )
            }
          >
            {filtered.length > 0 &&
            filtered.every((r) => selected.includes(r.id))
              ? t("Désélectionner", "Clear selection")
              : t("Tout sélectionner", "Select all")}
          </button>
          <span>
            {selected.length} {t("recette(s) choisie(s)", "recipe(s) selected")}
          </span>
          <RecipeExport
            recipes={recipes.filter((r) => selected.includes(r.id))}
            ingredients={ingredients}
            units={units}
            locale={locale}
            label={t("Exporter la sélection en PDF", "Export selection as PDF")}
          />
        </div>
      )}
      <label className="recipe-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Trouver une recette…", "Find a recipe…")}
          aria-label={t("Rechercher une recette", "Search recipes")}
        />
      </label>
      {!recipes.length && (
        <div className="empty-state">
          <BookOpen />
          <h3>
            {t(
              "Votre livre de recettes prend forme.",
              "Your recipe book is taking shape.",
            )}
          </h3>
          <p>
            {t(
              "Les recettes préparées ensemble apparaîtront ici au fil des semaines.",
              "Recipes we prepare together will appear here over the weeks.",
            )}
          </p>
        </div>
      )}
      {!!recipes.length && !filtered.length && (
        <p>
          {t(
            "Aucune recette ne correspond à cette recherche.",
            "No recipes match your search.",
          )}
        </p>
      )}
      <div className="recipe-grid">
        {filtered.map((recipe) => (
          <article className="recipe-card" key={recipe.id}>
            {!onChoose && ingredients && units && (
              <label className="recipe-select">
                <input
                  type="checkbox"
                  checked={selected.includes(recipe.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, recipe.id]
                        : selected.filter((id) => id !== recipe.id),
                    )
                  }
                  aria-label={`${t("Sélectionner", "Select")} ${locale === "fr" ? recipe.title : recipe.titleEn}`}
                />
                {t("Garder pour mon PDF", "Include in my PDF")}
              </label>
            )}
            <button className="recipe-open" onClick={() => onOpen(recipe)}>
              <div className="recipe-cover">
                <RecipeImage recipe={recipe} />
              </div>
              <div className="recipe-card-copy">
                <span className="eyebrow">
                  {t("DANS MON CARNET", "IN MY RECIPE BOOK")}
                </span>
                <h3>{locale === "fr" ? recipe.title : recipe.titleEn}</h3>
                <p>{locale === "fr" ? recipe.subtitle : recipe.subtitleEn}</p>
                <span className="recipe-meta">
                  <Clock3 size={14} />
                  {recipe.minutes} min · {recipe.servings} portions
                </span>
              </div>
            </button>
            {onChoose && (
              <button className="secondary" onClick={() => onChoose(recipe)}>
                {t("Choisir cette recette", "Choose this recipe")}
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
export function RecipeSheet({
  recipe,
  ingredients,
  units,
  locale,
  onClose,
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  units: UnitPreferences;
  locale: Locale;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const servings = recipe.servings;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const nutrition = recipeNutrition(recipe, ingredients);
  const factor = servings / recipe.servings;
  return (
    <dialog
      ref={dialog}
      className="recipe-sheet"
      onCancel={onClose}
      aria-labelledby="recipe-title"
    >
      <div className="sheet-top">
        <span>
          <BookOpen size={17} /> {t("MON LIVRE DE RECETTES", "MY RECIPE BOOK")}
        </span>
        <RecipeExport
          recipes={[recipe]}
          ingredients={ingredients}
          units={units}
          locale={locale}
        />
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("Fermer la recette", "Close recipe")}
        >
          <X />
        </button>
      </div>
      <header className="sheet-heading">
        <span className="eyebrow">
          {t("LE PLAISIR DE CUISINER CHEZ SOI", "THE JOY OF HOME COOKING")}
        </span>
        <h1 id="recipe-title">
          {locale === "fr" ? recipe.title : recipe.titleEn}
        </h1>
        <p>{locale === "fr" ? recipe.subtitle : recipe.subtitleEn}</p>
      </header>
      <div className="sheet-hero">
        <RecipeImage recipe={recipe} />
      </div>
      <div className="sheet-strip">
        <span>
          <Clock3 size={17} />
          {recipe.minutes} min
        </span>
        <span>
          {servings} {t("portions", "servings")}
        </span>
        <span>{t("À cuisiner à votre rythme", "Cook at your own pace")}</span>
      </div>
      <div className="sheet-body">
        <div className="sheet-basics">
          <section>
            <h2>{t("Les ingrédients", "Ingredients")}</h2>
            <ul className="ingredient-list">
              {recipe.ingredients.map((line, i) => {
                const ingredient = ingredients.find(
                  (x) => x.id === line.ingredientId,
                );
                return (
                  <li key={i}>
                    <span>
                      {ingredient
                        ? locale === "fr"
                          ? ingredient.name
                          : ingredient.nameEn
                        : line.ingredientId}
                      {line.optional ? t(" (facultatif)", " (optional)") : ""}
                      <small>
                        {line.note
                          ? instructionText(line.note, units, locale, factor)
                          : ""}
                      </small>
                    </span>
                    <strong>
                      {quantityLabel(line.quantity, units, locale, factor)}
                    </strong>
                  </li>
                );
              })}
            </ul>
          </section>
          <aside className="nutrition-card">
            <span className="eyebrow">{t("PAR PORTION", "PER SERVING")}</span>
            <h2>{t("Dans votre assiette", "On your plate")}</h2>
            {nutrition ? (
              <>
                <strong className="nutrition-calories">
                  {Math.round(nutrition.kcal)} <small>kcal</small>
                </strong>
                <dl>
                  {(
                    [
                      ["protein", t("Protéines", "Protein")],
                      ["carbs", t("Glucides", "Carbs")],
                      ["fat", t("Lipides", "Fat")],
                    ] as const
                  ).map(([k, label]) => (
                    <div key={k}>
                      <dt>{label}</dt>
                      <dd>
                        {nutrition[k].toLocaleString(locale, {
                          maximumFractionDigits: 1,
                        })}{" "}
                        g
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>
                  {t(
                    "Estimation calculée à partir des ingrédients. Les produits de marque et les mesures à la cuillère utilisent des équivalents génériques; les valeurs réelles peuvent varier. Les ingrédients facultatifs sont exclus.",
                    "Estimate calculated from ingredients. Branded products and spoon measures use generic equivalents; actual values may vary. Optional ingredients are excluded.",
                  )}
                </p>
              </>
            ) : (
              <p>
                {t(
                  "Valeurs en attente de vérification.",
                  "Values awaiting verification.",
                )}
              </p>
            )}
            <details>
              <summary>
                {t("Sources et hypothèses", "Sources and assumptions")}
              </summary>
              {recipe.ingredients.map((line, i) => {
                const item = ingredients.find(
                  (x) => x.id === line.ingredientId,
                );
                return item ? (
                  <p key={i}>
                    <a
                      href={item.source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.name} · {item.sourceLabel}
                    </a>
                    <br />
                    {item.sourceDescription}
                    <br />
                    {Math.round(line.grams * factor * 10) / 10} g{" "}
                    {t("utilisés pour le calcul", "used in the calculation")}
                  </p>
                ) : null;
              })}
            </details>
          </aside>
        </div>
        {recipe.note && (
          <p className="recipe-note">
            {instructionText(
              locale === "fr" ? recipe.note : recipe.noteEn || recipe.note,
              units,
              locale,
              factor,
            )}
          </p>
        )}
        <section className="recipe-preparation">
          <span className="eyebrow">
            {t("UN GESTE À LA FOIS", "ONE STEP AT A TIME")}
          </span>
          <h2>{t("À vous de cuisiner", "Let's get cooking")}</h2>
          <div className="recipe-steps">
            {recipe.steps.map((step, i) => (
              <article key={i}>
                <div className="step-image">
                  <RecipeImage
                    image={step.image}
                    alt={locale === "fr" ? step.title : step.titleEn}
                  />
                </div>
                <h3>
                  <span>{i + 1}</span>
                  {locale === "fr" ? step.title : step.titleEn}
                </h3>
                <p>
                  {instructionText(
                    locale === "fr" ? step.text : step.textEn,
                    units,
                    locale,
                    factor,
                  )}
                </p>
              </article>
            ))}
          </div>
        </section>
        <footer className="recipe-source">
          {t(
            "Tred’meal · Mon livre de recettes.",
            "Tred’meal · My recipe book.",
          )}{" "}
          <a href={recipe.source} target="_blank" rel="noopener noreferrer">
            {t("Fiche d’origine dans Drive", "Original card in Drive")}
          </a>
        </footer>
      </div>
    </dialog>
  );
}
export function WeeklyPlanner({
  week,
  onWeekChange,
  onGroceries,
  recipes,
  ingredients,
  slots,
  units,
  locale,
  onSave,
  onOpen,
  full = false,
  cooked = [],
  availability = {},
  onCook,
  onUndoCook,
}: {
  week: string;
  onWeekChange: (week: string) => void;
  onGroceries: () => void;
  recipes: Recipe[];
  ingredients: Ingredient[];
  slots: MealSlot[];
  units: UnitPreferences;
  locale: Locale;
  onSave: (value: {
    date: string;
    slot: MealTime;
    recipeId: string | null;
  }) => Promise<void>;
  onOpen: (r: Recipe) => void;
  full?: boolean;
  cooked?: CookedMeal[];
  availability?: Record<string, Availability>;
  onCook?: (meal: MealSlot) => void;
  onUndoCook?: (id: string) => Promise<void>;
}) {
  const [pick, setPick] = useState<{
    date: string;
    slot: MealTime;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (pick) picker.current?.showModal();
    else picker.current?.close();
  }, [pick]);
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const date = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(
      locale === "fr" ? "fr-CA" : "en-CA",
      { ...opts, timeZone: "UTC" },
    );
  async function choose(recipeId: string | null, target = pick) {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      await onSave({ ...target, recipeId });
      setPick(null);
    } catch {
      setError(
        t(
          "Le repas n’a pas pu être enregistré. Réessayez.",
          "The meal could not be saved. Please retry.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportWeek() {
    const { exportMenu } = await import("@/lib/pdf");
    await exportMenu(
      {
        id: week,
        title: t("Ma semaine", "My week"),
        titleEn: "My week",
        startDate: week,
        days: Array.from({ length: 7 }, (_, i) => {
          const d = addDays(week, i);
          const meal = (slot: MealTime) => {
            const r = recipes.find(
              (r) =>
                r.id ===
                slots.find((s) => s.date === d && s.slot === slot)?.recipeId,
            );
            return r
              ? {
                  title: r.title,
                  titleEn: r.titleEn,
                  minutes: r.minutes,
                  portions: r.servings,
                  kind: "bowl" as const,
                  kcal: recipeNutrition(r, ingredients)?.kcal ?? null,
                }
              : null;
          };
          return {
            date: d,
            breakfast: meal("breakfast"),
            morning_snack: meal("morning_snack"),
            lunch: meal("lunch"),
            afternoon_snack: meal("afternoon_snack"),
            dinner: meal("dinner"),
            evening_snack: meal("evening_snack"),
          };
        }),
      },
      locale,
      false,
    );
  }
  return (
    <section className="weekly-planner">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {t("BIEN MANGER, SIMPLEMENT", "GOOD FOOD, SIMPLY")}
          </span>
          <h2>
            {t(
              "Cette semaine, à votre rythme.",
              "This week, at your own pace.",
            )}
          </h2>
        </div>
        {full && (
          <div className="planner-actions">
            <RecipeExport
              recipes={Array.from(
                new Set(
                  slots
                    .filter((s) => s.date >= week && s.date <= addDays(week, 6))
                    .map((s) => s.recipeId),
                ),
              )
                .map((id) => recipes.find((r) => r.id === id))
                .filter((r): r is Recipe => !!r)}
              ingredients={ingredients}
              units={units}
              locale={locale}
              label={t("Les recettes en PDF", "Recipes as PDF")}
            />
            <button className="text-button" onClick={onGroceries}>
              <ShoppingBasket size={16} />
              {t("Liste d’épicerie", "Grocery list")}
            </button>
            <button className="text-button" onClick={() => void exportWeek()}>
              <ArrowDownToLine size={16} />
              {t("Exporter en PDF", "Export PDF")}
            </button>
          </div>
        )}
      </div>
      <WeekNavigation week={week} locale={locale} onChange={onWeekChange} />
      {error && <p role="alert">{error}</p>}
      <div className="week-grid">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(week, i);
          const total = dailyCalories(d, slots, recipes, ingredients);
          return (
            <article
              className={`week-day ${d === localToday() ? "is-today" : ""}`}
              key={d}
              aria-label={date(d, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            >
              <header>
                <span>{date(d, { weekday: "long" })}</span>
                <strong>{date(d, { day: "numeric" })}</strong>
              </header>
              {mealTimes.map((slot) => {
                const r = recipes.find(
                  (r) =>
                    r.id ===
                    slots.find((s) => s.date === d && s.slot === slot)
                      ?.recipeId,
                );
                const macros = r && recipeNutrition(r, ingredients);
                const prepared = cooked.find(c => !c.undone && c.meal.date === d && c.meal.slot === slot && c.meal.recipeId === r?.id);
                const label = mealLabel(slot, locale);
                const snack = slot.endsWith("snack");
                return (
                  <div
                    className={`planner-slot ${snack ? "snack-slot" : ""}`}
                    key={slot}
                    data-meal={slot}
                  >
                    <div className="planner-slot-heading"><span className="eyebrow">{label}</span>{r && !prepared && availability[mealKey({ date: d, slot, recipeId: r.id })] && <MealAvailability availability={availability[mealKey({ date: d, slot, recipeId: r.id })]} ingredients={ingredients} units={units} locale={locale}/>}</div>
                    {r ? (
                      <>
                        <button
                          className="planned-recipe"
                          onClick={() => onOpen(r)}
                        >
                          <RecipeImage recipe={r} />
                          <strong>
                            {locale === "fr" ? r.title : r.titleEn}
                          </strong>
                          <small>
                            {r.minutes} min
                            {macros
                              ? ` · ≈ ${Math.round(macros.kcal)} kcal`
                              : ""}
                          </small>
                        </button>
                        <div className="slot-actions">
                          <button
                            disabled={busy || !!prepared}
                            onClick={() => {
                              setError("");
                              setPick({ date: d, slot });
                            }}
                          >
                            {t("Changer", "Change")}
                          </button>
                          <button
                            disabled={busy || !!prepared}
                            onClick={() => void choose(null, { date: d, slot })}
                            aria-label={`${t("Retirer", "Remove")} ${label} ${d}`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        {onCook && <div className="cook-slot-action">{prepared ? <><span>{t("Cuisiné", "Cooked")} · {prepared.portions} {t("portions", "servings")}</span><button disabled={busy} onClick={async () => {
                          if (!onUndoCook) return;
                          setBusy(true); setError("");
                          try { await onUndoCook(prepared.id); } catch { setError(t("L’annulation n’a pas été confirmée. Rechargez si votre espace a changé.", "Undo was not confirmed. Reload if your workspace changed.")); } finally { setBusy(false); }
                        }}>{t("Annuler la préparation", "Undo cooking")}</button></> : <button disabled={busy} onClick={() => onCook({ date: d, slot, recipeId: r.id })}>{t("J’ai cuisiné", "I cooked this")}</button>}</div>}
                      </>
                    ) : (
                      <button
                        className="empty-slot"
                        disabled={busy}
                        onClick={() => {
                          setError("");
                          setPick({ date: d, slot });
                        }}
                        aria-label={`${t("Choisir", "Choose")} ${label} ${d}`}
                      >
                        <Plus size={20} />
                        <span>
                          {snack
                            ? t("Une petite pause", "A little break")
                            : t("Choisir un repas", "Choose a meal")}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
              <footer className="day-total" aria-live="polite">
                <span>{t("Total de la journée", "Daily total")}</span>
                <strong>
                  {!total.meals
                    ? "—"
                    : total.missing
                      ? t("À compléter", "Incomplete")
                      : `≈ ${Math.round(total.kcal).toLocaleString(locale)} kcal`}
                </strong>
                <small>
                  {!total.meals
                    ? t("Selon vos choix", "Based on your choices")
                    : total.missing
                      ? t(
                          "Certaines valeurs manquent",
                          "Some values are missing",
                        )
                      : t("Une portion par recette", "One serving per recipe")}
                </small>
              </footer>
            </article>
          );
        })}
      </div>
      <p className="planner-footnote">
        {t(
          "Du déjeuner à la collation du soir, composez votre journée à votre rythme. Les totaux sont estimés pour une portion de chaque recette choisie; les moments laissés libres ne sont pas comptés. Votre liste d’épicerie se met à jour au fil de vos choix.",
          "From breakfast to an evening snack, plan your day at your own pace. Totals estimate one serving of each chosen recipe; empty moments are not counted. Your grocery list updates as you choose.",
        )}
      </p>
      <dialog
        ref={picker}
        className="recipe-picker"
        onCancel={() => setPick(null)}
        aria-labelledby="picker-title"
      >
        <div className="sheet-top">
          <h2 id="picker-title">
            {t("Qu’est-ce qui vous ferait plaisir?", "What would you enjoy?")}
          </h2>
          {pick && (
            <p>
              {mealLabel(pick.slot, locale)} ·{" "}
              {date(pick.date, {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </p>
          )}
          <button
            className="icon-button"
            onClick={() => setPick(null)}
            aria-label={t("Fermer le choix de recette", "Close recipe picker")}
          >
            <X />
          </button>
        </div>
        {busy ? (
          <p role="status">{t("Enregistrement…", "Saving…")}</p>
        ) : (
          <RecipeLibrary
            recipes={recipes}
            locale={locale}
            onOpen={onOpen}
            onChoose={(r) => void choose(r.id)}
          />
        )}{" "}
        {error && <p role="alert">{error}</p>}
      </dialog>
    </section>
  );
}
