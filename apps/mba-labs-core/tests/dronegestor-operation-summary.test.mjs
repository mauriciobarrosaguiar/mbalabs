import test from "node:test";
import assert from "node:assert/strict";
import { droneAppliedArea, droneOperationStatusLabel } from "../src/lib/dronegestor-operation-summary.ts";

test("OS status distinguishes preparation, execution, suspension and consultation",()=>{
  for(const status of ["aberta","preparacao","em_preparacao"]){
    assert.match(droneOperationStatusLabel(status),/aplicação não iniciada/);
    assert.doesNotMatch(droneOperationStatusLabel(status),/em andamento/);
  }
  assert.equal(droneOperationStatusLabel("em_execucao"),"Operação em andamento");
  assert.equal(droneOperationStatusLabel("suspensa"),"Operação suspensa");
  assert.equal(droneOperationStatusLabel("campo_concluido"),"Campo concluído - regularização");
  assert.equal(droneOperationStatusLabel("campo_concluido","pronto"),"Pronta para encerrar");
  assert.equal(droneOperationStatusLabel("concluida"),"OS encerrada");
  assert.match(droneOperationStatusLabel("cancelada"),/cancelada.*somente consulta/);
  assert.equal(droneOperationStatusLabel(undefined),"Situação não informada");
});

test("report keeps zero applied area and uses only recorded progress",()=>{
  assert.equal(droneAppliedArea(0,1.5),0);
  assert.equal(droneAppliedArea("0",1.5),0);
  assert.equal(droneAppliedArea(0.04),0.04);
  assert.equal(droneAppliedArea(undefined,0.03),0.03);
  for(const input of [undefined,null,"invalid",-1,Infinity,NaN]) assert.equal(droneAppliedArea(input),0);
});

async function renderSummary(source) {
  const {createRequire}=await import('node:module');
  const {readFileSync}=await import('node:fs');
  const require=createRequire(import.meta.url),React=require('react'),ts=require('typescript');
  const {renderToStaticMarkup}=require('react-dom/server');
  const states=[{source,os:{status:'preparacao',numero:'TEST-OS'},state:{mission:{ordemServicoId:'OS-QA',area:0.1},progressHa:0}},[],false,{},false];
  let index=0;
  const hooks={useState:()=>[states[index++],()=>{}],useEffect:()=>{},useMemo:fn=>fn()};
  const compiled={exports:{}};
  const code=ts.transpileModule(readFileSync(new URL('../src/app/apps/dronegestor/pacote-operacao/DroneFinalOsSummary.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const resolve=s=>s==='react'?hooks:s==='react/jsx-runtime'?require(s):s==='@/lib/dronegestor-operation-summary'?{droneAppliedArea,droneOperationStatusLabel}:new Proxy({},{get:()=>function Icon(){return null;}});
  new Function('require','exports','module',code)(resolve,compiled.exports,compiled);
  return renderToStaticMarkup(React.createElement(compiled.exports.DroneFinalOsSummary));
}

test('real package component does not claim planned area or expose PDF before field synchronization',async()=>{
  const html=await renderSummary('os');
  assert.match(html,/0,00 ha realizados de 0,10 ha/);
  assert.match(html,/Em preparação — aplicação não iniciada/);
  assert.match(html,/Dados do campo ainda não sincronizados/);
  assert.match(html,/PDF aguarda conclusão e sincronização do campo/);
  assert.doesNotMatch(html,/href="[^\"]*pacote-operacao\/pdf/);
});

test('real package component exposes PDF only for finalized server snapshot',async()=>{
  const live=await renderSummary('live');
  assert.doesNotMatch(live,/href="[^\"]*pacote-operacao\/pdf/);
  const finalized=await renderSummary('finalized');
  assert.match(finalized,/href="\/api\/dronegestor\/pacote-operacao\/pdf\?osId=OS-QA"/);
});
