import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initialTraining,trainingStep,trainingTotals} from "../src/lib/agrovoo-training.ts";
function prepare(s){while(s.phase<7){s=trainingStep(s,{type:"check",index:s.phase});s=trainingStep(s,{type:"next"});}return s;}
test("Treinamento: não avança sem conferência e não aceita carga antes da etapa 7",()=>{
 const s=initialTraining();
 assert.equal(trainingStep(s,{type:"next"}),s);
 assert.equal(trainingStep(s,{type:"load",ha:4,liters:40}),s);
 assert.equal(trainingStep(s,{type:"check",index:6}),s);
 assert.equal(prepare(s).status,"campo");
});
test("Treinamento: parcial 12 ha, complementação 8 ha, sem perder cargas ou volume",()=>{
 let s=prepare(initialTraining());
 for(let i=0;i<3;i++)s=trainingStep(s,{type:"load",ha:4,liters:40});
 assert.deepEqual(trainingTotals(s),{area:12,liters:120,remaining:8,loads:3});
 s=trainingStep(s,{type:"partial",reason:"Exercício de interrupção"});
 assert.equal(s.status,"suspensa");
 assert.equal(trainingStep(s,{type:"load",ha:4,liters:40}),s);
 s=trainingStep(s,{type:"resume"});
 assert.equal(s.phase,4);assert.deepEqual(s.checks,[1,2,3]);
 s=prepare(s);
 assert.equal(trainingTotals(s).area,12);
 for(let i=0;i<2;i++)s=trainingStep(s,{type:"load",ha:4,liters:40});
 assert.deepEqual(trainingTotals(s),{area:20,liters:200,remaining:0,loads:5});
 assert.equal(trainingStep(s,{type:"deliver"}),s);
 s=trainingStep(s,{type:"map",name:"MAPA_FICTICIO.kml"});
 s=trainingStep(s,{type:"deliver"});
 assert.equal(s.phase,8);assert.equal(s.status,"entregue");
 s=trainingStep(s,{type:"review"});assert.equal(s.status,"conferida");
 assert.equal(trainingStep(s,{type:"load",ha:1,liters:10}),s);
});
test("Treinamento: rejeita cargas impossíveis, arquivo inválido, pausa e duplicação de parcial",()=>{
 let s=prepare(initialTraining());
 for(const a of [{ha:21,liters:40},{ha:1,liters:41},{ha:NaN,liters:10},{ha:0,liters:10}])assert.equal(trainingStep(s,{type:"load",...a}),s);
 assert.equal(trainingStep(s,{type:"map",name:"mapa.exe"}),s);
 s=trainingStep(s,{type:"pause"});assert.equal(trainingStep(s,{type:"load",ha:4,liters:40}),s);
 s=trainingStep(s,{type:"pause"});s=trainingStep(s,{type:"load",ha:4,liters:40});
 s=trainingStep(s,{type:"partial",reason:"teste de parcial"});s=prepare(trainingStep(s,{type:"resume"}));
 assert.equal(trainingStep(s,{type:"partial",reason:"teste de parcial"}),s);
 assert.deepEqual(trainingStep(s,{type:"reset"}),initialTraining());
});
test("Treinamento: entrada limitada à prévia, nenhuma API ou chave de operação real",()=>{
 const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/"+p,import.meta.url),"utf8");
 const page=read("agrovoo/piloto/treinamento/page.tsx");
 assert.ok(page.includes('process.env.VERCEL_ENV!=="preview"'));
 assert.ok(page.includes("requireAppAccess"));assert.ok(page.includes("isDroneGestorPilot"));
 const ui=read("agrovoo/piloto/treinamento/AgroVooTraining.tsx");
 for(const forbidden of ["fetch(","localStorage","sessionStorage","/api/","DronePersistenceSync","DroneGuidedFieldMode"])assert.ok(!ui.includes(forbidden),forbidden);
 assert.ok(ui.includes("SIMULACAO_AGROVOO_SEM_VALIDADE.csv"));
 assert.ok(ui.includes("NAO ENVIAR AO MAPA"));
 const field=read("campo/DroneGestorAppV3.tsx");
 assert.ok(field.includes("disabled={!missionReady||checkingPreflight||droneRecordPending}"));
 const shell=read("DroneAppShell.tsx");
 assert.ok(shell.includes("agrovoo-pilot-field"));
 const guard=read("campo/DronePilotPermissionBridge.tsx");
 assert.ok(guard.includes('setPermissionStatus("error")'));
 assert.ok(guard.includes("data-permission-retry"));
});
