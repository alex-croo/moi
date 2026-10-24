import { stockCatalog } from './stock-catalog';
import type { Quantity } from './types';
import type { ShoppingWorkspace } from './shopping-types';
import { shoppingNeeds, toBuyQuantity, type ShoppingItem } from './shopping';
import { compatibleQuantity, stockIdentity } from './stock-units';
export type InventoryReport = ReturnType<typeof shoppingNeeds>;
export type InventoryStatus = 'buy' | 'covered' | 'pending' | 'check';
export function inventoryStatus(item: ShoppingItem): InventoryStatus {
  if (item.needsStockCheck || item.awaitingConfirmation > 0) return 'check';
  if (toBuyQuantity(item).value > 1e-8) return 'buy';
  return item.pending > 0 ? 'pending' : 'covered';
}
/** Display physical lots in their own units. Never sum an unknown package into grams. */
export function inventoryQuantities(data: ShoppingWorkspace, report: InventoryReport, ingredientId: string, field: 'physical' | 'reserved' | 'free' = 'physical'): Quantity[] {
  const groups: Quantity[] = [];
  for (const lot of report.lots.filter(l => l.item.inStock && stockIdentity(l.item.ingredientId, stockCatalog(data, data).ingredients) === ingredientId)) {
    if (!lot.item.quantity) continue;
    const q = { ...lot.item.quantity, value: lot[field] };
    const existing = groups.find(g => compatibleQuantity(g, q) && JSON.stringify(g.content) === JSON.stringify(q.content));
    if (existing) existing.value += q.value; else groups.push(q);
  }
  return groups;
}
