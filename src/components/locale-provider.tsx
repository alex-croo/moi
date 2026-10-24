"use client";
import {createContext,useContext,useEffect,useRef,useState,useCallback,type ReactNode} from "react";
import {tr,type Locale} from "@/lib/locale";
type Kind="catalog"|"recipe"|"lesson";
type State={locale:Locale;strings:Record<string,string>;load:(kind:Kind,id?:string)=>Promise<void>};
const LocaleContext=createContext<State>({locale:"fr",strings:{},load:async()=>{}});
export function LocaleProvider({locale,children,enabled=false}:{locale:Locale;children:ReactNode;enabled?:boolean}){
 const [catalogs,setCatalogs]=useState<Record<string,Record<string,string>>>({});
 const canonical=useRef<Record<string,Record<string,string>>>({});
 const requests=useRef(new Map<string,Promise<void>>());
 const activeLocale=useRef(locale);activeLocale.current=locale;
 const load=useCallback((kind:Kind,id?:string)=>{
  if(!enabled||locale==="fr"||(locale==="en"&&kind!=="lesson"))return Promise.resolve();
  const key=`${locale}:${kind}:${id||""}`;
  if(requests.current.has(key))return requests.current.get(key)!;
  const pending=fetch('/api/localization',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale,kind,id}),signal:AbortSignal.timeout(58000)})
   .then(async r=>{if(!r.ok)throw Error('translation_unavailable');const data=await r.json();if(kind==='catalog')canonical.current[locale]=data.strings;setCatalogs(c=>({...c,[locale]:{...c[locale],...data.strings,...canonical.current[locale]}}));
    if(kind==='catalog'&&locale!=='en'&&data.recipes?.length){
     let next=0;const ids=data.recipes as string[];
     const worker=async()=>{while(next<ids.length&&activeLocale.current===locale){const id=ids[next++];try{await load('recipe',id);}catch{/* The recipe view offers a retry without changing the source. */}}};
     void Promise.all([worker(),worker()]);
    }})
   .catch(error=>{requests.current.delete(key);throw error;});
  requests.current.set(key,pending);return pending;
 },[locale,enabled]);
 useEffect(()=>{void load('catalog').catch(()=>{});},[load]);
 return <LocaleContext.Provider value={{locale,strings:catalogs[locale]||{},load}}>{children}</LocaleContext.Provider>;
}
export function useLocale(){return useContext(LocaleContext).locale;}
export function useText(locale?:Locale){const context=useContext(LocaleContext);const language=locale||context.locale;return (fr:string|undefined,en:string|undefined=fr)=>language!=="fr"&&language===context.locale&&context.strings[fr||""]!==undefined?context.strings[fr||""]:tr(language,fr||"",en||fr||"");}
export function L({text,en}:{text:string;en?:string}){const t=useText();return <>{text.match(/^\s*/)?.[0]}{t(text.trim(),en)}{text.match(/\s*$/)?.[0]}</>;}
export function useContentTranslation(kind:Kind,id?:string){
 const {load,locale}=useContext(LocaleContext);const [status,setStatus]=useState<'ready'|'loading'|'error'>('ready');
 const run=useCallback(()=>{if(!id||locale==='fr'){setStatus('ready');return;}setStatus('loading');void load(kind,id).then(()=>setStatus('ready')).catch(()=>setStatus('error'));},[id,locale,load,kind]);
 useEffect(run,[run]);return {status,retry:run};
}
export function TranslationStatus({status,retry}:{status:'ready'|'loading'|'error';retry:()=>void}){const t=useText();return status==='ready'?null:<p className="muted small" role="status">{status==='loading'?t('Traduction en cours…','Translating…'):t('La traduction est momentanément indisponible. Le texte original reste affiché.','Translation is temporarily unavailable. The original text is still shown.')} {status==='error'&&<button className="text-button" onClick={retry}>{t('Réessayer','Try again')}</button>}</p>;}
