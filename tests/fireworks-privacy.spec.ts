import { test, expect } from '@playwright/test';
import ts from 'typescript';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('journal inference fails closed before sending content when retention is missing or withdrawn', async () => {
  const source = readFileSync('src/lib/fireworks.ts', 'utf8').replace('import "server-only";', '');
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const env: Record<string,string> = {FIREWORKS_API_KEY:'synthetic-key',FIREWORKS_MODEL:'accounts/fireworks/models/ember-1'};
  let enforced=false, returnedModel=env.FIREWORKS_MODEL, finish='stop';
  const calls: {url:string;init:RequestInit}[]=[];
  const api: any = {};
  vm.runInNewContext(code, {exports:api,process:{env},AbortSignal,Date,JSON,Error,fetch:async(url:string,init:RequestInit)=>{
    calls.push({url,init});
    if(url.includes('policySettings'))return {ok:true,json:async()=>({zeroDataRetention:enforced?{inference:{enforcement:'ENFORCED'}}:null})};
    return {ok:true,json:async()=>({model:returnedModel,choices:[{finish_reason:finish,message:{content:'Synthetic response'}}]})};
  }});
  await assert.rejects(()=>api.fireworksText('Edit',{text:'Synthetic private text'}),/retention_unverified/);
  expect(calls).toHaveLength(0);
  env.FIREWORKS_ZDR_VERIFICATION=JSON.stringify({account:'bigbob',model:env.FIREWORKS_MODEL,reference:'synthetic-proof',validUntil:'2099-01-01'});
  await assert.rejects(()=>api.fireworksText('Edit',{text:'Synthetic private text'}),/retention_unverified/);
  expect(calls).toHaveLength(1);expect(calls[0].url).toContain('policySettings');
  enforced=true;calls.length=0;
  expect(await api.fireworksText('Edit',{text:'Synthetic private text'})).toBe('Synthetic response');
  const body=JSON.parse(calls.at(-1)!.init.body as string);
  expect(body).toMatchObject({store:false,stream:false,model:env.FIREWORKS_MODEL});
  returnedModel='another-model';await assert.rejects(()=>api.fireworksText('Edit',{}),/unexpected_model/);
  returnedModel=env.FIREWORKS_MODEL;finish='length';await assert.rejects(()=>api.fireworksText('Edit',{}),/incomplete_output/);
  enforced=false;calls.length=0;await assert.rejects(()=>api.fireworksText('Edit',{}),/retention_unverified/);
  expect(calls).toHaveLength(1);expect(calls[0].url).toContain('policySettings');
});
