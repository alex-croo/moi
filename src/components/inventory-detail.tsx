"use client";
import { X, ArrowUpRight, Snowflake } from 'lucide-react';
import { useText } from './locale-provider';
import { useShoppingDialog } from './use-shopping-dialog';
import { inventoryQuantities, type InventoryReport } from '@/lib/inventory';
import { stockCatalog } from '@/lib/stock-catalog';
import { stockIdentity } from '@/lib/stock-units';
import { shoppingState } from '@/lib/shopping';
import { quantityLabel } from '@/lib/units';
import { pantryLabel } from '@/lib/pantry';
import type { ShoppingWorkspace } from '@/lib/shopping-types';
import type { Locale } from '@/lib/locale';
export function InventoryDetail({ ingredientId, data, report, locale, onClose, onEdit, onMeals }: { ingredientId: string; data: ShoppingWorkspace; report: InventoryReport; locale: Locale; onClose: () => void; onEdit: (id: string) => void; onMeals: () => void }) {
  const t = useText(locale), ref = useShoppingDialog();
  const ingredient = data.ingredients.find(i => i.id === ingredientId), item = report.items.find(i => i.ingredient.id === ingredientId);
  const allocations = report.allocations.filter(a => a.ingredientId === ingredientId);
  const lots = report.lots.filter(l => l.item.inStock && stockIdentity(l.item.ingredientId, stockCatalog(data, data).ingredients) === ingredientId);
  const label = (q: Parameters<typeof quantityLabel>[0]) => quantityLabel(q, data.preferences, locale, 1, t);
  const total = (field: 'physical' | 'reserved' | 'free') => inventoryQuantities(data, report, ingredientId, field).map(label).join(' + ') || '—';
  return <dialog ref={ref} className="shopping-dialog inventory-detail" aria-labelledby="inventory-detail-title" onCancel={onClose}>
    <header><div><small>{t("Comprendre mes quantités", "Understand my quantities")}</small><h2 id="inventory-detail-title">{t(ingredient?.name || item?.ingredient.name || '', ingredient?.nameEn || item?.ingredient.nameEn || '')}</h2></div><button className="icon-button" aria-label={t("Fermer", "Close")} onClick={onClose}><X/></button></header>
    <div className="inventory-detail-body">
      <div className="inventory-metrics"><div><small>{t("À la maison", "At home")}</small><strong>{total('physical')}</strong></div><div><small>{t("Réservé aux repas", "Reserved for meals")}</small><strong>{total('reserved')}</strong></div><div><small>{t("Libre après les repas", "Free after meals")}</small><strong>{total('free')}</strong></div></div>
      <p className="inventory-caption">{t("Une réservation garde un aliment pour un repas. Vos réserves diminuent seulement quand vous confirmez avoir cuisiné.", "A reservation sets food aside for a meal. Your pantry only decreases when you confirm cooking.")}</p>
      <h3>{t("Dans ma cuisine", "In my kitchen")}</h3>
      {!lots.length && <p>{t("Aucun stock enregistré pour cet aliment.", "No stock recorded for this food.")}</p>}
      {lots.map(l => <div className="inventory-lot" key={l.item.id}><span>{l.item.location === 'freezer' && <Snowflake size={14}/>} {pantryLabel(l.item.location, locale)}<small>{l.item.note}</small></span><strong>{l.item.quantity ? label({...l.item.quantity, value:l.physical}) : t("Quantité à préciser", "Quantity to specify")}</strong><button className="text-button" onClick={() => onEdit(l.item.id)}>{t("Modifier", "Edit")}</button></div>)}
      {shoppingState(data).orders.filter(o=>o.status==='pending' && o.lines.some(l=>stockIdentity(l.ingredientId,stockCatalog(data,data).ingredients)===ingredientId)).map(order=><div className="inventory-lot" key={order.id}><span>{order.grocer}<small>{t("Livraison prévue", "Expected delivery")} · {order.expectedDate}{order.deliveryWindow ? ` · ${order.deliveryWindow.end}` : ''}</small></span><strong>{order.lines.filter(l=>stockIdentity(l.ingredientId,stockCatalog(data,data).ingredients)===ingredientId).map(l=>label(l.quantity)).join(' + ')}</strong></div>)}
      <h3>{t("Où vont mes ingrédients?", "Where are my ingredients going?")}</h3>
      <div className="inventory-allocation-list">{allocations.map((a, n) => { const recipe = data.recipes.find(r => r.id === a.meal.recipeId); return <article className={a.visible ? '' : 'outside-range'} key={`${a.meal.date}-${a.meal.slot}-${n}`}><div><small>{a.meal.date}{!a.visible && <> · {t("Hors des dates affichées", "Outside displayed dates")}</>}</small><strong>{t(recipe?.title || '', recipe?.titleEn || '')}</strong></div><div className="inventory-allocation-values"><span>{t("Besoin", "Needed")} <b>{label({...a.quantity,value:a.required})}</b></span>{a.onHand > 0 && <span className="inventory-positive">{t("Réservé à la maison", "Reserved at home")} <b>{label({...a.quantity,value:a.onHand})}</b></span>}{a.pending > 0 && <span>{t("Livraison prévue", "Expected delivery")} <b>{label({...a.quantity,value:a.pending})}</b></span>}{a.missing > 0 && <span className="inventory-short">{a.check ? t("À vérifier", "To check") : t("Il manque", "Missing")} <b>{label({...a.quantity,value:a.missing})}</b></span>}{a.sources.map(s => <small key={s.id}>{s.grocer} · {s.date}</small>)}</div></article>; })}</div>
      {!allocations.length && <p>{t("Cet aliment n’est réservé à aucun repas.", "This food is not reserved for any meal.")}</p>}
      {item?.estimated && <p className="inventory-caption">{t("Certaines conversions sont estimées à partir des mesures documentées de la recette.", "Some conversions are estimated from the recipe’s documented measurements.")}</p>}
      <button className="secondary" onClick={onMeals}>{t("Ajuster mes repas", "Adjust my meals")}<ArrowUpRight size={15}/></button>
    </div>
  </dialog>;
}
