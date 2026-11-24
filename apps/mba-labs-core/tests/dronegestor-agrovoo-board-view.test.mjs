import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterAgroVooOrders, paginateAgroVooOrders } from "../src/lib/agrovoo-board-view.ts";

const example = { numero: "OS-01", cliente: "João", fazenda: "São José", talhao: "Talhão 1", pilotName: "Pedro", stage: "aplicando" };
const orders = [example, {...example, numero:"OS-02", stage:"pausada"}, {...example, numero:"OS-03", stage:"encerrada"}, {...example, numero:"OS-04", stage:"cancelada"}];

test("Painel AgroVoo: filtro padrão exclui encerradas e canceladas", () => {
  assert.deepEqual(filterAgroVooOrders(orders,"","ativas").map(o=>o.numero),["OS-01","OS-02"]);
  assert.equal(filterAgroVooOrders(orders,"","todas").length,4);
});
test("Painel AgroVoo: pesquisa sem acentos e filtro de estágio funcionam juntos", () => {
  assert.deepEqual(filterAgroVooOrders(orders,"  SAO JOSE  ","pausada").map(o=>o.numero),["OS-02"]);
  assert.equal(filterAgroVooOrders(orders,"inexistente","ativas").length,0);
  assert.equal(filterAgroVooOrders(orders,"Pedro","aplicando").length,1);
});
test("Painel AgroVoo: paginação limita página após filtro e contempla lista vazia", () => {
  const data = Array.from({length:26},(_,i)=>i);
  assert.deepEqual(paginateAgroVooOrders(data,5,10),{totalPages:3,currentPage:2,visibleOrders:[20,21,22,23,24,25]});
  assert.deepEqual(paginateAgroVooOrders([],3,25),{totalPages:1,currentPage:0,visibleOrders:[]});
  assert.equal(paginateAgroVooOrders(data,-1,25).currentPage,0);
});
test("AgroVoo: shell novo restrito à prévia gerencial e fluxo anterior preservado", () => {
  const shell = readFileSync(new URL("../src/app/apps/dronegestor/DroneAppShell.tsx",import.meta.url),"utf8");
  assert.match(shell,/if \(canManage && \(path === .*agrovoo.*\)\) return <AgroVooAdminShell/);
  assert.match(shell,/Navegação do piloto/);
  const board = readFileSync(new URL("../src/app/apps/dronegestor/agrovoo/AgroVooBetaClient.tsx",import.meta.url),"utf8");
  assert.match(board,/buildAgroVooOsPayload\(draft\)/);
  assert.match(board,/paginateAgroVooOrders\(filtered, page, pageSize\)/);
  assert.match(board,/api\/dronegestor\/painel-gestor/);
});
