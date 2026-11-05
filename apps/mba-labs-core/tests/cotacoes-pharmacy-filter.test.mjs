import assert from "node:assert/strict";
import test from "node:test";
import { matchesPharmacyFilter, resolvePharmacyFilter } from "../src/modules/cotacoes/lib/pharmacy-filter.ts";

const pharmacies = [
  { id: "matriz", tenantId: "rede", status: "ativo" },
  { id: "filial", tenantId: "rede", status: "inativo" },
  { id: "outra", tenantId: "terceiro", status: "ativo" },
];

test("filtro consolidado preserva cotações legadas sem unidade", () => {
  const filter = resolvePharmacyFilter("", pharmacies, "rede");
  assert.equal(matchesPharmacyFilter({ tenantId: "rede" }, filter), true);
});

test("unidade inativa permanece disponível para consultas históricas da própria rede", () => {
  const filter = resolvePharmacyFilter("filial", pharmacies, "rede");
  assert.equal(matchesPharmacyFilter({ tenantId: "rede", pharmacyId: "filial" }, filter), true);
  assert.equal(matchesPharmacyFilter({ tenantId: "rede", pharmacyId: "matriz" }, filter), false);
  assert.equal(matchesPharmacyFilter({ tenantId: "terceiro", pharmacyId: "filial" }, filter), false);
});

test("filtro inválido ou de outro tenant não retorna a visão consolidada", () => {
  for (const id of ["inválido", "outra"]) {
    const filter = resolvePharmacyFilter(id, pharmacies, "rede");
    assert.equal(filter.kind, "invalid");
    assert.equal(matchesPharmacyFilter({ tenantId: "rede", pharmacyId: "matriz" }, filter), false);
  }
});
