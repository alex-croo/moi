"use client";
import { useText } from "./locale-provider";

import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { MealSlot } from "@/lib/types";
import type { ShoppingWorkspace } from "@/lib/shopping-types";
import { shoppingState, mealKey, previewCooking, type ShoppingMutation } from "@/lib/shopping";
import { quantityLabel } from "@/lib/units";
import { pantryLabel } from "@/lib/pantry";
import { useShoppingDialog } from "./use-shopping-dialog";
export function CookMeal({ meal, data, locale, onSave, onClose }: { meal: MealSlot; data: ShoppingWorkspace; locale: Locale; onSave: (m: ShoppingMutation) => Promise<void>; onClose: () => void }) {
  const recipe = data.recipes.find(r => r.id === meal.recipeId)!;
  const t = useText(locale);
  const [portions, setPortions] = useState(shoppingState(data).portions?.[mealKey(meal)] || recipe.servings), [optional, setOptional] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dialog = useShoppingDialog(), id = useRef(crypto.randomUUID());
  const preview = previewCooking(data, data, meal, portions > 0 && portions <= 100 ? portions : recipe.servings, optional);
  async function save() {
    setBusy(true); setError("");
    try { await onSave({ action: "cook", id: id.current, meal, portions, includeOptional: optional }); onClose(); }
    catch { setError(t("La préparation n’a pas pu être confirmée. Réessayez ou rechargez si vos réserves ont changé dans une autre page.", "Cooking could not be confirmed. Retry or reload if your pantry changed in another page.")); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="shopping-dialog cook-dialog" aria-labelledby="cook-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}><header><h2 id="cook-title">{t("J’ai cuisiné", "I cooked this")}</h2><button className="icon-button" aria-label={t("Fermer", "Close")} disabled={busy} onClick={onClose}><X size={20}/></button></header>
    <form onSubmit={e => { e.preventDefault(); void save(); }}><p>{t(recipe.title, recipe.titleEn)}</p><div className="purchase-options"><label>{t("Portions préparées", "Servings prepared")}<input required type="number" min="0.5" max="100" step="0.5" value={Number.isNaN(portions) ? "" : portions} onChange={e => setPortions(e.target.valueAsNumber)}/></label><label className="shopping-checkbox"><input type="checkbox" checked={optional} onChange={e => setOptional(e.target.checked)}/>{t("J’ai utilisé les ingrédients facultatifs", "I used optional ingredients")}</label></div>
    <h3>{t("À retirer de mes réserves", "To deduct from my pantry")}</h3><ul className="cooking-deductions">{preview.deductions.map((d, i) => <li key={i}><span>{t(data.ingredients.find(x => x.id === d.item.ingredientId)?.name || "", data.ingredients.find(x => x.id === d.item.ingredientId)?.nameEn || "") || d.item.name}<small>{pantryLabel(d.item.location, locale)}</small></span><strong>{quantityLabel({ ...d.item.quantity!, value: d.amount }, data.preferences, locale, 1, t)}</strong></li>)}</ul>
    {!preview.deductions.length && <p className="shopping-note">{t("Aucune quantité connue à retirer de vos réserves.", "No known pantry quantities to deduct.")}</p>}
    {!!preview.missing.length && <details open className="cooking-missing"><summary>{t("Quantités non suivies en réserve", "Quantities not tracked in your pantry")} ({preview.missing.length})</summary><p>{t("Ces quantités ne seront pas déduites. Vous pouvez quand même confirmer le repas; vos réserves ne passeront jamais sous zéro.", "These quantities will not be deducted. You can still confirm this meal; your pantry will never go below zero.")}</p><ul>{preview.missing.map((m, i) => <li key={i}>{t(data.ingredients.find(x => x.id === m.ingredientId)?.name || "", data.ingredients.find(x => x.id === m.ingredientId)?.nameEn || "") || m.ingredientId} · {quantityLabel(m.quantity, data.preferences, locale, 1, t)}</li>)}</ul></details>}
    <p className="shopping-note">{t("Vous pourrez annuler cette préparation depuis le repas pour rétablir les quantités retirées.", "You can undo cooking from the meal to restore the deducted quantities.")}</p>
    {error && <p role="alert">{t(error)}</p>}<footer><button className="text-button" type="button" disabled={busy} onClick={onClose}>{t("Annuler", "Cancel")}</button><button className="primary" disabled={busy}>{t("Confirmer la préparation", "Confirm cooking")}</button></footer></form>
  </dialog>;
}
