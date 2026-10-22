"use client";
import { useEffect, useState } from "react";
import { Plus, Tags } from "lucide-react";
import { defaultRecipeTags, type RecipeTag } from "@/lib/recipe-tags";
import type { Locale } from "@/lib/locale";
import { AppSelect } from "./app-select";
export function RecipeTagAdmin({ locale }: { locale: Locale }) {
  const [tags, setTags] = useState(defaultRecipeTags), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  useEffect(() => { fetch("/api/recipes/tags").then(async r => { if (!r.ok) throw Error(); setTags((await r.json()).tags); }).catch(() => setMessage(t("Les tags n’ont pas pu être chargés. Réessayez en rouvrant cette page.", "Tags could not be loaded. Reopen this page to retry."))); }, []);
  return <section className="card recipe-tag-admin"><h2><Tags size={21}/>{t("Les tags de recettes", "Recipe tags")}</h2><p>{t("Créez les repères qui apparaissent dans les filtres. L’attribution aux recettes est préparée avec Codex lors de la mise à jour du catalogue.", "Create labels that appear in the filters. Recipe assignments are prepared with Codex when the catalog is updated.")}</p>
    <div className="recipe-tag-list">{tags.map(tag => <span className="recipe-tag" key={tag.id}>{locale === "fr" ? tag.label : tag.label_en}</span>)}</div>
    <form onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setBusy(true); setMessage(""); try { const r = await fetch("/api/recipes/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(values)) }); if (!r.ok) throw Error(r.status === 409 ? "duplicate" : "failed"); const data: { tags: RecipeTag[] } = await r.json(); setTags(data.tags); form.reset(); setMessage(t("Tag ajouté. Il est disponible dans les filtres.", "Tag added. It is available in the filters.")); } catch (e) { setMessage((e as Error).message === "duplicate" ? t("Ce tag existe déjà.", "This tag already exists.") : t("L’ajout a échoué. Réessayez.", "Could not add tag. Please retry.")); } finally { setBusy(false); } }}>
      <label>{t("Nom français", "French label")}<input name="label" maxLength={50} required/></label>
      <label>{t("Nom anglais", "English label")}<input name="label_en" maxLength={50} required/></label>
      <label>{t("Catégorie", "Category")}<AppSelect name="category" defaultValue="tag"><option value="tag">Tag</option><option value="type">{t("Type de plat", "Recipe type")}</option><option value="diet">{t("Régime alimentaire", "Diet")}</option></AppSelect></label>
      <button className="primary" disabled={busy}><Plus size={16}/>{t("Ajouter", "Add")}</button>
    </form>{message && <p role="status">{message}</p>}
  </section>;
}
