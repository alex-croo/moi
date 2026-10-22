"use client";
import { AppSelect } from "./app-select";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { Ingredient, PantryItem, PantryLocation, Quantity, UnitPreferences } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { pantryFactor, pantryLabel, pantryLocations, pantryUnit, pantryQuantityLabel } from "@/lib/pantry";
import { countMeasures, countLabels } from "@/lib/ingredient-measures";
import { pantrySchema } from "@/lib/validation";
import { suggestedLocation, type ShoppingIngredient } from "@/lib/grocery-aisles";
import { useShoppingDialog } from "./use-shopping-dialog";

export function PantryQuickAdd({ ingredient, needed, units, locale, onSave, onClose, existing = [], onEdit }: {
  ingredient: ShoppingIngredient; needed: Quantity; units: UnitPreferences; locale: Locale;
  onSave: (item: PantryItem) => Promise<void>; onClose: () => void;
  existing?: PantryItem[]; onEdit?: (id: string) => void;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const dialog = useShoppingDialog(), id = useRef(crypto.randomUUID());
  const [kind, setKind] = useState<Quantity["kind"]>("volume"), [amount, setAmount] = useState("");
  const [countUnit, setCountUnit] = useState("");
  const [adding, setAdding] = useState(!existing.length);
  const [location, setLocation] = useState<PantryLocation>(suggestedLocation(ingredient)), [note, setNote] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      await onSave(pantrySchema.parse({ id: id.current, ingredientId: ingredient.id, name: ingredient.name, location, note, inStock: true,
        quantity: { ...(kind === needed.kind ? needed : {}), kind, value: Number(amount) * pantryFactor(kind, units), ...(kind === "count" ? countLabels(ingredient.id, countUnit) : {}) } }));
      onClose();
    } catch { setError(t("Vérifiez la quantité et réessayez. Rien n’a été ajouté sans confirmation.", "Check the quantity and retry. Nothing is added without confirmation.")); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="shopping-dialog pantry-quick-add" aria-labelledby="pantry-quick-title" onCancel={e => busy ? e.preventDefault() : onClose()}>
    <header><h2 id="pantry-quick-title">{t("Déjà en réserve", "Already in my pantry")}</h2><button className="icon-button" disabled={busy} onClick={onClose} aria-label={t("Fermer", "Close")}><X size={20}/></button></header>
    {!adding ? <div className="pantry-existing"><h3>{locale === "fr" ? ingredient.name : ingredient.nameEn}</h3><p>{t("Cet aliment est déjà enregistré. Modifiez la quantité existante pour la préciser.", "This food is already saved. Edit its existing quantity to clarify it.")}</p><ul>{existing.map(item => <li key={item.id}><span>{item.quantity ? pantryQuantityLabel(item.quantity, units, locale) : t("Quantité à préciser", "Quantity to specify")} · {pantryLabel(item.location, locale)}</span><button className="secondary" onClick={() => onEdit?.(item.id)}>{t("Modifier cette réserve", "Edit this stock")}</button></li>)}</ul><button className="text-button" onClick={() => setAdding(true)}>{t("Ajouter un autre lot", "Add another batch")}</button></div> : <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <h3>{locale === "fr" ? ingredient.name : ingredient.nameEn}</h3><p className="shopping-note">{t("Indiquez ce que vous avez réellement à la maison. Cette quantité s’ajoutera à vos réserves et sera retirée des achats nécessaires.", "Enter what you actually have at home. This amount will be added to your pantry and deducted from required purchases.")}</p>
      <div className="purchase-options"><label>{t("Mesure", "Measure")}<AppSelect value={kind} onChange={e => { setKind(e.target.value as Quantity["kind"]); setAmount(""); setCountUnit(countMeasures(ingredient.id)[0]?.label || ""); }}><option value="mass">{t("Poids", "Weight")}</option><option value="volume">{t("Volume", "Volume")}</option><option value="spoon">{t("Petites quantités", "Small amounts")}</option><option value="count">{t("Unités", "Items")}</option></AppSelect></label>
      {kind === "count" && countMeasures(ingredient.id).length > 0 && <label>{t("Unité comptée", "Counted unit")}<AppSelect aria-label={t("Unité comptée", "Counted unit")} value={countUnit} onChange={e => setCountUnit(e.target.value)}>{countMeasures(ingredient.id).map(m => <option key={m.label} value={m.label}>{locale === "fr" ? m.label : m.labelEn}</option>)}</AppSelect></label>}
      <label>{t("Quantité en réserve", "Pantry quantity")} · {pantryUnit(kind, units, locale)}<input required type="number" inputMode="decimal" min="0.000001" step="any" value={amount} onChange={e => setAmount(e.target.value)}/></label>
      <label>{t("Où le ranger", "Where it belongs")}<AppSelect value={location} onChange={e => setLocation(e.target.value as PantryLocation)}>{pantryLocations.map(l => <option key={l} value={l}>{pantryLabel(l, locale)}</option>)}</AppSelect></label>
      <label>{t("Précisions", "Details")}<input maxLength={160} placeholder={t("Format, nombre de paquets…", "Package size, number of packs…")} value={note} onChange={e => setNote(e.target.value)}/></label></div>
      <label className="shopping-checkbox"><input type="checkbox" checked={location === "freezer"} onChange={e => setLocation(e.target.checked ? "freezer" : "fridge")}/>{t("Cet aliment est congelé", "This food is frozen")}</label>
      {location === "freezer" && <p className="shopping-note">{t("Un rappel de décongélation sera proposé pour les repas qui utilisent cet aliment.", "A thawing reminder will appear for meals using this food.")}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><button type="button" className="text-button" disabled={busy} onClick={onClose}>{t("Annuler", "Cancel")}</button><button className="primary" disabled={busy}>{busy ? t("Enregistrement…", "Saving…") : t("Ajouter à mes réserves", "Add to my pantry")}</button></footer>
    </form>}
  </dialog>;
}
