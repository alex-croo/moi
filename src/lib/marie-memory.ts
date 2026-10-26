import { z } from "zod";
import type { LearningDay, LearningMemory } from "./learning-types";

export const MARIE_VERSION = 4;
export type MemorySource = { date: string; text: string; hash: string };
export type MarieMemory = LearningMemory & { source_hash?: string; excerpt?: string; topic?: string; kind?: string; active?: boolean; origin?: string; last_used?: string | null; experiment_date?: string | null };
export const memoryExtraction = z.object({ sources: z.array(z.object({
  date: z.iso.date(), memories: z.array(z.object({
    text: z.string().trim().min(5).max(400), excerpt: z.string().trim().min(5).max(700),
    category: z.enum(["motivation", "constraint", "preference", "experiment", "observation"]),
    kind: z.enum(["intention", "attempt", "outcome", "value", "preference", "constraint", "observation"]),
    topic: z.string().trim().min(3).max(100),
    supersedes: z.array(z.string().uuid()).max(3), experimentDate:z.iso.date().nullable(),
  }).strict()).max(6),
}).strict()).max(3) }).strict();
export const mariePage = z.object({
  introduction: z.string().trim().min(10).max(700),
  teaching: z.string().trim().min(40).max(4000),
  experiment: z.string().trim().min(10).max(700),
  question: z.string().trim().max(500),
  questionIntent: z.string().trim().max(150),
  usedMemoryIds: z.array(z.string().uuid()).max(6),
  personalReferences: z.array(z.object({ memoryIds:z.array(z.string().uuid()).min(1).max(2), field:z.enum(["teaching","experiment","question"]) }).strict()).max(1),
}).strict();
export type MariePage = z.infer<typeof mariePage>;
const normalize = (s:string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const tokens = (s:string) => new Set(normalize(s).match(/[a-z]{4,}/g) || []);
const overlap = (a:Set<string>,b:Set<string>) => [...a].filter(x=>b.has(x)).length / Math.max(1,Math.min(a.size,b.size));
export function verifyExtraction(result:z.infer<typeof memoryExtraction>, sources:MemorySource[], memories:MarieMemory[], experiments:{date:string}[] = []) {
  if (result.sources.length!==sources.length || new Set(result.sources.map(s=>s.date)).size!==sources.length) throw Error("incomplete_memory_sources");
  return result.sources.map(s=>{
    const source=sources.find(x=>x.date===s.date); if(!source)throw Error("unknown_memory_source");
    for(const m of s.memories){
      if(m.experimentDate && (m.experimentDate>s.date || !experiments.some(e=>e.date===m.experimentDate)))throw Error("unknown_experiment");
      if(!source.text.includes(m.excerpt))throw Error("ungrounded_memory");
      if(m.supersedes.some(id=>!memories.some(old=>old.id===id && old.source_date<=s.date)))throw Error("unknown_superseded_memory");
    }
    return {...s,hash:source.hash};
  });
}

/** Select across the complete indexed history. Age alone never disqualifies a useful observation. */
export function selectMarieMemories(lesson:{title:string;objective:string;body:string}, date:string, memories:MarieMemory[], ignoredDates:string[]=[]) {
  const target=tokens(`${lesson.title} ${lesson.objective} ${lesson.body}`);
  const ranked=memories.filter(m=>m.active!==false && m.status==="confirmed" && m.source_date<=date && (m.origin==="manual"||!ignoredDates.includes(m.source_date))).map(m=>{
    const elapsed=(Date.parse(date)-Date.parse(m.source_date))/86400000;
    const usedAgo=m.last_used?(Date.parse(date)-Date.parse(m.last_used))/86400000:Infinity;
    return {m,score:overlap(target,tokens(`${m.topic||""} ${m.text}`))*8+(m.kind==="outcome"?0.8:0)+(elapsed<8?0.2:0)-(usedAgo<3?4:usedAgo<7?1:0)};
  }).sort((a,b)=>b.score-a.score || a.m.source_date.localeCompare(b.m.source_date));
  const selected:MarieMemory[]=[];
  for(const {m} of ranked){
    if(selected.filter(s=>s.source_date===m.source_date).length>=2)continue;
    if(selected.some(s=>overlap(tokens(s.text),tokens(m.text))>0.85))continue;
    selected.push(m); if(selected.length===6)break;
  }
  return selected;
}
export function composeMarieContext(date:string, lesson:LearningDay["snapshot"], memories:MarieMemory[], history:LearningDay[], sources:MemorySource[], completed:{document_id:string;completed_on:string}[], ignoredDates:string[]=[]) {
  const past=history.filter(h=>h.date<date).sort((a,b)=>b.date.localeCompare(a.date));
  const selected=selectMarieMemories(lesson,date,memories,ignoredDates);
  const questions=history.filter(h=>h.date<=date).flatMap(h=>[
    ...h.questions.map(q=>({text:q.text,answered:!!h.notes[q.id]?.text.trim(),intent:""})),
    ...(h.adaptation?.question?[{text:h.adaptation.question,answered:sources.some(s=>s.date===h.date&&s.text.trim()),intent:(h.adaptation as (LearningDay["adaptation"] & {questionIntent?:string}))?.questionIntent||""}]:[]),
  ]);
  // Proposed actions are clearly separate from source-grounded observations.
  const experiments=past.filter(h=>!ignoredDates.includes(h.date)&&h.adaptation?.experiment).slice(0,5).map(h=>({date:h.date,suggested:h.adaptation!.experiment,reportedObservations:memories.filter(m=>m.active!==false && m.experiment_date===h.date && ["attempt","outcome"].includes(m.kind||"") && (m.origin==="manual"||!ignoredDates.includes(m.source_date))).slice(-6).map(m=>({id:m.id,text:m.text,date:m.source_date})),outcome:"unknown unless explicitly reported; do not infer success from reading completion"}));
  const concept=past.find(h=>completed.some(c=>c.document_id===h.document_id)&&h.snapshot.title!==lesson.title);
  return {date,lesson:{title:lesson.title,objective:lesson.objective,body:lesson.body,action:lesson.action,question:lesson.question,sources:lesson.sources},
    memories:selected.map(m=>({id:m.id,text:m.text,sourceDate:m.source_date,excerpt:m.excerpt,kind:m.kind,topic:m.topic,lastUsed:m.last_used})),
    currentNotes:sources.filter(s=>s.date===date&&!ignoredDates.includes(s.date)).map(s=>({date:s.date,text:s.text.slice(0,6000)})),
    previousQuestions:questions,previousExperiments:experiments,
    previousConcept:concept?{title:concept.snapshot.title,body:concept.snapshot.body.slice(0,2200)}:null,
  };
}
export function validateMariePage(value:MariePage, context:ReturnType<typeof composeMarieContext>) {
  const ids=new Set([...context.memories.map(m=>m.id),...context.previousExperiments.flatMap(e=>e.reportedObservations.map(m=>m.id))]);
  if(value.usedMemoryIds.some(id=>!ids.has(id)) || value.personalReferences.some(r=>r.memoryIds.some(id=>!ids.has(id)||!value.usedMemoryIds.includes(id))))throw Error("unknown_personal_reference");
  if(/vous (?:avez|aviez|evoqu|nomm|disiez|ecriv|notiez|remarqu|mention)|you (?:mentioned|noted|said|wrote|noticed)|voce (?:disse|escreveu|mencionou)|usted (?:dijo|escribio|menciono)/i.test(normalize(value.introduction)))throw Error("autobiographical_introduction");
  const repeated=context.previousQuestions.some(q=>
    (!!value.questionIntent && normalize(value.questionIntent)===normalize(q.intent)) ||
    (!!value.question && (normalize(q.text)===normalize(value.question) || overlap(tokens(q.text),tokens(value.question))>=0.8)));
  return {...value,question:repeated?"":value.question,questionIntent:repeated?"":value.questionIntent,version:MARIE_VERSION,recall:null};
}
