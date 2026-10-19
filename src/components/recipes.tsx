"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Plate } from "./plate";
import type {
  Ingredient,
  MealSlot,
  Recipe,
  UnitPreferences,
} from "@/lib/types";
import type { Locale } from "@/lib/locale";
import {
  addDays,
  instructionText,
  localToday,
  monday,
  quantityLabel,
  recipeNutrition,
} from "@/lib/units";

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
}: {
  recipes: Recipe[];
  locale: Locale;
  onOpen: (r: Recipe) => void;
  onChoose?: (r: Recipe) => void;
}) {
  const [query, setQuery] = useState("");
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
            "Adaptation indépendante de vos fiches DIY. Photos de la recette source HelloFresh.",
            "Independent adaptation of your DIY recipe cards. Photos from the original HelloFresh recipe.",
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
  recipes,
  ingredients,
  slots,
  locale,
  onSave,
  onOpen,
  full = false,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  slots: MealSlot[];
  locale: Locale;
  onSave: (value: {
    date: string;
    slot: "lunch" | "dinner";
    recipeId: string | null;
  }) => Promise<void>;
  onOpen: (r: Recipe) => void;
  full?: boolean;
}) {
  const [week, setWeek] = useState(() => monday(localToday()));
  const [pick, setPick] = useState<{
    date: string;
    slot: "lunch" | "dinner";
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
          const meal = (slot: "lunch" | "dinner") => {
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
                }
              : null;
          };
          return { date: d, lunch: meal("lunch"), dinner: meal("dinner") };
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
          <button className="text-button" onClick={() => void exportWeek()}>
            <ArrowDownToLine size={16} />
            {t("Exporter en PDF", "Export PDF")}
          </button>
        )}
      </div>
      <div className="week-navigation">
        <button
          className="icon-button"
          aria-label={t("Semaine précédente", "Previous week")}
          onClick={() => setWeek(addDays(week, -7))}
        >
          <ChevronLeft size={18} />
        </button>
        <strong>
          {date(week, { day: "numeric", month: "short" })} —{" "}
          {date(addDays(week, 6), {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </strong>
        <button
          className="icon-button"
          aria-label={t("Semaine suivante", "Next week")}
          onClick={() => setWeek(addDays(week, 7))}
        >
          <ChevronRight size={18} />
        </button>
        <button
          className="text-button"
          onClick={() => setWeek(monday(localToday()))}
        >
          {t("Aujourd’hui", "Today")}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="week-grid">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(week, i);
          return (
            <article
              className={`week-day ${d === localToday() ? "is-today" : ""}`}
              key={d}
            >
              <header>
                <span>{date(d, { weekday: "long" })}</span>
                <strong>{date(d, { day: "numeric" })}</strong>
              </header>
              {(["lunch", "dinner"] as const).map((slot) => {
                const r = recipes.find(
                  (r) =>
                    r.id ===
                    slots.find((s) => s.date === d && s.slot === slot)
                      ?.recipeId,
                );
                const macros = r && recipeNutrition(r, ingredients);
                const label = t(
                  slot === "lunch" ? "Dîner" : "Souper",
                  slot === "lunch" ? "Lunch" : "Dinner",
                );
                return (
                  <div className="planner-slot" key={slot}>
                    <span className="eyebrow">{label}</span>
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
                            onClick={() => {
                              setError("");
                              setPick({ date: d, slot });
                            }}
                          >
                            {t("Changer", "Change")}
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void choose(null, { date: d, slot })}
                            aria-label={`${t("Retirer", "Remove")} ${label} ${d}`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        className="empty-slot"
                        onClick={() => {
                          setError("");
                          setPick({ date: d, slot });
                        }}
                        aria-label={`${t("Choisir", "Choose")} ${label} ${d}`}
                      >
                        <Plus size={20} />
                        <span>{t("Choisir un repas", "Choose a meal")}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>
      <p className="planner-footnote">
        {t(
          "Deux repas à composer, sept jours à votre rythme. Les calories sont estimées pour une portion.",
          "Two meals to plan, seven days at your pace. Calories are estimated per serving.",
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
