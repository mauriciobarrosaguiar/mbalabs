import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pilotOrderHref} from "../src/lib/agrovoo-pilot-view.ts";
const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/"+p,import.meta.url),"utf8");
test("Abertura direta reusa validações de atribuição e estado local",()=>{
 assert.equal(pilotOrderHref("a&b",true),"/apps/dronegestor/gestao?osId=a%26b&abrir=1");
 const board=read("gestao/DroneGestaoClientV3.tsx");
 assert.ok(board.includes('searchParams.get("abrir")!=="1"'));
 assert.ok(board.includes("void openOrder(selected)"));
 assert.ok(board.includes("fresh.canManage===false"));
 assert.ok(board.includes('localStorage.getItem("dronegestor:deviceOwner:v1")!==currentDeviceOwner'));
 assert.ok(board.includes("droneDeviceSwitchIssue(localStorage,item.entityId)"));
 const home=read("agrovoo/piloto/AgroVooPilotHome.tsx");
 assert.ok(home.includes("pilotOrderHref(order.entityId,true)"));
 assert.ok(home.includes("!text-white"));
 assert.ok(!home.includes("<AgroVooInstall/>"));
 assert.ok(read("agrovoo/AgroVooPilotShell.tsx").includes("<AgroVooInstall/>"));
});
test("Compactação preserva controles e permite leitura de nomes longos",()=>{
 const field=read("campo/DroneGestorAppV3.tsx");
 assert.ok(field.includes("agro-field-compact-form"));
 assert.ok(field.includes("agro-field-full-value"));
 assert.ok(field.includes("disabled={!missionReady||checkingPreflight||droneRecordPending}"));
 assert.ok(field.includes('disabled={!safetyReady} onClick={()=>guarded("calibracao")}'));
 assert.ok(read("agrodoc.css").includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
});
