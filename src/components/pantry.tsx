"use client";
import { useState, type ReactNode } from "react";
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
} from "@/lib/pantry";
import { quantityLabel } from "@/lib/units";
import { pantrySchema } from "@/lib/validation";
import { useShoppingDialog } from "./use-shopping-dialog";

function PantryEditor({ title, locale, busy, onClose, children }: {
  title: string; locale: Locale; busy: boolean; onClose: () => void; children: ReactNode;
}) {
  const dialog = useShoppingDialog();
  return <dialog ref={dialog} className="shopping-dialog pantry-editor" aria-labelledby="pantry-editor-title" onCancel={e => busy ? e.preventDefault() : onClose()}>
    <header><h2 id="pantry-editor-title">{title}</h2><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label={locale === "fr" ? "Fermer" : "Close"}><X size={20}/></button></header>
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
}: {
  items: PantryItem[];
  ingredients: Ingredient[];
  units: UnitPreferences;
  locale: Locale;
  onSave: (item: PantryItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGroceries: () => void;
  deliveries?: ReactNode;
}) {
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PantryLocation | "all">("all");
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<Quantity["kind"]>("volume");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const sortedIngredients = [...ingredients].sort((a, b) =>
    (locale === "fr" ? a.name : a.nameEn).localeCompare(
      locale === "fr" ? b.name : b.nameEn,
      locale,
    ),
  );
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const filtered = items.filter((p) =>
    normalize(pantryName(p, ingredients, locale)).includes(normalize(query)),
  );
  function closeEditor() {
    setEditing(null);
    setError("");
  }
  function edit(item?: PantryItem) {
    setEditing(
      item || {
        id: crypto.randomUUID(),
        ingredientId: ingredients[0]?.id || null,
        name: ingredients[0]?.name || "",
        location: filter === "all" ? "cupboard" : filter,
        quantity: null,
        note: "",
        inStock: true,
      },
    );
    setKind(item?.quantity?.kind || "volume");
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
    const parsed = pantrySchema.safeParse({ ...editing, quantity });
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
        <button className="text-button" onClick={onGroceries}>
          {t("Ma liste d’épicerie", "My grocery list")}
        </button>
      </div>
      {error && !editing && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="grocery-status" role="status">
          {status}
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
              <select
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
                  });
                }}
              >
                {sortedIngredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {locale === "fr" ? i.name : i.nameEn}
                  </option>
                ))}
                <option value="custom">
                  {t("Un autre aliment…", "Another food…")}
                </option>
              </select>
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
            <label>
              {t("Où le ranger", "Where it belongs")}
              <select
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
              </select>
            </label>
            <label>
              {t("Mesure", "Measure")}
              <select
                aria-label={t("Mesure", "Measure")}
                value={kind}
                disabled={busy}
                onChange={(e) => {
                  setKind(e.target.value as Quantity["kind"]);
                  setAmount("");
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
              </select>
            </label>
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
                "Pour retrouver cet aliment dans l’épicerie des recettes, choisissez son nom dans la liste lorsqu’il y apparaît.",
                "To match this food with recipe groceries, choose its name from the list when available.",
              )}
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
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
      <div className="pantry-groups">
        {pantryLocations
          .filter((l) => filter === "all" || l === filter)
          .map((location) => {
            const group = filtered
              .filter((p) => p.location === location)
              .sort(
                (a, b) =>
                  Number(b.inStock) - Number(a.inStock) ||
                  pantryName(a, ingredients, locale).localeCompare(
                    pantryName(b, ingredients, locale),
                    locale,
                  ),
              );
            return group.length ? (
              <section className="pantry-group" key={location}>
                <h2>
                  {pantryLabel(location, locale)} <small>{group.length}</small>
                </h2>
                <ul>
                  {group.map((item) => (
                    <li
                      key={item.id}
                      className={item.inStock ? "" : "pantry-empty-item"}
                    >
                      <div className="pantry-item-copy">
                        <h3>{item.location === "freezer" && <Snowflake size={14} aria-label={t("Congelé", "Frozen")}/>} {pantryName(item, ingredients, locale)}</h3>
                        {item.quantity && (
                          <span>
                            {quantityLabel(item.quantity, units, locale)}
                          </span>
                        )}
                        {item.note && <p>{item.note}</p>}
                        <small>
                          {item.inStock
                            ? t("À la maison", "At home")
                            : t("À renouveler", "To replenish")}
                        </small>
                      </div>
                      <div className="pantry-item-actions">
                        <button
                          className="text-button"
                          disabled={busy || !!editing}
                          onClick={() =>
                            void perform(
                              () => onSave({ ...item, inStock: !item.inStock }),
                              t(
                                "Vos réserves sont à jour.",
                                "Your pantry is up to date.",
                              ),
                            )
                          }
                        >
                          <Check size={14} />
                          {item.inStock
                            ? t("Il n’en reste plus", "All used up")
                            : t("J’en ai de nouveau", "Restocked")}
                        </button>
                        <button
                          className="icon-button"
                          disabled={busy || !!editing}
                          aria-label={`${t("Modifier", "Edit")} ${pantryName(item, ingredients, locale)}`}
                          onClick={() => edit(item)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={busy || !!editing}
                          aria-label={`${t("Retirer des réserves", "Remove from pantry")} ${pantryName(item, ingredients, locale)}`}
                          onClick={() =>
                            void perform(
                              () => onDelete(item.id),
                              t(
                                "Aliment retiré de vos réserves.",
                                "Food removed from your pantry.",
                              ),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null;
          })}
      </div>
    </section>
  );
}
