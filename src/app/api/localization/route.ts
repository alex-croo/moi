import {z} from "zod";
import {authorizedClient} from "@/lib/supabase";
import {sameOrigin} from "@/lib/security";
import {boundedJson,privateReply} from "@/lib/private-http";
import {translateContent} from "@/lib/content-translation";
export const maxDuration=60;
const input=z.object({locale:z.enum(["es","pt-BR","en"]),kind:z.enum(["catalog","recipe","lesson"]),id:z.string().max(120).optional()}).strict();
export async function POST(request:Request){
 if(!sameOrigin(request))return privateReply({error:"forbidden"},403);
 const auth=await authorizedClient();if(!auth)return privateReply({error:"unauthorized"},401);
 try{
  const p=input.parse(await boundedJson(request,1000));let strings:string[]=[];let recipes:string[]=[];
  if(p.kind==="catalog"){
   const [r,i,days,lines]=await Promise.all([auth.db.from("recipes").select("id,details").eq("owner_id",auth.user.id),auth.db.from("ingredients").select("details").eq("owner_id",auth.user.id),auth.db.from("learning_days").select("snapshot").eq("owner_id",auth.user.id),auth.db.from("recipe_ingredients").select("quantity,note").eq("owner_id",auth.user.id)]);
   if(r.error||i.error||days.error||lines.error)throw Error("catalog");
   recipes=(r.data||[]).map(r=>r.id);
   strings=[...(r.data||[]).flatMap(r=>[r.details.title,r.details.subtitle]),...(i.data||[]).flatMap(i=>[i.details.name]),...(days.data||[]).flatMap(d=>[d.snapshot.title,d.snapshot.moduleTitle]),...(lines.data||[]).flatMap(l=>[l.note,l.quantity?.label])].filter(Boolean);
  }else if(p.kind==="recipe"){
   const r=await auth.db.from("recipes").select("details").eq("owner_id",auth.user.id).eq("id",p.id||"").maybeSingle();if(r.error||!r.data)return privateReply({error:"not_found"},404);
   const d=r.data.details;
   strings=[d.title,d.subtitle,d.note,...(d.steps||[]).flatMap((s:{title:string;text:string})=>[s.title,s.text])].filter(Boolean);
  }else{
   // Only the user's assigned, approved snapshot. Never notes, memories, personal journal text or drafts.
   const r=await auth.db.from("learning_days").select("snapshot").eq("owner_id",auth.user.id).eq("date",p.id||"").maybeSingle();if(r.error||!r.data)return privateReply({error:"not_found"},404);
   const d=r.data.snapshot;strings=[d.title,d.moduleTitle,d.body,d.action,d.question].filter(Boolean);
  }
  return privateReply({recipes,strings:await translateContent(auth.db,auth.user.id,p.locale,`${p.kind}:${p.id||"all"}`,strings)});
 }catch{return privateReply({error:"translation_unavailable"},503);}
}
