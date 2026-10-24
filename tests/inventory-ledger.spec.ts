import { test, expect } from '@playwright/test';
import { demoData } from '../src/lib/demo';
import { shoppingNeeds, applyShoppingMutation, previewCooking, mealKey } from '../src/lib/shopping';
import { inventoryStatus, inventoryQuantities } from '../src/lib/inventory';
import type { ShoppingWorkspace } from '../src/lib/shopping-types';
const make = (): ShoppingWorkspace => {
 const ingredient={...demoData.ingredients[0],id:'steak'},alias={...demoData.ingredients[0],id:'sirloin',stockId:'steak'};
 const recipe={...demoData.recipes[0],id:'steak-meal',servings:2,ingredients:[{ingredientId:'sirloin',grams:500,quantity:{kind:'count' as const,unit:'piece' as const,value:2,gramsPerItem:250}}]};
 return {...structuredClone(demoData),recipes:[recipe],ingredients:[ingredient,alias],slots:[25,26,29].map(d=>({date:`2026-10-${d}`,slot:'dinner',recipeId:recipe.id})),pantry:[{id:crypto.randomUUID(),ingredientId:'steak',name:'Steaks',location:'freezer',quantity:{kind:'count',unit:'piece',value:4,gramsPerItem:200},note:'',inStock:true}],shopping:{grocers:[],orders:[],cooked:[],selections:{}}};
};
test('same full-horizon ledger explains physical, reserved, free and missing without changing stock',()=>{
 const d=make(),before=JSON.stringify(d),r=shoppingNeeds(d,d,'2026-10-29','2026-10-30');
 expect(r.items[0]).toMatchObject({required:2,onHand:0,quantity:{value:2}});
 expect(r.lots[0]).toMatchObject({physical:4,reserved:4,free:0});
 expect(r.allocations.map(a=>[a.meal.date,a.onHand,a.visible])).toEqual([['2026-10-25',2,false],['2026-10-26',2,false],['2026-10-29',0,true]]);
 const first=shoppingNeeds(d,d,'2026-10-25','2026-10-25');expect(first.lots[0].reserved).toBe(4);
 expect(inventoryQuantities(d,r,'steak')[0].value).toBe(4);expect(inventoryStatus(r.items[0])).toBe('buy');expect(JSON.stringify(d)).toBe(before);
});
test('portions, moving and removing a meal reallocate and persist without touching physical stock',()=>{
 let d=make();d=applyShoppingMutation(d,{action:'planMeal',meal:d.slots[0],date:'2026-10-25',portions:1},d);
 expect(d.shopping!.portions![mealKey(d.slots.find(s=>s.date==='2026-10-25')!)]).toBe(1);
 expect(shoppingNeeds(d,d,'2026-10-29','2026-10-29').items[0].quantity.value).toBe(1);
 const first=d.slots.find(s=>s.date==='2026-10-25')!;
 expect(()=>applyShoppingMutation(d,{action:'planMeal',meal:first,date:'2026-10-26',portions:2},d)).toThrow('slot_occupied');
 d=applyShoppingMutation(d,{action:'planMeal',meal:first,date:'2026-10-30',portions:1},d);
 expect(shoppingNeeds(d,d,'2026-10-29','2026-10-29').items[0].quantity.value).toBe(0);
 const moved=d.slots.find(s=>s.date==='2026-10-30')!;d=applyShoppingMutation(d,{action:'planMeal',meal:moved,date:moved.date,portions:1,remove:true},d);
 expect(d.slots).toHaveLength(2);expect(d.pantry[0].quantity!.value).toBe(4);
});
test('cooking later meal respects earlier reservations; first meal and undo restore only actual deductions',()=>{
 let d=make();expect(previewCooking(d,d,d.slots[2],2,false)).toMatchObject({deductions:[],missing:[{quantity:{value:2}}]});
 const id=crypto.randomUUID(),m={action:'cook',id,meal:d.slots[0],portions:2,includeOptional:false};
 d=applyShoppingMutation(d,m,d);expect(d.pantry[0].quantity!.value).toBe(2);expect(applyShoppingMutation(d,m,d)).toBe(d);
 expect(shoppingNeeds(d,d,'2026-10-26','2026-10-29').lots[0]).toMatchObject({physical:2,reserved:2,free:0});
 d=applyShoppingMutation(d,{action:'undoCook',id},d);expect(d.pantry[0].quantity!.value).toBe(4);
});
test('pending, late and partial receipts have distinct statuses and never increase stock before receiving',()=>{
 let d=make(),id=crypto.randomUUID();const line={ingredientId:'steak',location:'fridge',quantity:{kind:'count',unit:'piece',value:2,gramsPerItem:210}};
 d=applyShoppingMutation(d,{action:'order',id,mode:'online',grocer:'Test',expectedDate:'2026-10-29',fulfillment:'delivery',lines:[line]},d);
 let r=shoppingNeeds(d,d,'2026-10-29','2026-10-29');expect(inventoryStatus(r.items[0])).toBe('pending');expect(r.lots[0].physical).toBe(4);
 const received={action:'receive',id,lines:[{...line,quantity:{...line.quantity,value:1}}]};d=applyShoppingMutation(d,received,d);
 r=shoppingNeeds(d,d,'2026-10-29','2026-10-29');expect(r.items[0].quantity.value).toBe(1);expect(inventoryQuantities(d,r,'steak')[0].value).toBe(5);expect(applyShoppingMutation(d,received,d)).toBe(d);
});
test('unknown formats remain visibly unresolved, not silently treated as available pieces',()=>{
 const d=make();d.pantry[0].quantity={kind:'mass',value:1200};const r=shoppingNeeds(d,d,'2026-10-25','2026-10-25');
 expect(inventoryStatus(r.items[0])).toBe('check');expect(r.lots[0]).toMatchObject({physical:1200,reserved:0,free:1200});expect(r.items[0].quantity.value).toBe(2);
});
test('inventory history reverses receipt and stock changes only, preserving unrelated private data',()=>{
 let d=make();const id=crypto.randomUUID();d=applyShoppingMutation(d,{action:'order',id,mode:'store',grocer:'Test',expectedDate:'2026-10-24',fulfillment:'pickup',lines:[{ingredientId:'steak',quantity:{kind:'count',unit:'piece',value:2},location:'fridge'}]},d);
 expect(d.pantry.reduce((n,p)=>n+p.quantity!.value,0)).toBe(6);
 const event=d.shopping!.inventoryEvents![0];d.journal=[{id:'preserved'} as never];
 const undone=applyShoppingMutation(d,{action:'undoInventory',id:event.id},d);
 expect(undone.pantry).toHaveLength(1);expect(undone.pantry[0].quantity!.value).toBe(4);expect(undone.shopping!.orders).toHaveLength(0);expect(undone.journal).toEqual(d.journal);
 expect(applyShoppingMutation(undone,{action:'undoInventory',id:event.id},undone)).toBe(undone);
 const changed=structuredClone(d);changed.pantry.find(p=>p.location==='fridge')!.quantity!.value=1;
 expect(()=>applyShoppingMutation(changed,{action:'undoInventory',id:event.id},changed)).toThrow('inventory_changed');
});
test('personal ingredient matches are owner-scoped, reversible and do not convert unknown package formats',()=>{
 let d=make();d.ingredients.push({...d.ingredients[0],id:'my-steak',stockId:undefined});d.pantry[0].ingredientId='my-steak';
 expect(shoppingNeeds(d,d,'2026-10-25','2026-10-25').items[0].onHand).toBe(0);
 const other=structuredClone(d);d=applyShoppingMutation(d,{action:'stockAlias',from:'my-steak',to:'steak'},d);
 expect(shoppingNeeds(d,d,'2026-10-25','2026-10-25').items[0].onHand).toBe(2);
 expect(shoppingNeeds(other,other,'2026-10-25','2026-10-25').items[0].onHand).toBe(0);
 expect(()=>applyShoppingMutation(d,{action:'stockAlias',from:'steak',to:'my-steak'},d)).toThrow('invalid_alias');
 const event=d.shopping!.inventoryEvents![0];d=applyShoppingMutation(d,{action:'undoInventory',id:event.id},d);
 expect(shoppingNeeds(d,d,'2026-10-25','2026-10-25').items[0].onHand).toBe(0);
});
