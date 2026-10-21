"use client";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import type { Grocer } from "@/lib/shopping-types";
import { shoppingMutation } from "@/lib/shopping";
import { grocerCategories, grocerCategoryLabel, normalizePostalCode, postalCodePattern } from "@/lib/grocer-preferences";
import type { InstacartRetailer } from "@/lib/instacart";

export function GrocerSettings({ grocers, postalCode = "", locale, onSave, onPostalCode }: {
  grocers: Grocer[]; postalCode?: string; locale: Locale; onSave: (grocers: Grocer[]) => Promise<void>;
  onPostalCode: (postalCode: string) => Promise<void>;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const [editing, setEditing] = useState<Grocer | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [postal, setPostal] = useState(postalCode), [retailers, setRetailers] = useState<InstacartRetailer[]>([]), [notice, setNotice] = useState("");
  async function savePostal(search: boolean) {
    const code = normalizePostalCode(postal);
    setError(""); setNotice(""); setRetailers([]);
    if (code && !postalCodePattern.test(code) || search && !code) { setError(t("Entrez un code postal canadien valide.", "Enter a valid Canadian postal code.")); return; }
    setBusy(true);
    try {
      await onPostalCode(code); setPostal(code);
      setNotice(t("Code postal enregistré.", "Postal code saved."));
      if (search) {
        const response = await fetch("/api/shopping/instacart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retailers", postalCode: code, locale }) });
        const result = await response.json();
        if (!response.ok) {
          setError(result.error === "unauthorized"
            ? t("La recherche Instacart est accessible dans votre espace connecté.", "Instacart search is available in your signed-in workspace.")
            : result.error === "instacart_not_configured"
              ? t("La connexion Instacart n’est pas encore activée. Vous pouvez ajouter vos épiciers manuellement.", "Instacart is not connected yet. You can add your grocers manually.")
              : t("La recherche n’a pas abouti. Réessayez ou ajoutez votre épicier manuellement.", "Search failed. Retry or add your grocer manually."));
        } else { setRetailers(result.retailers); setNotice(result.development ? t("Mode test Instacart : ces enseignes ne confirment pas la couverture réelle de votre adresse.", "Instacart test mode: these retailers do not confirm actual coverage at your address.") : result.retailers.length ? t("Choisissez une enseigne à ajouter à vos préférences.", "Choose a retailer to add to your preferences.") : t("Aucune enseigne trouvée pour ce code postal.", "No retailers found for this postal code.")); }
      }
    } catch { setError(t("La demande n’a pas abouti. Réessayez.", "The request failed. Please retry.")); }
    finally { setBusy(false); }
  }
  async function save(next: Grocer[]) {
    setError("");
    if (!shoppingMutation.safeParse({ action: "grocers", grocers: next }).success) { setError(t("Indiquez un nom et, si vous le souhaitez, une adresse https:// valide.", "Enter a name and, optionally, a valid https:// address.")); return; }
    setBusy(true);
    try { await onSave(next); setEditing(null); } catch { setError(t("La modification n’a pas été enregistrée. Réessayez ou rechargez si une autre page est ouverte.", "Changes were not saved. Retry or reload if another page is open.")); } finally { setBusy(false); }
  }
  return <section className="grocer-settings card" aria-labelledby="grocer-title">
    <header><div><h3 id="grocer-title">{t("Mes épiciers préférés", "My preferred grocers")}</h3><p>{t("Choisissez où acheter chaque catégorie : votre boucher pour le bœuf, votre épicerie pour les fruits et légumes…", "Choose where to buy each category: your butcher for beef, your grocer for fruit and vegetables…")}</p></div>
      <button className="secondary" disabled={busy || !!editing || grocers.length >= 20} onClick={() => setEditing({ id: crypto.randomUUID(), name: "", url: "", fulfillment: "delivery", favorite: !grocers.length })}>{t("Ajouter un épicier", "Add a grocer")}</button></header>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form className="grocer-postal" onSubmit={e => { e.preventDefault(); void savePostal(false); }}>
      <label>{t("Mon code postal", "My postal code")}<input autoComplete="postal-code" maxLength={12} value={postal} placeholder="H2X 1Y4" onChange={e => { setPostal(e.target.value); setRetailers([]); }} /></label>
      <button className="secondary" disabled={busy}>{t("Enregistrer le code postal", "Save postal code")}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => void savePostal(true)}>{t("Trouver les enseignes Instacart", "Find Instacart retailers")}</button>
    </form>
    <p>{t("La recherche transmet votre code postal à Instacart. Ajoutez aussi vos commerces locaux, même s’ils ne sont pas sur Instacart.", "Searching shares your postal code with Instacart. You can also add local stores that are not on Instacart.")}</p>
    {!!retailers.length && <ul className="grocer-retailers">{retailers.map(r => <li key={r.retailer_key}><span>{r.name}</span><button className="text-button" disabled={busy || !!editing || grocers.length >= 20 || grocers.some(g => g.name === r.name)} onClick={() => setEditing({ id: crypto.randomUUID(), name: r.name, url: "", fulfillment: "delivery", favorite: !grocers.length })}>{t("Ajouter", "Add")}</button></li>)}</ul>}
    <ul className="grocer-list">{grocers.map(g => <li key={g.id}><span><strong>{g.name}{g.favorite ? " ★" : ""}</strong><small>{g.fulfillment === "delivery" ? t("Livraison", "Delivery") : t("Cueillette", "Pickup")}{g.categories?.length ? ` · ${g.categories.map(c => grocerCategoryLabel(c, locale)).join(", ")}` : ""}</small></span><button className="text-button" disabled={busy || !!editing} onClick={() => setEditing(g)}>{t("Modifier", "Edit")}</button><button className="text-button" disabled={busy || !!editing} onClick={() => void save(grocers.filter(x => x.id !== g.id))}>{t("Retirer", "Remove")}</button></li>)}</ul>
    {editing && <form className="grocer-form" onSubmit={e => { e.preventDefault(); void save([...grocers.filter(g => g.id !== editing.id).map(g => ({ ...g, favorite: editing.favorite ? false : g.favorite, categories: g.categories?.filter(c => !editing.categories?.includes(c)) })), editing]); }}>
      <label>{t("Nom de l’épicier", "Grocer name")}<input required maxLength={100} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
      <label>{t("Site Web (facultatif)", "Website (optional)")}<input type="url" placeholder="https://" maxLength={2048} value={editing.url} onChange={e => setEditing({ ...editing, url: e.target.value })} /></label>
      <label>{t("Réception habituelle", "Usual fulfillment")}<select value={editing.fulfillment} onChange={e => setEditing({ ...editing, fulfillment: e.target.value as Grocer["fulfillment"] })}><option value="delivery">{t("Livraison", "Delivery")}</option><option value="pickup">{t("Cueillette", "Pickup")}</option></select></label>
      <label className="shopping-checkbox"><input type="checkbox" checked={editing.favorite} onChange={e => setEditing({ ...editing, favorite: e.target.checked })} />{t("Mon premier choix", "My first choice")}</label>
      <fieldset className="grocer-categories" disabled={busy}><legend>{t("J’achète ici", "I buy here")}</legend><p>{t("Une catégorie précise, comme le bœuf, passe avant « Viandes et volailles ». Une catégorie choisie ici sera retirée de l’autre épicier.", "A specific category, such as beef, takes priority over “Meat & poultry”. Selecting a category here removes it from the other grocer.")}</p><div>{grocerCategories.map(category => <label className="shopping-checkbox" key={category}><input type="checkbox" checked={editing.categories?.includes(category) || false} onChange={e => setEditing({ ...editing, categories: e.target.checked ? [...(editing.categories || []), category] : editing.categories?.filter(c => c !== category) })}/>{grocerCategoryLabel(category, locale)}</label>)}</div></fieldset>
      <div className="shopping-buttons"><button type="button" className="text-button" disabled={busy} onClick={() => setEditing(null)}>{t("Annuler", "Cancel")}</button><button className="primary" disabled={busy}>{t("Enregistrer l’épicier", "Save grocer")}</button></div>
    </form>}
  </section>;
}
