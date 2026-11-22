import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePartialExecution} from '../src/lib/dronegestor-partial.ts';
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
