export type ContentStrings=Record<string,string>;
export function preservedTokens(text:string){return (text.match(/\{\{[^}]+\}\}|https?:\/\/[^\s]+|\d+(?:[.,]\d+)?/g)||[]);}
export function checkedTranslation(source:string[],raw:unknown):ContentStrings {
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("translation_invalid");
 const values=raw as Record<string,unknown>;
 if(Object.keys(values).length!==source.length)throw Error("translation_incomplete");
 return Object.fromEntries(source.map((s,i)=>{
  const t=values[String(i)];if(typeof t!=="string"||!t.trim()||t.length>s.length*4+300||JSON.stringify(preservedTokens(t))!==JSON.stringify(preservedTokens(s)))throw Error("translation_changed_tokens");
  return [s,t];
 }));
}
