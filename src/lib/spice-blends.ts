import type { Ingredient, Recipe, RecipeIngredient } from './types';
import { recipePreparations } from './recipe-preparations';

export type SpiceBlend = Ingredient & {blend:{version:1;yieldMl:number;components:Pick<RecipeIngredient,'ingredientId'|'quantity'|'grams'>[];storage:'spices'|'fridge';storageNote:string;allergens:string[]}};
export function isSpiceBlend(item:Ingredient):item is SpiceBlend {
 const b=(item as SpiceBlend).blend;
 return !!b&&b.version===1&&b.yieldMl>0&&Array.isArray(b.components)&&b.components.length>0;
}
export function blendComponents(blend:SpiceBlend,volumeMl:number){
 return blend.blend.components.map(c=>({...c,grams:c.grams*volumeMl/blend.blend.yieldMl,quantity:{...c.quantity,value:c.quantity.value*volumeMl/blend.blend.yieldMl}}));
}
export const blendGrams=(blend:SpiceBlend,volumeMl:number)=>blendComponents(blend,volumeMl).reduce((n,c)=>n+c.grams,0);
export function linkedPreparations(recipe:Recipe,ingredients:Ingredient[]){
 return recipePreparations(recipe).flatMap(p=>{
  const blend=ingredients.find(i=>i.id===p.blendId);
  return blend&&isSpiceBlend(blend)?[{preparation:p,blend,volumeMl:p.ingredients.reduce((sum,c)=>sum+c.quantity.value,0)}]:[];
 });
}
/** Recipe ingredient rows remain flattened for nutrition. Remove only linked shares. */
export function directRecipeIngredients(recipe:Recipe,ingredients:Ingredient[]):RecipeIngredient[]{
 const rows=structuredClone(recipe.ingredients);
 for(const {preparation} of linkedPreparations(recipe,ingredients))for(const c of preparation.ingredients){
  let q=c.quantity.value,g=c.grams;
  for(const row of rows){
   if(row.optional||row.ingredientId!==c.ingredientId||row.quantity.kind!==c.quantity.kind||row.quantity.value<=0)continue;
   const used=Math.min(q,row.quantity.value),usedG=c.grams*used/c.quantity.value;
   row.quantity.value=Math.max(0,row.quantity.value-used);row.grams=Math.max(0,row.grams-usedG);q-=used;g-=usedG;
  }
  if(q>1e-6||g>1e-5)throw Error('invalid_blend_components');
 }
 return rows.filter(r=>r.quantity.value>1e-8);
}
/** Cooking shows the consumed blend dose; nutrition retains its base components. */
export function recipeCookingIngredients(recipe:Recipe,ingredients:Ingredient[]):RecipeIngredient[]{
 return [...directRecipeIngredients(recipe,ingredients),...linkedPreparations(recipe,ingredients).map(({blend,volumeMl})=>({ingredientId:blend.id,grams:blendGrams(blend,volumeMl),quantity:{kind:'spoon' as const,value:volumeMl},note:'Dose utilisée · préparation double ci-dessous'}))];
}
