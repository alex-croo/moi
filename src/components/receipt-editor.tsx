"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, PackageCheck, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { Ingredient, UnitPreferences } from "@/lib/types";
import type { Purchase, PurchaseLine } from "@/lib/shopping-types";
import { compatible, type ShoppingMutation } from "@/lib/shopping";
import { receiptQuantity, receiptUnits, type ReceiptPreview, type ReceiptUnit } from "@/lib/receipt";
import { aisles, aisleLabel } from "@/lib/grocery-aisles";
import { pantryFactor, pantryLabel, pantryLocations } from "@/lib/pantry";
import { AppSelect } from "./app-select";
import { useShoppingDialog } from "./use-shopping-dialog";

type Row = { line: PurchaseLine; amount: string; unit: ReceiptUnit; review: string; checked: boolean; source: string };
function rowFor(line: PurchaseLine, units: UnitPreferences, review = "", source = "", missing = false): Row {
  const kind = line.quantity.kind;
  const unit: ReceiptUnit = kind === "mass" ? units.ingredientMass : kind === "volume" ? units.volume === "ml" ? "ml" : units.volume : kind === "spoon" ? units.spoons === "ml" ? "ml" : "tbsp" : "count";
  return { line: { ...line, id: line.id || crypto.randomUUID() }, amount: missing ? "" : String(Number((line.quantity.value / pantryFactor(kind, units)).toFixed(6))), unit, review, checked: !review, source };
}

export function ReceiptEditor({ order, ingredients, units, locale, onSave, onClose }: {
  order: Purchase; ingredients: Ingredient[]; units: UnitPreferences; locale: Locale;
  onSave: (value: ShoppingMutation) => Promise<void>; onClose: () => void;
}) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const dialog = useShoppingDialog(), controller = useRef<AbortController | null>(null), running = useRef(false);
  const [text, setText] = useState(""), [rows, setRows] = useState<Row[] | null>(null), [note, setNote] = useState("");
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null), [error, setError] = useState("");
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  function edit(index: number, change: Partial<Row>) { setRows(current => current!.map((row, i) => i === index ? { ...row, ...change } : row)); }
  function editLine(index: number, change: Partial<PurchaseLine>) {
    setRows(current => current!.map((row, i) => i === index ? { ...row, line: { ...row.line, ...change } } : row));
  }
  function close() { if (busy !== "save") { controller.current?.abort(); onClose(); } }
  async function analyze() {
    if (running.current) return;
    running.current = true; setBusy("analyze"); setError("");
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/shopping/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, text, locale }), signal: controller.current.signal });
      if (!response.ok) throw Error(response.status === 429 ? "rate_limit" : response.status === 404 ? "order_changed" : "unavailable");
      const result = await response.json() as ReceiptPreview;
      setRows(result.items.map(item => rowFor(item.line, units, item.review, item.source, item.needsQuantity)));
      setNote(result.note); setConfirmEmpty(false); dialog.current?.scrollTo({ top: 0 });
    } catch (e) {
      if (controller.current?.signal.aborted) return;
      setError(e instanceof Error && e.message === "rate_limit" ? t("Quelques instants de pause, puis réessayez. Vous pouvez aussi vérifier les articles manuellement.", "Please wait a moment and retry, or review the items manually.") : e instanceof Error && e.message === "order_changed" ? t("Cette commande a changé. Rechargez la page avant de poursuivre.", "This order has changed. Reload before continuing.") : t("L’analyse n’a pas abouti. Votre texte est conservé : réessayez ou vérifiez les articles manuellement.", "Analysis failed. Your text is still here: retry or review the items manually."));
    } finally { running.current = false; setBusy(null); }
  }
  async function save() {
    if (running.current || !rows) return;
    setError("");
    if (rows.some(row => !row.checked || !row.amount.trim() || !row.line.name?.trim())) {
      setError(t("Précisez les quantités et vérifiez les articles signalés avant de confirmer.", "Specify quantities and review the flagged items before confirming.")); return;
    }
    if (!rows.length && !confirmEmpty) { setError(t("Confirmez qu’aucun article n’a été reçu.", "Confirm that no items were received.")); return; }
    running.current = true; setBusy("save");
    try {
      const lines = rows.map(row => {
        const value = Number(row.amount.replace(",", "."));
        if (!Number.isFinite(value) || value < 0) throw Error("quantity");
        const quantity = receiptQuantity(value, row.unit, 1, row.line.quantity.label);
        const original = order.lines.find(l => l.personalItemId && l.personalItemId === row.line.personalItemId);
        return { ...row.line, quantity, personalItemId: original && compatible(original.quantity, quantity) ? row.line.personalItemId : undefined };
      });
      await onSave({ action: "receiveActual", id: order.id, lines });
      onClose();
    } catch { setError(t("La réception n’a pas été enregistrée. Vérifiez les quantités et réessayez. Si la commande a changé ailleurs, rechargez la page.", "Receipt was not saved. Check quantities and retry. If the order changed elsewhere, reload the page.")); }
    finally { running.current = false; setBusy(null); }
  }
  const unitName = (unit: ReceiptUnit) => ({ g: "g", kg: "kg", oz: "oz", lb: "lb", ml: "ml", l: "L", fl_oz: "fl oz US", cup: t("tasses US", "US cups"), tsp: t("c. à thé", "tsp"), tbsp: t("c. à soupe", "tbsp"), count: t("unités", "items") })[unit];
  const flagged = rows?.filter(row => !row.checked || !row.amount.trim()).length || 0;
  return <dialog ref={dialog} className="shopping-dialog receipt-dialog" aria-labelledby="receipt-title" onCancel={e => { e.preventDefault(); close(); }}>
    <header><div className="receipt-heading"><span className="receipt-icon"><PackageCheck size={23}/></span><div><h2 id="receipt-title">{t("J’ai reçu ma commande", "I received my order")}</h2><span>{order.grocer || t("Ma commande", "My order")} · {rows === null ? t("1. Coller la réception", "1. Paste your receipt") : t("2. Vérifier les articles", "2. Review items")}</span></div></div><button type="button" className="icon-button" disabled={busy === "save"} aria-label={t("Fermer", "Close")} onClick={close}><X size={20}/></button></header>
    <form onSubmit={e => { e.preventDefault(); void (rows === null ? analyze() : save()); }}>
      {rows === null ? <>
        <p className="shopping-note">{t("Collez le détail de votre livraison ou de votre reçu. L’IA repère les aliments, les formats et les quantités pour préparer vos réserves.", "Paste your delivery details or receipt. AI identifies foods, package sizes and quantities to prepare your pantry.")}</p>
        <label className="receipt-paste">{t("Ce que j’ai reçu", "What I received")}<textarea aria-label={t("Ce que j’ai reçu", "What I received")} value={text} onChange={e => setText(e.target.value)} maxLength={20000} minLength={3} required disabled={!!busy} rows={8} placeholder={t("Ex. :\n4 × bœuf haché extra maigre — 500 g\n2 × lait — 1 L\n1 × œufs — boîte de 12", "E.g.:\n4 × extra lean ground beef — 500 g\n2 × milk — 1 L\n1 × eggs — carton of 12")}/></label>
        <div className="receipt-reassurance"><Check size={16}/>{t("Vous vérifiez la liste avant que vos réserves soient mises à jour.", "You review the list before your pantry is updated.")}</div>
        {error && <p role="alert" className="form-error">{error}</p>}
        <footer><button type="button" className="text-button" disabled={!!busy} onClick={() => { setRows(order.lines.map(line => rowFor({ ...line, name: line.name || ingredients.find(i => i.id === line.ingredientId)?.[locale === "fr" ? "name" : "nameEn"] || "" }, units))); setError(""); }}>{t("Vérifier manuellement", "Review manually")}</button><button className="primary" disabled={!!busy || text.trim().length < 3}><Sparkles size={16}/>{busy === "analyze" ? t("Analyse de la réception…", "Reading your receipt…") : t("Préparer ma réception", "Prepare my receipt")}</button></footer>
      </> : <>
        <div className="receipt-summary"><strong>{rows.length} {t("articles à vérifier", "items to review")}</strong><span>{flagged ? `${flagged} ${t("à préciser", "to clarify")}` : t("Tout est prêt à confirmer", "Ready to confirm")}</span></div>
        <p className="shopping-note">{t("Les quantités ci-dessous sont les totaux reçus. Corrigez un format, retirez un article absent ou ajoutez un oubli. Cette réception clôturera la commande.", "Quantities below are received totals. Correct a size, remove a missing item or add anything overlooked. This receipt will close the order.")}</p>
        {note && <p className="receipt-note">{note}</p>}
        <div className="receipt-rows">{rows.map((row, index) => <section className="receipt-row" key={row.line.id} aria-label={row.line.name || t("Nouvel aliment", "New food")}>
          <div className="receipt-product"><label>{t("Aliment reçu", "Received food")}<input aria-label={`${t("Aliment reçu", "Received food")} ${index + 1}`} value={row.line.name || ""} maxLength={160} required disabled={!!busy} onChange={e => editLine(index, { name: e.target.value, ingredientId: null, personalItemId: undefined })}/></label><button type="button" disabled={!!busy} className="icon-button" aria-label={`${t("Retirer", "Remove")} ${row.line.name}`} onClick={() => setRows(current => current!.filter((_, i) => i !== index))}><Trash2 size={16}/></button></div>
          {row.line.purchaseLabel && <small className="receipt-package">{row.line.purchaseLabel}</small>}
          <div className="receipt-fields"><label>{t("Quantité totale", "Total quantity")}<input aria-label={`${t("Quantité", "Quantity")} ${row.line.name}`} value={row.amount} required inputMode="decimal" type="text" disabled={!!busy} onChange={e => edit(index, { amount: e.target.value })}/></label>
            <label>{t("Unité", "Unit")}<AppSelect disabled={!!busy} value={row.unit} onChange={e => edit(index, { unit: e.target.value as ReceiptUnit })}>{receiptUnits.map(u => <option value={u} key={u}>{unitName(u)}</option>)}</AppSelect></label>
            <label>{t("Où le ranger", "Storage")}<AppSelect disabled={!!busy} value={row.line.location} onChange={e => editLine(index, { location: e.target.value as PurchaseLine["location"] })}>{pantryLocations.map(l => <option key={l} value={l}>{pantryLabel(l, locale)}</option>)}</AppSelect></label>
          </div>
          {row.unit === "count" && <label className="receipt-count">{t("Type d’unité (gousses, pièces…)", "Count type (cloves, items…)")}<input maxLength={80} disabled={!!busy} value={row.line.quantity.label || ""} onChange={e => editLine(index, { quantity: { ...row.line.quantity, label: e.target.value, labelEn: e.target.value } })}/></label>}
          {row.review && <div className="receipt-review"><p>{row.review}</p><label><input type="checkbox" disabled={!!busy} checked={row.checked} onChange={e => edit(index, { checked: e.target.checked })}/>{t("J’ai vérifié cet article", "I reviewed this item")}</label></div>}
          <details><summary>{t("Rayon et correspondance", "Aisle and ingredient match")}</summary><div className="receipt-matching"><label>{t("Rayon", "Aisle")}<AppSelect disabled={!!busy} value={row.line.aisle || "other"} onChange={e => editLine(index, { aisle: e.target.value as PurchaseLine["aisle"] })}>{aisles.map(a => <option key={a} value={a}>{aisleLabel(a, locale)}</option>)}</AppSelect></label><label>{t("Ingrédient de mes recettes", "Recipe ingredient")}<AppSelect disabled={!!busy} value={row.line.ingredientId || ""} onChange={e => editLine(index, { ingredientId: e.target.value || null, personalItemId: undefined })}><option value="">{t("Aliment personnel", "Personal food")}</option>{ingredients.map(i => <option key={i.id} value={i.id}>{locale === "fr" ? i.name : i.nameEn}</option>)}</AppSelect></label></div>{row.source && <p className="receipt-source">{row.source}</p>}</details>
        </section>)}</div>
        {!rows.length && <label className="receipt-empty"><input type="checkbox" checked={confirmEmpty} disabled={!!busy} onChange={e => setConfirmEmpty(e.target.checked)}/>{t("Je confirme n’avoir reçu aucun article de cette commande.", "I confirm that I received no items from this order.")}</label>}
        <button type="button" className="secondary receipt-add" disabled={!!busy} onClick={() => setRows(current => [...current!, rowFor({ id: crypto.randomUUID(), ingredientId: null, name: "", location: "cupboard", aisle: "other", quantity: { kind: "volume", value: 0 } }, units, "", "", true)])}><Plus size={16}/>{t("Ajouter un aliment", "Add food")}</button>
        {error && <p role="alert" className="form-error">{error}</p>}
        <footer><button type="button" className="text-button" disabled={!!busy} onClick={() => { setRows(null); setError(""); }}><ArrowLeft size={16}/>{t("Revenir au texte", "Back to receipt")}</button><button className="primary" disabled={!!busy || flagged > 0 || !rows.length && !confirmEmpty}><PackageCheck size={17}/>{busy === "save" ? t("Enregistrement…", "Saving…") : t("Confirmer et ajouter aux réserves", "Confirm and add to pantry")}</button></footer>
      </>}
    </form>
  </dialog>;
}
