import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fireworksText, requirePrivateFireworks } from "./fireworks";
import { languageInstruction, localeOf } from "./locale";
import { composeMarieContext, mariePage, memoryExtraction, validateMariePage, verifyExtraction, type MarieMemory, type MemorySource } from "./marie-memory";
import { marieInstructions, memoryInstructions } from "./marie-prompts";
import type { LearningDay } from "./learning-types";

type Lease={ownerId:string;token:string};
type Target={date:string;document_id:string;snapshot:LearningDay["snapshot"];quiet:boolean;opened:boolean};
type Context={today:string;locale:string;fingerprint:string;sources:MemorySource[];indexed:{date:string;source_hash:string}[];memories:MarieMemory[];history:LearningDay[];completed:{document_id:string;completed_on:string}[];ignoredDates:string[];targets:(Target|null)[];pages:{date:string;fingerprint:string;locale:string;snapshot:LearningDay["snapshot"]}[]};
export function workerAuthorized(value:string|null){
 const secret=process.env.MARIE_WORKER_SECRET;
 if(!secret||secret.length<40||!value)return false;
 const a=Buffer.from(value),b=Buffer.from(`Bearer ${secret}`);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function workerRpc<T>(action:string,payload:object={}):Promise<T>{
 const secret=process.env.MARIE_WORKER_SECRET,url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!secret||secret.length<40||!url||!key)throw Error("worker_unconfigured");
 const r=await fetch(`${url}/rest/v1/rpc/learning_worker`,{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({worker_key:secret,action,payload}),cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("worker_storage_unavailable");
 return r.json() as Promise<T>;
}
/** Each invocation does a bounded extraction batch OR prepares pages. Leases survive process crashes. */
export async function runMarieWorker(ownerId?:string){
 const lease=await workerRpc<Lease|null>("claim",ownerId?{ownerId}:{});if(!lease)return {status:"idle"};
 try {
  await requirePrivateFireworks(lease.ownerId);
  await workerRpc("prune",lease);
  const context=await workerRpc<Context>("load",lease);
  const pending=context.sources.filter(s=>!context.indexed.some(i=>i.date===s.date&&i.source_hash===s.hash));
  if(pending.length){
   const sources=pending.slice(0,3);
   const experiments=context.history.filter(h=>h.adaptation?.experiment&&!context.ignoredDates.includes(h.date)).map(h=>({date:h.date,suggested:h.adaptation!.experiment}));
   const raw=await fireworksText(memoryInstructions,{sources,experiments,existingMemories:context.memories.filter(m=>m.active!==false).map(m=>({id:m.id,text:m.text,sourceDate:m.source_date,kind:m.kind,topic:m.topic}))},true,true,lease.ownerId,{maxTokens:3500,reasoning:"none",timeoutMs:45000,schema:z.toJSONSchema(memoryExtraction)});
   const result=verifyExtraction(memoryExtraction.parse(JSON.parse(raw)),sources,context.memories,experiments);
   for(const source of result)await workerRpc("remember",{...lease,...source});
   await workerRpc("finish",{...lease,more:true});return {status:"indexed",sources:result.length};
  }
  const validMemories=context.memories.filter(m=>m.origin==="manual"||!m.source_hash||context.sources.some(s=>s.date===m.source_date&&s.hash===m.source_hash));
  const targets=context.targets.filter((t):t is Target=>!!t&&!t.quiet&&!t.opened).filter(t=>!context.pages.some(p=>p.date===t.date&&p.fingerprint===context.fingerprint&&p.locale===context.locale&&JSON.stringify(p.snapshot)===JSON.stringify(t.snapshot)));
  let prepared=0;
  const results=await Promise.allSettled(targets.map(async target=>{
   const input=composeMarieContext(target.date,target.snapshot,validMemories,context.history,context.sources,context.completed,context.ignoredDates);
   const raw=await fireworksText(`${marieInstructions}\n${languageInstruction(localeOf(context.locale))}`,input,true,true,lease.ownerId,{maxTokens:3000,reasoning:"none",timeoutMs:45000,schema:z.toJSONSchema(mariePage)});
   const adaptation={...validateMariePage(mariePage.parse(JSON.parse(raw)),input),locale:context.locale};
   const saved=await workerRpc<{saved?:boolean}>("page",{...lease,date:target.date,snapshot:target.snapshot,fingerprint:context.fingerprint,locale:context.locale,adaptation});
   if(saved.saved)prepared++;
  }));
  if(results.some(r=>r.status==="rejected"))throw Error("preparation_failed");
  await workerRpc("finish",{...lease,more:prepared<targets.length});
  return {status:"ready",prepared};
 }catch{
  await workerRpc("fail",lease).catch(()=>{});
  return {status:"retry_scheduled"};
 }
}
