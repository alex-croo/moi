import { boundedJson, privateReply } from "@/lib/private-http";
import { runMarieWorker, workerAuthorized } from "@/lib/marie-worker";
import { qualifyMarie } from "@/lib/marie-qualification";
export const maxDuration=120;
export async function POST(request:Request){
 if(!workerAuthorized(request.headers.get("authorization")))return privateReply({error:"unauthorized"},401);
 try{
  const body=await boundedJson(request,100);
  if(body && typeof body==="object" && "mode" in body && body.mode==="qualify")return privateReply(await qualifyMarie());
  return privateReply(await runMarieWorker());
 }catch{return privateReply({error:"unavailable"},503);}
}
