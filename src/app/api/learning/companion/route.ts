import { languageInstruction, localeOf } from "@/lib/locale";
import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { boundedJson, privateReply } from "@/lib/private-http";
import { requirePrivateFireworks, fireworksText, fireworksStatus } from "@/lib/fireworks";
import { companionInstructions } from "@/lib/learning-prompts";
import { companionOutput } from "@/lib/learning-validation";
import type { LearningDay } from "@/lib/learning-types";
import { coachContext, validateCoachRecall, freshCoachQuestion } from "@/lib/coach-context";
export const maxDuration = 60;
export async function POST(request:Request) {
 if (!sameOrigin(request)) return privateReply({error:"forbidden"},403);
 const auth = await authorizedClient(); if (!auth) return privateReply({error:"unauthorized"},401);
 let requestId:string|undefined;
 try {
  const input=z.object({date:z.iso.date(),locale:z.enum(["fr","en","es","pt-BR"]).optional(),kind:z.enum(["opening","followup"]).default("followup")}).strict().parse(await boundedJson(request,1000));
  // Check private AI access BEFORE loading personal text; the pilot owner comes from verified authentication.
  await requirePrivateFireworks(auth.user.id);
  const {data:reserved,error}=await auth.db.rpc("learning_action",{action:"reserve_ai",payload:{date:input.date,kind:input.kind,version:3,locale:input.locale||"fr"}});
  if(error) return privateReply({error:"unavailable"},error.code==="53300"?429:403);
  if(reserved.cached)return privateReply({...reserved.state,ai:fireworksStatus(auth.user.id)});
  requestId=reserved.requestId;
  const day=reserved.day as LearningDay;
  const [workspace,history,memories,completed]=await Promise.all([
   auth.db.from("standard_workspaces").select("data,revision").eq("owner_id",auth.user.id).maybeSingle(),
   auth.db.from("learning_days").select("date,document_id,snapshot,notes,adaptation,questions").eq("owner_id",auth.user.id).lte("date",input.date).order("date",{ascending:false}).limit(45),
   auth.db.from("learning_memories").select("id,text,source_date,category,status").eq("owner_id",auth.user.id).eq("status","confirmed").order("created_at",{ascending:false}).limit(30),
   auth.db.from("learning_completions").select("document_id,completed_on").eq("owner_id",auth.user.id).lt("completed_on",input.date),
  ]);
  if(workspace.error||history.error||memories.error||completed.error) throw Error("context");
  const context=coachContext(input.date,day,workspace.data?.data?.journal||[],history.data||[],memories.data||[],completed.data||[]);
  const allowedDates=new Set([...context.journal,...context.notes].map(d=>d.date));
  if(context.recall&&(context.recall.ownJournal||context.recall.ownNotes.length))allowedDates.add(context.recall.sourceDate);
  const text=await fireworksText(companionInstructions.replace("Write warm professional French, using vous,",languageInstruction(localeOf(input.locale||"fr")) + " Write warmly and professionally,"),{...context,mode:input.kind},true,true,auth.user.id,{maxTokens:4500,reasoning:"none",timeoutMs:42000,schema:z.toJSONSchema(companionOutput)});
  const output=validateCoachRecall(companionOutput.parse(JSON.parse(text.replace(/^```json\s*|\s*```$/g,""))),context);
  output.question=freshCoachQuestion(output.question,context);
  output.memories=output.memories.filter(m=>allowedDates.has(m.sourceDate));
  const {data:finished,error:failed}=await auth.db.rpc("learning_action",{action:"finish_ai",payload:{requestId,expectedRevision:day.revision,expectedWorkspaceRevision:workspace.data?.revision||0,result:{...output,version:3,locale:input.locale||"fr"}}});
  if(failed) throw Error("save");
  if(finished.stale) return privateReply({error:"changed"},409);
  return privateReply({...finished,ai:fireworksStatus(auth.user.id)});
 } catch {
  if(requestId)await auth.db.rpc("learning_action",{action:"fail_ai",payload:{requestId}});
  return privateReply({error:"unavailable"},503);
 }
}
