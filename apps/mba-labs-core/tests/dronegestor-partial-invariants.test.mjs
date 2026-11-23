import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=(p)=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");

test("partial API reuses requestId and never counts an acknowledgement twice",()=>{
  const s=source("app/api/dronegestor/execucao-parcial/route.ts");
  assert.match(s,/history\.find\(\(entry:any\)=>entry\.requestId===body\.requestId\)/);
  assert.match(s,/duplicate:true/);
  assert.match(s,/!sameDroneSnapshot\(prior\.snapshot, body\.state\)/);
  assert.match(s,/validateCumulativeContinuation\(previous, state\)/);
  assert.match(s,/\.eq\('detalhes->>updatedAt',version\)/);
  assert.match(s,/execucoesParciais:\[\.\.\.history,execution\]/);
  assert.doesNotMatch(s,/acao:\s*["']operacao_finalizada["']/);
});

test("finalization validates the cumulative checkpoint before closing the field",()=>{
  const s=source("app/api/dronegestor/state/route.ts");
  const post=s.slice(s.indexOf("export async function POST"));
  assert.match(post,/if \(osData\.execucaoParcialAtiva\)/);
  assert.match(post,/validateCumulativeContinuation\(checkpoint, state\)/);
  assert.match(post,/await validateServerPreflight/);
});

test("OS lifecycle retains campo_concluido and blocks changes to hectares after beginning",()=>{
  const s=source("app/api/dronegestor/cadastros/route.ts");
  assert.match(s,/const OS_STATUSES = \[[^\]]*"campo_concluido"/);
  assert.match(s,/\["em_execucao","suspensa","campo_concluido","concluida"\]/);
  assert.match(s,/const fixed=\["clienteId","fazendaId","talhaoId","areaHa"/);
  assert.match(s,/execucoesParciais/);
  assert.match(s,/partialExecutionSummary\(rawData\)/);
});

test("pilot OS cards display only confirmed partial totals from server",()=>{
  const s=source("app/apps/dronegestor/gestao/DroneGestaoClientV3.tsx");
  assert.match(s,/Último encerramento parcial confirmado/);
  assert.match(s,/partial\.areaAplicadaHa/);
  assert.match(s,/partial\.areaRestanteHa/);
  assert.match(s,/partial\.cargasRegistradas/);
});

test("lost acknowledgement freezes exact partial payload and prevents stale edits",()=>{
  const guided=source("app/apps/dronegestor/campo/DroneGuidedFieldMode.tsx");
  assert.match(guided,/dronegestor:partialPayload:v1:/);
  assert.match(guided,/const payload=frozen\|\|/);
  assert.match(guided,/body:JSON\.stringify\(payload\)/);
  assert.match(guided,/function hasPartialPending\(\)/);
  assert.match(guided,/if\(hasPartialPending\(\)\)return flash/);
  const app=source("app/apps/dronegestor/campo/DroneGestorAppV3.tsx");
  assert.match(app,/Encerramento parcial pendente/);
});
