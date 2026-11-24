import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const s=readFileSync(new URL("../src/app/apps/dronegestor/campo/DroneGestorAppV3.tsx",import.meta.url),"utf8");
test("formulário piloto: blocos na mesma página na sequência de liberação",()=>{
 const sequence=["nova","controle","documentacao","estrategia","seguranca","calibracao","checklist","calda","sarpas"];
 const indexes=sequence.map(step=>s.indexOf('renderPreparationStage("'+step+'", <>'));
 assert.ok(indexes.every((i,n)=>i>=0&&(n===0||i>indexes[n-1])));
 assert.ok(s.includes("current?children:stageSummaries[step]"));
 assert.ok(s.includes("index>maxUnlocked||locked||checkingPreflight"));
 assert.ok(s.includes("node.scrollIntoView"));
 assert.ok(s.includes('if(!verticalMode)return view===step?children:null'));
 assert.ok(s.includes('if(view==="nova"&&!canEditProducts)return flash'));
 assert.ok(s.includes('disabled={!missionReady||checkingPreflight||droneRecordPending}'));
 assert.ok(s.includes('onClick={()=>void verifyAndStartOperation()}'));
});
test("formulário: anexos informativos sem enfraquecer checagem operacional",()=>{
 assert.ok(s.includes("agrovooSafetyChecklistReady(checklist)"));
 assert.ok(s.includes('item.id!=="documents"&&!item.ok'));
 assert.ok(!s.includes('else if(!docsVerified)limit='));
 assert.ok(!s.includes('else if(!ok("documents"))permitted='));
 assert.ok(s.includes('if(!result.ready||missing)'));
 assert.ok(s.includes('if(!gpsReady)return flash'));
 assert.ok(s.includes('if(!safetyReady)return flash'));
 assert.ok(s.includes('if(!calibrationReady)return flash'));
 assert.ok(s.includes('if(!checklistReady)return flash'));
 assert.ok(s.includes('await patchOs("em_execucao")'));
});
