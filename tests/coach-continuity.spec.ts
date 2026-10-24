import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {coachContext,validateCoachRecall} from '../src/lib/coach-context';
import {companionOutput} from '../src/lib/learning-validation';
import type {LearningDay,LearningMemory} from '../src/lib/learning-types';
const lesson={title:'Un geste après le dîner',objective:'Retrouver une intention personnelle',body:'Une lecture approuvée sur les intentions personnelles.',action:'Choisir un geste simple après le dîner.',question:'Que souhaitez-vous essayer?',sources:[],limits:'',adaptations:'',reviewedOn:'2026-10-01',moduleTitle:'Motivation',version:1};
const day=(date:string,id:string):LearningDay=>({date,document_id:id,snapshot:lesson,revision:1,notes:{},questions:[],adaptation:null,quiet:false,reflection_skipped:false});

test('recall uses completed past learning, spaces returns, excludes future and unconfirmed memories',()=>{
 const today=day('2026-10-24','today'),previous=day('2026-10-23','recent'),spaced=day('2026-10-17','old'),unread=day('2026-10-10','unread');
 previous.adaptation={introduction:'Hello',experiment:'Suggested, never accomplished',recall:{sourceDate:spaced.date,sourceTitle:'Old',prompt:'Remember?',hint:'Idea',questionId:'q'}};
 const memories=[{id:'1',text:'Confirmed preference',status:'confirmed',source_date:'2026-10-10',category:'preference'},{id:'2',text:'Unconfirmed',status:'suggested',source_date:'2026-10-10',category:'preference'}] as LearningMemory[];
 const history=[today,previous,spaced,unread,day('2026-10-25','future')];
 const context=coachContext(today.date,today,[{date:'2026-10-25',text:'Future secret'},{date:'2026-10-23',text:'A'.repeat(10000)}],history,memories,[{document_id:'recent',completed_on:'2026-10-23'},{document_id:'old',completed_on:'2026-10-17'}]);
 expect(context.recall?.sourceDate).toBe('2026-10-23');expect(context.journal).toHaveLength(1);expect(context.journal[0].text).toHaveLength(2500);expect(context.memories.map(m=>m.text)).toEqual(['Confirmed preference']);
 const withoutRecent=coachContext(today.date,today,[],[today,spaced,unread],[],[{document_id:'old',completed_on:'2026-10-17'}]);
 expect(withoutRecent.recall?.sourceDate).toBe('2026-10-17');
 expect(()=>validateCoachRecall({recall:{sourceDate:'2026-10-25',prompt:'Invented',hint:'Invented'}},context)).toThrow();
 expect(()=>validateCoachRecall({recall:null},context)).toThrow();
 const first=coachContext(today.date,today,[],[],[],[]);expect(first.recall).toBeNull();expect(()=>validateCoachRecall({recall:{sourceDate:'2026-10-17',prompt:'x',hint:'x'}},first)).toThrow();
 expect(companionOutput.safeParse({introduction:'',experiment:'',question:'A short question?',bridge:'A connecting idea',recall:null,memories:[]}).success).toBe(false);
});

test('daily coach persists recall safely, caches opening, releases failures, guards stale writes and preserves journal answers',async()=>{
 test.setTimeout(120000);const db=new PGlite();const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${owner}','imalexgauthier@gmail.com',now()),('${other}','other@example.test',now());`);
  for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  await db.exec(`insert into private.members(user_id,role) values('${owner}','admin'),('${other}','member') on conflict(user_id) do update set role=excluded.role;`);
  const as=async(id:string)=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);
  const run=async(action:string,payload:object={})=>(await db.query<{result:any}>('select public.learning_action($1,$2::jsonb) as result',[action,JSON.stringify(payload)])).rows[0].result;
  await as(owner);const first=await run('ensure');await run('complete');await run('preferences',{enabled:true});
  await db.exec('reset role');await db.query('update public.learning_days set date=date-1 where owner_id=$1',[owner]);await db.query('update public.learning_completions set completed_on=completed_on-1 where owner_id=$1',[owner]);
  await as(owner);const current=await run('ensure');const yesterday=current.dates.find((d:string)=>d!==current.today);
  const reserved=await run('reserve_ai',{kind:'opening'});
  const output={version:2,locale:'fr',introduction:'Vous aviez choisi de prendre une pause.',experiment:'Après le dîner, essayez une courte pause.',bridge:'Votre intention peut orienter le petit geste du jour.',question:'Quel repère vous aiderait à faire cette pause?',recall:{sourceDate:yesterday,sourceTitle:'Forged title',prompt:'Quelle idée vous revient de la lecture précédente?',hint:'Une intention personnelle aide à choisir ce qui compte.'},memories:[]};
  const saved=await run('finish_ai',{requestId:reserved.requestId,expectedRevision:reserved.day.revision,result:output});
  expect(saved.day.adaptation.version).toBe(2);expect(saved.day.adaptation.recall.sourceTitle).toBe(first.day.snapshot.title);expect(saved.day.questions).toHaveLength(2);
  const recallId=saved.day.adaptation.recall.questionId;await run('note',{key:recallId,text:'My own recall, never replaced.',expectedRevision:0});
  const cached=await run('reserve_ai',{kind:'opening'});expect(cached.cached).toBe(true);expect(cached.state.day.questions).toHaveLength(2);
  const fail=await run('reserve_ai',{kind:'followup'});await run('fail_ai',{requestId:fail.requestId});
  const follow=await run('reserve_ai',{kind:'followup'});
  await run('note',{key:'reflection',text:'I have changed this note.',expectedRevision:0});
  expect((await run('finish_ai',{requestId:follow.requestId,expectedRevision:follow.day.revision,result:output})).stale).toBe(true);
  const last=await run('reserve_ai',{kind:'followup'});const final=await run('finish_ai',{requestId:last.requestId,expectedRevision:last.day.revision,result:{...output,question:'Quel ajustement aimeriez-vous essayer maintenant?'}});
  expect(final.day.notes[recallId].text).toBe('My own recall, never replaced.');expect(final.day.questions.filter((q:any)=>q.kind==='recall')).toHaveLength(1);expect(final.day.adaptation.introduction).toBe(output.introduction);
  expect((await run('reserve_ai',{kind:'opening'})).cached).toBe(true);await expect(run('reserve_ai',{kind:'followup'})).rejects.toThrow();
  await as(other);expect((await db.query('select * from public.learning_days')).rows).toHaveLength(0);await expect(run('finish_ai',{requestId:reserved.requestId,expectedRevision:1,result:output})).rejects.toThrow();
  await as(owner);await run('preferences',{enabled:false});await expect(run('reserve_ai',{kind:'opening'})).rejects.toThrow();
 } finally{await db.close();}
});
