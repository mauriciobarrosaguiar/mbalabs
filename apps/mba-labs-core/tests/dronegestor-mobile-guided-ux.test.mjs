import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relative) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("the mobile pilot stage header is concise and secondary navigation is hidden by default", () => {
  const source = read("../src/app/apps/dronegestor/campo/DroneSimpleFlowUX.tsx");
  assert.match(source, /Etapa \{active\.number\} de \{phases\.length\} · Apenas consulta/);
  assert.match(source, /<details className="mx-auto mt-2/);
  assert.match(source, /Ver roteiro completo e outros acessos/);
  assert.match(source, /A posição não significa que a fase foi concluída/);
  assert.match(source, /\{view==="seguranca" && <div/);
});

test("prefilled OS and technical data are summarized and expandable without altering values or gates", () => {
  const source = read("../src/app/apps/dronegestor/campo/DroneGestorAppV3.tsx");
  assert.match(source, /Resumo da aplicação/);
  assert.match(source, /<details defaultOpen=\{!missionReady\}/);
  assert.match(source, /<details defaultOpen=\{!productsReady\}/);
  assert.match(source, /Tempos operacionais · opcionais/);
  assert.match(source, /<Primary disabled=\{!missionReady\} onClick=\{\(\)=>guarded\("controle"\)\}/);
  assert.match(source, /const canStart = missionReady && safetyReady && calibrationReady && checklistReady && sarpasReady && gpsReady/);
  assert.match(source, /identifica[cç][aã]o ANAC v[aá]lido/i);
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
