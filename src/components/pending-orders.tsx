"use client";
import { useText } from "./locale-provider";


import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { useState } from "react";
import { Truck } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { Purchase, ShoppingWorkspace } from "@/lib/shopping-types";
import { shoppingState, purchaseLineKey, type ShoppingMutation } from "@/lib/shopping";
import { localToday, quantityLabel } from "@/lib/units";
import { ReceiptEditor } from "./receipt-editor";

export function PendingOrders({ data, locale, onSave, showEmpty = false }: {
  data: ShoppingWorkspace;
  locale: Locale;
  onSave: (value: ShoppingMutation) => Promise<void>;
  showEmpty?: boolean;
}) {
  const t = useText(locale);
  const shopping = shoppingState(data);
  // Delivery dates are independent of the period selected for groceries.
  const pending = shopping.orders.filter(order => order.status === "pending")
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  const received = shopping.orders.filter(order => order.status === "received" && order.mode === "online")
    .sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")).slice(0, 10);
  const [receiving, setReceiving] = useState<Purchase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  async function save(value: ShoppingMutation, message: string) {
    setBusy(true); setError(""); setStatus("");
    try { await onSave(value); setStatus(message); }
    catch { setError(t("La mise à jour n’a pas abouti. Réessayez ou rechargez si votre espace a changé dans une autre page.", "The update failed. Retry or reload if your workspace changed in another page.")); }
    finally { setBusy(false); }
  }
  const dateLabel = (date: string) => new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(`${date}T12:00:00`));

  if (!pending.length && !received.length && !showEmpty && !status && !error) return null;
  return <section className="pending-orders" aria-label={t("Commandes en attente", "Pending orders")}>
    <h2><Truck size={17}/>{t("Commandes en attente", "Pending orders")} <span>{pending.length}</span></h2>
    <p className="pending-orders-note">{pending.length
      ? t("Toutes vos livraisons et cueillettes, même à une date lointaine. Les quantités entrent dans vos réserves quand vous confirmez leur réception.", "All deliveries and pickups, including distant dates. Quantities enter your pantry when you confirm receipt.")
      : t("Aucune commande en attente. Vos prochains achats en ligne apparaîtront ici jusqu’à leur réception.", "No pending orders. Your next online purchases will appear here until you receive them.")}</p>
    {pending.map(order => <div className="pending-order" key={order.id}>
      <div><strong>{order.grocer || t("Commande en ligne", "Online order")}</strong>
        <small>{order.fulfillment === "delivery" ? t("Livraison", "Delivery") : t("Cueillette", "Pickup")} · <time dateTime={order.expectedDate}>{dateLabel(order.expectedDate)}</time>{order.deliveryWindow && ` · ${order.deliveryWindow.start}–${order.deliveryWindow.end}`} · {order.lines.length} {t("articles", "items")}</small>
        {order.expectedDate < localToday() && <small className="pending-order-overdue">{t("Date prévue dépassée · réception à confirmer", "Expected date passed · receipt still to confirm")}</small>}
      </div>
      <button className="secondary" disabled={busy} onClick={() => { setError(""); setStatus(""); setReceiving(order); }}>{t("J’ai reçu ma commande", "I received my order")}</button>
      <details><summary>{t("Détails et date", "Details and date")}</summary>
        <ul className="pending-order-items">{order.lines.map(line => <li key={purchaseLineKey(line)}>
          <span>{line.name || t(data.ingredients.find(i => i.id === line.ingredientId)?.name || "", data.ingredients.find(i => i.id === line.ingredientId)?.nameEn || "") || line.ingredientId}{line.purchaseLabel && <small>{line.purchaseLabel}</small>}</span>
          <span>{quantityLabel(line.quantity, data.preferences, locale, 1, t)}{line.priceCents !== undefined && <small>{new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "CAD" }).format(line.priceCents / 100)}</small>}</span>
        </li>)}</ul>
        {order.lines.every(line => line.priceCents !== undefined) && <p className="shopping-note">{t("Sous-total des articles : ", "Items subtotal: ")}{new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "CAD" }).format(order.lines.reduce((sum, line) => sum + line.priceCents!, 0) / 100)} · {t("Taxes et frais non inclus", "Taxes and fees not included")}</p>}
        <form onSubmit={e => { e.preventDefault(); const expectedDate = new FormData(e.currentTarget).get("expectedDate") as string; void save({ action: "reschedule", id: order.id, expectedDate }, t("La date prévue est mise à jour.", "The expected date is updated.")); }}>
          <label>{t("Nouvelle date", "New date")}<input type="date" name="expectedDate" key={order.expectedDate} defaultValue={order.expectedDate} required/></label>
          <button className="text-button" disabled={busy}>{t("Reporter", "Reschedule")}</button>
        </form>
        <button className="text-button" disabled={busy} onClick={() => void save({ action: "cancel", id: order.id }, t("Le suivi est annulé ici. Pour annuler l’achat, contactez aussi votre épicier.", "Tracking is cancelled here. To cancel the purchase, also contact your grocer."))}>{t("Annuler le suivi de commande", "Cancel order tracking")}</button>
      </details>
    </div>)}
    {error && <p role="alert" className="form-error">{t(error)}</p>}
    {status && <p role="status" className="grocery-status">{t(status)}</p>}
    {!!received.length && <details className="received-orders"><summary>{t("Mes dernières réceptions", "Recent receipts")} <span>{received.length}</span></summary>{received.map(order => <details key={order.id}><summary>{order.grocer || t("Commande en ligne", "Online order")} · {order.receivedAt && dateLabel(order.receivedAt.slice(0, 10))} · {(order.received || []).filter(l => l.quantity.value > 0).length} {t("articles reçus", "received items")}</summary><ul className="pending-order-items">{(order.received || []).map(line => <li key={purchaseLineKey(line)}><span>{line.name || t(data.ingredients.find(i => i.id === line.ingredientId)?.name || "", data.ingredients.find(i => i.id === line.ingredientId)?.nameEn || "") || line.ingredientId}</span><span>{quantityLabel(line.quantity, data.preferences, locale, 1, t)}</span></li>)}</ul></details>)}</details>}
    {receiving && <ReceiptEditor order={receiving} ingredients={data.ingredients} units={data.preferences} locale={locale} onClose={() => setReceiving(null)} onSave={async value => {
      await onSave(value);
      setStatus(t("Commande reçue. Les quantités confirmées sont ajoutées à vos réserves.", "Order received. Confirmed quantities have been added to your pantry."));
    }}/>}
  </section>;
}
