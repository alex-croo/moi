import {z} from 'zod';
import {authorizedClient} from '@/lib/supabase';
import {sameOrigin} from '@/lib/security';
import {boundedJson,privateReply} from '@/lib/private-http';
import {fireworksText} from '@/lib/fireworks';
import {companionInstructions} from '@/lib/learning-prompts';
import {companionOutput,learningContent} from '@/lib/learning-validation';
import {coachPreviewInput} from '@/lib/coach-preview';
export const maxDuration=60;
export async function POST(request:Request){
 if(!sameOrigin(request))return privateReply({error:'forbidden'},403);
 const auth=await authorizedClient();if(!auth)return privateReply({error:'unauthorized'},401);
 const {data:admin}=await auth.db.rpc('current_user_admin');if(admin!==true)return privateReply({error:'forbidden'},403);
 try{
  const input=z.object({content:learningContent,scenario:z.enum(['first-day','continuity','difficult-day'])}).strict().parse(await boundedJson(request,65000));
  // Fixed fictional profiles only. Never reads or saves a user's journal.
  const context=coachPreviewInput(input.content,input.scenario);
  const text=await fireworksText(companionInstructions,context,false,true,undefined,{maxTokens:4500,reasoning:'none',timeoutMs:42000,schema:z.toJSONSchema(companionOutput)});
  const output=companionOutput.parse(JSON.parse(text));
  if((output.recall?.sourceDate||null)!==(context.recall?.sourceDate||null))throw Error('invalid_source');
  return privateReply({...output,recall:output.recall?{...output.recall,sourceTitle:context.recall!.sourceTitle,questionId:'fictional'}:null});
 }catch{return privateReply({error:'unavailable'},503);}
}
