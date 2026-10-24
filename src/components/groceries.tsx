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
import { InventoryDetail } from './inventory-detail';
import { inventoryStatus, inventoryQuantities, type InventoryStatus } from '@/lib/inventory';
import { stockCatalog } from '@/lib/stock-catalog';
import { stockIdentity } from '@/lib/stock-units';
import { pantryQuantityLabel } from "@/lib/pantry";

export function GroceryList({ data, locale, week, onPlan, onOpen, onPantry, onSettings, onSave, onPantrySave }: {
  data: ShoppingWorkspace; locale: Locale; week: string; onPlan: () => void; onOpen: (recipe: Recipe) => void;
  onPantrySave: (item: PantryItem) => Promise<void>;
  onPantry: (id?: string) => void; onSettings: () => void; onSave: (value: ShoppingMutation) => Promise<void>;
}) {
  const t = useText(locale);
  const shopping = shoppingState(data), range = shopping.range || { start: week, end: addDays(week, 6) };
  const [dates, setDates] = useState(range), [optional, setOptional] = useState(false), [filter, setFilter] = useState<InventoryStatus | "all">("buy");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ mode: "store" | "online"; lines: PurchaseLine[]; initialGrocerId?: string } | null>(null);
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [reserve, setReserve] = useState<(typeof items)[number] | null>(null);
  const [detail, setDetail] = useState<string | null>(null), [query, setQuery] = useState("");
  const [actions, setActions] = useState<string | null>(null);
  const result = useMemo(() => shoppingNeeds(data, data, range.start, range.end, optional), [data, range.start, range.end, optional]);
  const items = result.items.sort((a, b) => (t(a.ingredient.name, a.ingredient.nameEn)).localeCompare(t(b.ingredient.name, b.ingredient.nameEn), locale));
  const selection = useShoppingSelection(range, shopping.selections[periodKey(range.start, range.end)] || [], onSave);
  const selected = selection.selected;
  const needs = items.filter(i => toBuyQuantity(i).value > 0 && inventoryStatus(i) !== "check").map(i => ({ ...i, quantity: toBuyQuantity(i) })), picked = needs.filter(i => selected.includes(i.ingredient.id));
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
  const labels = { buy: t("À acheter", "To buy"), covered: t("Couvert", "Covered"), pending: t("En commande", "On order"), check: t("À vérifier", "To check") };
  const shown = items.filter(i => (filter === "all" || inventoryStatus(i) === filter) && name(i).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const eligible = shown.filter(i => toBuyQuantity(i).value > 0 && inventoryStatus(i) !== "check");
  const checked = eligible.filter(i => selected.includes(i.ingredient.id));
  const q = (item: (typeof items)[number], value: number) => quantityLabel({...item.quantity, value}, data.preferences, locale, 1, t);
  return <section className="grocery-page inventory-page">
    <div className="grocery-heading"><div className="page-heading"><h1>{t("Ma liste d’épicerie.", "My grocery list.")}</h1><p>{t("Vos recettes et vos envies, moins vos réserves et vos commandes.", "Your recipes and personal picks, minus pantry stock and orders.")}</p></div>
      <div className="grocery-actions"><button className="primary" onClick={() => setAddingPersonal(true)}><Plus size={16}/>{t("Ajouter un aliment", "Add a food")}</button><button className="secondary" onClick={() => onPantry()}><PackageCheck size={16}/>{t("Voir mes réserves", "View my pantry")}</button><button className="text-button" onClick={onPlan}>{t("Voir les repas", "View meals")}<ArrowRight size={16}/></button></div></div>
    <div className="grocery-controls shopping-controls">
      <form className="shopping-dates" onSubmit={e => { e.preventDefault(); void changeRange(dates); }}>
        <label>{t("Du", "From")}<input required aria-label={t("Début des courses", "Shopping start")} type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })}/></label>
        <label>{t("Au", "To")}<input required aria-label={t("Fin des courses", "Shopping end")} type="date" min={dates.start} value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })}/></label>
        <button className="secondary" disabled={busy}>{t("Afficher", "Show")}</button>
        <div className="shopping-shortcuts">{[3, 7, 14].map(days => <button type="button" disabled={busy} key={days} onClick={() => void changeRange({ start: localToday(), end: addDays(localToday(), days - 1) })}>{days} {t("j", "d")}</button>)}</div>
      </form>
      <div className="grocery-toolbar"><label className="shopping-checkbox"><input type="checkbox" aria-label={t("Inclure les ingrédients facultatifs", "Include optional ingredients")} checked={optional} onChange={e => setOptional(e.target.checked)}/>{t("Facultatifs", "Optional")}</label></div>
    </div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}{status && <p className="grocery-status" role="status">{t(status)}</p>}
    <div className="inventory-status-grid">{(Object.keys(labels) as InventoryStatus[]).map(key => <button key={key} className={`inventory-status-card ${key}`} aria-pressed={filter === key} onClick={() => setFilter(key)}><span>{labels[key]}</span><strong>{items.filter(i => inventoryStatus(i) === key).length}</strong></button>)}</div>
    {shopping.orders.some(o => o.status === "pending") && <details className="inventory-orders-peek"><summary>{t("Mes commandes en attente", "My pending orders")} · {shopping.orders.filter(o => o.status === "pending").length}</summary><PendingOrders data={data} locale={locale} onSave={onSave}/></details>}
    {!!result.missing && <p role="alert" className="form-error">{t("La liste est incomplète : une recette ou un ingrédient est indisponible.", "This list is incomplete: a recipe or ingredient is unavailable.")}</p>}
    <div className="grocery-paper inventory-paper">
      <header className="inventory-table-toolbar"><div><h2>{filter === "all" ? t("Tous mes ingrédients", "All my ingredients") : labels[filter]}</h2><small>{result.meals} {t("repas prévus", "planned meals")} · {range.start} — {range.end}</small></div><label><input type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label={t("Rechercher un ingrédient", "Search ingredients")} placeholder={t("Rechercher un ingrédient", "Search ingredients")}/></label><button className="text-button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{t("Tout voir", "Show all")}</button><button className="secondary" onClick={() => void copy()}><Copy size={15}/>{t("Copier la liste", "Copy list")}</button></header>
      {filter === "check" && <p className="inventory-caption">{t("Un format ou une quantité reste à préciser. Vérifiez l’aliment avant d’en acheter davantage.", "A package size or quantity needs clarification. Check the food before buying more.")}</p>}
      {(selection.error || selection.saving) && <div className="grocery-selection-status" role="status">{selection.error ? <>{t("Sélection non enregistrée. Vos choix restent affichés.", "Selection not saved. Your choices are still shown.")} <button className="text-button" onClick={selection.retry}>{t("Réessayer", "Retry")}</button></> : t("Enregistrement de la sélection…", "Saving selection…")}</div>}
      <div className="inventory-scroll"><div className="inventory-column-headings"><input type="checkbox" aria-label={t("Tout sélectionner", "Select all")} checked={eligible.length > 0 && checked.length === eligible.length} ref={el => { if(el) el.indeterminate = checked.length > 0 && checked.length < eligible.length; }} disabled={!eligible.length} onChange={e => selection.select(eligible.map(i => i.ingredient.id), e.target.checked)}/><span>{t("Ingrédient", "Ingredient")}</span><span>{t("À la maison", "At home")}</span><span>{t("Pour ces repas", "For these meals")}</span><span>{t("À acheter", "To buy")}</span><span>{t("Pour ces recettes", "For these recipes")}</span><span/></div>
      {aisles.map(aisle => {
        const group = shown.filter(i => ingredientAisle(i.ingredient) === aisle);
        return group.length ? <section className="grocery-aisle" key={aisle}><h2>{aisleLabel(aisle, locale)} <small>{group.length}</small></h2><ul className="inventory-rows">{group.map(item => {
          const state = inventoryStatus(item), physical = inventoryQuantities(data, result, item.ingredient.id);
          return <li className={selected.includes(item.ingredient.id) ? "is-picked" : ""} key={item.ingredient.id}>
          <input type="checkbox" checked={toBuyQuantity(item).value > 0 && state !== "check" && selected.includes(item.ingredient.id)} disabled={toBuyQuantity(item).value <= 0 || state === "check"} aria-label={`${t("Cocher", "Check")} ${name(item)}`} onChange={e => selection.select([item.ingredient.id], e.target.checked)}/>
          <div><button className="inventory-food-name" onClick={() => setDetail(item.ingredient.id)}>{name(item)}</button><small className={`inventory-badge ${state}`}>{labels[state]}</small>{item.sources.length > 0 && <small>{item.sources.map(s => `${s.grocer} · ${s.date}`).join(", ")}</small>}</div>
          <div className="inventory-number">{physical.length ? physical.map(value => quantityLabel(value, data.preferences, locale, 1, t)).join(" + ") : item.personalItemId && item.onHand ? q(item, item.onHand) : "—"}</div>
          <div className="inventory-number">{q(item, item.required)}{item.onHand > 0 && <small>{q(item, item.onHand)} {t("réservés ici", "reserved here")}</small>}</div>
          <div className="inventory-number"><strong className={toBuyQuantity(item).value > 0 && state !== "check" ? "inventory-short" : "inventory-positive"}>{state === "check" ? t("À préciser", "To clarify") : toBuyQuantity(item).value > 0 ? q(item, toBuyQuantity(item).value) : "—"}</strong>{item.pending > 0 && <small>{q(item, item.pending)} {t("attendus", "expected")}</small>}</div>
          <div className="inventory-recipe-links">{item.personalItemId ? t("Ajout personnel", "Personal item") : item.uses.map(({recipe, meals}) => <button className="text-button" key={recipe.id} onClick={() => onOpen(recipe)}>{t(recipe.title, recipe.titleEn)}{meals > 1 ? ` ×${meals}` : ""}</button>)}</div>
          <div className="inventory-row-actions"><button className="icon-button" title={t("Déjà en réserve", "Already in my pantry")} aria-label={`${t("Déjà en réserve", "Already in my pantry")} : ${name(item)}`} onClick={() => alreadyHome(item)}><Refrigerator size={17}/></button>{item.personalItemId && <button className="icon-button" aria-label={`${t("Retirer de la liste", "Remove from list")} : ${name(item)}`} disabled={busy} onClick={() => void perform({action:"removePersonalItem",id:item.personalItemId!})}><Trash2 size={15}/></button>}</div>
        </li>; })}</ul></section> : null;
      })}</div>
      {!shown.length && <div className="inventory-empty"><ShoppingBasket/><h3>{query ? t("Aucun résultat", "No results") : filter === "buy" ? t("Rien à acheter ici", "Nothing to buy here") : t("Aucun aliment dans cette vue", "No foods in this view")}</h3><p>{t("Consultez les autres états ou ajustez les dates de vos courses.", "Check the other statuses or adjust your shopping dates.")}</p><button className="secondary" onClick={() => setFilter("all")}>{t("Tout voir", "Show all")}</button></div>}
      <footer className="inventory-table-foot"><span>{t("Cliquez sur un aliment pour voir à quels repas il est réservé.", "Click a food to see which meals it is reserved for.")}</span><button className="text-button" onClick={onSettings}>{t("Mes épiciers", "My grocers")}</button></footer>
    </div>
    <div className="inventory-purchase-bar"><span><b>{picked.length || needs.length}</b> {picked.length ? t("articles sélectionnés", "selected items") : t("articles à acheter", "items to buy")}</span><button className="secondary" disabled={busy || !needs.length} onClick={() => prepare("store")}>{t("J’ai acheté", "I bought these")}</button><button className="primary" disabled={busy || !needs.length} onClick={() => prepare("online")}>{t("Préparer ma commande", "Prepare my order")}</button></div>
    {detail && <InventoryDetail ingredientId={detail} data={data} report={result} locale={locale} onClose={() => setDetail(null)} onEdit={id => { setDetail(null); onPantry(id); }} onMeals={onPlan}/>}
    {reserve && <PantryQuickAdd existing={data.pantry.filter(p => p.inStock && stockIdentity(p.ingredientId, stockCatalog(data, data).ingredients) === reserve.ingredient.id)} onEdit={id => { setReserve(null); onPantry(id); }} ingredient={reserve.ingredient} needed={{ ...reserve.quantity, value: reserve.quantity.value || reserve.required }} units={data.preferences} locale={locale} onClose={() => setReserve(null)} onSave={async item => { await onPantrySave(item); setStatus(t("Réserves mises à jour. La liste a été recalculée.", "Pantry updated. The list has been recalculated.")); }}/> }
    {addingPersonal && <PersonalGroceryEditor locale={locale} units={data.preferences} onClose={() => setAddingPersonal(false)} onSave={onSave}/>}
    {editing && <PurchaseEditor {...editing} initialLines={editing.lines} grocers={shopping.grocers} ingredients={data.ingredients} units={data.preferences} locale={locale} onClose={() => setEditing(null)} onSave={async m => { await onSave(m); setStatus(m.action === "order" && m.mode === "online" ? t("Commande enregistrée. Nous attendons votre confirmation de réception.", "Order recorded. Awaiting your receipt confirmation.") : t("Vos achats sont rangés dans vos réserves.", "Your purchases are in your pantry.")); }}/>}
  </section>;
}
