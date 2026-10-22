import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
test('daily program: isolated notes, one step per local date, resume, editorial versions and concurrent revisions',async()=>{
 test.setTimeout(120000);const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}','imalexgauthier@gmail.com',now()),('${b}','member@example.test',now());`);
 for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into private.members(user_id,role) values('${a}','admin'),('${b}','member') on conflict(user_id) do update set role=excluded.role;`);
 const as=async(id:string)=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);};
 const run=async(action:string,payload:object={})=>(await db.query<{result:any}>('select public.learning_action($1,$2::jsonb) as result',[action,JSON.stringify(payload)])).rows[0].result;
 await as(b);const first=await run('ensure',{timeZone:'America/Toronto'});expect(first.day.snapshot.title).toBeTruthy();expect(first.completed).toHaveLength(0);expect(first.personalization).toBe(false);
 await expect(run('admin_list')).rejects.toThrow();expect((await db.query('select * from public.learning_documents')).rows).toHaveLength(0);
 await run('note',{date:first.today,key:'reflection',text:'Synthetic private reflection',expectedRevision:0});
 await expect(run('note',{date:first.today,key:'reflection',text:'Overwrite conflict',expectedRevision:0})).rejects.toThrow();
 expect((await run('note',{date:first.today,key:'reflection',text:'Synthetic private reflection',expectedRevision:0})).revision).toBe(1);
 await expect(run('reserve_ai',{date:first.today})).rejects.toThrow();
 await expect(run('note',{date:first.today,key:'reflection',text:'No revision'})).rejects.toThrow();
 const finished=await run('complete');expect(finished.completed).toHaveLength(1);expect(finished.pages[0].journalDone).toBe(true);
 expect((await run('ensure')).day.document_id).toBe(first.day.document_id);expect((await run('complete')).completed).toHaveLength(1);
 const future=new Date(first.today+'T12:00:00Z');future.setUTCDate(future.getUTCDate()+1);const tomorrow=future.toISOString().slice(0,10);
 expect((await run('ensure',{date:tomorrow})).day).toBeNull();await expect(run('complete',{date:tomorrow})).rejects.toThrow();
 await as(a);expect((await db.query('select * from public.learning_days')).rows).toHaveLength(0);expect((await db.query('select * from public.learning_memories')).rows).toHaveLength(0);
 const docs=await run('admin_list');expect(docs.documents).toHaveLength(150);expect(docs.modules).toHaveLength(15);
 const doc=docs.documents[0];await run('admin_save',{id:doc.id,moduleId:doc.module_id,expectedRevision:doc.revision,content:{...doc.draft,title:'Editorial revision for test'}});
 await expect(run('admin_publish',{id:doc.id,expectedRevision:1,reviewed:true})).rejects.toThrow();
 await run('admin_publish',{id:doc.id,expectedRevision:2,reviewed:true});
 await as(b);expect((await run('state')).day.snapshot.title).toBe(first.day.snapshot.title);
 // Simulate the previous day without changing server clock. Next assignment comes only tomorrow.
 await db.exec('reset role');await db.query(`update public.learning_days set date=date-1 where owner_id=$1;update public.learning_completions set completed_on=completed_on-1 where owner_id=$1;`,[b]).catch(async()=>{await db.query('update public.learning_days set date=date-1 where owner_id=$1',[b]);await db.query('update public.learning_completions set completed_on=completed_on-1 where owner_id=$1',[b]);});
 await as(b);const next=await run('ensure');expect(next.day.document_id).not.toBe(first.day.document_id);
 // An unfinished step resumes its immutable snapshot after a missed day.
 await db.exec('reset role');await db.query('update public.learning_days set date=date-2 where owner_id=$1',[b]);await as(b);expect((await run('ensure')).day.document_id).toBe(next.day.document_id);
 // A reviewed but unpublished step must block later published chapters.
 await run('complete');await db.exec('reset role');
 await db.query('update public.learning_days set date=date-10 where owner_id=$1',[b]);
 await db.query('update public.learning_completions set completed_on=completed_on-10 where owner_id=$1',[b]);
 await db.exec("update public.learning_documents set status='review',published=null where position=3;");
 await as(b);expect((await run('ensure')).day).toBeNull();
 await db.exec(`reset role;set role anon;select set_config('request.jwt.claim.sub','',false);`);await expect(run('state')).rejects.toThrow();
 }finally{await db.close();}
});
test('private AI access is checked for the authenticated owner before loading journal context',async()=>{
 const route=await readFile('src/app/api/learning/companion/route.ts','utf8');const guard=route.indexOf('await requirePrivateFireworks(auth.user.id)');expect(guard).toBeGreaterThan(-1);expect(guard).toBeLessThan(route.indexOf('.from("standard_workspaces")'));
 const provider=await readFile('src/lib/fireworks.ts','utf8');expect(provider).toContain('store: false');expect(provider).toContain('result.model !== model');expect(provider).toContain('zeroDataRetention');expect(provider).toContain('FIREWORKS_ZDR_VERIFICATION');
});
