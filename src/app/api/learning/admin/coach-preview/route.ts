import {z} from 'zod';
import {authorizedClient} from '@/lib/supabase';
import {sameOrigin} from '@/lib/security';
import {boundedJson,privateReply} from '@/lib/private-http';
import {fireworksText} from '@/lib/fireworks';
import {companionInstructions,teachingInstructions} from '@/lib/learning-prompts';
import {companionOutput,teachingOutput,learningContent} from '@/lib/learning-validation';
import {coachTeachingContext} from '@/lib/coach-context';
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
  const [text,teachingText]=await Promise.all([
   fireworksText(companionInstructions,context,false,true,undefined,{maxTokens:3000,reasoning:'none',timeoutMs:42000,schema:z.toJSONSchema(companionOutput)}),
   fireworksText(teachingInstructions,coachTeachingContext(context),false,true,undefined,{maxTokens:2000,reasoning:'none',timeoutMs:35000,schema:z.toJSONSchema(teachingOutput)}),
  ]);
  const teaching=teachingOutput.parse(JSON.parse(teachingText)).teaching;
  const output=companionOutput.parse(JSON.parse(text));
  if((output.recall?.sourceDate||null)!==(context.recall?.sourceDate||null))throw Error('invalid_source');
  return privateReply({...output,teaching,recall:output.recall?{...output.recall,sourceTitle:context.recall!.sourceTitle,questionId:'fictional'}:null});
 }catch{return privateReply({error:'unavailable'},503);}
}
