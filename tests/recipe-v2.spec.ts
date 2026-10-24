import {test,expect} from '@playwright/test';
import {defaultUnits,measure,instructionText,quantityLabel} from '../src/lib/units';
import {stockConversion,compatibleQuantity,sameStockFormat} from '../src/lib/stock-units';
import {shoppingNeeds,applyShoppingMutation,previewCooking,mealKey} from '../src/lib/shopping';
import {pantryFactor} from '../src/lib/pantry';
import {prepareReceipt} from '../src/lib/receipt';
import {countLabels} from '../src/lib/ingredient-measures';
import {demoData} from '../src/lib/demo';
import {validateCatalog} from '../scripts/recipe-import-schema.mjs';
import type {Quantity,Recipe,UnitPreferences} from '../src/lib/types';
import type {ShoppingWorkspace} from '../src/lib/shopping-types';
const piece=(value:number,weight=200):Quantity=>({kind:'count',value,unit:'piece',label:'pièces',gramsPerItem:weight,weightBasis:'package'});
const data=():ShoppingWorkspace=>{
 const ingredient={...demoData.ingredients[0],id:'sirloin'},alias={...demoData.ingredients[0],id:'other-sirloin',stockId:'sirloin'};
 const recipe={...demoData.recipes[0],id:'steak-meal',servings:2,ingredients:[{ingredientId:'other-sirloin',grams:500,quantity:piece(2,250)}]};
 return {...structuredClone(demoData),recipes:[recipe],ingredients:[ingredient,alias],slots:[24,25,26].map(d=>({date:`2026-10-${d}`,slot:'dinner',recipeId:recipe.id})),pantry:[{id:crypto.randomUUID(),name:'Steaks',ingredientId:'sirloin',location:'freezer',quantity:piece(4),inStock:true,note:''}],shopping:{grocers:[],orders:[],cooked:[],selections:{}}};
};
test('four small steaks cover exactly two meals, across ranges, without gram shortages or double reservations',()=>{
 const d=data(),before=JSON.stringify(d),result=shoppingNeeds(d,d,'2026-10-24','2026-10-26');
 expect(result.items).toHaveLength(1);expect(result.items[0]).toMatchObject({required:6,onHand:4,quantity:{value:2,unit:'piece'}});
 expect(result.availability[mealKey(d.slots[0])].complete).toBe(true);expect(result.availability[mealKey(d.slots[1])].complete).toBe(true);expect(result.availability[mealKey(d.slots[2])].complete).toBe(false);
 expect(shoppingNeeds(d,d,'2026-10-26','2026-10-26').items[0].quantity.value).toBe(2);
 expect(JSON.stringify(d)).toBe(before);
});
test('cooking and undo use actual pieces once, preserving weights, other activity and the historical recipe',()=>{
 const d=data(),id=crypto.randomUUID(),input={action:'cook',id,meal:d.slots[0],portions:2,includeOptional:false};
 const cooked=applyShoppingMutation(d,input,d);expect(cooked.pantry[0].quantity?.value).toBe(2);expect(cooked.pantry[0].quantity?.gramsPerItem).toBe(200);
 expect(cooked.shopping!.cooked[0].recipeSnapshot!.ingredients[0].grams).toBe(500);
 expect(applyShoppingMutation(cooked,input,d)).toBe(cooked);
 cooked.pantry[0].quantity!.value=1;const undone=applyShoppingMutation(cooked,{action:'undoCook',id},d);expect(undone.pantry[0].quantity?.value).toBe(3);
 expect(applyShoppingMutation(undone,{action:'undoCook',id},d)).toBe(undone);
});
test('weight-only stock never invents pieces and counts do not require a known weight',()=>{
 const d=data();d.pantry[0].quantity={kind:'mass',value:1000};expect(shoppingNeeds(d,d,'2026-10-24','2026-10-24').items[0]).toMatchObject({quantity:{value:2},needsStockCheck:true});
 expect(previewCooking(d,d,d.slots[0],2,false).deductions).toEqual([]);
 d.pantry[0].quantity={kind:'count',value:2,label:'pieces',labelEn:'pièces'};
 expect(shoppingNeeds(d,d,'2026-10-24','2026-10-24').items[0].quantity.value).toBe(0);
});
test('packages use their own known net or drained content; incompatible and unknown formats stay unconfirmed',()=>{
 const can:Quantity={kind:'count',unit:'can',value:2,content:{kind:'volume',value:540,basis:'net'}};
 expect(stockConversion(can,{kind:'volume',value:370},370,'beans')).toBe(540);
 expect(stockConversion(can,{kind:'mass',value:300,basis:'drained'},300,'beans')).toBeNull();
 expect(stockConversion({...can,content:undefined},{kind:'volume',value:370},370,'beans')).toBeNull();
 expect(sameStockFormat(can,{...can,content:{kind:'volume',value:398,basis:'net'}})).toBe(false);
 expect(countLabels('ail-frais','têtes').unit).toBe('bulb');
 expect(stockConversion({kind:'count',value:1,unit:'bulb'},{kind:'count',value:8,unit:'clove'},24,'ail-frais')).toBe(8);
 expect(compatibleQuantity({kind:'count',value:1,label:'boîtes'},{kind:'count',value:1,label:'pièces'})).toBe(false);
});
test('receipt retains the explicit number and package weight of whole cuts, ground meat stays grams',()=>{
 const d=data();d.ingredients[0].id='haut-surlonge-cru';
 const order={id:crypto.randomUUID(),mode:'online' as const,status:'pending' as const,grocer:'Test',expectedDate:'2026-10-24',fulfillment:'delivery' as const,createdAt:'',lines:[]};
 const r=prepareReceipt({items:[{name:'Steaks',source:'4 x steak 12 oz',ingredientId:'haut-surlonge-cru',orderLineIndex:null,packs:4,amount:12,unit:'oz',pieces:4,countLabel:'',packageLabel:'12 oz chacun',location:'fridge',aisle:'meat',review:''}],note:''},'4 x steak 12 oz',order,d.ingredients,'fr');
 expect(r.items[0].line.quantity).toMatchObject({kind:'count',value:4,unit:'piece',weightBasis:'package'});expect(r.items[0].line.quantity.gramsPerItem).toBeCloseTo(340.1942775);
});
test('oven settings are practical while internal, storage and precise temperatures stay exact',()=>{
 expect(measure('mass',453.59237,defaultUnits,'fr')).toBe('453,6 g');
 expect(measure('mass',453.59237,{...defaultUnits,ingredientMass:'kg'},'fr')).toBe('0,454 kg');
 expect(measure('oven',205,{...defaultUnits,temperature:'F'},'fr')).toBe('400 °F');
 expect(measure('oven',(425-32)*5/9,defaultUnits,'fr')).toBe('220 °C');
 expect(measure('temp',74,{...defaultUnits,temperature:'F'},'fr')).toBe('165 °F');
 expect(measure('temp',74,defaultUnits,'fr')).toBe('74 °C');expect(measure('temp',4,defaultUnits,'fr')).toBe('4 °C');
});
test('all four languages and 160 unit combinations render bound quantities without changing their canonical values',()=>{
 const d=data(),r=d.recipes[0],before=JSON.stringify(d);let count=0;
 for(const locale of ['fr','en','es','pt-BR'] as const)for(const ingredientMass of ['g','kg','oz','lb'] as const)for(const volume of ['ml','l','cup','cup_metric','fl_oz'] as const)for(const spoons of ['spoon','ml'] as const)for(const temperature of ['C','F'] as const)for(const length of ['cm','in'] as const){
 const units={...defaultUnits,ingredientMass,volume,spoons,temperature,length};
 expect(instructionText('{{qty:other-sirloin}} · {{oven:205}} · {{temp:74}} · {{volume:250}} · {{mass:500}} · {{spoon:2.5}} · {{length:5}}',units,locale,1,r)).not.toContain('{{');
 expect(quantityLabel(piece(2),units,locale)).toMatch(/^2 /);expect(pantryFactor('mass',units)).toBeGreaterThan(0);count++;
 }
 expect(count).toBe(640);expect(JSON.stringify(d)).toBe(before);
 expect(quantityLabel({kind:'spoon',value:2.5},defaultUnits,'fr')).toBe('1/2 c. à thé');
});
test('imports refuse missing locales, unknown units and mismatched measure tokens before SQL generation',()=>{
 const r:Recipe={...demoData.recipes[0],importVersion:2,ingredients:[{ingredientId:demoData.ingredients[0].id,quantity:piece(2),grams:500}],steps:[{title:'Cuire',titleEn:'Cook',text:'Four {{oven:205}}',textEn:'Oven {{oven:205}}'}]};
 const translations=Object.fromEntries(['fr','en','es','pt-BR'].map(l=>[l,Object.fromEntries([r.title,r.subtitle,'Cuire','Four {{oven:205}}'].map(s=>[s,s]))]));
 const input={ingredients:[{...demoData.ingredients[0],translations:Object.fromEntries(['fr','en','es','pt-BR'].map(l=>[l,{[demoData.ingredients[0].name]:demoData.ingredients[0].name}]))}],recipes:[{...r,image:'/api/recipe-images/test',source:'https://example.com',translations,provenance:{importedAt:new Date().toISOString(),original:{},decisions:['Reviewed']}}],assets:[]};
 delete input.recipes[0].note;delete input.recipes[0].noteEn;expect(()=>validateCatalog(input)).not.toThrow();
 const bad=structuredClone(input);delete bad.recipes[0].translations.es;expect(()=>validateCatalog(bad)).toThrow();
 const changed=structuredClone(input);changed.recipes[0].translations.en['Four {{oven:205}}']='Oven {{oven:200}}';expect(()=>validateCatalog(changed)).toThrow();
});
