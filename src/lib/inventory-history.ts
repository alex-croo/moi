import type { ShoppingPersonal, ShoppingState } from './shopping-types';
export type InventoryChange = { collection: 'pantry'|'slots'|'orders'|'cooked'|'personalItems'|'portions'|'stockAliases'; key: string; before?: unknown; after?: unknown };
export type InventoryEvent = { id: string; at: string; action: string; changes: InventoryChange[]; undone?: boolean };
const defaults = (): ShoppingState => ({grocers:[],orders:[],cooked:[],selections:{}});
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])) : value;
const equal = (a: unknown,b:unknown) => JSON.stringify(stable(a))===JSON.stringify(stable(b));
function entries(data:ShoppingPersonal, collection:InventoryChange['collection']):Record<string,unknown>{
 const state=data.shopping||defaults();
 if(collection==='portions'||collection==='stockAliases')return {...state[collection]};
 if(collection==='slots')return Object.fromEntries(data.slots.map(s=>[`${s.date}:${s.slot}`,s]));
 const rows=collection==='pantry'?data.pantry:state[collection]||[];
 return Object.fromEntries(rows.map(row=>[row.id,row]));
}
/** Record only food-related changes, never a snapshot of journals or credentials. */
export function recordInventory<T extends ShoppingPersonal>(before:T,after:T,action:string):T {
 const changes:InventoryChange[]=[];
 for(const collection of ['pantry','slots','orders','cooked','personalItems','portions','stockAliases'] as const){
  const a=entries(before,collection),b=entries(after,collection);
  for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(!equal(a[key],b[key]))changes.push({collection,key,before:a[key],after:b[key]});
 }
 if(!changes.length)return after;
 const events:InventoryEvent[]=[{id:crypto.randomUUID(),at:new Date().toISOString(),action,changes:structuredClone(changes)},...(after.shopping?.inventoryEvents||[])].slice(0,30);
 // Keep the workspace bounded even for receipts containing many lines.
 while(events.length>1&&JSON.stringify(events).length>180000)events.pop();
 return {...after,shopping:{...(after.shopping||defaults()),inventoryEvents:events}};
}
export function undoInventory<T extends ShoppingPersonal>(data:T,id:string):T {
 const events=data.shopping?.inventoryEvents||[],event=events.find(e=>e.id===id);
 if(!event||event.undone)return data;
 if(events.find(e=>!e.undone)?.id!==id)throw Error('undo_order');
 const next=structuredClone(data);next.shopping ||= defaults();
 for(const change of event.changes){
  const current=entries(next,change.collection);
  if(!equal(current[change.key],change.after))throw Error('inventory_changed');
  if(change.before===undefined)delete current[change.key];else current[change.key]=change.before;
  if(change.collection==='pantry')next.pantry=Object.values(current) as T['pantry'];
  else if(change.collection==='slots')next.slots=Object.values(current) as T['slots'];
  else if(change.collection==='portions')next.shopping.portions=current as Record<string,number>;
  else if(change.collection==='stockAliases')next.shopping.stockAliases=current as Record<string,string>;
  else Object.assign(next.shopping,{[change.collection]:Object.values(current)});
 }
 next.shopping.inventoryEvents!.find(e=>e.id===id)!.undone=true;
 return next;
}
