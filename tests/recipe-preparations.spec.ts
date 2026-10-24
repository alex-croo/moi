import {test,expect} from '@playwright/test';
import {flattenPreparations,assertPreparations} from '../scripts/recipe-preparations.mjs';
import {shoppingNeeds,applyShoppingMutation} from '../src/lib/shopping';
import {demoData} from '../src/lib/demo';
import type {Recipe} from '../src/lib/types';
import type {ShoppingWorkspace} from '../src/lib/shopping-types';
const component=(ingredientId:string,value:number)=>({ingredientId,grams:value*.6,quantity:{kind:'spoon' as const,value}});
test('preparations share canonical stock, aggregate once, and cooking debits their real ingredients once',()=>{
 const ingredients=['ail-poudre','poivre-noir'].map(id=>({...demoData.ingredients[0],id,name:id}));
 const recipe:Recipe=flattenPreparations({...demoData.recipes[0],id:'test-mix',servings:2,ingredients:[component('ail-poudre',2.5)],preparations:[{id:'sauce',title:'Sauce',titleEn:'Sauce',ingredients:[component('ail-poudre',2.5),component('poivre-noir',1.25)]}]});
 expect(recipe.ingredients.find(l=>l.ingredientId==='ail-poudre')!.quantity.value).toBe(5);
 expect(()=>assertPreparations(recipe,ingredients)).not.toThrow();
 const d:ShoppingWorkspace={...structuredClone(demoData),recipes:[recipe],ingredients,slots:[{date:'2026-10-24',slot:'dinner',recipeId:recipe.id}],pantry:[{id:crypto.randomUUID(),ingredientId:'ail-poudre',name:'Ail',location:'spices',inStock:true,note:'',quantity:{kind:'volume',value:10}}],shopping:{grocers:[],orders:[],cooked:[],selections:{}}};
 const needs=shoppingNeeds(d,d,'2026-10-24','2026-10-24');
 expect(needs.items.find(l=>l.ingredient.id==='ail-poudre')?.quantity.value).toBe(0);
 expect(needs.items.find(l=>l.ingredient.id==='poivre-noir')?.quantity.value).toBe(1.25);
 const mutation={action:'cook',id:crypto.randomUUID(),meal:d.slots[0],portions:2,includeOptional:false};
 const cooked=applyShoppingMutation(d,mutation,d);expect(cooked.pantry[0].quantity?.value).toBe(5);expect(applyShoppingMutation(cooked,mutation,d)).toBe(cooked);
 expect(applyShoppingMutation(cooked,{action:'undoCook',id:mutation.id},d).pantry[0].quantity?.value).toBe(10);
});
test('unresolved blends and incomplete component totals are rejected before import',()=>{
 const base={...demoData.recipes[0],ingredients:[component('maison-mix-jus',5)]};
 expect(()=>assertPreparations(base,[{...demoData.ingredients[0],id:'maison-mix-jus',name:'Base maison'}])).toThrow(/Unresolved/);
 const preparation={id:'sauce',title:'Sauce',titleEn:'Sauce',ingredients:[component('ail-poudre',5)]};
 expect(()=>assertPreparations({...base,ingredients:[component('ail-poudre',2.5)],preparations:[preparation]},[{...demoData.ingredients[0],id:'ail-poudre'}])).toThrow(/missing/);
});
