"use client";
import { recipeCookingIngredients, linkedPreparations, type SpiceBlend } from "@/lib/spice-blends";
import { recipePreparations } from "@/lib/recipe-preparations";
import { useText, useContentTranslation, TranslationStatus } from "./locale-provider";

import { L } from "@/components/locale-provider";
import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChefHat,
  Clock3,
  Plus,
  Search,
  ShoppingBasket,
  X,
} from "lucide-react";
import { defaultRecipeTags, mergeRecipeTags, matchesRecipe, recipeTagIds, type RecipeTag } from "@/lib/recipe-tags";
import { AppSelect } from "./app-select";
import { CookingMode } from "./cooking-mode";
import { Plate } from "./plate";
import { WeekNavigation } from "./week-navigation";
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
  const t=useText();
  const src = image || recipe?.image;
  return src ? (
    <img src={src} alt={alt || t(recipe?.title,recipe?.titleEn) || ""} loading="lazy" />
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
  const t = useText(locale);
  const [vocabulary, setVocabulary] = useState<RecipeTag[]>(defaultRecipeTags);
  const [diet, setDiet] = useState(""), [type, setType] = useState(""), [tags, setTags] = useState<string[]>([]);
  useEffect(() => { let alive = true; fetch("/api/recipes/tags").then(async r => { if (r.ok) { const data = await r.json(); if (alive) setVocabulary(mergeRecipeTags(data.tags)); } }).catch(() => {}); return () => { alive = false; }; }, []);
  const filtered = recipes.filter(recipe => matchesRecipe(recipe, { query: "", diet, type, tags }, vocabulary) && (!query || `${t(recipe.title,recipe.titleEn)} ${t(recipe.subtitle,recipe.subtitleEn)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase())));
  const filteredActive = !!(query || diet || type || tags.length);
  const label = (tag: RecipeTag) => t(tag.label, tag.label_en);
  return (
    <>
      <div className="recipe-filter-bar"><label className="recipe-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Trouver une recette…", "Find a recipe…")}
          aria-label={t("Rechercher une recette", "Search recipes")}
        />
      </label>
      <label className="recipe-filter"><span>{t("Régime alimentaire", "Diet")}</span><AppSelect aria-label={t("Régime alimentaire", "Diet")} value={diet} onChange={e => setDiet(e.target.value)}><option value="">{t("Tous les régimes", "All diets")}</option>{vocabulary.filter(tag => tag.category === "diet").map(tag => <option key={tag.id} value={tag.id}>{label(tag)}</option>)}</AppSelect></label>
      <label className="recipe-filter"><span>{t("Type de plat", "Recipe type")}</span><AppSelect aria-label={t("Type de plat", "Recipe type")} value={type} onChange={e => setType(e.target.value)}><option value="">{t("Tous les plats", "All types")}</option>{vocabulary.filter(tag => tag.category === "type").map(tag => <option key={tag.id} value={tag.id}>{label(tag)}</option>)}</AppSelect></label></div>
      <div className="recipe-filter-tags" aria-label="Tags">{vocabulary.filter(tag => tag.category === "tag").map(tag => <button key={tag.id} className="recipe-tag" aria-pressed={tags.includes(tag.id)} onClick={() => setTags(current => current.includes(tag.id) ? current.filter(id => id !== tag.id) : [...current, tag.id])}>{label(tag)}</button>)}</div>
      <div className="recipe-filter-summary"><span role="status">{filtered.length} {t("recettes à découvrir", "recipes to explore")}</span>{filteredActive && <button className="text-button" onClick={() => { setQuery(""); setDiet(""); setType(""); setTags([]); }}>{t("Effacer les filtres", "Clear filters")}</button>}</div>
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
                <span className="recipe-card-tags">{vocabulary.filter(tag => tag.category === "type" && tag.id !== "main" && recipeTagIds(recipe).includes(tag.id)).slice(0,1).map(tag => <span className="recipe-tag" key={tag.id}>{label(tag)}</span>)}</span>
                <h3>{t(recipe.title, recipe.titleEn)}</h3>
                <p>{t(recipe.subtitle, recipe.subtitleEn)}</p>
                <span className="recipe-meta">
                  <Clock3 size={14} />
                  {recipe.minutes} <L text={" min · "} />{recipe.servings} <L text={" portions"} /></span>
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
  onPrepare,
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  units: UnitPreferences;
  locale: Locale;
  onClose: () => void;
  onPrepare?: (blend:SpiceBlend,volumeMl:number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const servings = recipe.servings;
  const [cookingMode, setCookingMode] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const translation=useContentTranslation("recipe",recipe.id);
  const t = useText(locale);
  const nutrition = recipeNutrition(recipe, ingredients);
  const factor = servings / recipe.servings;
  const linked = linkedPreparations(recipe,ingredients);
  const displayIngredients = recipeCookingIngredients(recipe,ingredients);
  return (
    <dialog
      ref={dialog}
      className="recipe-sheet"
      onCancel={onClose}
      aria-labelledby="recipe-title"
    >
      {cookingMode && <CookingMode recipe={recipe} ingredients={ingredients} units={units} locale={locale} onPrepare={onPrepare} onClose={() => setCookingMode(false)}/>}
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
      <TranslationStatus {...translation}/><header className="sheet-heading">
        <span className="eyebrow">
          {t("LE PLAISIR DE CUISINER CHEZ SOI", "THE JOY OF HOME COOKING")}
        </span>
        <h1 id="recipe-title">
          {t(recipe.title, recipe.titleEn)}
        </h1>
        <p>{t(recipe.subtitle, recipe.subtitleEn)}</p>
      </header>
      <div className="sheet-hero">
        <RecipeImage recipe={recipe} />
      </div>
      <div className="sheet-strip">
        <button className="primary" onClick={() => setCookingMode(true)}><ChefHat size={18}/>{t("Mode cuisine", "Cooking mode")}</button>
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
              {displayIngredients.map((line, i) => {
                const ingredient = ingredients.find(
                  (x) => x.id === line.ingredientId,
                );
                return (
                  <li key={i}>
                    <span>
                      {ingredient
                        ? t(ingredient.name, ingredient.nameEn)
                        : line.ingredientId}
                      {line.optional ? t(" (facultatif)", " (optional)") : ""}
                      <small>
                        {line.note
                          ? instructionText(t(line.note), units, locale, factor, recipe)
                          : ""}
                      </small>
                    </span>
                    <strong>
                      {quantityLabel(line.quantity, units, locale, factor, t)}
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
                        {nutrition[k].toLocaleString(intlLocale(locale), {
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
                      {t(item.name, item.nameEn)} · {item.sourceLabel}
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
        {recipePreparations(recipe).length>0&&<section className="recipe-homemade" aria-label={t("Mes mélanges Tred’meal","My Tred’meal blends")}>
          <h2>{t("Mes mélanges Tred’meal","My Tred’meal blends")}</h2>
          <p>{t("Préparez une double dose : une pour ce repas, l’autre à garder. Si votre mélange est déjà prêt, utilisez seulement la dose indiquée dans les ingrédients.","Prepare a double batch: one for this meal, one to keep. If your blend is already prepared, use only the amount shown in the ingredients.")}</p>
          <div>{recipePreparations(recipe).map(prep=>{const item=linked.find(l=>l.preparation.id===prep.id);return <article key={prep.id}><h3>{item?t(item.blend.name,item.blend.nameEn):t(prep.title,prep.titleEn)}</h3>{item&&<p className="blend-recipe-yield"><strong>{quantityLabel({kind:"spoon",value:item.volumeMl*2},units,locale,factor,t)}</strong> · {t("la moitié pour ce repas, la moitié en réserve","half for this meal, half for your pantry")}</p>}<ul>{prep.ingredients.map((line,i)=>{const ingredient=ingredients.find(x=>x.id===line.ingredientId);return <li key={i}><span>{ingredient?t(ingredient.name,ingredient.nameEn):line.ingredientId}</span><strong>{quantityLabel(line.quantity,units,locale,factor*(item?2:1),t)}</strong></li>})}</ul>{item&&onPrepare&&<button className="secondary" onClick={()=>onPrepare(item.blend,item.volumeMl*factor*2)}>{t("Préparer et mettre en réserve","Prepare and add to pantry")}</button>}</article>;})}</div>
        </section>}
        {recipe.note && (
          <p className="recipe-note">
            {instructionText(
              t(recipe.note, recipe.noteEn || recipe.note),
              units,
              locale,
              factor, recipe,
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
                {step.image && <div className="step-image">
                  <RecipeImage
                    image={step.image}
                    alt={t(step.title, step.titleEn)}
                  />
                </div>}
                <h3>
                  <span>{i + 1}</span>
                  {t(step.title, step.titleEn)}
                </h3>
                <p>
                  {instructionText(
                    t(step.text, step.textEn),
                    units,
                    locale,
                    factor, recipe,
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
            {t("Source de la recette", "Recipe source")}
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
  const t = useText(locale);
  const date = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(
      intlLocale(locale),
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
            <button className="text-button" onClick={onGroceries}>
              <ShoppingBasket size={16} />
              {t("Liste d’épicerie", "Grocery list")}
            </button>
          </div>
        )}
      </div>
      <WeekNavigation week={week} locale={locale} onChange={onWeekChange} />
      {error && <p role="alert">{t(error)}</p>}
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
                            {t(r.title, r.titleEn)}
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
                      : `≈ ${Math.round(total.kcal).toLocaleString(intlLocale(locale))} kcal`}
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
        {error && <p role="alert">{t(error)}</p>}
      </dialog>
    </section>
  );
}
