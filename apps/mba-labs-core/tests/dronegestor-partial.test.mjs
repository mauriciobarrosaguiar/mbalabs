import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePartialExecution,validateCumulativeContinuation,partialExecutionSummary,sameDroneSnapshot,validateFieldCompletionState} from '../src/lib/dronegestor-partial.ts';
const state=()=>({mission:{area:20},progressHa:12,startedAt:'2026-11-22T11:00:00Z',tankRecords:[{id:'load-1',at:'2026-11-22T11:10:00Z',areaHa:12,volumeL:120}]});
test('20 ha / 12 ha / chuva preserves 8 ha pending and does not mutate loads',()=>{
 const input=state(),copy=structuredClone(input);
 assert.deepEqual(validatePartialExecution(input,20,'Chuva','Chuva no talhão'),{areaPlanejadaHa:20,areaAplicadaHa:12,areaRestanteHa:8,motivo:'Chuva',justificativa:'Chuva no talhão'});
 assert.deepEqual(input,copy);
});
test('rejects negative, nonfinite, completed/excess area, divergent planning and missing explanation',()=>{
 for(const progressHa of [-1,0,20,21,NaN,Infinity])assert.throws(()=>validatePartialExecution({...state(),progressHa},20,'Chuva','Chuva no talhão'));
 assert.throws(()=>validatePartialExecution(state(),30,'Chuva','Chuva no talhão'));
 assert.throws(()=>validatePartialExecution(state(),20,'inexistente','Chuva no talhão'));
 assert.throws(()=>validatePartialExecution(state(),20,'Chuva',''));
});
test('rejects duplicate loads, missing real timestamps and divergent hectare sum',()=>{
 const input=state();input.tankRecords.push(input.tankRecords[0]);assert.throws(()=>validatePartialExecution(input,20,'Chuva','Chuva no talhão'),/duplicada/);
 for(const patch of [{tankRecords:[]},{startedAt:''},{progressHa:11},{tankRecords:[{...state().tankRecords[0],areaHa:-1}]}])assert.throws(()=>validatePartialExecution({...state(),...patch},20,'Chuva','Chuva no talhão'));
});

const continuation=()=>{
  const base=state();
  const previous={areaAplicadaHa:12,snapshot:structuredClone(base)};
  const second={...structuredClone(base),progressHa:17,tankRecords:[
    ...structuredClone(base.tankRecords),{id:'load-2',at:'2026-11-22T13:00:00Z',areaHa:5,volumeL:50}
  ]};
  return {previous,second};
};
test('20 ha / 12 ha then +5 ha preserves initial load and totals 170 L',()=>{
  const {previous,second}=continuation(),copy=structuredClone(second);
  assert.deepEqual(validatePartialExecution(second,20,'Bateria','Troca de bateria e retomada'),{
    areaPlanejadaHa:20,areaAplicadaHa:17,areaRestanteHa:3,motivo:'Bateria',justificativa:'Troca de bateria e retomada'
  });
  assert.deepEqual(validateCumulativeContinuation(previous,second),{
    hectaresAnteriores:12,hectaresAcrescentados:5,hectaresAcumulados:17,
    cargasAnteriores:1,novasCargas:1,volumeAcumuladoL:170
  });
  assert.deepEqual(second,copy,'validation must not mutate recorded loads');
});
test('20 ha / 12 ha then 17 ha and finally 20 ha is cumulative without double counting',()=>{
  const {previous,second}=continuation();
  const next={areaAplicadaHa:17,snapshot:structuredClone(second)};
  const finished={...structuredClone(second),progressHa:20,tankRecords:[
    ...structuredClone(second.tankRecords),{id:'load-3',at:'2026-11-22T14:00:00Z',areaHa:3,volumeL:30}
  ]};
  assert.deepEqual(validateCumulativeContinuation(next,finished),{
    hectaresAnteriores:17,hectaresAcrescentados:3,hectaresAcumulados:20,
    cargasAnteriores:2,novasCargas:1,volumeAcumuladoL:200
  });
});
test('rejects unchanged progress, missing appended loads and repeated IDs',()=>{
  const {previous,second}=continuation();
  assert.throws(()=>validateCumulativeContinuation(previous,{...second,progressHa:12}),/acrescentar área/);
  assert.throws(()=>validateCumulativeContinuation(previous,{...second,tankRecords:state().tankRecords}),/novas cargas/);
  assert.throws(()=>validateCumulativeContinuation(previous,{...second,tankRecords:[
    state().tankRecords[0],{...second.tankRecords[1],id:'load-1'}
  ]}),/duplicada/);
});
test('blocks removal, edits or reorder of acknowledged loads',()=>{
  const {previous,second}=continuation();
  assert.throws(()=>validateCumulativeContinuation(previous,{...second,tankRecords:second.tankRecords.slice(1)}));
  assert.throws(()=>validateCumulativeContinuation(previous,{...second,tankRecords:[
    {...second.tankRecords[0],volumeL:119},second.tankRecords[1]
  ]}),/não podem ser alterados/);
  assert.throws(()=>validateCumulativeContinuation(previous,{...second,tankRecords:[
    second.tankRecords[1],second.tankRecords[0]
  ]}),/não podem ser alterados/);
});
test('blocks altered first start, fake progress, invalid volumes and timestamps',()=>{
  const {previous,second}=continuation();
  assert.throws(()=>validateCumulativeContinuation(previous,{...second,startedAt:'2026-11-23T11:00:00Z'}),/início original/);
  assert.throws(()=>validateCumulativeContinuation(previous,{...second,progressHa:18}),/soma acumulada/);
  for (const bad of [{volumeL:-1},{volumeL:NaN},{at:'invalid'}]){
    const copy=structuredClone(second);Object.assign(copy.tankRecords[1],bad);
    assert.throws(()=>validateCumulativeContinuation(previous,copy));
  }
});

test('partial OS list includes only safe summary, with cumulative hectares, loads and remaining area',()=>{
 const {previous,second}=continuation();
 const osData={areaHa:20,execucoesParciais:[
   {...previous,motivo:'Chuva',at:'2026-11-22T11:30:00Z'},
   {areaAplicadaHa:17,snapshot:second,motivo:'Bateria',at:'2026-11-22T13:30:00Z'}
 ]};
 const summary=partialExecutionSummary(osData);
 assert.deepEqual(summary,{
   areaAplicadaHa:17,areaRestanteHa:3,volumeAplicadoL:170,cargasRegistradas:2,
   complementacoes:1,motivo:'Bateria',atualizadoEm:'2026-11-22T13:30:00Z'
 });
 assert.equal('snapshot' in summary,false,'OS lists must not expose raw flight snapshots');
 assert.equal(partialExecutionSummary({areaHa:20}),null);
 assert.equal(partialExecutionSummary({...osData,areaHa:16}),null);
});

test('JSONB reorders object keys without changing checkpoint or requestId semantics',()=>{
 const {previous,second}=continuation();
 const reverseKeys=value=>{
   if(Array.isArray(value))return value.map(reverseKeys);
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reverseKeys(v)]));
   return value;
 };
 const inDatabase=reverseKeys(previous);
 assert.equal(sameDroneSnapshot(previous,inDatabase),true);
 assert.deepEqual(validateCumulativeContinuation(inDatabase,second).cargasAnteriores,1);
 assert.equal(sameDroneSnapshot(second,reverseKeys(second)),true);
 const changed=reverseKeys(second);changed.tankRecords[0].volumeL+=1;
 assert.equal(sameDroneSnapshot(second,changed),false);
 assert.throws(()=>validateCumulativeContinuation(previous,changed),/não podem ser alterados/);
});

test('new field completion requires OS actually started by server',()=>{
 const started={status:'em_execucao',iniciadaEm:'2026-11-23T08:00:00Z',execucaoParcialAtiva:false};
 assert.equal(validateFieldCompletionState(started),undefined);
 assert.equal(validateFieldCompletionState({...started,status:'suspensa'}),undefined);
 for(const status of ['aberta','preparacao','em_preparacao','campo_concluido','concluida','cancelada']){
   assert.throws(()=>validateFieldCompletionState({...started,status}),/não está em execução/);
 }
 assert.throws(()=>validateFieldCompletionState({...started,iniciadaEm:''}),/início de execução/);
 assert.throws(()=>validateFieldCompletionState({...started,iniciadaEm:'invalido'}),/início de execução/);
 assert.throws(()=>validateFieldCompletionState({...started,execucaoParcialAtiva:true}),/Retome a execução parcial/);
});
