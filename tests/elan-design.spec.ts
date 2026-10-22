import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { defaultRecipeTags, matchesRecipe, recipeTagAssignments, recipeTagIds } from '../src/lib/recipe-tags';
import { demoRecipes } from '../src/lib/demo-recipes';
import { selectAppOption } from './select-helper';

test('recipe filters combine search, diet, type and tags without guessing dietary claims', () => {
 const recipe = {...demoRecipes[0],id:'diy-02',title:'Burgers de bœuf fumés',minutes:35};
 expect(Object.keys(recipeTagAssignments)).toHaveLength(58);
 expect(recipeTagIds(recipe)).toEqual(['omnivore','main','beef','sandwich']);
 expect(matchesRecipe(recipe,{query:'boeuf',diet:'omnivore',type:'sandwich',tags:['beef']},defaultRecipeTags)).toBe(true);
 for(const filters of [{diet:'vegan'}, {type:'soup'}, {tags:['quick']}, {tags:['beef','chicken']}])
  expect(matchesRecipe(recipe,{query:'',diet:'',type:'',tags:[],...filters},defaultRecipeTags)).toBe(false);
 expect(recipeTagIds({...recipe,id:'unknown'})).toEqual([]);
});

test('only an active admin creates shared tags; members read them and private journals remain isolated',async()=>{
 test.setTimeout(120000);const db=new PGlite();
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}','imalexgauthier@gmail.com',now()),('${b}','member@example.test',now()),('${c}','stranger@example.test',now());`);
 for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into private.members(user_id,role) values('${a}','admin'),('${b}','member') on conflict(user_id) do update set role=excluded.role;`);
 const as=async(id:string)=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);
 await as(a);await db.exec("insert into recipe_tags(id,label,label_en,category) values('test','Au four','Oven baked','tag')");
 await as(b);expect((await db.query('select * from recipe_tags')).rows).toHaveLength(1);
 await expect(db.exec("insert into recipe_tags(id,label,label_en,category) values('denied','Test','Test','tag')")).rejects.toThrow();
 await expect(db.exec("delete from recipe_tags")).rejects.toThrow();
 await as(c);expect((await db.query('select * from recipe_tags')).rows).toHaveLength(0);
 await db.exec('reset role;set role anon');await expect(db.exec('select * from recipe_tags')).rejects.toThrow();
 }finally{await db.close();}
});

test('recipe search, clear filters and full-screen cooking navigation work at desktop and phone size', async ({page})=>{
 await page.goto('/fr/demo');
 await page.getByRole('navigation').getByRole('button',{name:'Mes recettes',exact:true}).click();
 await page.getByLabel('Rechercher une recette').fill('aucun-resultat');
 await expect(page.locator('.recipe-card')).toHaveCount(0);
 await page.getByRole('button',{name:'Effacer les filtres'}).click();
 await expect(page.locator('.recipe-card')).toHaveCount(1);
 await selectAppOption(page.getByRole('combobox',{name:'Régime alimentaire'}),'vegan');
 await expect(page.locator('.recipe-card')).toHaveCount(0);
 await page.getByRole('button',{name:'Effacer les filtres'}).click();
 await page.locator('.recipe-open').click();
 await page.getByRole('button',{name:'Mode cuisine',exact:true}).click();
 const cooking=page.locator('.cooking-mode');await expect(cooking).toBeVisible();
 await cooking.getByRole('button',{name:'Plein écran',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
 await cooking.getByRole('button',{name:'Plein écran',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
 await expect(cooking.locator('.cooking-step-number')).toHaveText('Étape 1 / 2');
 await expect(cooking.getByRole('button',{name:'Précédente',exact:true})).toBeDisabled();
 await cooking.getByRole('button',{name:'Suivante',exact:true}).click();
 await expect(cooking.locator('.cooking-step-number')).toHaveText('Étape 2 / 2');
 await cooking.press('ArrowLeft');await expect(cooking.locator('.cooking-step-number')).toHaveText('Étape 1 / 2');
 await cooking.getByRole('button',{name:'Ingrédients',exact:true}).click();await expect(cooking.locator('.cooking-ingredients')).toBeVisible();
 await page.setViewportSize({width:393,height:852});
 expect(await cooking.evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
 await cooking.getByRole('button',{name:'Quitter le mode cuisine'}).click();
 await expect(page.locator('.recipe-sheet')).toBeVisible();await expect(cooking).toHaveCount(0);
 await page.getByRole('button',{name:'Fermer la recette'}).click();
});

test('journal library retains navigation and draft content with the new layout',async({page})=>{
 await page.goto('/fr/demo');await page.getByRole('navigation').getByRole('button',{name:'Mon journal',exact:true}).click();
 await expect(page.locator('.journal-cover')).toBeVisible();
 await page.getByRole('button',{name:'Liste',exact:true}).click();await expect(page.locator('div.journal-library')).toHaveClass(/layout-list/);
 await page.getByRole('button',{name:'Grille',exact:true}).click();await expect(page.locator('div.journal-library')).toHaveClass(/layout-grid/);
 await page.getByRole('button',{name:'Écrire aujourd’hui'}).click();await expect(page.locator('.journal-canvas').first()).toBeVisible();
});
