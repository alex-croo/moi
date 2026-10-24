import { test, expect } from '@playwright/test';
import { demoData } from '../src/lib/demo';
import { reconcileCooking } from '../src/lib/cooking-reconcile';
import { applyShoppingMutation } from '../src/lib/shopping';
import type { ShoppingWorkspace } from '../src/lib/shopping-types';

function fixture() {
  const data: ShoppingWorkspace = structuredClone(demoData);
  data.recipes = [{...data.recipes[0], ingredients: [{ ingredientId: 'beef-95-raw', grams: 250, quantity: {kind:'mass', value:250} }]}];
  data.slots = [{date:'2026-10-24',slot:'lunch',recipeId:data.recipes[0].id}];
  data.pantry = [{id:crypto.randomUUID(),ingredientId:'beef-95-raw',name:'Beef',quantity:{kind:'mass',value:500},inStock:true,location:'fridge',note:''}];
  data.shopping = {grocers:[],orders:[],cooked:[],selections:{}};
  const value = {action:'cook',id:crypto.randomUUID(),meal:data.slots[0],portions:data.recipes[0].servings,includeOptional:false};
  return {data,value};
}
test('unrelated edits can be preserved while retrying cooking on the latest workspace',()=>{
  const {data,value}=fixture(), remote=structuredClone(data);
  remote.journal=[];remote.shopping!.selections={other:['ingredient']};
  expect(reconcileCooking(data,remote,data,remote,value)).toBe('retry');
  const saved=applyShoppingMutation(remote,value,remote);
  expect(saved.shopping!.selections).toEqual(remote.shopping!.selections);
  expect(saved.journal).toEqual(remote.journal);expect(saved.pantry[0].quantity!.value).toBe(250);
});
test('a lost acknowledgement or another tab cooking the same meal never debits twice',()=>{
  const {data,value}=fixture(), saved=applyShoppingMutation(data,value,data);
  expect(reconcileCooking(data,saved,data,saved,value)).toBe('acknowledged');
  expect(reconcileCooking(data,saved,data,saved,{...value,id:crypto.randomUUID()})).toBe('acknowledged');
  expect(saved.pantry[0].quantity!.value).toBe(250);
});
test('changed stock deductions, meal allocation or recipe quantities require review',()=>{
  const {data,value}=fixture(), remote=structuredClone(data);
  remote.pantry[0].quantity!.value=100;
  expect(()=>reconcileCooking(data,remote,data,remote,value)).toThrow('cooking_changed');
  remote.pantry[0].quantity!.value=500;
  remote.slots.unshift({...value.meal,date:'2026-10-23'});
  remote.slots.unshift({...value.meal,date:'2026-10-22'});
  expect(()=>reconcileCooking(data,remote,data,remote,value)).toThrow('cooking_changed');
  const catalog=structuredClone(data);catalog.recipes[0].ingredients[0].quantity.value=300;
  expect(()=>reconcileCooking(data,data,data,catalog,value)).toThrow('cooking_changed');
});
test('removed meals cannot be recreated by retrying an old dialog',()=>{
  const {data,value}=fixture(), remote={...data,slots:[]};
  expect(()=>reconcileCooking(data,remote,data,remote,value)).toThrow('meal_changed');
});
test('a stock top-up with unchanged deductions is retained by the retry',()=>{
  const {data,value}=fixture(), remote=structuredClone(data);remote.pantry[0].quantity!.value=1000;
  expect(reconcileCooking(data,remote,data,remote,value)).toBe('retry');
  expect(applyShoppingMutation(remote,value,remote).pantry[0].quantity!.value).toBe(750);
});
