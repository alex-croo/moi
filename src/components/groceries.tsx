"use client";
import { useText } from "./locale-provider";

import { L } from "@/components/locale-provider";
import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { useMemo, useState } from "react";
import { ArrowRight, Copy, PackageCheck, ShoppingBasket, MoreHorizontal, Refrigerator, Plus, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { Recipe, PantryItem } from "@/lib/types";
import type { ShoppingWorkspace, PurchaseLine } from "@/lib/shopping-types";
import { shoppingNeeds, toBuyQuantity, shoppingState, periodKey, purchaseLineKey, shoppingPurchaseLine, type ShoppingMutation } from "@/lib/shopping";
import { aisles, ingredientAisle, aisleLabel, suggestedLocation } from "@/lib/grocery-aisles";
import { quantityLabel, addDays, localToday } from "@/lib/units";
import { PendingOrders } from "./pending-orders";
import { PurchaseEditor } from "./purchase-editor";
import { PersonalGroceryEditor } from "./personal-grocery-editor";
import { useShoppingSelection } from "./use-shopping-selection";
import { PantryQuickAdd } from "./pantry-quick-add";
import { pantryQuantityLabel } from "@/lib/pantry";

export function GroceryList({ data, locale, week, onPlan, onOpen, onPantry, onSettings, onSave, onPantrySave }: {
  data: ShoppingWorkspace; locale: Locale; week: string; onPlan: () => void; onOpen: (recipe: Recipe) => void;
  onPantrySave: (item: PantryItem) => Promise<void>;
  onPantry: (id?: string) => void; onSettings: () => void; onSave: (value: ShoppingMutation) => Promise<void>;
}) {
  const t = useText(locale);
  const shopping = shoppingState(data), range = shopping.range || { start: week, end: addDays(week, 6) };
  const [dates, setDates] = useState(range), [optional, setOptional] = useState(false), [showReady, setShowReady] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ mode: "store" | "online"; lines: PurchaseLine[]; initialGrocerId?: string } | null>(null);
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [reserve, setReserve] = useState<(typeof items)[number] | null>(null);
  const [actions, setActions] = useState<string | null>(null);
  const result = useMemo(() => shoppingNeeds(data, data, range.start, range.end, optional), [data, range.start, range.end, optional]);
  const items = result.items.sort((a, b) => (t(a.ingredient.name, a.ingredient.nameEn)).localeCompare(t(b.ingredient.name, b.ingredient.nameEn), locale));
  const selection = useShoppingSelection(range, shopping.selections[periodKey(range.start, range.end)] || [], onSave);
  const selected = selection.selected;
  const needs = items.filter(i => toBuyQuantity(i).value > 0).map(i => ({ ...i, quantity: toBuyQuantity(i) })), picked = needs.filter(i => selected.includes(i.ingredient.id));
  const name = (i: (typeof items)[number]) => t(i.ingredient.name, i.ingredient.nameEn);
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
    setEditing({ mode, lines: chosen.map(shoppingPurchaseLine) });
  }
  function alreadyHome(item: (typeof items)[number]) {
    if (item.personalItemId) setEditing({ mode: "store", lines: [shoppingPurchaseLine(item)] });
    else setReserve(item);
    setActions(null);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText([t("Ma liste d’épicerie", "My grocery list"), `${range.start} — ${range.end}`,
        ...aisles.flatMap(aisle => {
          const group = needs.filter(i => ingredientAisle(i.ingredient) === aisle);
          return group.length ? ["", aisleLabel(aisle, locale), ...group.map(i => `[ ] ${name(i)} : ${i.estimated ? "≈ " : ""}${quantityLabel(i.quantity, data.preferences, locale, 1, t)}`)] : [];
        }), ...(result.missing ? [t("Liste incomplète : vérifiez les repas.", "Incomplete list: check your meals.")] : [])].join("\n"));
      setStatus(t("Liste copiée.", "List copied."));
    } catch { setError(t("La copie n’a pas abouti.", "Copy failed.")); }
  }
  return <section className="grocery-page">
    <div className="grocery-heading"><div className="page-heading"><h1>{t("Ma liste d’épicerie.", "My grocery list.")}</h1><p>{t("Vos recettes et vos envies, moins vos réserves et vos commandes.", "Your recipes and personal picks, minus pantry stock and orders.")}</p></div>
      <div className="grocery-actions"><button className="primary" onClick={() => setAddingPersonal(true)}><Plus size={16}/>{t("Ajouter un aliment", "Add a food")}</button><button className="secondary" onClick={() => onPantry()}><PackageCheck size={16}/>{t("Voir mes réserves", "View my pantry")}</button><button className="text-button" onClick={onPlan}>{t("Voir les repas", "View meals")}<ArrowRight size={16}/></button></div></div>
    <div className="grocery-controls shopping-controls">
      <form className="shopping-dates" onSubmit={e => { e.preventDefault(); void changeRange(dates); }}>
        <label>{t("Du", "From")}<input required aria-label={t("Début des courses", "Shopping start")} type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })}/></label>
        <label>{t("Au", "To")}<input required aria-label={t("Fin des courses", "Shopping end")} type="date" min={dates.start} value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })}/></label>
        <button className="secondary" disabled={busy}>{t("Afficher", "Show")}</button>
        <div className="shopping-shortcuts">{[3, 7, 14].map(days => <button type="button" disabled={busy} key={days} onClick={() => void changeRange({ start: localToday(), end: addDays(localToday(), days - 1) })}>{days} {t("j", "d")}</button>)}</div>
      </form>
      <div className="grocery-toolbar"><label className="shopping-checkbox"><input type="checkbox" aria-label={t("Afficher les aliments déjà prêts", "Show foods already ready")} checked={showReady} onChange={e => setShowReady(e.target.checked)}/>{t("Déjà couverts", "Already covered")}</label><label className="shopping-checkbox"><input type="checkbox" aria-label={t("Inclure les ingrédients facultatifs", "Include optional ingredients")} checked={optional} onChange={e => setOptional(e.target.checked)}/>{t("Facultatifs", "Optional")}</label></div>
    </div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}{status && <p className="grocery-status" role="status">{t(status)}</p>}
    <PendingOrders data={data} locale={locale} onSave={onSave}/>
    {!!result.missing && <p role="alert" className="form-error">{t("La liste est incomplète : une recette ou un ingrédient est indisponible.", "This list is incomplete: a recipe or ingredient is unavailable.")}</p>}
    {items.length ? <div className="grocery-paper"><header className="grocery-summary"><div className="grocery-summary-title"><ShoppingBasket size={20}/><div><h2>{t("Ce qu’il me manque", "What I still need")}</h2><p>{result.meals} {t("repas prévus", "planned meals")} · {needs.length} {t("articles à acheter", "items to buy")}{picked.length ? ` · ${picked.length} ${t("cochés", "checked")}` : ""}</p></div></div><button className="secondary" onClick={() => void copy()}><Copy size={15}/>{t("Copier la liste", "Copy list")}</button></header>
      <div className="shopping-purchase-bar"><div><button className="secondary" disabled={busy || !needs.length} onClick={() => prepare("store")}>{t("Ranger mes achats", "Put my groceries away")}</button><button className="secondary" disabled={busy || !needs.length} onClick={() => prepare("online")}>{t("Commander en ligne", "Order online")}</button></div><button className="text-button" onClick={onSettings}>{t("Mes épiciers", "My grocers")}</button></div>
      <p className="shopping-note">{picked.length ? t("Les articles cochés seront proposés pour vos achats.", "Checked items will be included in your purchase.") : t("Cochez les articles achetés ou à commander. Sans sélection, tous les articles manquants seront proposés.", "Check purchased items or those to order. With no selection, all missing items will be included.")}</p>
      {items.some(i => i.awaitingConfirmation > 0) && <p className="shopping-note grocery-order-check">{t("Certains articles sont déjà commandés, mais leur format reste à préciser. Ils ne seront pas ajoutés à une nouvelle commande.", "Some items are already ordered, but their package size needs checking. They will not be added to a new order.")} <button className="text-button" onClick={() => setShowReady(true)}>{t("Voir les articles commandés", "View ordered items")}</button></p>}
      {(selection.error || selection.saving) && <div className="grocery-selection-status" role="status">{selection.error ? <>{t("Sélection non enregistrée. Vos choix restent affichés.", "Selection not saved. Your choices are still shown.")} <button className="text-button" onClick={selection.retry}>{t("Réessayer", "Retry")}</button></> : selection.saving ? t("Enregistrement de la sélection…", "Saving selection…") : ""}</div>}
      <div className="grocery-column-headings"><input className="grocery-select-all" type="checkbox" aria-label={t("Tout sélectionner", "Select all")} checked={needs.length > 0 && picked.length === needs.length} ref={el => { if (el) el.indeterminate = picked.length > 0 && picked.length < needs.length; }} disabled={!needs.length} onChange={e => selection.select(needs.map(i => i.ingredient.id), e.target.checked)}/><span>{t("Ingrédient", "Ingredient")}</span><span>{t("Pour ces recettes", "For these recipes")}</span><span>{t("À acheter", "To buy")}</span></div>
      {aisles.map(aisle => {
        const group = items.filter(i => ingredientAisle(i.ingredient) === aisle && (showReady || toBuyQuantity(i).value > 0));
        return group.length ? <section className="grocery-aisle" key={aisle}><h2>{aisleLabel(aisle, locale)} <small>{group.length}</small></h2><ul className="grocery-items">{group.map(item => <li className={`grocery-item ${selected.includes(item.ingredient.id) ? "is-picked" : ""}`} key={item.ingredient.id}>
          <input className="grocery-check" id={`buy-${item.ingredient.id}`} type="checkbox" checked={toBuyQuantity(item).value === 0 || selected.includes(item.ingredient.id)} disabled={toBuyQuantity(item).value === 0} aria-label={`${t("Cocher", "Check")} ${name(item)}`} onChange={e => selection.select([item.ingredient.id], e.target.checked)}/>
          <div className="grocery-item-body"><h3><label htmlFor={`buy-${item.ingredient.id}`}>{name(item)}</label></h3>
            {item.sources.length > 0 && <p className="grocery-supplier">{t("En commande · ", "Ordered · ")}{item.sources.map(s => s.grocer || t("Mon épicier", "My grocer")).join(", ")}</p>}
            {(item.onHand > 0 || item.pending > 0) && <p className="grocery-calculation">{item.onHand > 0 ? `${quantityLabel({ ...item.quantity, value: item.onHand }, data.preferences, locale, 1, t)} ${t("en réserve", "in pantry")}` : ""}{item.onHand > 0 && item.pending > 0 ? " · " : ""}{item.pending > 0 ? `${quantityLabel({ ...item.quantity, value: item.pending }, data.preferences, locale, 1, t)} ${t("attendus", "expected")}` : ""}</p>}
            {item.needsStockCheck && <div className="grocery-stock-warning">{item.awaitingConfirmation > 0 ? t("Déjà commandé · format à préciser.", "Already ordered · package size to confirm.") : <>{t("Déjà enregistré : ", "Already saved: ")}{data.pantry.filter(p => p.inStock && p.ingredientId === item.ingredient.id).map(p => p.quantity ? pantryQuantityLabel(p.quantity, data.preferences, locale) : t("quantité non précisée", "unspecified quantity")).join(" + ")}. {t("Précisez la mesure pour la comparer à la recette.", "Clarify the measure to compare it with the recipe.")} <button className="text-button" onClick={() => setReserve(item)}>{t("Vérifier ma réserve", "Check my stock")}</button></>}</div>}</div>
          <ul className="grocery-recipes">{item.personalItemId && <li className="grocery-personal-label">{t("Ajout personnel", "Personal item")}</li>}{item.uses.map(({ recipe, meals }) => <li key={recipe.id}><button className="text-button" onClick={() => onOpen(recipe)}>{t(recipe.title, recipe.titleEn)}{meals > 1 && <span className="grocery-recipe-count"><L text="×" />{meals}</span>}</button></li>)}</ul>
          <div className="grocery-quantity"><strong>{toBuyQuantity(item).value > 0 ? `${item.estimated ? "≈ " : ""}${quantityLabel(toBuyQuantity(item), data.preferences, locale, 1, t)}` : item.pending > 0 || item.awaitingConfirmation > 0 ? t("En commande", "On order") : t("Déjà à la maison", "Already at home")}</strong>
            <button className="grocery-reserve-button" aria-label={`${t("Déjà en réserve", "Already in my pantry")} : ${name(item)}`} title={t("Déjà en réserve", "Already in my pantry")} onClick={() => alreadyHome(item)}><Refrigerator size={19} aria-hidden="true"/></button>
            {item.personalItemId && <button className="icon-button grocery-personal-remove" aria-label={`${t("Retirer de la liste", "Remove from list")} : ${name(item)}`} disabled={busy} onClick={() => void perform({ action: "removePersonalItem", id: item.personalItemId! })}><Trash2 size={15}/></button>}<div className="grocery-more"><button className="icon-button" aria-label={`${t("Options pour", "Options for")} ${name(item)}`} aria-expanded={actions === item.ingredient.id} onClick={() => setActions(actions === item.ingredient.id ? null : item.ingredient.id)}><MoreHorizontal size={18}/></button>{actions === item.ingredient.id && <div className="grocery-more-panel"><button onClick={() => alreadyHome(item)}>{t("Déjà en réserve", "Already in my pantry")}</button>{item.personalItemId && <button onClick={() => { void perform({ action: "removePersonalItem", id: item.personalItemId! }); setActions(null); }}>{t("Retirer de la liste", "Remove from list")}</button>}</div>}</div>
          </div>
        </li>)}</ul></section> : null;
      })}
      {!needs.length && <p className="shopping-note">{t(items.some(i => i.awaitingConfirmation > 0) ? "Plus d’achat proposé. Vérifiez les formats des articles déjà commandés pour confirmer les quantités." : "Tout est couvert pour cette période. Les articles en commande restent à recevoir.", items.some(i => i.awaitingConfirmation > 0) ? "No further purchases suggested. Check ordered package sizes to confirm quantities." : "This period is covered. Ordered items still need to be received.")}</p>}
      <details className="grocery-help"><summary>{t("Comment mes quantités sont calculées", "How quantities are calculated")}</summary><p>{t("Les repas non cuisinés réservent les ingrédients dans l’ordre des dates, même hors de la période affichée. Une livraison prévue après un repas ne le couvre pas. Les achats entrent en réserve à votre confirmation; « J’ai cuisiné » retire ensuite les ingrédients. ≈ indique une conversion estimée à partir de la recette ou d’une mesure de référence de l’ingrédient. L’eau du robinet n’est pas ajoutée aux courses.", "Uncooked meals reserve ingredients in date order, including outside the visible period. A delivery after a meal does not cover it. Purchases enter your pantry when confirmed; “I cooked this” then deducts ingredients. ≈ indicates an estimate from the recipe or an ingredient reference measure. Tap water is excluded from groceries.")}</p></details>
    </div> : <div className="grocery-empty"><div className="grocery-empty-icon"><ShoppingBasket/></div><h2>{t("De quoi remplir votre cuisine.", "A little something for your kitchen.")}</h2><p>{t("Ajoutez un aliment personnel ou choisissez vos repas. Tout se rassemble ici, par rayon.", "Add a personal food or choose your meals. Everything comes together here, by aisle.")}</p><button className="primary" onClick={onPlan}>{t("Choisir mes repas", "Choose my meals")}<ArrowRight size={16}/></button></div>}
    {!!shopping.orders.some(o => o.status !== "pending") && <details className="shopping-history"><summary>{t("Mes achats précédents", "Previous purchases")}</summary>{shopping.orders.filter(o => o.status !== "pending").map(o => <details key={o.id}><summary>{o.status === "received" ? t("Rangés", "Put away") : t("Annulée", "Cancelled")} · {o.grocer || t("Mes courses", "My groceries")} · {(o.receivedAt || o.createdAt).slice(0, 10)}</summary><ul>{(o.received || o.lines).map(line => <li key={purchaseLineKey(line)}>{line.name || t(data.ingredients.find(i => i.id === line.ingredientId)?.name || "", data.ingredients.find(i => i.id === line.ingredientId)?.nameEn || "") || line.ingredientId} — {quantityLabel(line.quantity, data.preferences, locale, 1, t)}</li>)}</ul></details>)}</details>}
    {reserve && <PantryQuickAdd existing={data.pantry.filter(p => p.inStock && p.ingredientId === reserve.ingredient.id)} onEdit={id => { setReserve(null); onPantry(id); }} ingredient={reserve.ingredient} needed={{ ...reserve.quantity, value: reserve.quantity.value || reserve.required }} units={data.preferences} locale={locale} onClose={() => setReserve(null)} onSave={async item => { await onPantrySave(item); setStatus(t("Réserves mises à jour. La liste a été recalculée.", "Pantry updated. The list has been recalculated.")); }}/> }
    {addingPersonal && <PersonalGroceryEditor locale={locale} units={data.preferences} onClose={() => setAddingPersonal(false)} onSave={onSave}/>}
    {editing && <PurchaseEditor {...editing} initialLines={editing.lines} grocers={shopping.grocers} ingredients={data.ingredients} units={data.preferences} locale={locale} onClose={() => setEditing(null)} onSave={async m => { await onSave(m); setStatus(m.action === "order" && m.mode === "online" ? t("Commande enregistrée. Nous attendons votre confirmation de réception.", "Order recorded. Awaiting your receipt confirmation.") : t("Vos achats sont rangés dans vos réserves.", "Your purchases are in your pantry.")); }}/>}
  </section>;
}
