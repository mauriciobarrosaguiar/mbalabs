import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  agrovooSafetyChecklistReady,
  agrovooPreflightReady,
  agrovooNextBlockingStep,
} from "../src/lib/agrovoo-preflight-rules.ts";

test("AgroVoo: falta de anexo documental não bloqueia checklist físico", () => {
  assert.equal(agrovooSafetyChecklistReady({
    area: true, pessoasAnimais: true, drone: true, clima: true, documentos: false,
  }), true);
  assert.equal(agrovooSafetyChecklistReady({
    area: true, pessoasAnimais: false, drone: true, documentos: true,
  }), false);
});

test("AgroVoo: ausência total de conferência física não libera", () => {
  assert.equal(agrovooSafetyChecklistReady({ documentos: true }), false);
  assert.equal(agrovooSafetyChecklistReady({}), false);
  assert.equal(agrovooSafetyChecklistReady(null), false);
});

test("AgroVoo: pendência documental permanece visível mas não impede início", () => {
  const steps = [
    { id: "pilot", ok: true },
    { id: "drone", ok: true },
    { id: "mission", ok: true },
    { id: "safety", ok: true },
    { id: "documents", ok: false },
    { id: "sarpas", ok: true },
    { id: "gps", ok: true },
  ];
  assert.equal(agrovooPreflightReady(steps), true);
  assert.equal(agrovooNextBlockingStep(steps), "");
});

test("AgroVoo: autorização SARPAS e GPS continuam requisitos operacionais", () => {
  const base = [
    { id: "documents", ok: false },
    { id: "sarpas", ok: false },
    { id: "gps", ok: false },
  ];
  assert.equal(agrovooPreflightReady(base), false);
  assert.equal(agrovooNextBlockingStep(base), "sarpas");
  assert.equal(agrovooPreflightReady([{ id: "documents", ok: false }]), true);
  assert.equal(agrovooPreflightReady([]), false);
});


test("AgroVoo: transição real da OS usa a mesma regra documental do pré-voo", () => {
  const route = readFileSync(new URL("../src/app/api/dronegestor/cadastros/route.ts", import.meta.url), "utf8");
  const start = route.indexOf("async function requireStartPreflight(");
  const end = route.indexOf("export async function GET", start);
  assert.ok(start >= 0 && end > start);
  const guard = route.slice(start, end);
  assert.match(guard, /agrovooSafetyChecklistReady\(snapshot\.checklist\)/);
  assert.doesNotMatch(guard, /documentTypes\.has|allTrue\(snapshot\.checklist\)/);
  assert.match(guard, /cleanText\(sarpas\.status\) !== "autorizado"/);
  assert.match(guard, /!cleanText\(sarpas\.numero\)/);
  assert.match(guard, /!hasDroneCoordinates\(weather\)/);
  assert.match(guard, /!allTrue\(snapshot\.calibration\)/);
  assert.match(guard, /assigned !== current\.usuarioId/);
});
