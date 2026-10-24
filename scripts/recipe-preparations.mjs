/** Imports keep shopping ingredients flat; preparations describe how a share is used.
 * No virtual mixture is a purchasable SKU. Quantities and grams use the same recipe yield. */
export function flattenPreparations(recipe) {
 const result=structuredClone(recipe);
 for(const preparation of result.preparations||[])for(const component of preparation.ingredients){
  const existing=result.ingredients.find(l=>l.ingredientId===component.ingredientId&&l.quantity.kind===component.quantity.kind&&JSON.stringify({...l.quantity,value:0})===JSON.stringify({...component.quantity,value:0})&&!!l.optional===!!component.optional);
  if(existing){existing.grams+=component.grams;existing.quantity.value+=component.quantity.value;}
  else result.ingredients.push(structuredClone(component));
 }
 return result;
}
export function assertPreparations(recipe,ingredients){
 const ingredientMap=new Map(ingredients.map(i=>[i.id,i]));
 for(const line of recipe.ingredients){
  const item=ingredientMap.get(line.ingredientId);
  if(/^maison-mix-/.test(line.ingredientId)||/mélange maison|homemade (blend|mix)/i.test(item?.name||''))throw Error(`Unresolved homemade preparation: ${line.ingredientId}. Supply its actual ingredients.`);
 }
 const required=new Map();
 for(const prep of recipe.preparations||[]){
  if(prep.blendId){
   const blend=ingredientMap.get(prep.blendId)?.blend;
   if(!blend)throw Error("Unknown preparation blend");
   const volume=prep.ingredients.reduce((n,c)=>n+c.quantity.value,0);
   if(prep.ingredients.length!==blend.components.length||new Set(prep.ingredients.map(c=>c.ingredientId)).size!==prep.ingredients.length)throw Error("Incomplete blend preparation");
   for(const c of prep.ingredients){const base=blend.components.find(b=>b.ingredientId===c.ingredientId);if(!base||!["volume","spoon"].includes(c.quantity.kind)||Math.abs(c.quantity.value-base.quantity.value*volume/blend.yieldMl)>1e-6||Math.abs(c.grams-base.grams*volume/blend.yieldMl)>1e-5)throw Error("Inconsistent blend preparation");}
  }
  for(const line of prep.ingredients){
  if(!ingredientMap.has(line.ingredientId)||/^maison-mix-/.test(line.ingredientId))throw Error('Preparation requires canonical base ingredients');
  const key=`${line.ingredientId}:${line.quantity.kind}`;const total=required.get(key)||{grams:0,value:0};total.grams+=line.grams;total.value+=line.quantity.value;required.set(key,total);
 }
 }
 for(const [key,needed]of required){
  const actual=recipe.ingredients.filter(l=>`${l.ingredientId}:${l.quantity.kind}`===key&&!l.optional).reduce((sum,l)=>({grams:sum.grams+l.grams,value:sum.value+l.quantity.value}),{grams:0,value:0});
  if(actual.grams+0.00001<needed.grams||actual.value+0.00001<needed.value)throw Error(`Preparation missing from shopping ingredients: ${key}`);
 }
 return recipe;
}
