"use client";
import type { ReactNode } from "react";
import type { LearningDay } from "@/lib/learning-types";
import { Marie } from "./marie";
import { useText } from "./locale-provider";
import { ArrowUpRight, RotateCcw } from "lucide-react";

export function CoachPanel({day,loading,busy,personalized,ready,error,onRetry,onOpen,children}:{
 day?:LearningDay|null; loading:boolean;busy:boolean;personalized:boolean;ready:boolean;error:string;
 onRetry:()=>void;onOpen?:(date:string)=>void;children?:ReactNode;
}) {
 const t=useText();const recall=day?.adaptation?.recall;
 return <section className="coach-welcome" aria-label={t("Marie, votre fil du jour","Marie, your daily thread")} aria-busy={busy||loading}>
  <Marie caption={t("Votre fil du jour","Your daily thread")}/>
  {day?.quiet?<p>{t("Aujourd’hui, place à vos mots. Vous pouvez retrouver Marie quand vous le souhaitez.","Today, make room for your words. Return to Marie whenever you like.")}</p>:<>
   {day?.adaptation?.introduction?<p className="coach-introduction">{day.adaptation.introduction}</p>:<p className="coach-introduction">{loading||busy?t("Je prépare le fil de votre journée. Vous pouvez commencer à lire ou à écrire.","I’m preparing your daily thread. You can start reading or writing."):!personalized?t("Un moment pour lire, réfléchir et essayer à votre façon. La personnalisation avec vos notes s’active dans vos préférences.","A moment to read, reflect and try things your way. Enable personalization with your notes in Preferences."):!ready?t("Votre lecture et vos mots restent disponibles. Marie pourra reprendre le fil dès son retour.","Your reading and words remain available. Marie can pick up the thread when she returns."):t("Votre journée peut commencer ici. Retrouvez Marie pour relier vos notes à la lecture.","Your day can begin here. Ask Marie to connect your notes with the reading.")}</p>}
   {busy&&day?.adaptation&&<small role="status">{t("Marie prépare la suite…","Marie is preparing the next step…")}</small>}
   {recall&&(day?.adaptation?.version||0)<3&&<div className="coach-recall"><div className="coach-recall-heading"><span>{t("Un repère à retrouver","A thought to revisit")}</span><span>{recall.sourceDate}</span></div>{children}
    <details><summary>{t("Revoir le repère","Revisit the idea")}</summary><p>{recall.hint}</p>{onOpen&&<button className="text-button" onClick={()=>onOpen(recall.sourceDate)}>{t("Rouvrir cette journée","Reopen this day")}<ArrowUpRight size={14}/></button>}<small>{recall.sourceTitle}</small></details>
   </div>}
   {error&&<div className="coach-error" role="alert"><p>{error}</p>{ready&&personalized&&<button className="text-button" disabled={busy} onClick={onRetry}><RotateCcw size={14}/>{t("Retrouver Marie","Reconnect with Marie")}</button>}</div>}
   {!loading&&!busy&&!error&&!day?.adaptation&&ready&&personalized&&<button className="text-button" onClick={onRetry}>{t("Retrouver Marie","Reconnect with Marie")}</button>}
  </>}
 </section>;
}
