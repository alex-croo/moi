"use client";
import { AppSelect } from "./app-select";
import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { Quantity, UnitPreferences } from "@/lib/types";
import { aisles, aisleLabel, type Aisle } from "@/lib/grocery-aisles";
import { pantryFactor, pantryUnit } from "@/lib/pantry";
import { shoppingMutation, type ShoppingMutation } from "@/lib/shopping";
import { useShoppingDialog } from "./use-shopping-dialog";

export function PersonalGroceryEditor({ locale, units, onClose, onSave }: {
  locale: Locale; units: UnitPreferences; onClose: () => void; onSave: (m: ShoppingMutation) => Promise<void>;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const dialog = useShoppingDialog(), id = useRef(crypto.randomUUID());
  const [name, setName] = useState(""), [aisle, setAisle] = useState<Aisle>("other");
  const [kind, setKind] = useState<Quantity["kind"]>("volume"), [amount, setAmount] = useState(""), [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try {
      const value = shoppingMutation.parse({ action: "personalItem", item: { id: id.current, name, aisle,
        quantity: { kind, value: Number(amount) * pantryFactor(kind, units), ...(kind === "count" && unit.trim() ? { label: unit.trim(), labelEn: unit.trim() } : {}) } } });
      await onSave(value); onClose();
    } catch { setError(t("Vérifiez le nom et la quantité, puis réessayez. Votre saisie est conservée.", "Check the name and quantity, then retry. Your entries are preserved.")); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="shopping-dialog personal-grocery-dialog" aria-labelledby="personal-grocery-title" onCancel={e => busy ? e.preventDefault() : onClose()}>
    <header><div><span className="dialog-eyebrow">{t("POUR MA CUISINE", "FOR MY KITCHEN")}</span><h2 id="personal-grocery-title">{t("Ajouter un aliment personnel", "Add a personal food")}</h2></div><button className="icon-button" disabled={busy} aria-label={t("Fermer", "Close")} onClick={onClose}><X size={20}/></button></header>
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <p className="shopping-note">{t("Pas besoin de recette. Cet aliment restera sur votre liste jusqu’à son achat et rejoindra vos réserves à la confirmation.", "No recipe needed. This food stays on your list until purchased and joins your pantry when confirmed.")}</p>
      <label>{t("Nom de l’aliment", "Food name")}<input required autoComplete="off" maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder={t("Ex. : yogourt nature", "E.g. plain yogurt")}/></label>
      <div className="purchase-options personal-grocery-fields">
        <label>{t("Rayon", "Aisle")}<AppSelect aria-label={t("Rayon", "Aisle")} value={aisle} onChange={e => setAisle(e.target.value as Aisle)}>{aisles.map(a => <option key={a} value={a}>{aisleLabel(a, locale)}</option>)}</AppSelect></label>
        <label>{t("Mesure", "Measure")}<AppSelect aria-label={t("Mesure", "Measure")} value={kind} onChange={e => { setKind(e.target.value as Quantity["kind"]); setAmount(""); }}><option value="volume">{t("Volume", "Volume")}</option><option value="mass">{t("Poids", "Weight")}</option><option value="spoon">{t("Petites quantités", "Small amounts")}</option><option value="count">{t("Unités", "Items")}</option></AppSelect></label>
        <label>{t("Quantité", "Quantity")} · {pantryUnit(kind, units, locale)}<input aria-label={t("Quantité", "Quantity")} required type="number" inputMode="decimal" min="0.000001" step="any" max={1000000 / pantryFactor(kind, units)} value={amount} onChange={e => setAmount(e.target.value)}/></label>
        {kind === "count" && <label>{t("Unité comptée (facultatif)", "Counted unit (optional)")}<input maxLength={80} value={unit} onChange={e => setUnit(e.target.value)} placeholder={t("Ex. : paquets", "E.g. packages")}/></label>}
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <footer><button type="button" className="text-button" disabled={busy} onClick={onClose}>{t("Annuler", "Cancel")}</button><button className="primary" disabled={busy}><Plus size={16}/>{busy ? t("Ajout…", "Adding…") : t("Ajouter à ma liste", "Add to my list")}</button></footer>
    </form>
  </dialog>;
}
