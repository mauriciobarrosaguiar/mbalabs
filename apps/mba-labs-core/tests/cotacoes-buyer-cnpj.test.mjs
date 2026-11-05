import test from "node:test";
import assert from "node:assert/strict";
import { formatBuyerCnpj, normalizeBuyerCnpj } from "../src/modules/cotacoes/lib/buyer-cnpj.ts";

test("CNPJ comprador aceita documentos numéricos e alfanuméricos com dígitos válidos", () => {
  assert.equal(formatBuyerCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(normalizeBuyerCnpj(" 12.abc.345/01de-35 "), "12ABC34501DE35");
  assert.equal(formatBuyerCnpj("12.abc.345/01de-35"), "12.ABC.345/01DE-35");
});

test("CNPJ comprador rejeita dígitos incorretos, documentos incompletos e zeros", () => {
  for (const document of ["11222333000182", "12.ABC.345/01DE-36", "11222333", "00000000000000"]) {
    assert.equal(formatBuyerCnpj(document), "");
  }
});
