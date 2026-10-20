import { test, expect } from "@playwright/test";
import { lessons, completeLesson } from "../src/lib/daily-program";
import { lessonPrompt, reflectionInEntry, journalStep, progressWithJournal, programSteps } from "../src/lib/program-journal";
import { applyPrivateMutation } from "../src/lib/private-mutations";
import type { JournalEntry } from "../src/lib/types";
import type { PersonalData } from "../src/lib/private-types";
const date="2026-10-19";
const prompt=(i:number,lang:0|1=0)=>`${lessonPrompt(lessons[i],lang)}\n${lessons[i].question[lang]}\n\n`;
const entry=(text:string):JournalEntry=>({id:"test",date,text,title:"A page",mood:3,revision:1});
test("saved program journal is distinct from reading and opening a prompt is not completion",()=>{
 const p=completeLesson({completed:{},reflections:{}},lessons[0].id,date);
 expect(programSteps(p,[]).next?.kind).toBe("journal");
 expect(journalStep(lessons[0],[entry(prompt(0))],p)).toEqual({done:false,date,started:true});
 expect(journalStep(lessons[0],[entry("Unrelated journal content")],p).done).toBe(false);
 const saved=entry(prompt(0)+"Une réflexion personnelle.");
 expect(programSteps(p,[saved]).complete).toBe(1);
 expect(programSteps(p,[saved]).next?.lesson.id).toBe(lessons[1].id);
});
test("several same-day lessons and bilingual prompts do not complete each other",()=>{
 const saved=entry(prompt(0)+prompt(1,1)+"A personal answer.");
 expect(reflectionInEntry(lessons[0],saved)).toBe(false);
 expect(reflectionInEntry(lessons[1],saved)).toBe(true);
 const p=progressWithJournal({completed:{},reflections:{}},saved);
 expect(p.reflections[lessons[0].id]).toBeUndefined();
 expect(p.reflections[lessons[1].id]).toBe(date);
 expect(p.completed).toEqual({});
 expect(reflectionInEntry(lessons[0],entry(prompt(0)+prompt(0)+"A saved answer after an older duplicate."))).toBe(true);
});
test("journal linkage is saved atomically, survives reload and honors revision conflicts",()=>{
 const current={journal:[],program:{completed:{[lessons[0].id]:date},reflections:{}}} as unknown as PersonalData;
 const data={date,text:prompt(0)+"Je commence à mon rythme.",title:"Test",mood:3,expectedRevision:0};
 const saved=applyPrivateMutation(current,"journal",data);
 const reloaded=JSON.parse(JSON.stringify(saved));
 expect(reloaded.program.reflections[lessons[0].id]).toBe(date);
 expect(programSteps(reloaded.program,reloaded.journal).complete).toBe(1);
 expect(()=>applyPrivateMutation(saved,"journal",data)).toThrow("conflict");
 const blank=applyPrivateMutation(saved,"journal",{...data,text:prompt(0),expectedRevision:1});
 expect(journalStep(lessons[0],blank.journal,blank.program).done).toBe(false);
});
test("older dated reflections reopen their saved day without exposing the journal to circles",()=>{
 const e=entry(prompt(0)+"Saved before this update.");
 const p={completed:{[lessons[0].id]:date},reflections:{}};
 expect(journalStep(lessons[0],[e],p).date).toBe(date);
 const link=progressWithJournal(p,e);
 expect(link.reflections[lessons[0].id]).toBe(date);
 expect(JSON.stringify(link)).not.toContain("Saved before");
 expect(journalStep(lessons[0],[],link).done).toBe(false);
});
