import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
function read(path){return readFileSync(new URL(path,import.meta.url),"utf8");}
const app=read("../src/app/apps/dronegestor/campo/DroneGestorAppV3.tsx");
const page=read("../src/app/apps/dronegestor/campo/page.tsx");
const preflight=read("../src/app/api/dronegestor/preflight/route.ts");

test("only one step navigation exists, in the field app",()=>{
 assert.doesNotMatch(page,/<DroneSimpleFlowUX\s*\/>/);
 assert.doesNotMatch(page,/<DroneOperationNextStep\s*\/>/);
 assert.doesNotMatch(page,/<DroneMissionGateHint\s*\/>/);
 assert.doesNotMatch(app,/agro-field-shortcuts/);
 assert.match(app,/Etapa \$\{guidedPhase\[view\]\} de 8/);
});
test("all steps are sequential, with documents as mandatory step three",()=>{
 assert.match(app,/const flow: View\[\] = \["nova", "controle", "documentacao", "estrategia", "seguranca", "calibracao", "checklist", "calda", "sarpas", "execucao", "relatorios"\]/);
 assert.match(app,/if\(current<0\|\|to!==current\+1\)return flash/);
 assert.match(app,/if\(index>=0&&index>maxUnlocked\)/);
 assert.match(app,/if\(view==="documentacao"\)/);
 assert.match(app,/if\(view==="seguranca"\)/);
 assert.match(app,/if\(view==="calda"\)/);
});
test("step one and documents use server-backed preflight checks",()=>{
 assert.match(app,/fetch\("\/api\/dronegestor\/preflight"/);
 assert.match(app,/\["pilot","drone","mission"\]\.includes\(item\.id\)&&!item\.ok/);
 assert.match(app,/const documents=result\.items\.find\(item=>item\.id==="documents"\)/);
 assert.match(preflight,/isExplicitHomologationPlaceholder/);
 assert.match(preflight,/hasNonPlaceholderAnacId/);
 assert.match(preflight,/sarpasStatus === "autorizado"/);
});
test("the pilot confirms calda, physical inspection, climate and GPS before later stages",()=>{
 assert.match(app,/disabled=\{!caldaReviewed\} onClick=\{\(\)=>guarded\("sarpas"\)\}/);
 assert.match(app,/if\(!gpsReady\)return flash/);
 assert.match(app,/if\(!calibrationReady\)return flash/);
 assert.match(app,/if\(!checklistReady\)return flash/);
 assert.match(app,/if\(!caldaReviewed\)return flash/);
 assert.match(app,/unlock\("execucao"\)/);
 assert.match(app,/const result=await preflightCheck\(\)/);
 assert.match(app,/await startOperation\(\)/);
 assert.match(app,/unlock\("relatorios"\)/);
});
test("map file or controller photo stays in the safety step, and field map is inline",()=>{
 assert.match(app,/<DroneGeoMapEvidence\s*\/>/);
 assert.match(app,/<DroneMapEvidence\s*\/>/);
 const map=read("../src/app/apps/dronegestor/campo/DroneMapEvidence.tsx");
 assert.doesNotMatch(map,/fixed bottom-24/);
 assert.match(map,/aria-label="Registrar mapa usado no voo"/);
});

test("an offline finalization stays in stage seven until server reconciliation",()=>{
 assert.match(app,/missionStatus==="pendente_sync"\s*\? <div/);
 assert.match(app,/setMissionStatus\("pendente_sync"\); setFinalSaved\(false\); unlock\("execucao"\)/);
 assert.match(app,/setMissionStatus\("pendente_sync"\); unlock\("execucao"\)/);
 assert.match(app,/setMissionStatus\("finalizada"\); unlock\("relatorios"\)/);
});
