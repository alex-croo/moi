import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fireworksText } from "./fireworks";
import { composeMarieContext, memoryExtraction, mariePage, validateMariePage, verifyExtraction, type MarieMemory } from "./marie-memory";
import { memoryInstructions, marieInstructions } from "./marie-prompts";

/** Operator smoke test: fixed fictitious data only, never accepts a journal or an owner ID. */
export async function qualifyMarie(){
 const sources=[
  {date:"2026-08-01",text:"Quand je rentre tard, choisir le repas me fatigue. Je souhaite préparer une option à l’avance.",hash:"synthetic-a"},
  {date:"2026-09-10",text:"J’ai essayé de choisir le repas le matin. Le soir, cela m’a simplifié les choses.",hash:"synthetic-b"},
  {date:"2026-10-25",text:"Aujourd’hui j’ai observé les arbres pendant une promenade.",hash:"synthetic-c"},
 ];
 const started=Date.now();
 const extracted=verifyExtraction(memoryExtraction.parse(JSON.parse(await fireworksText(memoryInstructions,{sources,existingMemories:[],experiments:[]},false,true,undefined,{maxTokens:3500,reasoning:"none",timeoutMs:45000,schema:z.toJSONSchema(memoryExtraction)}))),sources,[]);
 const memories:MarieMemory[]=extracted.flatMap(s=>s.memories.map(m=>({...m,id:randomUUID(),source_date:s.date,source_hash:s.hash,status:"confirmed",active:true,origin:"automatic",experiment_date:m.experimentDate})));
 const lesson={title:"Préparer une option pour les soirs chargés",objective:"Réduire les décisions à prendre en fin de journée",body:"Choisir une option de repas à l’avance peut simplifier une soirée chargée. La préparation peut être modeste : une composante disponible, un ingrédient sorti du congélateur ou un repas choisi. Adaptez cette organisation à votre horaire réel.",action:"Choisir une option simple.",question:"Que préparer?",sources:[],limits:"",adaptations:"",reviewedOn:"2026-10-26",moduleTitle:"Organisation",version:1};
 const context=composeMarieContext("2026-10-26",lesson,memories,[],sources,[]);
 const page=validateMariePage(mariePage.parse(JSON.parse(await fireworksText(marieInstructions+"\nÉcris en français, avec vous.",context,false,true,undefined,{maxTokens:3000,reasoning:"none",timeoutMs:45000,schema:z.toJSONSchema(mariePage)}))),context);
 return {synthetic:true,sources:extracted.length,memories:memories.length,usedOlderMemory:page.usedMemoryIds.some(id=>memories.find(m=>m.id===id)!.source_date<"2026-10-01"),milliseconds:Date.now()-started,page};
}
