import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readFinalizationQueue,acknowledgeFinalization} from "../src/lib/agrovoo-finalization-queue.ts";
test("Fila: confirmação antiga não apaga novas operações ou versão diferente",()=>{
 const sent={operationId:"a",state:{progressHa:12}},next={operationId:"b",state:{progressHa:8}},changed={operationId:"a",state:{progressHa:20}};
 assert.deepEqual(acknowledgeFinalization([sent,next],sent),[next]);
 assert.deepEqual(acknowledgeFinalization([changed,next],sent),[changed,next]);
 assert.deepEqual(readFinalizationQueue(null),[]);
 for(const raw of ["invalid","{}",'[{"operationId":"x"}]'])assert.equal(readFinalizationQueue(raw),null);
});
test("Ficha vertical: consulta sem salto e sincronização sem sobrescrever fila antiga",()=>{
 const s=readFileSync(new URL("../src/app/apps/dronegestor/campo/DroneGestorAppV3.tsx",import.meta.url),"utf8");
 assert.ok(s.includes("Ficha vertical da aplicação"));
 assert.ok(s.includes("index>maxUnlocked||locked||checkingPreflight"));
 assert.ok(s.includes("setVerticalReview(false);go(step)"));
 assert.ok(s.includes("if(retryInFlight.current)return"));
 assert.ok(s.includes("if(!sameOwner())return"));
 assert.ok(s.includes("acknowledgeFinalization(latest,item)"));
 assert.match(s,/data\?\.osConcluida\s*!==\s*true/);
 assert.ok(s.includes("disabled={!missionReady||checkingPreflight||droneRecordPending}"));
});
