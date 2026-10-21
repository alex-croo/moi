"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { UnitPreferences } from "@/lib/types";
import type { Grocer } from "@/lib/shopping-types";
import type { ShoppingItem } from "@/lib/shopping";
import { preferredGrocer } from "@/lib/grocer-preferences";
import { instacartListBody, isInstacartLink } from "@/lib/instacart";
import { quantityLabel } from "@/lib/units";
import { useShoppingDialog } from "./use-shopping-dialog";

export function InstacartExport({ items, grocers, locale, units, onClose }: {
  items: ShoppingItem[]; grocers: Grocer[]; locale: Locale; units: UnitPreferences; onClose: () => void;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const dialog = useShoppingDialog();
  const links = useRef(new Map<string, { url: string; development: boolean }>());
  const [group, setGroup] = useState("all"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [availability, setAvailability] = useState<"loading" | "ready" | "unavailable" | "anonymous">("loading");
  const [status, setStatus] = useState("");
  const groups = [...new Set(items.map(i => preferredGrocer(i.ingredient, grocers)?.id || "unassigned"))];
  const chosen = items.filter(i => group === "all" || (preferredGrocer(i.ingredient, grocers)?.id || "unassigned") === group);
  const payload = { action: "export" as const, locale, items: chosen.map(i => ({ name: locale === "fr" ? i.ingredient.name : i.ingredient.nameEn, quantity: i.quantity })) };
  const signature = JSON.stringify(payload);
  const [exported, setExported] = useState<{ signature: string; url: string; development: boolean } | null>(null);
  const result = exported?.signature === signature ? exported : null;
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/shopping/instacart", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const value = await response.json();
        if (!controller.signal.aborted) setAvailability(response.status === 401 ? "anonymous" : response.ok && value.configured ? "ready" : "unavailable");
      }).catch(() => { if (!controller.signal.aborted) setAvailability("unavailable"); });
    return () => controller.abort();
  }, []);
  async function create() {
    setError(""); setStatus("");
    const cached = links.current.get(signature);
    if (cached) { setExported({ signature, ...cached }); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/shopping/instacart", { method: "POST", headers: { "Content-Type": "application/json" }, body: signature });
      const value = await response.json();
      if (!response.ok || !isInstacartLink(value.url, value.development === true)) {
        if (value.error === "instacart_not_configured") setAvailability("unavailable");
        setError(value.error === "unauthorized" ? t("Reconnectez-vous à votre espace, puis réessayez.", "Sign in to your workspace again, then retry.") : t("La liste n’a pas pu être créée sur Instacart. Vous pouvez réessayer ou copier votre liste.", "The Instacart list could not be created. Retry or copy your list."));
        return;
      }
      const next = { url: value.url as string, development: value.development === true };
      links.current.set(signature, next); setExported({ signature, ...next });
    } catch { setError(t("La connexion a échoué. Votre liste est conservée; réessayez.", "Connection failed. Your list is preserved; please retry.")); }
    finally { setBusy(false); }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(instacartListBody(payload).line_items.map(i => i.display_text).join("\n"));
      setStatus(t("Liste copiée.", "List copied.")); setError("");
    } catch { setError(t("La copie n’a pas abouti.", "Copy failed.")); }
  }
  return <dialog ref={dialog} className="shopping-dialog instacart-dialog" aria-labelledby="instacart-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <header><h2 id="instacart-title">{t("Acheter avec Instacart", "Shop with Instacart")}</h2><button className="icon-button" aria-label={t("Fermer", "Close")} disabled={busy} onClick={onClose}><X size={20}/></button></header>
    <div className="instacart-content">
      <p className="shopping-note">{t("Préparez votre liste ici, puis choisissez votre magasin et confirmez les produits, les formats et les quantités sur Instacart.", "Prepare your list here, then choose your store and confirm products, package sizes and quantities on Instacart.")}</p>
      <label className="instacart-group">{t("Articles à exporter", "Items to export")}<select value={group} disabled={busy} onChange={e => { setGroup(e.target.value); setError(""); setStatus(""); }}><option value="all">{t("Toute la liste", "Entire list")} · {items.length}</option>{groups.map(id => <option key={id} value={id}>{grocers.find(g => g.id === id)?.name || t("Sans fournisseur préféré", "No preferred supplier")} · {items.filter(i => (preferredGrocer(i.ingredient, grocers)?.id || "unassigned") === id).length}</option>)}</select></label>
      <ul className="instacart-items">{chosen.map(item => <li key={item.ingredient.id}><span>{locale === "fr" ? item.ingredient.name : item.ingredient.nameEn}<small>{preferredGrocer(item.ingredient, grocers)?.name || t("Sans fournisseur préféré", "No preferred supplier")}</small></span><strong>{item.estimated ? "≈ " : ""}{quantityLabel(item.quantity, units, locale)}</strong></li>)}</ul>
      <p className="shopping-note">{t("Vos fournisseurs servent à organiser la liste. Le magasin doit être choisi sur Instacart parmi les enseignes disponibles. Les commerces locaux absents d’Instacart restent dans vos préférences.", "Your suppliers organize the list. Choose an available retailer on Instacart. Local stores absent from Instacart remain in your preferences.")}</p>
      <p className="shopping-note">{t("En créant la liste, vous transmettez uniquement les noms et quantités affichés à Instacart. Vérifiez le prix final sur Instacart avant de payer.", "Creating the list shares only the displayed names and quantities with Instacart. Check the final price on Instacart before paying.")}</p>
      {availability === "unavailable" && <p role="status" className="shopping-note">{t("La connexion Instacart n’est pas encore activée. Votre liste est prête à être copiée.", "Instacart is not connected yet. Your list is ready to copy.")}</p>}
      {availability === "anonymous" && <p role="status" className="shopping-note">{t("Dans cette démonstration, vous pouvez préparer et copier la liste. L’export Instacart nécessite votre espace connecté.", "In this demo you can prepare and copy the list. Instacart export requires your signed-in workspace.")}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}{status && <p role="status">{status}</p>}
      {result && <div className="instacart-result" role="status"><p>{result.development ? t("Liste de test créée. Aucun achat réel n’est validé.", "Test list created. No real purchase is confirmed.") : t("Votre liste Instacart est prête. Choisissez votre magasin et vérifiez vos articles avant de commander.", "Your Instacart list is ready. Choose your store and review your items before ordering.")}</p><a className="primary" href={result.url} target="_blank" rel="noopener noreferrer">{t("Continuer sur Instacart ↗", "Continue on Instacart ↗")}</a></div>}
      <footer><button className="text-button" disabled={busy} onClick={onClose}>{t("Fermer", "Close")}</button><button className="secondary" disabled={busy || !chosen.length} onClick={() => void copy()}>{t("Copier ces articles", "Copy these items")}</button>{!result && <button className="primary" disabled={busy || availability !== "ready" || !chosen.length} onClick={() => void create()}>{busy ? t("Création…", "Creating…") : t("Créer ma liste Instacart", "Create my Instacart list")}</button>}</footer>
    </div>
  </dialog>;
}
