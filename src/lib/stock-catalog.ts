import type { ShoppingCatalog, ShoppingPersonal } from './shopping-types';
import { stockIdentity } from './stock-units';
export function stockCatalog(data:ShoppingPersonal,catalog:ShoppingCatalog):ShoppingCatalog {
 const aliases=data.shopping?.stockAliases;
 if(!aliases||!Object.keys(aliases).length)return catalog;
 const ids=new Set(catalog.ingredients.map(i=>i.id));
 const resolve=(id:string)=>{const seen=new Set<string>();let current=id;while(true){if(seen.has(current))return id;seen.add(current);const next=aliases[current]||stockIdentity(current,catalog.ingredients);if(!next||next===current||!ids.has(next))return current;current=next;}};
 return {...catalog,ingredients:catalog.ingredients.map(i=>({...i,stockId:resolve(i.id)}))};
}
