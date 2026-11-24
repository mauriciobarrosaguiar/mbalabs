import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relative) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("the field has a single compact phase header and no secondary wizard bar", () => {
  const field = read("../src/app/apps/dronegestor/campo/DroneGestorAppV3.tsx");
  const page = read("../src/app/apps/dronegestor/campo/page.tsx");
  assert.match(field, /Etapa \$\{guidedPhase\[view\]\} de 8/);
  assert.doesNotMatch(field, /agro-field-shortcuts/);
  assert.doesNotMatch(page, /<DroneSimpleFlowUX\s*\/>/);
  assert.doesNotMatch(page, /<DroneMissionGateHint\s*\/>/);
});

test("prefilled OS and technical data are summarized and expandable without altering values or gates", () => {
  const source = read("../src/app/apps/dronegestor/campo/DroneGestorAppV3.tsx");
  assert.match(source, /Dados essenciais da OS/);
  assert.match(source, /<details className="rounded-2xl border border-slate-200 bg-white">/);
  assert.match(source, /Conferir ou corrigir dados técnicos/);
  assert.match(source, /Produtos e receita/);
  assert.match(source, /Tempos operacionais · opcionais/);
  assert.match(source, /<Primary disabled=\{!missionReady\|\|checkingPreflight\|\|droneRecordPending\} onClick=\{\(\)=>guarded\("controle"\)\}/);
  assert.match(source, /const canStart = missionReady && safetyReady && calibrationReady && checklistReady && sarpasReady && gpsReady/);
  assert.match(source, /Etapa 1 bloqueada — registro do drone/);
});

test("GPS/weather remains accessible but no longer covers mobile forms with a floating button", () => {
  const weather = read("../src/app/apps/dronegestor/campo/DroneWeatherSync.tsx");
  const field = read("../src/app/apps/dronegestor/campo/DroneGestorAppV3.tsx");
  assert.match(weather, /addEventListener\("dronegestor:open-gps-weather"/);
  assert.doesNotMatch(weather, /className=\{styles\.fab\}/);
  assert.match(field, /dispatchEvent\(new Event\("dronegestor:open-gps-weather"\)\)/);
  assert.match(field, /aria-label="GPS e clima"/);
});

test("preflight status stays guarded but its detailed indicators start folded", () => {
  const source = read("../src/app/apps/dronegestor/campo/DroneOperationNextStep.tsx");
  assert.match(source, /aria-label="Status pré-voo"/);
  assert.match(source, /expanded\?"mt-3 grid grid-cols-7 gap-1\.5":"hidden"/);
  assert.match(source, /if\(release\.ready\)return openField\("sarpas"\)/);
  assert.match(source, /\/api\/dronegestor\/preflight/);
});
