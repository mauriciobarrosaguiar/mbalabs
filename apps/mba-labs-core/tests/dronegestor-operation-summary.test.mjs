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
