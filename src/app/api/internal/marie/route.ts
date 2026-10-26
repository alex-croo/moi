import { boundedJson, privateReply } from "@/lib/private-http";
import { runMarieWorker } from "@/lib/marie-worker";
import { workerAuthorized } from "@/lib/marie-worker-auth";
import { qualifyMarie } from "@/lib/marie-qualification";
export const maxDuration=120;
export async function POST(request:Request){
 const authorization=request.headers.get("authorization");
 if(!workerAuthorized(authorization,request.headers.get("x-marie-time")))return privateReply({error:"unauthorized"},401);
 try{
  const body=await boundedJson(request,100);
  if(body && typeof body==="object" && "mode" in body && body.mode==="qualify"){
   if(!workerAuthorized(authorization))return privateReply({error:"unauthorized"},401);
   return privateReply(await qualifyMarie());
  }
  return privateReply(await runMarieWorker());
 }catch{return privateReply({error:"unavailable"},503);}
}
