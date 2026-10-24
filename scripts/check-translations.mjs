import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const base=new URL('../src/',import.meta.url);
const source=JSON.parse(fs.readFileSync(new URL('lib/translations/source.json',base),'utf8'));
const required=new Set(Object.keys(source));
function visitDirectory(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='translations')visitDirectory(file);continue;}if(!/\.tsx?$/.test(file))continue;const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(n){if(ts.isCallExpression(n)&&['t','tr','regionalTr'].includes(n.expression.getText(sf))){const i=n.expression.getText(sf)==='t'?0:1;const a=n.arguments[i];if(a&&ts.isStringLiteral(a)&&a.text.trim())required.add(a.text);}if(ts.isJsxAttribute(n)&&n.name.getText(sf)==='text'&&n.initializer&&ts.isStringLiteral(n.initializer))required.add(n.initializer.text);ts.forEachChild(n,visit);}visit(sf);}}
visitDirectory(base.pathname);for(const token of ['v','· v'])required.delete(token);
for(const locale of ['es','pt-BR']){const dictionary=JSON.parse(fs.readFileSync(new URL(`lib/translations/${locale}.json`,base),'utf8'));const missing=[...required].filter(s=>typeof dictionary[s]!=='string'||!dictionary[s].trim());if(missing.length)throw Error(`${locale}: missing UI translations: ${JSON.stringify(missing)}`);}
console.log(`${required.size} UI strings checked in Spanish and Brazilian Portuguese.`);
