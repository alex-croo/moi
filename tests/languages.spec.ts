import {checkedTranslation} from "../src/lib/translation-validation";
import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {localeOf,isLocale,intlLocale,tr} from '../src/lib/locale';
import {measure,defaultUnits} from '../src/lib/units';
import {receiptInput} from '../src/lib/receipt';
test('regional languages preserve routes, fractions, receipt input and canonical units',()=>{
 expect(localeOf('pt')).toBe('pt-BR');expect(localeOf('pt-BR')).toBe('pt-BR');expect(localeOf('es-GT')).toBe('es');expect(isLocale('es')).toBe(true);expect(isLocale('de')).toBe(false);
 expect(intlLocale('es')).toBe('es-GT');expect(intlLocale('pt-BR')).toBe('pt-BR');
 expect(tr('es','Mon journal','My journal')).toBe('Mi diario');expect(tr('pt-BR','Mon journal','My journal')).toBe('Meu diário');
 expect(measure('spoon',2.5,defaultUnits,'es')).toBe('1/2 cdta.');expect(measure('spoon',2.5,defaultUnits,'pt-BR')).toBe('1/2 c. de chá');
 expect(measure('mass',1234.5,defaultUnits,'pt-BR')).toBe('1.234,5 g');
 for(const locale of ['fr','en','es','pt-BR'])expect(receiptInput.safeParse({orderId:'11111111-1111-4111-8111-111111111111',text:'2 x 500 g arroz',locale}).success).toBe(true);
});
test('every application string has both regional translations',async()=>{
 const source=JSON.parse(await readFile('src/lib/translations/source.json','utf8'));
 for(const locale of ['es','pt-BR']){const translated=JSON.parse(await readFile(`src/lib/translations/${locale}.json`,'utf8'));expect(Object.keys(source).filter(key=>typeof translated[key]!=='string'||!translated[key].trim())).toEqual([]);}
});
test('translation caches cannot be read or written across accounts, including by an admin',async()=>{
 test.setTimeout(120000);const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 try{
 await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}','imalexgauthier@gmail.com',now()),('${b}','member@example.test',now());`);
 for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into private.members(user_id,role) values('${a}','admin'),('${b}','member') on conflict(user_id) do update set role=excluded.role;`);
 const as=async(id:string)=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);};
 await as(b);await db.query('insert into public.content_translations(owner_id,locale,source_key,source_hash,strings) values($1,$2,$3,$4,$5)',[b,'es','recipe:test','hash','{"Soupe":"Sopa"}']);
 expect((await db.query('select * from public.content_translations')).rows).toHaveLength(1);
 await as(a);expect((await db.query('select * from public.content_translations')).rows).toHaveLength(0);
 await expect(db.query('insert into public.content_translations(owner_id,locale,source_key,source_hash,strings) values($1,$2,$3,$4,$5)',[b,'pt-BR','recipe:test','hash','{}'])).rejects.toThrow();
 await db.exec('reset role;set role anon;');await expect(db.query('select * from public.content_translations')).rejects.toThrow();
 }finally{await db.close();}
});

test('recipe translations preserve numerical quantities, cooking tokens and reference URLs',()=>{
 const source=['Cuire {{temp:74}} pendant 12 minutes. Voir https://example.test/source'];
 expect(checkedTranslation(source,{0:'Cocina a {{temp:74}} durante 12 minutos. Consulta https://example.test/source'})).toBeTruthy();
 expect(()=>checkedTranslation(source,{0:'Cocina a {{temp:60}} durante 12 minutos. Consulta https://example.test/source'})).toThrow();
 expect(()=>checkedTranslation(source,{0:'Cocina a {{temp:74}} durante 20 minutos. Consulta https://example.test/source'})).toThrow();
 expect(()=>checkedTranslation(source,{0:'Cocina a {{temp:74}} durante 12 minutos. Consulta https://other.test/source'})).toThrow();
 expect(()=>checkedTranslation(source,{})).toThrow();
});
