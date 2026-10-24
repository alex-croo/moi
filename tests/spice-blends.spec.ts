import {test,expect} from '@playwright/test';
import {demoData} from '../src/lib/demo';
import {shoppingNeeds,applyShoppingMutation,previewBlend,mealKey} from '../src/lib/shopping';
import {blendComponents,directRecipeIngredients,type SpiceBlend} from '../src/lib/spice-blends';
import {assertPreparations,flattenPreparations} from '../scripts/recipe-preparations.mjs';
import type {ShoppingWorkspace} from '../src/lib/shopping-types';
const component=(ingredientId:string,value:number)=>({ingredientId,grams:value*.5,quantity:{kind:'spoon' as const,value}});
const bases=['garlic','paprika'].map(id=>({...demoData.ingredients[0],id,name:id}));
const blend:SpiceBlend={...demoData.ingredients[0],id:'tredmeal-spice',name:'Paprika à l’ail',blend:{version:1,yieldMl:100,storage:'spices',storageNote:'Au sec',allergens:[],components:[component('garlic',25),component('paprika',75)]}};
const recipe=flattenPreparations({...demoData.recipes[0],id:'test-blend',servings:2,ingredients:[component('garlic',2)],preparations:[{id:'blend',title:'Blend',titleEn:'Blend',blendId:blend.id,ingredients:blendComponents(blend,20)}]});
function data():ShoppingWorkspace{return {...structuredClone(demoData),ingredients:[...bases,blend],recipes:[recipe],slots:[{date:'2026-10-25',slot:'dinner',recipeId:recipe.id},{date:'2026-10-26',slot:'dinner',recipeId:recipe.id}],pantry:bases.map(i=>({id:crypto.randomUUID(),ingredientId:i.id,name:i.name,location:'spices',inStock:true,note:'',quantity:{kind:'volume',value:100}})),shopping:{grocers:[],orders:[],cooked:[],selections:{}}};}
test('preparing 100 ml debits actual raw ingredients once, preserves extra stock and is idempotent',()=>{
 const d=data(),mutation={action:'prepareBlend',id:crypto.randomUUID(),blendId:blend.id,volumeMl:100};
 expect(previewBlend(d,d,blend.id,100).missing).toHaveLength(0);
 const saved=applyShoppingMutation(d,mutation,d);
 expect(saved.pantry.map(p=>p.quantity!.value)).toEqual([75,25,100]);expect(d.pantry.map(p=>p.quantity!.value)).toEqual([100,100]);
 expect(applyShoppingMutation(saved,mutation,saved)).toBe(saved);
 const undo=applyShoppingMutation(saved,{action:'undoInventory',id:saved.shopping!.inventoryEvents![0].id},saved);
 expect(undo.pantry).toEqual(d.pantry);expect(undo.shopping!.preparedBlends).toEqual([]);
});
test('planning reserves a prepared pot chronologically and cooking uses only one dose, not its components',()=>{
 let d=data();d=applyShoppingMutation(d,{action:'prepareBlend',id:crypto.randomUUID(),blendId:blend.id,volumeMl:100},d);
 const before=structuredClone(d),report=shoppingNeeds(d,d,'2026-10-25','2026-10-26');expect(d).toEqual(before);
 expect(report.items.find(i=>i.ingredient.id===blend.id)).toMatchObject({onHand:40,required:40,quantity:{value:0}});
 expect(report.items.find(i=>i.ingredient.id==='garlic')).toMatchObject({required:4});expect(report.items.find(i=>i.ingredient.id==='paprika')).toBeUndefined();
 const cook={action:'cook',id:crypto.randomUUID(),meal:d.slots[0],portions:2,includeOptional:false};
 const saved=applyShoppingMutation(d,cook,d);expect(saved.pantry.map(p=>p.quantity!.value)).toEqual([73,25,80]);
 expect(applyShoppingMutation(saved,cook,saved)).toBe(saved);
 expect(applyShoppingMutation(saved,{action:'undoCook',id:cook.id},saved).pantry).toEqual(d.pantry);
});
test('a partly covered blend expands only its missing share, including other planned meals',()=>{
 const d=data();d.pantry=[{id:crypto.randomUUID(),ingredientId:blend.id,name:blend.name,location:'spices',inStock:true,note:'',quantity:{kind:'volume',value:30}}];
 const all=shoppingNeeds(d,d,'2026-10-25','2026-10-26');
 expect(all.items.find(i=>i.ingredient.id==='garlic')!.quantity.value).toBeCloseTo(6.5);
 expect(all.items.find(i=>i.ingredient.id==='paprika')!.quantity.value).toBeCloseTo(7.5);
 const second=shoppingNeeds(d,d,'2026-10-26','2026-10-26');
 expect(second.items.find(i=>i.ingredient.id===blend.id)!.onHand).toBe(10);
 expect(second.availability[mealKey(d.slots[1])].complete).toBe(false);
});
test('missing ingredients require explicit confirmation; pending deliveries cannot be consumed before reception',()=>{
 const d=data();d.pantry=[];d.shopping!.orders=[{id:crypto.randomUUID(),mode:'online',grocer:'Test',expectedDate:'2026-10-25',fulfillment:'delivery',status:'pending',lines:bases.map(i=>({ingredientId:i.id,quantity:{kind:'volume',value:100},location:'spices'})),createdAt:new Date().toISOString()}];
 const m={action:'prepareBlend',id:crypto.randomUUID(),blendId:blend.id,volumeMl:100};
 expect(previewBlend(d,d,blend.id,100).missing).toHaveLength(2);expect(()=>applyShoppingMutation(d,m,d)).toThrow('blend_missing_stock');
 const saved=applyShoppingMutation(d,{...m,confirmUntracked:true},d);expect(saved.pantry).toHaveLength(1);expect(saved.shopping!.preparedBlends![0].untracked).toHaveLength(2);expect(saved.shopping!.orders).toEqual(d.shopping!.orders);
});
test('no prepared stock yields raw shopping ingredients, with scaled portions and doubled preparation',()=>{
 const d=data();d.pantry=[];d.shopping!.portions={[mealKey(d.slots[0])]:1};
 const report=shoppingNeeds(d,d,'2026-10-25','2026-10-25');
 expect(report.items.find(i=>i.ingredient.id==='garlic')!.required).toBeCloseTo(3.5);expect(report.items.find(i=>i.ingredient.id==='paprika')!.required).toBe(7.5);
 expect(report.items.find(i=>i.ingredient.id===blend.id)).toBeUndefined();
 expect(blendComponents(blend,40).map(c=>c.quantity.value)).toEqual([10,30]);expect(directRecipeIngredients(recipe,d.ingredients)).toEqual([component('garlic',2)]);
});
test('imports reject unknown, inconsistent, nested or incomplete preparation links',()=>{
 expect(()=>assertPreparations(recipe,[...bases,blend])).not.toThrow();
 expect(()=>assertPreparations(recipe,bases)).toThrow('Unknown');
 const invalid=structuredClone(recipe);invalid.preparations[0].ingredients[0].quantity.value+=1;
 expect(()=>assertPreparations(invalid,[...bases,blend])).toThrow('Inconsistent');
});
