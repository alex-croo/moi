import spanish from "./translations/es.json";
import portuguese from "./translations/pt-BR.json";
export const locales = ["fr", "en", "es", "pt-BR"] as const;
export type Locale = typeof locales[number];
export const languageNames: Record<Locale,string> = {fr:"Français",en:"English",es:"Español (Centroamérica)","pt-BR":"Português (Brasil)"};
export const languageCodes: Record<Locale,string> = {fr:"FR",en:"EN",es:"ES","pt-BR":"PT"};
export function isLocale(value:string):value is Locale{return (locales as readonly string[]).includes(value);}
export function localeOf(value:string):Locale{return isLocale(value)?value:value.toLowerCase()==="pt-br"||value==="pt"?"pt-BR":value.startsWith("es-")?"es":"fr";}
export function intlLocale(locale:Locale):string{return {fr:"fr-CA",en:"en-CA",es:"es-GT","pt-BR":"pt-BR"}[locale];}
export function htmlLocale(locale:Locale):string{return locale==="es"?"es-419":locale;}
export function languageInstruction(locale:Locale):string{return {fr:"Write natural professional French (Canada), using vous.",en:"Write natural Canadian English.",es:"Escribe en español centroamericano claro y cálido, usando tú y ustedes, nunca vosotros. Evita modismos exclusivos de España y no alteres las unidades elegidas.","pt-BR":"Escreva em português brasileiro natural, acolhedor e profissional, usando você, nunca português europeu. Mantenha as unidades escolhidas."}[locale];}
const dictionaries:Partial<Record<Locale,Record<string,string>>>={es:spanish,"pt-BR":portuguese};
export function tr(locale:Locale,fr:string,en:string=fr):string{
 if(locale==="fr")return fr;if(locale==="en")return en;
 return dictionaries[locale]?.[fr] ?? fr;
}
