import assert from "node:assert/strict";
import test from "node:test";
import { validateAgroVooStep, buildAgroVooOsPayload } from "../src/lib/agrovoo-os-wizard.ts";

const complete = {
  clienteId: "cliente-1", fazendaId: "fazenda-1", talhaoId: "talhao-1",
  cultura: " Milho ", alvo: " Praga-alvo ", areaHa: "2.75",
  dataPrevista: "2026-11-30", observacoes: " acesso pelo portão ",
};

test("AgroVoo: não avança sem cliente, fazenda ou talhão", () => {
  for (const field of ["clienteId", "fazendaId", "talhaoId"]) {
    assert.match(validateAgroVooStep(0, { ...complete, [field]: "" }), /Selecione cliente/);
  }
  assert.equal(validateAgroVooStep(0, complete), "");
});

test("AgroVoo: não avança com área vazia, zero, negativa, inválida ou infinita", () => {
  for (const areaHa of ["", "0", "-1", "NaN", "1e999"]) {
    assert.match(validateAgroVooStep(1, { ...complete, areaHa }), /área maior que zero/);
  }
  assert.equal(validateAgroVooStep(1, complete), "");
});

test("AgroVoo: cultura e alvo são exigidos antes da conferência", () => {
  assert.match(validateAgroVooStep(1, { ...complete, cultura: " " }), /Preencha cultura/);
  assert.match(validateAgroVooStep(1, { ...complete, alvo: " " }), /Preencha cultura/);
});

test("AgroVoo: agendamento e observações são opcionais", () => {
  const withoutOptional = { ...complete, dataPrevista: "", observacoes: "" };
  assert.equal(validateAgroVooStep(2, withoutOptional), "");
  assert.equal(validateAgroVooStep(3, withoutOptional), "");
});

test("AgroVoo: criação usa somente campos persistidos pela API atual", () => {
  const data = buildAgroVooOsPayload(complete);
  assert.equal(data.type, "os");
  assert.equal(data.data.areaHa, 2.75);
  assert.equal(data.data.cultura, "Milho");
  assert.equal(data.data.alvo, "Praga-alvo");
  assert.equal(data.data.observacoes, "acesso pelo portão");
  assert.deepEqual(Object.keys(data.data).sort(), [
    "alvo", "areaHa", "clienteId", "cultura", "dataPrevista",
    "fazendaId", "observacoes", "talhaoId",
  ].sort());
  assert.equal(Object.hasOwn(data.data, "status"), false);
  assert.equal(Object.hasOwn(data.data, "progressHa"), false);
  assert.equal(Object.hasOwn(data.data, "abastecimentos"), false);
  assert.equal(complete.cultura, " Milho ");
});
