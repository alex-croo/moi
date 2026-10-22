"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, List, Maximize, X } from "lucide-react";
import type { Recipe, Ingredient, UnitPreferences } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { instructionText, quantityLabel } from "@/lib/units";

export function CookingMode({ recipe, ingredients, units, locale, onClose }: {
  recipe: Recipe; ingredients: Ingredient[]; units: UnitPreferences; locale: Locale; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ownsFullscreen = useRef(false);
  const [index, setIndex] = useState(0), [showIngredients, setShowIngredients] = useState(false);
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const step = recipe.steps[index];
  useEffect(() => { const node = dialog.current; node?.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; node?.close(); if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  }, []);
  function close() { onClose(); }
  return <dialog ref={dialog} className="cooking-mode" aria-labelledby="cooking-title" onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => {
    if ((event.target as HTMLElement).closest("input,textarea,select")) return;
    if (event.key === "ArrowRight") { event.preventDefault(); setIndex(i => Math.min(i + 1, recipe.steps.length - 1)); }
    if (event.key === "ArrowLeft") { event.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
  }}>
    <header><div><span className="eyebrow">{t("MODE CUISINE", "COOKING MODE")}</span><h1 id="cooking-title">{locale === "fr" ? recipe.title : recipe.titleEn}</h1></div>
      <div className="cooking-tools"><button className="secondary" aria-expanded={showIngredients} onClick={() => setShowIngredients(v => !v)}><List size={18}/>{t("Ingrédients", "Ingredients")}</button>
      <button className="icon-button" aria-label={t("Plein écran", "Full screen")} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void document.documentElement.requestFullscreen?.().then(() => { ownsFullscreen.current = true; }).catch(() => {}); }}><Maximize size={19}/></button>
      <button autoFocus className="icon-button" aria-label={t("Quitter le mode cuisine", "Exit cooking mode")} onClick={close}><X/></button></div>
    </header>
    <div className={`cooking-content ${showIngredients ? "with-ingredients" : ""}`}>
      {showIngredients && <aside className="cooking-ingredients"><h2>{t("À portée de main", "Within reach")}</h2><p>{recipe.servings} portions</p><ul>{recipe.ingredients.map((line, i) => { const item = ingredients.find(x => x.id === line.ingredientId); return <li key={i}><span>{item ? locale === "fr" ? item.name : item.nameEn : line.ingredientId}{line.optional ? t(" (facultatif)", " (optional)") : ""}</span><strong>{quantityLabel(line.quantity, units, locale)}</strong></li>; })}</ul></aside>}
      {step ? <article className="cooking-step" aria-live="polite" aria-atomic="true">
        {step.image && <img src={step.image} alt={locale === "fr" ? step.title : step.titleEn}/>}
        <div><span className="cooking-step-number">{t("Étape", "Step")} {index + 1} / {recipe.steps.length}</span><h2>{locale === "fr" ? step.title : step.titleEn}</h2><p>{instructionText(locale === "fr" ? step.text : step.textEn, units, locale)}</p></div>
      </article> : <p>{t("Les étapes de cette recette ne sont pas encore disponibles.", "Steps for this recipe are not available yet.")}</p>}
    </div>
    <footer><button className="secondary" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ArrowLeft size={18}/>{t("Précédente", "Previous")}</button><progress aria-label={t("Progression de la recette", "Recipe progress")} value={index + 1} max={Math.max(1, recipe.steps.length)}/>{index < recipe.steps.length - 1 ? <button className="primary" onClick={() => setIndex(i => i + 1)}>{t("Suivante", "Next")}<ArrowRight size={18}/></button> : <button className="primary" onClick={close}>{t("Terminer la lecture", "Finish reading")}<Check size={18}/></button>}</footer>
  </dialog>;
}
