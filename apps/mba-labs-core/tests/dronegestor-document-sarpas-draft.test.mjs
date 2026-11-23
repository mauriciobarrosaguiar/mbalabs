import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Execute the real component's state/handlers with isolated HTTP responses.
function harness({saveOk=true, persisted=null}={}) {
 const source=readFileSync(new URL('../src/app/apps/dronegestor/documentos/DroneDocumentsCenter.tsx',import.meta.url),'utf8');
 const cut=source.slice(0,source.indexOf(' return <fieldset'))+' return {guide,setStatus,setNumero,saveSarpas,load};\n}';
 const states=[];let index=0;const requests=[];
 const hooks={useState(initial){const slot=index++;if(!(slot in states))states[slot]=initial;return[states[slot],value=>{states[slot]=value;}];},useEffect(){},useMemo:fn=>fn(),useCallback:fn=>fn};
 const response=(data,ok=true)=>({ok,json:async()=>data});
 const fetch=async(url,init)=>{
  requests.push({url,method:init?.method||'GET'});
  if(init?.method==='POST')return response(saveOk?{sarpas:{status:'autorizado',numero:'HOMOLOGACAO-SEM-VALIDADE'}}:{error:'Falha ao salvar.'},saveOk);
  if(url.includes('operacao-os'))return response({state:{mission:{registroAnac:'TESTE',tipoAtividade:'pulverizacao'}}});
  if(url.includes('/sarpas'))return response({sarpas:persisted});
  return response({items:[]});
 };
 const compiled={exports:{}};
 const code=ts.transpileModule(cut,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','module','fetch',code)(s=>s==='react'?hooks:{},compiled.exports,compiled,fetch);
 return {requests,render(){index=0;return compiled.exports.DroneDocumentsCenter({osId:'OS-ISOLADA'});}};
}
const sarpasItem=actions=>actions.guide.find(item=>item.id==='sarpas');

test('unsaved authorized selection and reference never complete SARPAS checklist',async()=>{
 const h=harness();await h.render().load();const actions=h.render();
 actions.setStatus('autorizado');actions.setNumero('HOMOLOGACAO-SEM-VALIDADE');
 assert.equal(sarpasItem(h.render()).ok,false);
 assert.equal(h.requests.filter(r=>r.method==='POST').length,0);
});
test('failed SARPAS save keeps the persisted pending state',async()=>{
 const h=harness({saveOk:false});await h.render().load();
 h.render().setStatus('autorizado');h.render().setNumero('HOMOLOGACAO-SEM-VALIDADE');
 await h.render().saveSarpas();assert.equal(sarpasItem(h.render()).ok,false);
});
test('successful SARPAS save uses server response and describes a declaration',async()=>{
 const h=harness();await h.render().load();
 h.render().setStatus('autorizado');h.render().setNumero('HOMOLOGACAO-SEM-VALIDADE');
 await h.render().saveSarpas();const item=sarpasItem(h.render());
 assert.equal(item.ok,true);assert.match(item.detail,/Referência declarada/);
 assert.match(item.detail,/SARPAS oficial/);
 assert.equal(h.render().guide.find(i=>i.id==='sarpas-doc').ok,false);
});
test('editing a saved declaration does not rewrite server-confirmed checklist state',async()=>{
 const h=harness({persisted:{status:'solicitado',numero:'PENDENTE'}});await h.render().load();
 h.render().setStatus('autorizado');h.render().setNumero('NOVO-RASCUNHO');
 assert.equal(sarpasItem(h.render()).ok,false);
 assert.match(sarpasItem(h.render()).detail,/Solicitação registrada/);
});
