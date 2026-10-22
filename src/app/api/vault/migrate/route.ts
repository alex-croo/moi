import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { boundedJson,privateReply } from "@/lib/private-http";
export async function POST(request:Request){
 if(!sameOrigin(request))return privateReply({error:"forbidden"},403);
 const auth=await authorizedClient();if(!auth)return privateReply({error:"unauthorized"},401);
 try{const input=z.object({expectedRevision:z.number().int().positive(),acknowledged:z.literal(true),personal:z.object({journal:z.array(z.unknown()),weights:z.array(z.unknown()),plans:z.array(z.unknown()),slots:z.array(z.unknown()),pantry:z.array(z.unknown()),preferences:z.record(z.string(),z.unknown()),documents:z.array(z.unknown()),groceryChecks:z.array(z.unknown()),program:z.record(z.string(),z.unknown())}).passthrough()}).strict().parse(await boundedJson(request,3000000));
 const {data,error}=await auth.db.rpc("migrate_learning_vault",{expected_revision:input.expectedRevision,personal:input.personal});
 if(error)return privateReply({error:error.code==="40001"?"conflict":"unavailable"},error.code==="40001"?409:503);
 return privateReply({revision:data});}catch{return privateReply({error:"invalid"},400);}
}
