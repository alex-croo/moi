"use client";
import {useParams} from "next/navigation";
import {localeOf,tr} from "@/lib/locale";
export default function WorkspaceError({reset}:{reset:()=>void}){
 const locale=localeOf(String(useParams().locale));
 return <main className="error-screen"><h1>{tr(locale,"Votre espace est momentanément indisponible.","Your space is temporarily unavailable.")}</h1><p>{tr(locale,"Vos données n’ont pas été modifiées.","Your data has not been changed.")}</p><button className="primary" onClick={reset}>{tr(locale,"Réessayer","Try again")}</button></main>;
}
