"use client";
import { useState } from "react";
import { ArrowRight, Copy, PackageCheck, ShoppingBasket } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { Recipe } from "@/lib/types";
import type { ShoppingWorkspace, PurchaseLine } from "@/lib/shopping-types";
import { shoppingNeeds, shoppingState, periodKey, purchaseLineKey, type ShoppingMutation } from "@/lib/shopping";
import { aisles, ingredientAisle, aisleLabel, suggestedLocation } from "@/lib/grocery-aisles";
import { quantityLabel, addDays, localToday } from "@/lib/units";
import { PendingOrders } from "./pending-orders";
import { PurchaseEditor } from "./purchase-editor";
import { InstacartExport } from "./instacart-export";
import { preferredGrocer } from "@/lib/grocer-preferences";

export function GroceryList({ data, locale, week, onPlan, onOpen, onPantry, onSettings, onSave }: {
  data: ShoppingWorkspace; locale: Locale; week: string; onPlan: () => void; onOpen: (recipe: Recipe) => void;
  onPantry: () => void; onSettings: () => void; onSave: (value: ShoppingMutation) => Promise<void>;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const shopping = shoppingState(data), range = shopping.range || { start: week, end: addDays(week, 6) };
  const [dates, setDates] = useState(range), [optional, setOptional] = useState(false), [showReady, setShowReady] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ mode: "store" | "online"; lines: PurchaseLine[] } | null>(null);
  const [exporting, setExporting] = useState(false);
  const result = shoppingNeeds(data, data, range.start, range.end, optional);
  const items = result.items.sort((a, b) => (locale === "fr" ? a.ingredient.name : a.ingredient.nameEn).localeCompare(locale === "fr" ? b.ingredient.name : b.ingredient.nameEn, locale));
  const selected = shopping.selections[periodKey(range.start, range.end)] || [];
  const needs = items.filter(i => i.quantity.value > 0), picked = needs.filter(i => selected.includes(i.ingredient.id));
  const name = (i: (typeof items)[number]) => locale === "fr" ? i.ingredient.name : i.ingredient.nameEn;
  async function perform(value: ShoppingMutation, message = "") {
    setBusy(true); setError(""); setStatus("");
    try { await onSave(value); setStatus(message); return true; }
    catch { setError(t("L’enregistrement n’a pas abouti. Réessayez ou rechargez si votre espace a changé dans une autre page.", "Saving failed. Retry or reload if your workspace changed in another page.")); return false; }
    finally { setBusy(false); }
  }
  async function changeRange(next: typeof range) {
    if (!next.start || !next.end || next.start > next.end || next.end > addDays(next.start, 90)) { setError(t("Choisissez une période de 1 à 91 jours, dans l’ordre des dates.", "Choose a period of 1–91 days in chronological order.")); return; }
    if (await perform({ action: "range", range: next })) setDates(next);
  }
  function prepare(mode: "store" | "online") {
    const chosen = picked.length ? picked : needs;
    setEditing({ mode, lines: chosen.map(i => ({ ingredientId: i.ingredient.id, quantity: { ...i.quantity }, location: suggestedLocation(i.ingredient) })) });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText([t("Ma liste d’épicerie", "My grocery list"), `${range.start} — ${range.end}`,
        ...aisles.flatMap(aisle => {
          const group = needs.filter(i => ingredientAisle(i.ingredient) === aisle);
          return group.length ? ["", aisleLabel(aisle, locale), ...group.map(i => `[ ] ${name(i)} : ${i.estimated ? "≈ " : ""}${quantityLabel(i.quantity, data.preferences, locale)}`)] : [];
        }), ...(result.missing ? [t("Liste incomplète : vérifiez les repas.", "Incomplete list: check your meals.")] : [])].join("\n"));
      setStatus(t("Liste copiée.", "List copied."));
    } catch { setError(t("La copie n’a pas abouti.", "Copy failed.")); }
  }
  return <section className="grocery-page">
    <div className="grocery-heading"><div className="page-heading"><h1>{t("Ma liste d’épicerie.", "My grocery list.")}</h1><p>{t("Vos repas, vos courses et vos réserves, au même endroit.", "Your meals, groceries and pantry, together.")}</p></div>
      <div className="grocery-actions"><button className="secondary" onClick={onPantry}><PackageCheck size={16}/>{t("Voir mes réserves", "View my pantry")}</button><button className="text-button" onClick={onPlan}>{t("Voir les repas", "View meals")}<ArrowRight size={16}/></button></div></div>
    <div className="grocery-controls shopping-controls">
      <form className="shopping-dates" onSubmit={e => { e.preventDefault(); void changeRange(dates); }}>
        <label>{t("Du", "From")}<input required aria-label={t("Début des courses", "Shopping start")} type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })}/></label>
        <label>{t("Au", "To")}<input required aria-label={t("Fin des courses", "Shopping end")} type="date" min={dates.start} value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })}/></label>
        <button className="secondary" disabled={busy}>{t("Afficher", "Show")}</button>
        <div className="shopping-shortcuts">{[3, 7, 14].map(days => <button type="button" disabled={busy} key={days} onClick={() => void changeRange({ start: localToday(), end: addDays(localToday(), days - 1) })}>{days} {t("j", "d")}</button>)}</div>
      </form>
      <div className="grocery-toolbar"><label className="shopping-checkbox"><input type="checkbox" aria-label={t("Afficher les aliments déjà prêts", "Show foods already ready")} checked={showReady} onChange={e => setShowReady(e.target.checked)}/>{t("Déjà couverts", "Already covered")}</label><label className="shopping-checkbox"><input type="checkbox" aria-label={t("Inclure les ingrédients facultatifs", "Include optional ingredients")} checked={optional} onChange={e => setOptional(e.target.checked)}/>{t("Facultatifs", "Optional")}</label></div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}{status && <p className="grocery-status" role="status">{status}</p>}
    <PendingOrders data={data} locale={locale} onSave={onSave}/>
    {!!result.missing && <p role="alert" className="form-error">{t("La liste est incomplète : une recette ou un ingrédient est indisponible.", "This list is incomplete: a recipe or ingredient is unavailable.")}</p>}
    {items.length ? <div className="grocery-paper"><header className="grocery-summary"><div className="grocery-summary-title"><ShoppingBasket size={20}/><div><h2>{t("Ce qu’il me manque", "What I still need")}</h2><p>{result.meals} {t("repas prévus", "planned meals")} · {needs.length} {t("ingrédients à acheter", "ingredients to buy")}{picked.length ? ` · ${picked.length} ${t("cochés", "checked")}` : ""}</p></div></div><button className="secondary" onClick={() => void copy()}><Copy size={15}/>{t("Copier la liste", "Copy list")}</button></header>
      <div className="shopping-purchase-bar"><div><button className="secondary" disabled={busy || !needs.length} onClick={() => prepare("store")}>{t("Ranger mes achats", "Put my groceries away")}</button><button className="secondary" disabled={busy || !needs.length} onClick={() => prepare("online")}>{t("Commander en ligne", "Order online")}</button><button className="primary" disabled={busy || !needs.length} onClick={() => setExporting(true)}>{t("Acheter avec Instacart", "Shop with Instacart")}</button></div><button className="text-button" onClick={onSettings}>{t("Mes épiciers", "My grocers")}</button></div>
      <p className="shopping-note">{picked.length ? t("Les articles cochés seront proposés pour vos achats.", "Checked items will be included in your purchase.") : t("Cochez les articles achetés ou à commander. Sans sélection, tous les articles manquants seront proposés.", "Check purchased items or those to order. With no selection, all missing items will be included.")}</p>
      <div className="grocery-column-headings" aria-hidden="true"><span>{t("Ingrédient", "Ingredient")}</span><span>{t("Pour ces recettes", "For these recipes")}</span><span>{t("À acheter", "To buy")}</span></div>
      {aisles.map(aisle => {
        const group = items.filter(i => ingredientAisle(i.ingredient) === aisle && (showReady || i.quantity.value > 0));
        return group.length ? <section className="grocery-aisle" key={aisle}><h2>{aisleLabel(aisle, locale)} <small>{group.length}</small></h2><ul className="grocery-items">{group.map(item => <li className={`grocery-item ${selected.includes(item.ingredient.id) ? "is-picked" : ""}`} key={item.ingredient.id}>
          <input className="grocery-check" id={`buy-${item.ingredient.id}`} type="checkbox" checked={selected.includes(item.ingredient.id)} disabled={busy || item.quantity.value === 0} aria-label={`${t("Cocher", "Check")} ${name(item)}`} onChange={e => void perform({ action: "select", range, ingredientId: item.ingredient.id, checked: e.target.checked })}/>
          <div className="grocery-item-body"><h3><label htmlFor={`buy-${item.ingredient.id}`}>{name(item)}</label></h3>
            {preferredGrocer(item.ingredient, shopping.grocers) && <p className="grocery-supplier">{preferredGrocer(item.ingredient, shopping.grocers)!.name}</p>}
            {(item.onHand > 0 || item.pending > 0) && <p className="grocery-calculation">{item.onHand > 0 ? `${quantityLabel({ ...item.quantity, value: item.onHand }, data.preferences, locale)} ${t("en réserve", "in pantry")}` : ""}{item.onHand > 0 && item.pending > 0 ? " · " : ""}{item.pending > 0 ? `${quantityLabel({ ...item.quantity, value: item.pending }, data.preferences, locale)} ${t("attendus", "expected")}` : ""}</p>}
            {item.needsStockCheck && <p className="grocery-stock-warning">{t("Une quantité en réserve reste à vérifier.", "A pantry quantity needs checking.")}</p>}</div>
          <ul className="grocery-recipes">{item.uses.map(({ recipe, meals }) => <li key={recipe.id}><button className="text-button" onClick={() => onOpen(recipe)}>{locale === "fr" ? recipe.title : recipe.titleEn}{meals > 1 && <span className="grocery-recipe-count">×{meals}</span>}</button></li>)}</ul>
          <div className="grocery-quantity"><strong>{item.quantity.value > 0 ? `${item.estimated ? "≈ " : ""}${quantityLabel(item.quantity, data.preferences, locale)}` : item.pending > 0 ? t("En commande", "On order") : t("Déjà à la maison", "Already at home")}</strong></div>
        </li>)}</ul></section> : null;
      })}
      {!needs.length && <p className="shopping-note">{t("Tout est couvert pour cette période. Les articles en commande restent à recevoir.", "This period is covered. Ordered items still need to be received.")}</p>}
      <details className="grocery-help"><summary>{t("Comment mes quantités sont calculées", "How quantities are calculated")}</summary><p>{t("Les repas non cuisinés réservent les ingrédients dans l’ordre des dates, même hors de la période affichée. Une livraison prévue après un repas ne le couvre pas. Les achats entrent en réserve à votre confirmation; « J’ai cuisiné » retire ensuite les ingrédients. ≈ indique une conversion estimée à partir de la recette. L’eau du robinet n’est pas ajoutée aux courses.", "Uncooked meals reserve ingredients in date order, including outside the visible period. A delivery after a meal does not cover it. Purchases enter your pantry when confirmed; “I cooked this” then deducts ingredients. ≈ indicates an estimate from the recipe. Tap water is excluded from groceries.")}</p></details>
    </div> : <div className="grocery-empty"><div className="grocery-empty-icon"><ShoppingBasket/></div><h2>{t("Votre épicerie commence par vos repas.", "Your grocery list starts with your meals.")}</h2><p>{t("Choisissez des recettes pour ces dates ou élargissez la période. Les repas déjà cuisinés ne sont plus à acheter.", "Choose recipes for these dates or widen the period. Cooked meals no longer need groceries.")}</p><button className="primary" onClick={onPlan}>{t("Choisir mes repas", "Choose my meals")}<ArrowRight size={16}/></button></div>}
    {!!shopping.orders.some(o => o.status !== "pending") && <details className="shopping-history"><summary>{t("Mes achats précédents", "Previous purchases")}</summary>{shopping.orders.filter(o => o.status !== "pending").map(o => <details key={o.id}><summary>{o.status === "received" ? t("Rangés", "Put away") : t("Annulée", "Cancelled")} · {o.grocer || t("Mes courses", "My groceries")} · {(o.receivedAt || o.createdAt).slice(0, 10)}</summary><ul>{(o.received || o.lines).map(line => <li key={purchaseLineKey(line)}>{line.name || data.ingredients.find(i => i.id === line.ingredientId)?.[locale === "fr" ? "name" : "nameEn"] || line.ingredientId} — {quantityLabel(line.quantity, data.preferences, locale)}</li>)}</ul></details>)}</details>}
    {exporting && <InstacartExport items={picked.length ? picked : needs} grocers={shopping.grocers} locale={locale} units={data.preferences} onClose={() => setExporting(false)}/>}
    {editing && <PurchaseEditor {...editing} initialLines={editing.lines} grocers={shopping.grocers} ingredients={data.ingredients} units={data.preferences} locale={locale} onClose={() => setEditing(null)} onSave={async m => { await onSave(m); setStatus(m.action === "order" && m.mode === "online" ? t("Commande enregistrée. Nous attendons votre confirmation de réception.", "Order recorded. Awaiting your receipt confirmation.") : t("Vos achats sont rangés dans vos réserves.", "Your purchases are in your pantry.")); }}/>}
  </section>;
}
