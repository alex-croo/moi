import { languageInstruction, localeOf } from "@/lib/locale";
import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { boundedJson, privateReply } from "@/lib/private-http";
import { requirePrivateFireworks, fireworksText, fireworksStatus } from "@/lib/fireworks";
import { companionInstructions } from "@/lib/learning-prompts";
import { companionOutput } from "@/lib/learning-validation";
import type { LearningDay } from "@/lib/learning-types";
export const maxDuration = 60;
export async function POST(request:Request) {
 if (!sameOrigin(request)) return privateReply({error:"forbidden"},403);
 const auth = await authorizedClient(); if (!auth) return privateReply({error:"unauthorized"},401);
 try {
  const input=z.object({date:z.iso.date(),locale:z.enum(["fr","en","es","pt-BR"]).optional()}).strict().parse(await boundedJson(request,1000));
  // Check private AI access BEFORE loading personal text; the pilot owner comes from verified authentication.
  await requirePrivateFireworks(auth.user.id);
  const {data:reserved,error}=await auth.db.rpc("learning_action",{action:"reserve_ai",payload:{date:input.date}});
  if(error) return privateReply({error:"unavailable"},error.code==="53300"?429:403);
  const day=reserved.day as LearningDay;
  const [workspace,history,memories]=await Promise.all([
   auth.db.from("standard_workspaces").select("data").eq("owner_id",auth.user.id).maybeSingle(),
   auth.db.from("learning_days").select("date,notes").eq("owner_id",auth.user.id).lte("date",input.date).order("date",{ascending:false}).limit(7),
   auth.db.from("learning_memories").select("text,source_date,category").eq("owner_id",auth.user.id).eq("status","confirmed").limit(30),
  ]);
  if(workspace.error||history.error||memories.error) throw Error("context");
  const journal=(workspace.data?.data?.journal||[]).filter((e:{date:string})=>e.date<=input.date).sort((a:{date:string},b:{date:string})=>b.date.localeCompare(a.date)).slice(0,7).map((e:{date:string;text:string})=>({date:e.date,text:e.text.slice(0,4000)}));
  const notes=(history.data||[]).map(d=>({date:d.date,notes:Object.values(d.notes as Record<string,{text:string}>).map(n=>n.text.slice(0,3000)).slice(0,5)}));
  const allowedDates=new Set([...journal,...notes].map(d=>d.date));
  const text=await fireworksText(companionInstructions.replace("Write warm professional French, using vous,",languageInstruction(localeOf(input.locale||"fr")) + " Write warmly and professionally,"),{lesson:day.snapshot,previousQuestions:day.questions,journal,notes,memories:memories.data},true,true,auth.user.id);
  const output=companionOutput.parse(JSON.parse(text.replace(/^```json\s*|\s*```$/g,"")));
  output.memories=output.memories.filter(m=>allowedDates.has(m.sourceDate));
  const {data:finished,error:failed}=await auth.db.rpc("learning_action",{action:"finish_ai",payload:{requestId:reserved.requestId,expectedRevision:day.revision,result:output}});
  if(failed) throw Error("save");
  if(finished.stale) return privateReply({error:"changed"},409);
  return privateReply({...finished,ai:fireworksStatus(auth.user.id)});
 } catch { return privateReply({error:"unavailable"},503); }
}
