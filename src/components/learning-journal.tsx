"use client";
import { useText, useLocale, useContentTranslation, TranslationStatus } from "./locale-provider";

import { L } from "@/components/locale-provider";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CoachPanel } from "./coach-panel";
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
 const t=useText(); const locale=useLocale();

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
 const status=sync.recoveryError?"Attendez l’enregistrement avant de fermer cette page.":state==="conflict"?t("Cette note a changé sur un autre appareil. Votre version est conservée ici."):state==="offline"?t("Vos mots sont conservés. L’enregistrement reprend automatiquement dès le retour de la connexion."):state==="pending"||state==="saving"?"Enregistrement automatique…":state==="saved"?t("Enregistré"):"";
 return <label className="learning-note"><span>{label}</span><textarea disabled={!sync.ready} aria-label={label} value={draft.text} rows={3} maxLength={20000} placeholder={t("Quelques mots, à votre rythme…")} onBlur={()=>void sync.flush()} onChange={e=>sync.update(date,{...draft,text:e.target.value})}/>{status&&<small role="status">{t(status)}</small>}{state==="offline"&&<button type="button" className="text-button" onClick={()=>void sync.flush()}><L text="Réessayer maintenant" /></button>}{state==="conflict"&&<p><L text="Copiez votre brouillon avant de recharger pour comparer les versions." /></p>}</label>;
}
export function DailyJournal({date,owner,enabled,children,beforeAI,onOpen}:{date:string;owner:string;enabled:boolean;children:ReactNode;beforeAI:()=>Promise<void>;onOpen?:(date:string)=>void}) {
 const t=useText(); const locale=useLocale();
 const [data,setData]=useState<LearningState|null>(null),[error,setError]=useState(""),[aiError,setAiError]=useState(""),[busy,setBusy]=useState(false);
 const active=useRef(true), autoAsked=useRef(false), asking=useRef(false);
 const noteFlushers=useRef(new Set<()=>Promise<void>>());
 const registerNotes=useMemo(()=>(flush:()=>Promise<void>)=>{noteFlushers.current.add(flush);return()=>{noteFlushers.current.delete(flush);};},[]);
 function accept(next:LearningState){if(active.current)setData(current=>current?.day&&next.day&&current.day.date===next.day.date&&current.day.revision>next.day.revision?current:next);}
 async function load(){try{const next=await learningCall("ensure",{date,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});accept(next);if(active.current)setError("");}catch(e){if(active.current)setError((e as Error).message);}}
 useEffect(()=>{active.current=true;if(enabled)void load();return()=>{active.current=false;};},[date,enabled]);
 async function ask(kind:"opening"|"followup"="followup"){
  if(asking.current)return;asking.current=true;setBusy(true);setAiError("");
  try {
   await Promise.all([...noteFlushers.current].map(flush=>flush()));await beforeAI();
   const r=await fetch("/api/learning/companion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date,locale,kind}),signal:AbortSignal.timeout(55000)});
   if(!r.ok)throw Error(r.status===429?t("Marie a déjà actualisé votre journée. Vous pouvez continuer à écrire; elle reprendra le fil demain.","Marie has already updated your day. Keep writing; she will pick up the thread tomorrow."):r.status===409?t("Vos notes ont changé pendant la préparation. Relancez Marie pour en tenir compte.","Your notes changed while Marie was preparing. Try again to include them."):t("Marie n’est pas disponible pour le moment. Vos notes sont conservées; vous pouvez réessayer.","Marie is unavailable for now. Your notes are safe; you can try again."));
   accept(await r.json());
  }catch(e){if(active.current)setAiError(e instanceof Error&&e.name!=="TimeoutError"?e.message:t("Marie prend plus de temps que prévu. Réessayez dans un moment; votre journal reste accessible.","Marie is taking longer than expected. Try again shortly; your journal remains accessible."));}
  finally{asking.current=false;if(active.current)setBusy(false);}
 }
 async function action(name:string,payload:object={}){setBusy(true);setError("");try{accept(await learningCall(name,{date,...payload}));}catch(e){setError((e as Error).message);}finally{if(active.current)setBusy(false);}}
 useEffect(()=>{if(enabled&&data?.personalization&&data.ai.ready&&data.day&&data.day.adaptation?.version!==3&&!data.day.quiet&&date===data.today&&!autoAsked.current){autoAsked.current=true;void ask("opening");}},[data?.personalization,data?.ai.ready,data?.day?.document_id,data?.day?.quiet,enabled]);
 const translation=useContentTranslation("lesson",data?.day?.date);
 const day=data?.day,done=!!day&&data?.completed.some(c=>c.document_id===day.document_id);
 const questions=day?.questions.filter(q=>q.kind!=="recall")||[],latest=questions.at(-1);
 const currentQuestion=!day?.quiet&&latest?latest:null;
 const journalPrompt=day?.adaptation?.version===3&&!day.quiet?(day.adaptation.question||t("Ce que je retiens et ce que j’ai essayé","What I remember and what I tried")):currentQuestion?.text||t(day?.snapshot.question||"");
 const archivedNotes=day?Object.entries(day.notes).filter(([key,n])=>n.text.trim()):[];
 const memories=data?.memories.filter(m=>m.status==="suggested"&&m.source_date===date).slice(0,3)||[];
 const note=(id:string,label:string)=><AutoNote key={`${date}:${id}`} owner={owner} date={date} noteKey={id} label={label} initial={day?.notes[id]} onSaved={()=>void load()}/>;
 if(!enabled)return <>{children}</>;
 return <NotesSync.Provider value={registerNotes}><div className="daily-journal"><TranslationStatus {...translation}/>
 <CoachPanel day={day} loading={!data&&!error} busy={busy} personalized={!!data?.personalization} ready={!!data?.ai.ready&&date===data.today} error={aiError} onRetry={()=>void ask(day?.adaptation?.version===3?"followup":"opening")} onOpen={onOpen}>

 </CoachPanel>
 {day&&<section className="daily-reading" aria-label={t("Ma lecture du jour","My daily reading")}><div className="learning-meta"><BookOpen size={15}/><span>{t(day.snapshot.moduleTitle)}</span><span>{done?t("Lecture terminée"):t("À découvrir")}</span></div><h2>{t(day.snapshot.title)}</h2>
 <div className="reading-prose">{(!day.quiet&&day.adaptation?.teaching||t(day.snapshot.body)).split("\n\n").map((p,i)=><p key={i}>{p.replace(/\[S\d+\]/g,"")}</p>)}</div>
 <aside className="learning-experiment"><strong><L text="Un petit pas à essayer" /></strong><p>{(!day.quiet&&day.adaptation?.experiment)||t(day.snapshot.action)}</p></aside>
 <section className="learning-sources" aria-label={t("Références")}><h3><L text="Références :" /></h3><ul>{day.snapshot.sources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul></section>
 <div className="learning-actions">{done?<span><Check size={15}/> <L text={" Lecture terminée"} /></span>:<button className="primary" disabled={busy||date!==data?.today} onClick={()=>void action("complete")}><L text={"J’ai terminé la lecture "} /><Check size={14}/></button>}<small><L text="Une nouvelle étape par jour." /></small></div>
 {archivedNotes.length>0&&<details className="coach-previous"><summary>{t("Mes notes déjà écrites","My earlier notes")}</summary>{archivedNotes.map(([id])=>note(id,id==="reflection"?t(day.snapshot.question):day.questions.find(q=>q.id===id)?.text||t("Mes notes","My notes")))}</details>}
 </section>}
 {!day&&data&&<p className="learning-muted">{date===data.today?t("Votre prochaine lecture sera disponible lors de la publication du prochain jalon. Votre journal reste ouvert."):t("Votre page personnelle · aucune lecture attribuée à cette date.")}</p>}
 {error&&<p role="alert">{t(error)} <button className="text-button" onClick={()=>void load()}><L text="Réessayer" /></button></p>}

 <div className="daily-freewriting">{day&&!day.quiet&&!data?.encrypted&&<p className="coach-journal-prompt">{journalPrompt}</p>}{children}</div>
 {day&&!data?.encrypted&&<details className="coach-options"><summary>{t("Ajuster mon accompagnement","Adjust my guidance")}</summary>
 {memories.length>0&&<div className="coach-memories"><p>{t("Les repères que je garde","The reminders I keep")}</p>{memories.map(m=><div key={m.id}><p>{m.text}</p><button className="text-button" disabled={busy} onClick={()=>void action("memory",{operation:"confirm",id:m.id})}>{t("Garder ce repère","Keep this reminder")}</button><button className="text-button" disabled={busy} onClick={()=>void action("memory",{operation:"forget",id:m.id})}>{t("Ne pas garder","Don’t keep")}</button></div>)}</div>}
 {data.personalization&&data.ai.ready&&<div className="learning-actions">{!day.quiet&&<button className="secondary" disabled={busy||date!==data.today} onClick={()=>void ask()}><Sparkles size={14}/>{t("Actualiser avec mes notes","Update with my notes")}</button>}<label><input type="checkbox" checked={day.quiet} disabled={busy} onChange={e=>void action("quiet",{enabled:e.target.checked})}/>{t("Écrire sans accompagnement aujourd’hui","Write without guidance today")}</label></div>}
 </details>}
 </div></NotesSync.Provider>;
}
export function LearningJourney({onOpen,entries=[]}:{onOpen:(date:string)=>void;entries:{date:string;text:string}[]}) {
 const t=useText(); const locale=useLocale();

 const [data,setData]=useState<LearningState|null>(null),[error,setError]=useState("");
 useEffect(()=>{learningCall("ensure",{timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).then(setData).catch(e=>setError(e.message));},[]);
 useEffect(()=>{
  if(!data)return;
  const refresh=()=>{if(document.visibilityState!=="visible")return;const today=new Intl.DateTimeFormat("en-CA",{timeZone:data.timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());if(today!==data.today)learningCall("ensure",{timeZone:data.timeZone}).then(setData).catch(e=>setError(e.message));};
  const timer=setInterval(refresh,60000);document.addEventListener("visibilitychange",refresh);window.addEventListener("focus",refresh);
  return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",refresh);window.removeEventListener("focus",refresh);};
 },[data?.today,data?.timeZone]);
 const translation=useContentTranslation("lesson",data?.day?.date);
 return <section className="learning-journey"><TranslationStatus {...translation}/><header><span className="eyebrow"><L text="UN JOUR À LA FOIS" /></span><h1><L text="Votre chemin, à votre rythme." /></h1><p><L text="Une lecture, quelques mots et un petit pas dans votre quotidien." /></p></header>{error&&<p role="alert">{t(error)}</p>}{data&&<>
 <section className="learning-resume"><div><span className="eyebrow"><Flag size={14}/> {t(data.currentModule?.title)||t("Votre prochain jalon")}</span><h2>{t(data.day?.snapshot.title)||t("Un moment pour vous")}</h2><p>{data.waiting?t("Lecture terminée. La prochaine étape sera disponible demain. Vous pouvez poursuivre votre journal."):t("Reprenez là où vous en êtes. Une seule nouvelle lecture par jour.")}</p></div><button className="primary" onClick={()=>onOpen(data.today)}><L text={"Ouvrir ma journée "} /><ArrowRight size={16}/></button></section>
 {data.currentModule&&data.currentModule.completed===data.currentModule.total&&data.currentModule.total>0&&<p className="learning-milestone"><Flag size={16}/> <L text={" Jalon accompli · "} />{t(data.currentModule.title)}<L text=". Prenez un moment pour reconnaître le chemin parcouru." /></p>}
 <h2><L text="Mes journées" /></h2><div className="learning-history">{data.dates.map(date=>{const page=data.pages.find(p=>p.date===date);const c=data.completed.find(c=>c.completed_on===date || (page?.documentId===c.document_id));const journal=page?.journalDone||entries.some(e=>e.date===date&&e.text.trim());return <button key={date} onClick={()=>onOpen(date)}><span>{date}</span><strong>{t(page?.title||c?.title)||t("Lecture à poursuivre")}</strong><span>{c?t("✓ Lecture"):t("Lecture à poursuivre")} · {journal?t("✓ Journal"):t("Journal à écrire")}<ArrowRight size={14}/></span></button>;})}</div>
 </>}</section>;
}
export function LearningPreferences(){
 const t=useText(); const locale=useLocale();
const [data,setData]=useState<LearningState|null>(null),[error,setError]=useState("");
 async function run(action="state",payload:object={}){try{setData(await learningCall(action,payload));setError("");}catch(e){setError((e as Error).message);}}useEffect(()=>{void run();},[]);
 return <section className="learning-preferences"><h2><L text="Marie, dans mon journal" /></h2><p><L text="Avec votre accord, Fireworks et Ember-1 utilisent des extraits de vos notes et les repères que vous confirmez pour adapter les questions et votre prochaine lecture. L’administration de l’application ne donne pas accès à votre journal; les opérateurs techniques peuvent toutefois accéder aux données hébergées." /></p>{data&&<><label className="learning-consent"><input type="checkbox" checked={data.personalization} disabled={(!data.ai.ready||data.encrypted)&&!data.personalization} onChange={e=>void run("preferences",{enabled:e.target.checked})}/> <L text={" J’active la personnalisation de mon journal par l’IA"} /></label>{!data.ai.ready&&<p className="learning-muted">{t(data.ai.reason)}</p>}<h3><L text="Les repères que je garde" /></h3><p className="learning-muted"><L text="Seuls les repères confirmés servent de mémoire durable. Vous pouvez les modifier ou les oublier." /></p>{data.memories.length===0&&<p><L text="Aucun repère enregistré pour le moment." /></p>}{data.memories.map(m=><div className="learning-memory" key={m.id}><textarea aria-label={t("Repère personnel")} defaultValue={m.text} maxLength={400} id={`memory-${m.id}`}/><small>{m.source_date} · {m.status==="confirmed"?t("Confirmé"):t("À confirmer")}</small><div className="learning-actions"><button className="secondary" onClick={()=>void run("memory",{operation:"confirm",id:m.id,text:(document.getElementById(`memory-${m.id}`) as HTMLTextAreaElement).value})}><L text="Garder ce repère" /></button><button className="text-button" onClick={()=>void run("memory",{operation:"forget",id:m.id})}><L text="Oublier" /></button></div></div>)}</>}{error&&<p role="alert">{t(error)}</p>}</section>;
}
