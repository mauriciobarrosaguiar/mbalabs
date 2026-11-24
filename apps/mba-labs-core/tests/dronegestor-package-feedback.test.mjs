import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function harness(statusOk=true){
 const source=readFileSync(new URL('../src/app/apps/dronegestor/pacote-operacao/DroneOperationPackage.tsx',import.meta.url),'utf8');
 const cut=source.slice(0,source.indexOf('  const pending=useMemo'))+'  return {saveProperty,closure};\n}';
 const states=['OS-QA',{}, {},[],null,null,false,false,false,[], '', 'preparacao','',false,'PROPRIETARIO FICTICIO','REFERENCIA FICTICIA','os','','',true];
 const timers=[],requests=[];let index=0;
 const hooks={useState:()=>{const slot=index++;return[states[slot],value=>{states[slot]=value;}];},useEffect:()=>{}};
 const resolve=s=>s==='react'?hooks:{};
 const fetch=async(url,init)=>{requests.push({url,method:init.method});return{ok:init.method==='PATCH'||statusOk,json:async()=>init.method==='PATCH'?{ok:true}:{status:'pendente_regularizacao',osStatus:'preparacao',missing:['Campo ainda não concluído'],...(statusOk?{}:{error:'Falha na atualização das pendências.'})}};};
 const compiled={exports:{}};
 const code=ts.transpileModule(cut,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','module','fetch','window','localStorage',code)(resolve,compiled.exports,compiled,fetch,{setTimeout:fn=>timers.push(fn)},{getItem:()=>null});
 return{...compiled.exports.DroneOperationPackage(),states,timers,requests};
}

test('property save success remains visible after automatic pending refresh',async()=>{
 const h=harness();await h.saveProperty();assert.match(h.states[12],/Dados da propriedade salvos/);
 assert.equal(h.timers.length,1);h.timers[0]();await new Promise(resolve=>setImmediate(resolve));
 assert.match(h.states[12],/Dados da propriedade salvos/);
 assert.deepEqual(h.states[9],['Campo ainda não concluído']);
 assert.deepEqual(h.requests.map(r=>r.method),['PATCH','POST']);
});
test('automatic pending refresh still displays server errors instead of hiding them',async()=>{
 const h=harness(false);await h.saveProperty();h.timers[0]();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.states[12],'Falha na atualização das pendências.');
});

test('saving pending items on preparation never claims the field is completed',async()=>{
 const h=harness();await h.closure('save_pending');
 assert.match(h.states[12],/Pendências salvas/);
 assert.doesNotMatch(h.states[12],/campo continua concluído/);
 assert.equal(h.states[11],'preparacao');
});
