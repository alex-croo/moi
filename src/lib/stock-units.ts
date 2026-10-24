import type { Ingredient, Quantity } from "./types";
import { countMeasure } from "./ingredient-measures";
const normal = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
const aliases: Record<string,string[]> = {
 piece:["piece","pieces","unite","unites","item","items","each","steak","steaks","poitrine","poitrines","breast","breasts","cotelette","cotelettes","chop","chops","filet","filets","fillet","fillets","lime","limes","pain","pains","bun","buns","tortilla","tortillas","oeuf","oeufs","egg","eggs"],
 clove:["gousse","gousses","clove","cloves"], bulb:["tete","tetes","bulbe","bulbes","bulb","bulbs"],
 can:["boite","boites","can","cans","conserve","conserves"], pack:["paquet","paquets","pack","packs"], bunch:["botte","bottes","bunch","bunches"], slice:["tranche","tranches","slice","slices"]
};
export function countUnit(q: Quantity): string {
 if(q.unit)return q.unit;
 const labels=[q.label,q.labelEn].filter(Boolean).map(s=>normal(s!));
 if(!labels.length)return "piece";
 const found=labels.map(label=>Object.entries(aliases).find(([,v])=>v.includes(label))?.[0]||label);
 return found.every(unit=>unit===found[0])?found[0]:found.join("|");
}
export function compatibleQuantity(a:Quantity,b:Quantity) {
 const av=a.kind==="volume"||a.kind==="spoon",bv=b.kind==="volume"||b.kind==="spoon";
 if((a.basis||"net")!==(b.basis||"net"))return false;
 return av&&bv||a.kind===b.kind&&(a.kind!=="count"||countUnit(a)===countUnit(b));
}
export function sameStockFormat(a:Quantity,b:Quantity) {
 return compatibleQuantity(a,b)&&a.gramsPerItem===b.gramsPerItem&&a.weightBasis===b.weightBasis&&JSON.stringify(a.content)===JSON.stringify(b.content);
}
export function stockIdentity(id:string|null, ingredients:Ingredient[]) {
 if(!id)return id;
 const target=ingredients.find(i=>i.id===id)?.stockId;
 return target&&ingredients.some(i=>i.id===target)?target:id;
}
export function stockConversion(from:Quantity, to:Quantity, grams:number, ingredientId:string):number|null {
 // Equal package labels do not mean equal package sizes.
 if(from.kind==="count"&&to.kind==="count"&&["can","pack"].includes(countUnit(from))){
  if(!from.content||!to.content)return sameStockFormat(from,to)?1:null;
  return from.content.kind===to.content.kind&&from.content.basis===to.content.basis ? from.content.value/to.content.value:null;
 }
 if(compatibleQuantity(from,to))return 1;
 if(from.kind==="count"&&from.content){
  const content={kind:from.content.kind,value:from.content.value,basis:from.content.basis};
  if(compatibleQuantity(content,to))return from.content.value;
  return null; // No inferred drained weight or density.
 }
 // A weight alone never establishes how many steaks/breasts are available.
 if(to.kind==="count"&&to.unit==="piece")return null;
 if(grams<=0||to.value<=0)return null;
 if(from.kind==="mass")return to.value/grams;
 const known=countMeasure(ingredientId,from);
 if(known?.grams)return known.grams*to.value/grams;
 if(from.kind==="count"&&from.gramsPerItem&&to.kind==="mass")return from.gramsPerItem;
 return null;
}
