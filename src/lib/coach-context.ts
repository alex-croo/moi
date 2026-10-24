import type { LearningDay, LearningMemory } from "./learning-types";

type Journal = { date: string; text: string };
export type CoachHistory = Pick<LearningDay, "date" | "document_id" | "snapshot" | "notes" | "adaptation" | "questions">;
type Completion = { document_id: string; completed_on: string };
const age = (today: string, date: string) => Math.round((Date.parse(today) - Date.parse(date)) / 86400000);
const words = (text: string) => new Set(text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z]{5,}/g) || []);

/** A bounded, owner-scoped context. Suggested memories and future entries never enter it.
 * 1/3/7/14/30 days are product heuristics, not a clinically validated schedule. */
export function coachContext(date: string, day: LearningDay, journal: Journal[], history: CoachHistory[], memories: LearningMemory[], completed: Completion[]) {
  const past = history.filter(h => h.date < date).sort((a,b) => b.date.localeCompare(a.date));
  const targetWords = words(`${day.snapshot.title} ${day.snapshot.objective}`);
  const lastRecalled = new Map<string, string>();
  for (const h of past) {
    const recall = h.adaptation?.recall;
    if (recall && !lastRecalled.has(recall.sourceDate)) lastRecalled.set(recall.sourceDate, h.date);
  }
  const seen = new Set<string>();
  const candidates = past.filter(h => {
    if (h.document_id === day.document_id || seen.has(h.document_id) || !completed.some(c => c.document_id === h.document_id && c.completed_on < date)) return false;
    seen.add(h.document_id);
    return !lastRecalled.has(h.date) || age(date, lastRecalled.get(h.date)!) >= 3;
  });
  const score = (h: CoachHistory) => {
    const elapsed = age(date, h.date), intervals = [1,3,7,14,30];
    const spacing = Math.min(...intervals.map(n => Math.abs(n - elapsed)));
    const overlap = [...words(`${h.snapshot.title} ${h.snapshot.objective}`)].filter(w => targetWords.has(w)).length;
    return overlap * 2 - spacing - (lastRecalled.has(h.date) ? 2 : 0);
  };
  candidates.sort((a,b) => score(b)-score(a) || a.date.localeCompare(b.date));
  const chosen = candidates[0];
  const safeJournal = journal.filter(e => e.date <= date && e.text.trim()).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(e=>({date:e.date,text:e.text.slice(0,2500)}));
  const safeNotes = history.filter(h=>h.date<=date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(h=>({date:h.date,notes:Object.values(h.notes).map(n=>n.text.trim().slice(0,1200)).filter(Boolean).slice(0,3)})).filter(h=>h.notes.length);
  const confirmed = memories.filter(m=>m.status === "confirmed" && m.source_date<=date).slice(0,10).map(m=>({text:m.text,sourceDate:m.source_date,category:m.category}));
  const recall = chosen ? {
    sourceDate: chosen.date, sourceTitle: chosen.snapshot.title,
    lesson: { objective: chosen.snapshot.objective, body: chosen.snapshot.body.slice(0,2500), action: chosen.snapshot.action },
    // The action is a suggestion. These separate fields alone contain the user's own words.
    ownNotes: Object.values(chosen.notes).map(n=>n.text.trim().slice(0,800)).filter(Boolean).slice(0,2),
    ownJournal: journal.find(e=>e.date===chosen.date)?.text.slice(0,1600) || "",
  } : null;
  return {
    today: date, lesson: day.snapshot, journal: safeJournal, notes: safeNotes, memories: confirmed, recall,
    previousQuestions: history.filter(h=>h.date<=date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).flatMap(h=>h.questions.map(q=>({text:q.text,answered:!!h.notes[q.id]?.text.trim()}))).slice(0,14),
    previousExperiments: past.slice(0,3).map(h=>({
      date:h.date, suggested:h.adaptation?.experiment||h.snapshot.action,
      // Only the person can report an attempt. Keep the question with its answer.
      reports:Object.entries(h.notes).filter(([,n])=>n.text.trim()).slice(0,4).map(([key,n])=>({question:key==="reflection"?h.snapshot.question:h.questions.find(q=>q.id===key)?.text||"",answer:n.text.slice(0,1200)})),
      ownJournal:journal.find(e=>e.date===h.date)?.text.slice(0,2500)||"",
      outcome:"unknown unless explicitly reported in these own words",
    })),
  };
}

export function validateCoachRecall<T extends { recall: { sourceDate:string; prompt:string; hint:string } | null }>(output:T, context:ReturnType<typeof coachContext>) {
  if (context.recall) {
    if (!output.recall || output.recall.sourceDate !== context.recall.sourceDate) throw Error("invalid_recall_source");
    return { ...output, recall: {...output.recall, sourceTitle:context.recall.sourceTitle} };
  }
  if (output.recall) throw Error("invented_recall");
  return {...output, recall:null};
}

/** Suppress exact/near rephrasing of an earlier question; never erase an answer. */
export function freshCoachQuestion(question:string, context:ReturnType<typeof coachContext>) {
 const normalize=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
 const q=normalize(question), a=words(question);
 const repeated=context.previousQuestions.some(p=>{
  if(normalize(p.text)===q)return true;
  const b=words(p.text), common=[...a].filter(w=>b.has(w)).length;
  return a.size>=3&&b.size>=3&&common/Math.max(a.size,b.size)>=0.8;
 });
 return repeated?"":question;
}
