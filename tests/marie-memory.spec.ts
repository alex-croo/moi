import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {createHash,createHmac} from 'node:crypto';
import {workerAuthorized} from '../src/lib/marie-worker-auth';
import {readFile,readdir} from 'node:fs/promises';
import {selectMarieMemories,composeMarieContext,verifyExtraction,validateMariePage, type MarieMemory} from '../src/lib/marie-memory';
import type {LearningDay} from '../src/lib/learning-types';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const key='synthetic-worker-credential-not-for-production-000000000000000';
const lesson={title:'Préparer les repas',objective:'Simplifier la préparation des repas du soir',body:'Préparer un repas à l’avance peut simplifier les décisions du soir.',action:'Préparer une petite chose.',question:'Quel geste essayer?',sources:[],limits:'',adaptations:'',reviewedOn:'2026-10-01',moduleTitle:'Organisation',version:1};
const mem=(id:string,date:string,text:string):MarieMemory=>({id,source_date:date,text,category:'observation',status:'confirmed',active:true,kind:'outcome',topic:'repas',origin:'automatic'});
const day=(date:string):LearningDay=>({date,document_id:'doc',snapshot:lesson,revision:1,notes:{},questions:[],adaptation:null,quiet:false,reflection_skipped:false});

test('scheduled kickoff signatures expire and cannot substitute for the operator credential',()=>{
 const prior=process.env.MARIE_WORKER_SECRET;process.env.MARIE_WORKER_SECRET=key;
 try{
  const time='1793016000',now=Number(time)*1000;
  const signed='Marie '+createHmac('sha256',key).update('marie-tick:'+time).digest('hex');
  expect(workerAuthorized(signed,time,now)).toBe(true);
  expect(workerAuthorized(signed,time,now+121000)).toBe(false);
  expect(workerAuthorized(signed,null,now)).toBe(false);
  expect(workerAuthorized('Bearer wrong',time,now)).toBe(false);
  expect(workerAuthorized('Bearer '+key,null,now)).toBe(true);
 }finally{if(prior===undefined)delete process.env.MARIE_WORKER_SECRET;else process.env.MARIE_WORKER_SECRET=prior;}
});

test('relevant old memories can outrank yesterday; recently repeated, excluded and inactive memories do not dominate',()=>{
 const old=mem(owner,'2026-07-01','Préparer les repas du soir me simplifie les décisions.');
 const recent=mem(other,'2026-10-25','J’aime marcher dans les bois.');
 const selected=selectMarieMemories(lesson,'2026-10-26',[recent,old]);expect(selected[0].id).toBe(owner);
 expect(selectMarieMemories(lesson,'2026-10-26',[{...old,active:false},recent]).map(m=>m.id)).toEqual([other]);
 expect(selectMarieMemories(lesson,'2026-10-26',[old,recent],[old.source_date]).map(m=>m.id)).toEqual([other]);
 const corrected={...old,origin:'manual'};expect(selectMarieMemories(lesson,'2026-10-26',[corrected],[old.source_date])).toHaveLength(1);
});
test('extraction requires exact source evidence, complete coverage and owner-scoped supersession',()=>{
 const source={date:'2026-10-25',text:'J’aimerais préparer le repas plus tôt.',hash:'h'};
 const result={sources:[{date:source.date,memories:[{text:'Souhaite préparer le repas plus tôt.',excerpt:source.text,category:'experiment' as const,kind:'intention' as const,topic:'repas',supersedes:[],experimentDate:null}]}]};
 expect(verifyExtraction(result,[source],[])[0].hash).toBe('h');
 expect(()=>verifyExtraction({...result,sources:[]},[source],[])).toThrow();
 expect(()=>verifyExtraction({sources:[{...result.sources[0],memories:[{...result.sources[0].memories[0],excerpt:'J’ai réussi mon repas.'}]}]},[source],[])).toThrow();
 expect(()=>verifyExtraction({sources:[{...result.sources[0],memories:[{...result.sources[0].memories[0],supersedes:[other]}]}]},[source],[])).toThrow();
});
test('one composition receives old source-grounded memories and suppresses repeated question intent',()=>{
 const history=day('2026-09-01');history.questions=[{id:'q',text:'Quel moment préparer?',createdAt:'',source:'assistant'}];history.notes.q={text:'Avant mon départ.',revision:1};
 const context=composeMarieContext('2026-10-26',lesson,[mem(owner,'2026-07-01','Préparer les repas du soir me simplifie les décisions.')],[history],[],[],[]);
 expect(context.memories[0].sourceDate).toBe('2026-07-01');
 const page={introduction:'Bienvenue dans votre journée.',teaching:'Un exemple personnel peut éclairer la lecture de cette journée.',experiment:'Choisir une petite préparation pour ce soir.',question:'Quel moment préparer?',questionIntent:'moment',usedMemoryIds:[owner],personalReferences:[{memoryIds:[owner],field:'teaching' as const}]};
 expect(validateMariePage(page,context).question).toBe('');
 expect(()=>validateMariePage({...page,usedMemoryIds:[other]},context)).toThrow();
});
test('an observation follows a proposed step only with an explicit source-grounded experiment link',()=>{
 const previous=day('2026-10-20');previous.adaptation={introduction:'Bonjour.',experiment:'Choisir le repas le matin.'};
 const unrelated={...mem(owner,'2026-10-21','La marche me fait du bien.'),experiment_date:null};
 const linked={...mem(other,'2026-10-22','Choisir le repas le matin a simplifié la soirée.'),experiment_date:previous.date};
 const ctx=composeMarieContext('2026-10-26',lesson,[unrelated,linked],[previous],[],[]);
 expect(ctx.previousExperiments[0].reportedObservations.map(m=>m.id)).toEqual([other]);
});

async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${owner}','imalexgauthier@gmail.com',now()),('${other}','other@example.test',now());`);
 for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into private.members(user_id,role) values('${owner}','admin'),('${other}','member') on conflict(user_id) do update set role=excluded.role;`);
 await db.query('insert into learning_private.coach_config values(true,$1)',[createHash('sha256').update(key).digest('hex')]);
 const as=async(id:string)=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);
 const run=async(action:string,payload:object={})=>(await db.query<{result:any}>('select public.learning_action($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;
 const worker=async(action:string,payload:object={},secret=key)=>{
  await db.exec('reset role;set role anon');
  return (await db.query<{result:any}>('select public.learning_worker($1,$2,$3::jsonb) result',[secret,action,JSON.stringify(payload)])).rows[0].result;
 };
 return {db,as,run,worker};
}

test('automatic memory is idempotent, private, revision guarded and forget cannot resurrect from its source',async()=>{
 test.setTimeout(120000);const {db,as,run,worker}=await fixture();
 try{
  await as(owner);const initial=await run('ensure');await run('preferences',{enabled:true});await run('note',{key:'reflection',text:'Je prépare le repas avant le départ.',expectedRevision:0});
  await db.exec('reset role;update learning_private.coach_jobs set available_at=now()');
  await expect(worker('claim',{},'bad-key')).rejects.toThrow();
  const lease=await worker('claim');expect(lease.ownerId).toBe(owner);expect(await worker('claim')).toBeNull();
  const ctx=await worker('load',lease);const src=ctx.sources[0];
  const memories=[{text:'Prépare le repas avant le départ.',excerpt:'Je prépare le repas avant le départ.',topic:'repas',kind:'attempt',category:'experiment',supersedes:[],experimentDate:null}];
  expect((await worker('remember',{...lease,date:src.date,hash:'outdated',memories})).stale).toBe(true);
  await worker('remember',{...lease,date:src.date,hash:src.hash,memories});
  const first=await worker('load',lease);expect(first.memories[0].status).toBe('confirmed');
  await worker('remember',{...lease,date:src.date,hash:src.hash,memories});
  const repeated=await worker('load',lease);expect(repeated.memories).toHaveLength(1);expect(repeated.memories[0].id).toBe(first.memories[0].id);
  await as(other);expect((await db.query('select * from public.learning_memories')).rows).toHaveLength(0);await expect(db.query('select * from learning_private.coach_pages')).rejects.toThrow();
  await as(owner);await run('memory',{operation:'forget',id:first.memories[0].id});
  const forgotten=await worker('load',lease);expect(forgotten.sources).toHaveLength(0);expect(forgotten.memories).toHaveLength(0);expect(forgotten.ignoredDates).toEqual([initial.today]);
  await as(owner);await run('preferences',{enabled:false});await expect(worker('load',lease)).rejects.toThrow();
 }finally{await db.close();}
});

test('prepared pages are private until their date, stable once opened, and stale computations cannot overwrite notes',async()=>{
 test.setTimeout(120000);const {db,as,run,worker}=await fixture();
 try{
  await as(owner);const state=await run('ensure');await run('preferences',{enabled:true});await run('complete');
  await db.exec('reset role;update learning_private.coach_jobs set available_at=now()');
  const lease=await worker('claim');const ctx=await worker('load',lease);const tomorrow=ctx.targets[1];expect(tomorrow.document_id).not.toBe(state.day.document_id);
  const adaptation={version:4,introduction:'Bonjour, voici votre fil de journée.',teaching:'Une lecture préparée en avance et disponible immédiatement.',experiment:'Essayez un petit geste dans votre journée.',question:'Quel petit geste choisir?',questionIntent:'choisir-geste',usedMemoryIds:[],personalReferences:[],recall:null,locale:'fr'};
  const save=(target:any,fingerprint=ctx.fingerprint)=>worker('page',{...lease,date:target.date,snapshot:target.snapshot,fingerprint,locale:'fr',adaptation});
  expect((await save(tomorrow)).saved).toBe(true);
  await as(owner);expect((await run('ensure',{date:tomorrow.date})).day).toBeNull();await expect(run('complete',{date:tomorrow.date})).rejects.toThrow();
  // Date rollover: shift only the prepared target to today and preserve the next document.
  await db.exec('reset role');
  await db.query('update public.learning_days set date=date-1 where owner_id=$1',[owner]);
  await db.query('update public.learning_completions set completed_on=completed_on-1 where owner_id=$1',[owner]);
  await db.query('update learning_private.coach_pages set date=date-1,fingerprint=learning_private.coach_fingerprint($1) where owner_id=$1',[owner]);
  await as(owner);const opened=await run('ensure');expect(opened.day.adaptation.teaching).toBe(adaptation.teaching);expect(opened.day.document_id).toBe(tomorrow.document_id);expect(opened.day.opened_at).toBeTruthy();
  const updated=await worker('load',lease);const now=updated.targets[0];
  await worker('page',{...lease,date:now.date,snapshot:now.snapshot,fingerprint:updated.fingerprint,locale:'fr',adaptation:{...adaptation,teaching:'A different prepared version must not replace an already opened page.'}});
  await as(owner);expect((await run('ensure')).day.adaptation.teaching).toBe(adaptation.teaching);
  await run('note',{key:'reflection',text:'Newer user text stays safe.',expectedRevision:0});
  expect((await save(now,updated.fingerprint)).stale).toBe(true);
  await as(owner);expect((await run('state')).day.notes.reflection.text).toBe('Newer user text stays safe.');
 }finally{await db.close();}
});
