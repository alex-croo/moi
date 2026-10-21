"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Ingredient, PantryItem, PantryLocation, Quantity, UnitPreferences } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { pantryFactor, pantryLabel, pantryLocations, pantryUnit } from "@/lib/pantry";
import { pantrySchema } from "@/lib/validation";
import { suggestedLocation } from "@/lib/grocery-aisles";

export function PantryQuickAdd({ ingredient, needed, units, locale, onSave, onClose }: {
  ingredient: Ingredient; needed: Quantity; units: UnitPreferences; locale: Locale;
  onSave: (item: PantryItem) => Promise<void>; onClose: () => void;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const dialog = useRef<HTMLDialogElement>(null), id = useRef(crypto.randomUUID());
  const [kind, setKind] = useState(needed.kind), [amount, setAmount] = useState(String(Number((needed.value / pantryFactor(needed.kind, units)).toPrecision(10))));
  const [location, setLocation] = useState<PantryLocation>(suggestedLocation(ingredient)), [note, setNote] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function save() {
    setBusy(true); setError("");
    try {
      await onSave(pantrySchema.parse({ id: id.current, ingredientId: ingredient.id, name: ingredient.name, location, note, inStock: true,
        quantity: { ...(kind === needed.kind ? needed : {}), kind, value: Number(amount) * pantryFactor(kind, units) } }));
      onClose();
    } catch { setError(t("Vérifiez la quantité et réessayez. Rien n’a été ajouté sans confirmation.", "Check the quantity and retry. Nothing is added without confirmation.")); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="shopping-dialog pantry-quick-add" aria-labelledby="pantry-quick-title" onCancel={e => busy ? e.preventDefault() : onClose()}>
    <header><h2 id="pantry-quick-title">{t("Déjà en réserve", "Already in my pantry")}</h2><button className="icon-button" disabled={busy} onClick={onClose} aria-label={t("Fermer", "Close")}><X size={20}/></button></header>
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <h3>{locale === "fr" ? ingredient.name : ingredient.nameEn}</h3><p className="shopping-note">{t("Indiquez ce que vous avez réellement à la maison. Cette quantité s’ajoutera à vos réserves et sera retirée des achats nécessaires.", "Enter what you actually have at home. This amount will be added to your pantry and deducted from required purchases.")}</p>
      <div className="purchase-options"><label>{t("Mesure", "Measure")}<select value={kind} onChange={e => { setKind(e.target.value as Quantity["kind"]); setAmount(""); }}><option value="mass">{t("Poids", "Weight")}</option><option value="volume">{t("Volume", "Volume")}</option><option value="spoon">{t("Petites quantités", "Small amounts")}</option><option value="count">{t("Unités", "Items")}</option></select></label>
      <label>{t("Quantité en réserve", "Pantry quantity")} · {pantryUnit(kind, units, locale)}<input required type="number" min="0.000001" step="any" value={amount} onChange={e => setAmount(e.target.value)}/></label>
      <label>{t("Où le ranger", "Where it belongs")}<select value={location} onChange={e => setLocation(e.target.value as PantryLocation)}>{pantryLocations.map(l => <option key={l} value={l}>{pantryLabel(l, locale)}</option>)}</select></label>
      <label>{t("Précisions", "Details")}<input maxLength={160} placeholder={t("Format, nombre de paquets…", "Package size, number of packs…")} value={note} onChange={e => setNote(e.target.value)}/></label></div>
      <label className="shopping-checkbox"><input type="checkbox" checked={location === "freezer"} onChange={e => setLocation(e.target.checked ? "freezer" : "fridge")}/>{t("Cet aliment est congelé", "This food is frozen")}</label>
      {location === "freezer" && <p className="shopping-note">{t("Un rappel de décongélation sera proposé pour les repas qui utilisent cet aliment.", "A thawing reminder will appear for meals using this food.")}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><button type="button" className="text-button" disabled={busy} onClick={onClose}>{t("Annuler", "Cancel")}</button><button className="primary" disabled={busy}>{busy ? t("Enregistrement…", "Saving…") : t("Ajouter à mes réserves", "Add to my pantry")}</button></footer>
    </form>
  </dialog>;
}
