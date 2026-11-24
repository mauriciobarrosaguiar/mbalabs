import assert from "node:assert/strict";
import test from "node:test";
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
