"use client";
import { useText } from "./locale-provider";

import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { AppSelect } from "./app-select";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import type { Grocer } from "@/lib/shopping-types";
import { shoppingMutation } from "@/lib/shopping";
import { grocerCategories, grocerCategoryLabel } from "@/lib/grocer-preferences";

export function GrocerSettings({ grocers, locale, onSave }: {
  grocers: Grocer[]; locale: Locale; onSave: (grocers: Grocer[]) => Promise<void>;
}) {
  const t = useText(locale);
  const [editing, setEditing] = useState<Grocer | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(next: Grocer[]) {
    setError("");
    if (!shoppingMutation.safeParse({ action: "grocers", grocers: next }).success) { setError(t("Indiquez un nom et, si vous le souhaitez, une adresse https:// valide.", "Enter a name and, optionally, a valid https:// address.")); return; }
    setBusy(true);
    try { await onSave(next); setEditing(null); } catch { setError(t("La modification n’a pas été enregistrée. Réessayez ou rechargez si une autre page est ouverte.", "Changes were not saved. Retry or reload if another page is open.")); } finally { setBusy(false); }
  }
  return <section className="grocer-settings card" aria-labelledby="grocer-title">
    <header><div><h3 id="grocer-title">{t("Mes épiciers préférés", "My preferred grocers")}</h3><p>{t("Choisissez où acheter chaque catégorie : votre boucher pour le bœuf, votre épicerie pour les fruits et légumes…", "Choose where to buy each category: your butcher for beef, your grocer for fruit and vegetables…")}</p></div>
      <button className="secondary" disabled={busy || !!editing || grocers.length >= 20} onClick={() => setEditing({ id: crypto.randomUUID(), name: "", url: "", fulfillment: "delivery", favorite: !grocers.length })}>{t("Ajouter un épicier", "Add a grocer")}</button></header>
    {error && <p role="alert">{t(error)}</p>}
    <ul className="grocer-list">{grocers.map(g => <li key={g.id}><span><strong>{g.name}{g.favorite ? " ★" : ""}</strong><small>{g.fulfillment === "delivery" ? t("Livraison", "Delivery") : t("Cueillette", "Pickup")}{g.categories?.length ? ` · ${g.categories.map(c => grocerCategoryLabel(c, locale)).join(", ")}` : ""}</small></span><button className="text-button" disabled={busy || !!editing} onClick={() => setEditing(g)}>{t("Modifier", "Edit")}</button><button className="text-button" disabled={busy || !!editing} onClick={() => void save(grocers.filter(x => x.id !== g.id))}>{t("Retirer", "Remove")}</button></li>)}</ul>
    {editing && <form className="grocer-form" onSubmit={e => { e.preventDefault(); void save([...grocers.filter(g => g.id !== editing.id).map(g => ({ ...g, favorite: editing.favorite ? false : g.favorite, categories: g.categories?.filter(c => !editing.categories?.includes(c)) })), editing]); }}>
      <label>{t("Nom de l’épicier", "Grocer name")}<input required maxLength={100} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
      <label>{t("Site Web (facultatif)", "Website (optional)")}<input type="url" placeholder="https://" maxLength={2048} value={editing.url} onChange={e => setEditing({ ...editing, url: e.target.value })} /></label>
      <label>{t("Réception habituelle", "Usual fulfillment")}<AppSelect value={editing.fulfillment} onChange={e => setEditing({ ...editing, fulfillment: e.target.value as Grocer["fulfillment"] })}><option value="delivery">{t("Livraison", "Delivery")}</option><option value="pickup">{t("Cueillette", "Pickup")}</option></AppSelect></label>
      <label className="shopping-checkbox"><input type="checkbox" checked={editing.favorite} onChange={e => setEditing({ ...editing, favorite: e.target.checked })} />{t("Mon premier choix", "My first choice")}</label>
      <fieldset className="grocer-categories" disabled={busy}><legend>{t("J’achète ici", "I buy here")}</legend><p>{t("Une catégorie précise, comme le bœuf, passe avant « Viandes et volailles ». Une catégorie choisie ici sera retirée de l’autre épicier.", "A specific category, such as beef, takes priority over “Meat & poultry”. Selecting a category here removes it from the other grocer.")}</p><div>{grocerCategories.map(category => <label className="shopping-checkbox" key={category}><input type="checkbox" checked={editing.categories?.includes(category) || false} onChange={e => setEditing({ ...editing, categories: e.target.checked ? [...(editing.categories || []), category] : editing.categories?.filter(c => c !== category) })}/>{grocerCategoryLabel(category, locale)}</label>)}</div></fieldset>
      <div className="shopping-buttons"><button type="button" className="text-button" disabled={busy} onClick={() => setEditing(null)}>{t("Annuler", "Cancel")}</button><button className="primary" disabled={busy}>{t("Enregistrer l’épicier", "Save grocer")}</button></div>
    </form>}
  </section>;
}
