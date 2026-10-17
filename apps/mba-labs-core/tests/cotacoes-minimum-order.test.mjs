import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateMinimumOrderShortfalls } from "../src/modules/cotacoes/lib/services/minimum-order.ts";

const order = (id, parts) => ({
  id, tenantId: "tenant-ficticio", quotationId: "quotation-ficticia",
  moduleType: "pharmacy", supplierName: "TESTE REPRESENTANTE",
  publicToken: "teste", totalAmount: 0, status: "gerado",
  items: parts.map(([itemId, price, quantity, distributorId]) => ({
    id: itemId, tenantId: "tenant-ficticio", purchaseOrderId: id,
    quotationItemId: itemId, productName: "TESTE",
    unit: "CX", quantityToBuy: quantity, unitPrice: price,
    distributorId, totalPrice: price * quantity,
  })),
});
const makeRule = (id, dist, min, items) => ({
  orderId: id, distributorId: dist, distributorName: "TESTE DISTRIBUIDORA",
  minimum: min, itemIds: items,
});

test("não gera exceção quando o valor da distribuidora atinge o mínimo", () => {
  const orders = [order("po1", [["a", 10, 50, "d1"]])];
  assert.deepEqual(calculateMinimumOrderShortfalls(orders,
    [makeRule("po1", "d1", 500, ["a"])]), []);
});

test("abaixo do mínimo identifica valor, diferença e fornecedor correto", () => {
  const orders = [order("po1", [["a", 10, 40, "d1"]])];
  const result = calculateMinimumOrderShortfalls(orders,
    [makeRule("po1", "d1", 500, ["a"])]);
  assert.deepEqual(result.map((v) => [v.orderId,v.distributorId,v.amount,v.minimum,v.shortfall]),
    [["po1","d1",400,500,100]]);
});

test("a revisão de quantidades recalcula o mínimo instantaneamente", () => {
  const orders = [order("po1", [["a", 10, 60, "d1"]])];
  const rule = makeRule("po1", "d1", 500, ["a"]);
  assert.deepEqual(calculateMinimumOrderShortfalls(orders, [rule]), []);
  const result = calculateMinimumOrderShortfalls(orders, [rule], {a:"35"});
  assert.equal(result[0].amount,350);
  assert.equal(result[0].shortfall,150);
});

test("dois fornecedores da mesma distribuidora são verificados por pedido separadamente", () => {
  const orders = [
    order("po1", [["a", 10, 20, "d1"]]),
    order("po2", [["b", 10, 60, "d1"]]),
  ];
  const rules = [makeRule("po1","d1",500,["a"]),makeRule("po2","d1",500,["b"])];
  assert.deepEqual(calculateMinimumOrderShortfalls(orders,rules).map(v=>v.orderId),["po1"]);
});

test("um pedido com duas distribuidoras verifica cada subtotal independente", () => {
  const orders = [order("po1", [
    ["a", 8, 50, "d1"],
    ["b", 12, 50, "d2"],
  ])];
  const rules = [makeRule("po1","d1",500,["a"]),makeRule("po1","d2",550,["b"])];
  assert.deepEqual(calculateMinimumOrderShortfalls(orders,rules).map(v=>v.distributorId),["d1"]);
});

test("retirar todos os itens de uma distribuidora não autoriza exceção sem compra", () => {
  const orders = [order("po1",[["a",10,40,"d1"]])];
  const result = calculateMinimumOrderShortfalls(orders,[makeRule("po1","d1",500,["a"])],{a:0});
  assert.deepEqual(result, []);
});

test("itens sem vinculação de distribuidora não herdam mínimo de outras farmácias", () => {
  const orders = [order("po1",[["a",10,10,undefined]])];
  assert.deepEqual(calculateMinimumOrderShortfalls(orders,[]),[]);
});

test("migração protege a aprovação e cria registro de auditoria atômico", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261017061000_cotacoes_pedido_minimo_excecao_auditada.sql", import.meta.url),"utf8");
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.cot_minimum_order_exceptions/);
  assert.match(sql,/ALTER TABLE public\.cot_minimum_order_exceptions ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/v_exception->>'confirmed' IS DISTINCT FROM 'true'/);
  assert.match(sql,/INSERT INTO public\.audit_logs/);
  assert.match(sql,/GROUP BY o\.id,d\.id,d\.nome,d\.pedido_minimo/);
  assert.match(sql,/IF v_minimum_exceptions<>jsonb_array_length\(p_exceptions\)/);
});
