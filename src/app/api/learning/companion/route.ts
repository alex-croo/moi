import { after } from "next/server";
import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { boundedJson, privateReply } from "@/lib/private-http";
import { requirePrivateFireworks, fireworksStatus } from "@/lib/fireworks";
import { runMarieWorker } from "@/lib/marie-worker";
export const maxDuration=120;
export async function POST(request:Request){
 if(!sameOrigin(request))return privateReply({error:"forbidden"},403);
 const auth=await authorizedClient();if(!auth)return privateReply({error:"unauthorized"},401);
 try{
  const input=z.object({date:z.iso.date(),locale:z.enum(["fr","en","es","pt-BR"]).optional(),kind:z.enum(["opening","followup"]).optional()}).strict().parse(await boundedJson(request,1000));
  await requirePrivateFireworks(auth.user.id);
  const {data,error}=await auth.db.rpc("learning_action",{action:"coach_refresh",payload:input});
  if(error)return privateReply({error:"unavailable"},error.code==="53300"?429:403);
  after(async()=>{await runMarieWorker(auth.user.id).catch(()=>{});});
  return privateReply({...data,ai:fireworksStatus(auth.user.id)},202);
 }catch{return privateReply({error:"unavailable"},503);}
}
