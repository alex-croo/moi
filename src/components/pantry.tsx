"use client";
import { useText } from "./locale-provider";

import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { AppSelect } from "./app-select";
import { useMemo, useState, type ReactNode } from "react";
import { Archive, Check, Pencil, Plus, Search, Trash2, Snowflake, X } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type {
  Ingredient,
  PantryItem,
  PantryLocation,
  Quantity,
  UnitPreferences,
} from "@/lib/types";
import {
  pantryFactor,
  pantryLabel,
  pantryLocations,
  pantryName,
  pantryUnit,
  pantryAisle,
  pantryQuantityLabel,
  type PantryEntry,
} from "@/lib/pantry";
import { aisles, aisleLabel, type Aisle } from "@/lib/grocery-aisles";
import { countLabels, countMeasure, countMeasures } from "@/lib/ingredient-measures";
import { pantrySchema } from "@/lib/validation";
import { useShoppingDialog } from "./use-shopping-dialog";

import type { ShoppingWorkspace } from '@/lib/shopping-types';
import { shoppingNeeds } from '@/lib/shopping';
import { InventoryDetail } from './inventory-detail';
import { stockCatalog } from '@/lib/stock-catalog';
import { stockIdentity } from '@/lib/stock-units';

function PantryEditor({ title, locale, busy, onClose, children }: {
  title: string; locale: Locale; busy: boolean; onClose: () => void; children: ReactNode;
}) {
  const dialog = useShoppingDialog();
  return <dialog ref={dialog} className="shopping-dialog pantry-editor" aria-labelledby="pantry-editor-title" onCancel={e => busy ? e.preventDefault() : onClose()}>
    <header><h2 id="pantry-editor-title">{title}</h2><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label={regionalTr(locale, "Fermer", "Close")}><X size={20}/></button></header>
    {children}
  </dialog>;
}

export function Pantry({
  items,
  ingredients,
  units,
  locale,
  onSave,
  onDelete,
  onGroceries,
  deliveries,
  initialItemId, workspace, onMeals,
}: {
  items: PantryEntry[];
  ingredients: Ingredient[];
  units: UnitPreferences;
  locale: Locale;
  onSave: (item: PantryItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGroceries: () => void;
  deliveries?: ReactNode;
  initialItemId?: string;
  workspace?: ShoppingWorkspace; onMeals?: () => void;
}) {
  const t = useText(locale);
  const report = useMemo(() => workspace ? shoppingNeeds(workspace, workspace, "0001-01-01", "9999-12-31") : null, [workspace]);
  const [detail, setDetail] = useState<string | null>(null);
  const initialItem = items.find(p => p.id === initialItemId);
  const displayAmount = (q: Quantity | null | undefined) => q ? String(Number((q.value / pantryFactor(q.kind, units)).toPrecision(12))) : "";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PantryLocation | "all">("all");
  const [showEmpty, setShowEmpty] = useState(false);
  const [editing, setEditing] = useState<PantryEntry | null>(initialItem || null);
  const [amount, setAmount] = useState(displayAmount(initialItem?.quantity));
  const [kind, setKind] = useState<Quantity["kind"]>(initialItem?.quantity?.kind || "volume");
  const [countUnit, setCountUnit] = useState(initialItem?.quantity?.label || initialItem?.quantity?.labelEn || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const sortedIngredients = [...ingredients].sort((a, b) =>
    (t(a.name, a.nameEn)).localeCompare(
      t(b.name, b.nameEn),
      locale,
    ),
  );
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const filtered = items.filter((p) =>
    (showEmpty || p.inStock) && normalize(t(pantryName(p, ingredients, "fr"), pantryName(p, ingredients, "en"))).includes(normalize(query)) && (filter === "all" || p.location === filter),
  );
  function closeEditor() {
    setEditing(null);
    setError("");
  }
  function edit(item?: PantryEntry, custom = false) {
    setEditing(
      item || {
        id: crypto.randomUUID(),
        ingredientId: custom ? null : ingredients[0]?.id || null,
        name: custom ? "" : ingredients[0]?.name || "",
        location: filter === "all" ? "cupboard" : filter,
        quantity: null,
        note: "",
        inStock: true,
      },
    );
    setKind(item?.quantity?.kind || "volume");
    setCountUnit(item?.quantity?.label || item?.quantity?.labelEn || "");
    setAmount(
      item?.quantity
        ? String(
            Number(
              (
                item.quantity.value / pantryFactor(item.quantity.kind, units)
              ).toPrecision(12),
            ),
          )
        : "",
    );
    setError("");
    setStatus("");
  }
  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
      setStatus(success);
      return true;
    } catch (e) {
      setError(
        e instanceof Error && e.message === "conflict"
          ? t(
              "Cet aliment est déjà rangé à cet endroit. Modifiez sa fiche dans vos réserves.",
              "This food is already stored here. Edit its existing entry.",
            )
          : t(
              "L’enregistrement n’a pas abouti. Vos changements sont toujours ici : réessayez.",
              "Saving failed. Your changes are still here: please retry.",
            ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!editing) return;
    // Preserve the exact stored value when an existing quantity was not edited.
    const oldAmount = editing.quantity
      ? String(
          Number(
            (
              editing.quantity.value /
              pantryFactor(editing.quantity.kind, units)
            ).toPrecision(12),
          ),
        )
      : "";
    const quantity =
      amount === ""
        ? null
        : editing.quantity &&
            editing.quantity.kind === kind &&
            amount === oldAmount
          ? editing.quantity
          : { ...(editing.quantity?.kind === kind ? editing.quantity : {}), kind, value: Number(amount) * pantryFactor(kind, units) };
    const labeledQuantity = quantity?.kind === "count" && countUnit !== (editing.quantity?.label || editing.quantity?.labelEn || "")
      ? { ...quantity, ...countLabels(editing.ingredientId, countUnit) } : quantity;
    const parsed = pantrySchema.safeParse({ ...editing, quantity: labeledQuantity });
    if (!parsed.success) {
      setError(
        t(
          "Vérifiez le nom et la quantité de cet aliment.",
          "Please check the food name and quantity.",
        ),
      );
      return;
    }
    if (
      await perform(
        () => onSave(parsed.data),
        t("Vos réserves sont à jour.", "Your pantry is up to date."),
      )
    )
      setEditing(null);
  }
  return (
    <section className="pantry-page">
      <div className="page-heading">
        <span className="eyebrow">{t("BIEN CHEZ SOI", "AT HOME")}</span>
        <h1>{t("Mes réserves.", "My pantry.")}</h1>
        <p>
          {t(
            "Un petit tour de la cuisine avant l’épicerie. Retrouvez ce que vous avez déjà, au bon endroit.",
            "A look around the kitchen before shopping. Find what you already have, right where it belongs.",
          )}
        </p>
      </div>
      {deliveries}
      <div className="pantry-toolbar">
        <button
          className="primary"
          onClick={() => edit()}
          disabled={busy || !!editing}
        >
          <Plus size={16} />
          {t("Ajouter un aliment", "Add a food")}
        </button>
        <button className="secondary" disabled={busy || !!editing} onClick={() => edit(undefined, true)}>
          <Plus size={16}/>{t("Ajouter un aliment personnel", "Add a personal food")}
        </button>
        <button className="text-button" onClick={onGroceries}>
          {t("Ma liste d’épicerie", "My grocery list")}
        </button>
      </div>
      {error && !editing && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
      {status && (
        <p className="grocery-status" role="status">
          {t(status)}
        </p>
      )}
      {editing && (
        <PantryEditor title={items.some(p => p.id === editing.id) ? t("Modifier un aliment", "Edit a food") : t("Ajouter un aliment", "Add a food")} locale={locale} busy={busy} onClose={closeEditor}>
        <form
          className="pantry-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="pantry-fields">
            <label>
              {t("Aliment", "Food")}
              <AppSelect
                aria-label={t("Aliment", "Food")}
                value={editing.ingredientId || "custom"}
                disabled={busy}
                onChange={(e) => {
                  const ingredient = ingredients.find(
                    (i) => i.id === e.target.value,
                  );
                  setEditing({
                    ...editing,
                    ingredientId: ingredient?.id || null,
                    name: ingredient?.name || "",
                    aisle: undefined,
                  });
                  setCountUnit("");
                }}
              >
                <option value="custom">{t("Mon aliment personnel…", "My own food…")}</option>
                {sortedIngredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {t(i.name, i.nameEn)}
                  </option>
                ))}
              </AppSelect>
            </label>
            {!editing.ingredientId && (
              <label>
                {t("Nom de l’aliment", "Food name")}
                <input
                  required
                  maxLength={160}
                  value={editing.name}
                  disabled={busy}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
            )}
            <label>{t("Rayon", "Aisle")}
              <AppSelect aria-label={t("Rayon", "Aisle")} value={pantryAisle(editing, ingredients)} disabled={busy} onChange={e => setEditing({ ...editing, aisle: e.target.value as Aisle })}>
                {aisles.map(aisle => <option key={aisle} value={aisle}>{aisleLabel(aisle, locale)}</option>)}
              </AppSelect>
            </label>
            <label>
              {t("Où le ranger", "Where it belongs")}
              <AppSelect
                aria-label={t("Où le ranger", "Where it belongs")}
                value={editing.location}
                disabled={busy}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    location: e.target.value as PantryLocation,
                  })
                }
              >
                {pantryLocations.map((l) => (
                  <option key={l} value={l}>
                    {pantryLabel(l, locale)}
                  </option>
                ))}
              </AppSelect>
            </label>
            <label>
              {t("Mesure", "Measure")}
              <AppSelect
                aria-label={t("Mesure", "Measure")}
                value={kind}
                disabled={busy}
                onChange={(e) => {
                  setKind(e.target.value as Quantity["kind"]);
                  setAmount("");
                  if (e.target.value === "count") setCountUnit(countMeasures(editing.ingredientId)[0]?.label || "");
                }}
              >
                <option value="mass">{t("Poids", "Weight")}</option>
                <option value="volume">{t("Volume", "Volume")}</option>
                <option value="spoon">
                  {t("Petites quantités", "Small amounts")}
                </option>
                <option value="count">
                  {t("Nombre d’unités", "Item count")}
                </option>
              </AppSelect>
            </label>
            {kind === "count" && <label>{t("Unité comptée", "Counted unit")}
              {countMeasures(editing.ingredientId).length > 0
                ? <AppSelect aria-label={t("Unité comptée", "Counted unit")} value={countMeasure(editing.ingredientId, { kind: "count", value: 1, label: countUnit })?.label || ""} disabled={busy} onChange={e => setCountUnit(e.target.value)}>
                    <option value="">{t("Unités non précisées", "Unspecified items")}</option>
                    {countMeasures(editing.ingredientId).map(m => <option key={m.label} value={m.label}>{t(m.label, m.labelEn)}</option>)}
                  </AppSelect>
                : <input maxLength={80} value={countUnit} disabled={busy} placeholder={t("pièces, paquets…", "pieces, packs…")} onChange={e => setCountUnit(e.target.value)}/>}
            </label>}
            <label>
              {t("Quantité (facultatif)", "Quantity (optional)")} ·{" "}
              {pantryUnit(kind, units, locale)}
              <input
                type="number"
                inputMode="decimal"
                min="0.000001"
                step="any"
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            {kind === "count" && <label>{t("Poids par pièce (facultatif)", "Weight per piece (optional)")} · {units.ingredientMass}
              <input aria-label={t("Poids par pièce (facultatif)", "Weight per piece (optional)")} inputMode="decimal" type="number" min="0" step="any" disabled={busy}
                value={editing.quantity?.gramsPerItem ? Number((editing.quantity.gramsPerItem / pantryFactor("mass", units)).toPrecision(8)) : ""}
                onChange={e => setEditing({...editing,quantity:{...(editing.quantity||{kind:"count",value:0}),kind:"count",gramsPerItem:e.target.value?Number(e.target.value)*pantryFactor("mass",units):undefined,weightBasis:e.target.value?"measured":undefined}})}/>
            </label>}
            <label className="pantry-note-field">
              {t("Petit repère (facultatif)", "A little reminder (optional)")}
              <input
                value={editing.note}
                maxLength={160}
                placeholder={t(
                  "Sachet entamé, deux portions au congélo…",
                  "Open bag, two portions in the freezer…",
                )}
                disabled={busy}
                onChange={(e) =>
                  setEditing({ ...editing, note: e.target.value })
                }
              />
            </label>
          </div>
          <label className="shopping-checkbox"><input type="checkbox" checked={editing.location === "freezer"} disabled={busy} onChange={e => setEditing({ ...editing, location: e.target.checked ? "freezer" : "fridge" })}/>{t("Cet aliment est congelé", "This food is frozen")}</label>
          {editing.location === "freezer" && <p className="shopping-note">{t("Un rappel de décongélation sera proposé pour les repas qui utilisent cet aliment.", "A thawing reminder will appear for meals using this food.")}</p>}
          {!editing.ingredientId && (
            <p className="grocery-explanation">
              {t(
                "Aucune recette n’est nécessaire. Cet aliment personnel reste dans vos réserves, dans le rayon de votre choix.",
                "No recipe needed. This personal food stays in your pantry, in the aisle you choose.",
              )}
            </p>
          )}
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <footer>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={closeEditor}
            >
              {t("Annuler", "Cancel")}
            </button>
            <button className="primary" disabled={busy}>
              {busy
                ? t("Enregistrement…", "Saving…")
                : t("Garder dans mes réserves", "Save to my pantry")}
            </button>
          </footer>
        </form>
        </PantryEditor>
      )}
      <label className="recipe-search">
        <Search size={18} />
        <input
          aria-label={t("Rechercher dans mes réserves", "Search my pantry")}
          placeholder={t("Trouver un aliment…", "Find a food…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div
        className="pantry-filters"
        role="group"
        aria-label={t("Emplacements", "Locations")}
      >
        {(["all", ...pantryLocations] as const).map((l) => (
          <button
            key={l}
            className="secondary"
            aria-pressed={filter === l}
            onClick={() => setFilter(l)}
          >
            {l === "all" ? t("Tout voir", "Show all") : pantryLabel(l, locale)}
          </button>
        ))}
        <label className="shopping-checkbox"><input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)}/>{t("Afficher les aliments épuisés", "Show used-up foods")}</label>
      </div>
      {!items.length && !editing && (
        <div className="grocery-empty">
          <Archive size={32} />
          <h2>
            {t(
              "Votre cuisine a déjà de quoi vous inspirer.",
              "Your kitchen already holds a little inspiration.",
            )}
          </h2>
          <p>
            {t(
              "Notez vos huiles, vos épices, les aliments au réfrigérateur ou au congélateur. Ils seront signalés dans votre liste d’épicerie.",
              "Add oils, spices, and foods in your fridge or freezer. They will be highlighted on your grocery list.",
            )}
          </p>
        </div>
      )}
      {items.length > 0 &&
        !filtered.some((p) => filter === "all" || p.location === filter) && (
          <p>
            {t(
              "Aucun aliment à afficher ici pour le moment.",
              "No foods to show here yet.",
            )}
          </p>
        )}
      <div className="pantry-groups pantry-list inventory-pantry">
        {filtered.length > 0 && <div className="pantry-columns" aria-hidden="true"><span>{t("Aliment", "Food")}</span><span>{t("Emplacement", "Location")}</span><span>{t("À la maison", "At home")}</span><span>{t("Réservé aux repas", "Reserved for meals")}</span><span>{t("Libre", "Free")}</span><span/></div>}
        {aisles.map(aisle => {
          const group = filtered.filter(p => pantryAisle(p, ingredients) === aisle).sort((a, b) => Number(b.inStock) - Number(a.inStock) || t(pantryName(a, ingredients, "fr"), pantryName(a, ingredients, "en")).localeCompare(t(pantryName(b, ingredients, "fr"), pantryName(b, ingredients, "en")), locale));
          return group.length ? <section className="pantry-group" key={aisle} aria-label={aisleLabel(aisle, locale)}>
            <h2>{aisleLabel(aisle, locale)} <small>{group.length}</small></h2>
            <ul>{group.map(item => <li key={item.id} className={item.inStock ? "" : "pantry-empty-item"}>
              <div className="pantry-item-copy"><h3>{item.ingredientId && report ? <button className="inventory-food-name" onClick={() => setDetail(stockIdentity(item.ingredientId, workspace ? stockCatalog(workspace, workspace).ingredients : ingredients))}>{t(pantryName(item, ingredients, "fr"), pantryName(item, ingredients, "en"))}</button> : t(pantryName(item, ingredients, "fr"), pantryName(item, ingredients, "en"))}</h3>{item.note && <p>{item.note}</p>}{!item.inStock && <small>{t("À renouveler", "To replenish")}</small>}</div>
              <span className="pantry-item-location">{item.location === "freezer" && <Snowflake size={14} aria-label={t("Congelé", "Frozen")}/>} {pantryLabel(item.location, locale)}</span>
              <strong className="pantry-item-quantity">{item.quantity ? pantryQuantityLabel(item.quantity, units, locale, t) : t("Quantité à préciser", "Quantity to specify")}</strong>
              <span className="inventory-number">{item.quantity ? pantryQuantityLabel({...item.quantity, value: report?.lots.find(l => l.item.id === item.id)?.reserved || 0}, units, locale, t) : "—"}</span>
              <span className="inventory-number inventory-positive">{item.quantity ? pantryQuantityLabel({...item.quantity, value: report?.lots.find(l => l.item.id === item.id)?.free ?? (item.inStock ? item.quantity.value : 0)}, units, locale, t) : "—"}</span>
              <div className="pantry-item-actions">
                <button className="icon-button pantry-stock-toggle" disabled={busy || !!editing} aria-label={item.inStock ? t("Il n’en reste plus", "All used up") : t("J’en ai de nouveau", "Restocked")} title={item.inStock ? t("Il n’en reste plus", "All used up") : t("J’en ai de nouveau", "Restocked")} aria-pressed={item.inStock} onClick={() => void perform(() => onSave({ ...item, inStock: !item.inStock }), t("Vos réserves sont à jour.", "Your pantry is up to date."))}><Check size={15}/></button>
                <button className="icon-button" disabled={busy || !!editing} aria-label={`${t("Modifier", "Edit")} ${t(pantryName(item, ingredients, "fr"), pantryName(item, ingredients, "en"))}`} onClick={() => edit(item)}><Pencil size={15}/></button>
                <button className="icon-button" disabled={busy || !!editing} aria-label={`${t("Retirer des réserves", "Remove from pantry")} ${t(pantryName(item, ingredients, "fr"), pantryName(item, ingredients, "en"))}`} onClick={() => void perform(() => onDelete(item.id), t("Aliment retiré de vos réserves.", "Food removed from your pantry."))}><Trash2 size={15}/></button>
              </div>
            </li>)}</ul>
          </section> : null;
        })}
      </div>
      {detail && workspace && report && <InventoryDetail ingredientId={detail} data={workspace} report={report} locale={locale} onClose={() => setDetail(null)} onEdit={id => {setDetail(null);const item=items.find(p=>p.id===id);if(item)edit(item);}} onMeals={onMeals || onGroceries}/>}
    </section>
  );
}
