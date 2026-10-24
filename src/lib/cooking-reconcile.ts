import { mealKey, previewCooking, shoppingMutation, shoppingState } from './shopping';
import type { ShoppingCatalog, ShoppingPersonal } from './shopping-types';

const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

/** Retry a stale workspace only if the cooking preview the user approved is unchanged. */
export function reconcileCooking(base: ShoppingPersonal, remote: ShoppingPersonal,
  baseCatalog: ShoppingCatalog, remoteCatalog: ShoppingCatalog, value: object) {
  const input = shoppingMutation.parse(value);
  if (input.action !== 'cook') throw Error('conflict');
  if (shoppingState(remote).cooked.some(c => c.id === input.id || !c.undone && mealKey(c.meal) === mealKey(input.meal))) return 'acknowledged';
  if (!remote.slots.some(s => mealKey(s) === mealKey(input.meal))) throw Error('meal_changed');
  const fingerprint = (data: ShoppingPersonal, catalog: ShoppingCatalog) => {
    const preview = previewCooking(data, catalog, input.meal, input.portions, input.includeOptional);
    return canonical({
      deductions: preview.deductions.map(({ item, amount }) => ({ id: item.id, ingredientId: item.ingredientId,
        location: item.location, quantity: { ...item.quantity, value: amount } })),
      missing: preview.missing,
    });
  };
  if (fingerprint(base, baseCatalog) !== fingerprint(remote, remoteCatalog)) throw Error('cooking_changed');
  return 'retry';
}
