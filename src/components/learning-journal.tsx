"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, Check, ArrowRight, Sparkles, Flag } from "lucide-react";
import { useJournalAutosave } from "@/hooks/use-journal-autosave";
import { draftFromEntry, type JournalSyncBridge } from "@/lib/journal-autosave";
import type { JournalEntry } from "@/lib/types";
import type { LearningState } from "@/lib/learning-types";
export async function learningCall(action:string,payload:object={},admin=false) {
 const r=await fetch(`/api/learning${admin?"/admin":""}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload}),keepalive:action==="note"});
 if(!r.ok) throw Error(r.status===409?"Cette note a changé sur un autre appareil. Votre brouillon est conservé ici.":"La connexion n’a pas abouti. Vos mots restent sur cet appareil; réessayez.");
 return r.json();
}
const NotesSync = createContext<(flush:()=>Promise<void>)=>()=>void>(()=>()=>{});
function AutoNote({owner,date,noteKey,label,initial,onSaved}:{owner:string;date:string;noteKey:string;label:string;initial?:{text:string;revision:number};onSaved:()=>void}) {
 const entry:JournalEntry={id:noteKey,date,title:"",mood:3,text:initial?.text||"",revision:initial?.revision||0};
 const [bridge]=useState<JournalSyncBridge>({});
 const register=useContext(NotesSync);
 const sync=useJournalAutosave([entry],async value=>{
  try {
   const saved=await learningCall("note",{date,key:noteKey,text:value.text,expectedRevision:value.expectedRevision});
   onSaved();return {...entry,text:saved.text,revision:saved.revision};
  } catch(error) {
   if(error instanceof Error&&error.message.includes("autre appareil"))throw Error("conflict");
   throw error;
  }
 },`${owner}:learning:${date}:${noteKey}`,null,bridge);
 useEffect(()=>register(()=>sync.requireSynced()),[register,sync]);
 const draft=sync.drafts[date]||draftFromEntry(entry), state=sync.states[date];
 const status=sync.recoveryError?"Attendez l’enregistrement avant de fermer cette page.":state==="conflict"?"Cette note a changé sur un autre appareil. Votre version est conservée ici.":state==="offline"?"Vos mots sont conservés. L’enregistrement reprend automatiquement dès le retour de la connexion.":state==="pending"||state==="saving"?"Enregistrement automatique…":state==="saved"?"Enregistré":"";
 return <label className="learning-note"><span>{label}</span><textarea disabled={!sync.ready} aria-label={label} value={draft.text} rows={3} maxLength={20000} placeholder="Quelques mots, à votre rythme…" onBlur={()=>void sync.flush()} onChange={e=>sync.update(date,{...draft,text:e.target.value})}/>{status&&<small role="status">{status}</small>}{state==="offline"&&<button type="button" className="text-button" onClick={()=>void sync.flush()}>Réessayer maintenant</button>}{state==="conflict"&&<p>Copiez votre brouillon avant de recharger pour comparer les versions.</p>}</label>;
}
export function DailyJournal({date,owner,enabled,children,beforeAI}:{date:string;owner:string;enabled:boolean;children:ReactNode;beforeAI:()=>Promise<void>}) {
 const [data,setData]=useState<LearningState|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const active=useRef(true), autoAsked=useRef(false);
 const noteFlushers=useRef(new Set<()=>Promise<void>>());
 const registerNotes=useMemo(()=>(flush:()=>Promise<void>)=>{noteFlushers.current.add(flush);return()=>{noteFlushers.current.delete(flush);};},[]);
 async function load(){try{const next=await learningCall("ensure",{date,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});if(active.current){setData(next);setError("");}}catch(e){if(active.current)setError((e as Error).message);}}
 useEffect(()=>{active.current=true;if(enabled)void load();return()=>{active.current=false;};},[date,enabled]);
 async function ask(){setBusy(true);setError("");try{await Promise.all([...noteFlushers.current].map(flush=>flush()));await beforeAI();const r=await fetch("/api/learning/companion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date})});if(!r.ok)throw Error("Le compagnon n’est pas disponible pour le moment. Votre journal reste accessible.");const next=await r.json();if(active.current)setData(next);}catch(e){if(active.current)setError((e as Error).message);}finally{if(active.current)setBusy(false);}}
 async function action(name:string,payload:object={}){setBusy(true);try{const next=await learningCall(name,{date,...payload});setData(next);if(name==="complete"&&next.personalization&&next.ai.ready&&!next.day?.quiet)void ask();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{if(enabled && data?.personalization && data.ai.ready && data.day && !data.day.adaptation && !data.day.quiet && date===data.today && !autoAsked.current){autoAsked.current=true;void ask();}},[data?.personalization,data?.ai.ready,data?.day?.document_id,enabled]);
 if(!enabled)return <>{children}</>;
 const day=data?.day,done=!!day&&data?.completed.some(c=>c.document_id===day.document_id);
 return <NotesSync.Provider value={registerNotes}><div className="daily-journal">
 {day&&<section className="daily-reading" aria-label="Ma lecture du jour"><div className="learning-meta"><BookOpen size={15}/><span>{day.snapshot.moduleTitle}</span><span>{done?"Lecture terminée":"À découvrir"}</span></div><h2>{day.snapshot.title}</h2>
 {day.adaptation?.introduction&&<aside className="companion-copy"><small><Sparkles size={12}/> Une invitation de votre compagnon IA</small><p>{day.adaptation.introduction}</p></aside>}
 <div className="reading-prose">{day.snapshot.body.split("\n\n").map((p,i)=><p key={i}>{p.replace(/\[S\d+\]/g,"")}</p>)}</div>
 <aside className="learning-experiment"><strong>Un petit pas à essayer</strong><p>{day.adaptation?.experiment||day.snapshot.action}</p></aside>
 <section className="learning-sources" aria-label="Références"><h3>Références :</h3><ul>{day.snapshot.sources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul></section>
 <div className="learning-actions">{done?<span><Check size={15}/> Lecture terminée</span>:<button className="primary" disabled={busy||date!==data?.today} onClick={()=>void action("complete")}>J’ai terminé la lecture <Check size={14}/></button>}<small>Une nouvelle étape par jour.</small></div>
 {!data?.encrypted&&<AutoNote key={`${date}:reflection`} owner={owner} date={date} noteKey="reflection" label={day.snapshot.question} initial={day.notes.reflection} onSaved={()=>void load()}/>}
 </section>}
 {!day&&data&&<p className="learning-muted">{date===data.today?"Votre prochaine lecture sera disponible lors de la publication du prochain jalon. Votre journal reste ouvert.":"Votre page personnelle · aucune lecture attribuée à cette date."}</p>}
 {error&&<p role="alert">{error} <button className="text-button" onClick={()=>void load()}>Réessayer</button></p>}
 <div className="daily-freewriting"><span className="eyebrow">MES MOTS, MON MOMENT</span>{children}</div>
 {day&&!data?.encrypted&&<section className="daily-followup"><h3>Pour aller un peu plus loin</h3>
 {day.questions.map(q=><div key={q.id}><small className="learning-muted"><Sparkles size={12}/> Question proposée par votre compagnon IA</small><AutoNote owner={owner} date={date} noteKey={q.id} label={q.text} initial={day.notes[q.id]} onSaved={()=>void load()}/></div>)}
 {!data?.personalization?<p className="learning-muted">Les questions personnalisées sont facultatives et s’activent dans vos préférences.</p>:!data.ai.ready?<p className="learning-muted">{data.ai.reason}</p>:<div className="learning-actions"><button className="secondary" disabled={busy||day.quiet||date!==data.today} onClick={()=>void ask()}><Sparkles size={14}/>{busy?"Un instant…":"Me proposer une question"}</button><label><input type="checkbox" checked={day.quiet} onChange={e=>void action("quiet",{enabled:e.target.checked})}/> Aujourd’hui, je préfère écrire librement</label></div>}
 {done&&<p className="learning-muted">Votre lecture est terminée. La prochaine étape vous attendra demain, sans pression.</p>}
 </section>}
 </div></NotesSync.Provider>;
}
export function LearningJourney({onOpen,entries=[]}:{onOpen:(date:string)=>void;entries:{date:string;text:string}[]}) {
 const [data,setData]=useState<LearningState|null>(null),[error,setError]=useState("");
 useEffect(()=>{learningCall("ensure",{timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).then(setData).catch(e=>setError(e.message));},[]);
 return <section className="learning-journey"><header><span className="eyebrow">UN JOUR À LA FOIS</span><h1>Votre chemin, à votre rythme.</h1><p>Une lecture, quelques mots et un petit pas dans votre quotidien.</p></header>{error&&<p role="alert">{error}</p>}{data&&<>
 <section className="learning-resume"><div><span className="eyebrow"><Flag size={14}/> {data.currentModule?.title||"Votre prochain jalon"}</span><h2>{data.day?.snapshot.title||"Un moment pour vous"}</h2><p>{data.waiting?"Lecture terminée. Retrouvez vos notes et poursuivez votre journal.":"Reprenez là où vous en êtes. Une seule nouvelle lecture par jour."}</p></div><button className="primary" onClick={()=>onOpen(data.today)}>Ouvrir ma journée <ArrowRight size={16}/></button></section>
 {data.currentModule&&data.currentModule.completed===data.currentModule.total&&data.currentModule.total>0&&<p className="learning-milestone"><Flag size={16}/> Jalon accompli · {data.currentModule.title}. Prenez un moment pour reconnaître le chemin parcouru.</p>}
 <h2>Mes journées</h2><div className="learning-history">{data.dates.map(date=>{const page=data.pages.find(p=>p.date===date);const c=data.completed.find(c=>c.completed_on===date || (page?.documentId===c.document_id));const journal=page?.journalDone||entries.some(e=>e.date===date&&e.text.trim());return <button key={date} onClick={()=>onOpen(date)}><span>{date}</span><strong>{page?.title||c?.title||"Lecture à poursuivre"}</strong><span>{c?"✓ Lecture":"Lecture à poursuivre"} · {journal?"✓ Journal":"Journal à écrire"}<ArrowRight size={14}/></span></button>;})}</div>
 </>}</section>;
}
export function LearningPreferences(){const [data,setData]=useState<LearningState|null>(null),[error,setError]=useState("");
 async function run(action="state",payload:object={}){try{setData(await learningCall(action,payload));setError("");}catch(e){setError((e as Error).message);}}useEffect(()=>{void run();},[]);
 return <section className="learning-preferences"><h2>Mon compagnon de journal</h2><p>Avec votre accord, Fireworks et Ember-1 utilisent des extraits de vos notes et les repères que vous confirmez pour adapter les questions et votre prochaine lecture. L’administration de l’application ne donne pas accès à votre journal; les opérateurs techniques peuvent toutefois accéder aux données hébergées.</p>{data&&<><label className="learning-consent"><input type="checkbox" checked={data.personalization} disabled={(!data.ai.ready||data.encrypted)&&!data.personalization} onChange={e=>void run("preferences",{enabled:e.target.checked})}/> J’active la personnalisation de mon journal par l’IA</label>{!data.ai.ready&&<p className="learning-muted">{data.ai.reason}</p>}<h3>Les repères que je garde</h3><p className="learning-muted">Seuls les repères confirmés servent de mémoire durable. Vous pouvez les modifier ou les oublier.</p>{data.memories.length===0&&<p>Aucun repère enregistré pour le moment.</p>}{data.memories.map(m=><div className="learning-memory" key={m.id}><textarea aria-label="Repère personnel" defaultValue={m.text} maxLength={400} id={`memory-${m.id}`}/><small>{m.source_date} · {m.status==="confirmed"?"Confirmé":"À confirmer"}</small><div className="learning-actions"><button className="secondary" onClick={()=>void run("memory",{operation:"confirm",id:m.id,text:(document.getElementById(`memory-${m.id}`) as HTMLTextAreaElement).value})}>Garder ce repère</button><button className="text-button" onClick={()=>void run("memory",{operation:"forget",id:m.id})}>Oublier</button></div></div>)}</>}{error&&<p role="alert">{error}</p>}</section>;
}
