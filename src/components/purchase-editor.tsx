"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { Ingredient, UnitPreferences } from "@/lib/types";
import type { Grocer, Purchase, PurchaseLine } from "@/lib/shopping-types";
import type { ShoppingMutation } from "@/lib/shopping";
import { pantryFactor, pantryUnit, pantryLabel, pantryLocations } from "@/lib/pantry";
import { localToday, quantityLabel } from "@/lib/units";

export function PurchaseEditor({ initialLines, order, mode, grocers, ingredients, units, locale, onClose, onSave }: {
  initialLines: PurchaseLine[]; order?: Purchase; mode: "store" | "online" | "receive"; grocers: Grocer[];
  ingredients: Ingredient[]; units: UnitPreferences; locale: Locale; onClose: () => void; onSave: (m: ShoppingMutation) => Promise<void>;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const dialog = useRef<HTMLDialogElement>(null), operationId = useRef(order?.id || crypto.randomUUID());
  const [lines, setLines] = useState(initialLines), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const first = grocers.find(g => g.favorite) || grocers[0];
  const [grocerId, setGrocerId] = useState(first?.id || ""), [date, setDate] = useState(order?.expectedDate || localToday()), [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(first?.fulfillment || "delivery");
  const grocer = grocers.find(g => g.id === grocerId);
  const title = mode === "receive" ? t("J’ai reçu ma commande", "I received my order") : mode === "store" ? t("Ranger mes achats", "Put my groceries away") : t("Ma commande en ligne", "My online order");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit() {
    setBusy(true); setError("");
    try {
      await onSave(mode === "receive" ? { action: "receive", id: operationId.current, lines } : { action: "order", id: operationId.current, mode, grocer: grocer?.name || "", expectedDate: date, fulfillment, lines });
      onClose();
    } catch { setError(t("La confirmation n’a pas abouti. Vérifiez les quantités et votre connexion. Si une autre page a modifié vos réserves, rechargez avant de réessayer.", "Confirmation failed. Check quantities and your connection. Reload if your pantry changed in another page.")); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="shopping-dialog" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} aria-labelledby="purchase-title">
    <header><h2 id="purchase-title">{title}</h2><button className="icon-button" aria-label={t("Fermer", "Close")} disabled={busy} onClick={onClose}><X size={20}/></button></header>
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <p className="shopping-note">{mode === "online" ? t("Après avoir payé votre commande chez l’épicier ou sur Instacart, enregistrez les articles confirmés ici. Créer une liste Instacart ne confirme pas une commande. Vos réserves seront mises à jour à la réception.", "After paying for your order with the grocer or on Instacart, record the confirmed items here. Creating an Instacart list does not confirm an order. Your pantry updates when you receive it.") : t("Ajustez les quantités réellement achetées et leur rangement. Indiquez 0 pour un article non reçu; il restera à acheter.", "Adjust actual purchased quantities and storage. Enter 0 for an item not received; it will remain on your list.")}</p>
      {mode !== "receive" && <div className="purchase-options"><label>{t("Épicier", "Grocer")}<select aria-label={t("Épicier", "Grocer")} value={grocerId} onChange={e => { setGrocerId(e.target.value); setFulfillment(grocers.find(g => g.id === e.target.value)?.fulfillment || "delivery"); }}><option value="">{t("Sans épicier enregistré", "No saved grocer")}</option>{grocers.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      {mode === "online" && <><label>{t("Réception prévue", "Expected receipt")}<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>{t("Mode de réception", "Fulfillment")}<select aria-label={t("Mode de réception", "Fulfillment")} value={fulfillment} onChange={e => setFulfillment(e.target.value as "delivery" | "pickup")}><option value="delivery">{t("Livraison", "Delivery")}</option><option value="pickup">{t("Cueillette", "Pickup")}</option></select></label></>}
      {grocer?.url && <a className="text-button" href={grocer.url} target="_blank" rel="noopener noreferrer">{t("Ouvrir la boutique ↗", "Open store ↗")}</a>}</div>}
      {mode === "receive" && <p className="shopping-note">{order?.grocer} · {order?.expectedDate} · {t("Cette réception clôturera la commande.", "This receipt will close the order.")}</p>}
      <div className="purchase-lines">{lines.map((line, i) => {
        const ingredient = ingredients.find(x => x.id === line.ingredientId), name = ingredient ? locale === "fr" ? ingredient.name : ingredient.nameEn : line.ingredientId;
        const factor = pantryFactor(line.quantity.kind, units);
        return <div className="purchase-line" key={line.ingredientId}><span>{name}<small>{t("Prévu : ", "Planned: ")}{quantityLabel(initialLines[i].quantity, units, locale)}</small></span>
          <label><span>{t("Quantité", "Quantity")} · {line.quantity.kind === "count" ? (locale === "fr" ? line.quantity.label : line.quantity.labelEn) || pantryUnit("count", units, locale) : pantryUnit(line.quantity.kind, units, locale)}</span><input aria-label={`${t("Quantité", "Quantity")} ${name}`} required type="number" min="0" step="any" max={1000000 / factor} defaultValue={Number((line.quantity.value / factor).toPrecision(10))} onChange={e => setLines(current => current.map((l, index) => index === i ? { ...l, quantity: { ...l.quantity, value: e.target.valueAsNumber * factor } } : l))} /></label>
          <label><span>{t("Rangement", "Storage")}</span><select aria-label={`${t("Rangement", "Storage")} ${name}`} value={line.location} onChange={e => setLines(current => current.map((l, index) => index === i ? { ...l, location: e.target.value as PurchaseLine["location"] } : l))}>{pantryLocations.map(loc => <option value={loc} key={loc}>{pantryLabel(loc, locale)}</option>)}</select></label>
        </div>;
      })}</div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <footer><button type="button" disabled={busy} className="text-button" onClick={onClose}>{t("Annuler", "Cancel")}</button><button className="primary" disabled={busy}>{busy ? t("Enregistrement…", "Saving…") : mode === "online" ? t("J’ai passé ma commande", "I placed my order") : t("Confirmer et ajouter aux réserves", "Confirm and add to pantry")}</button></footer>
    </form>
  </dialog>;
}
