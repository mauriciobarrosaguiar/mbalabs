import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import ExcelJS from "exceljs";
import { state } from "./helpers/cotacoes-public-order-fixture.mjs";

const fixture = new URL("./helpers/cotacoes-public-order-fixture.mjs", import.meta.url).href;
const mocked = new Set([
  "server-only", "next/server", "@/modules/cotacoes/lib/supabase/server",
  "@/modules/cotacoes/lib/auth/session", "@/modules/cotacoes/lib/auth/quotation-access",
  "@/modules/cotacoes/lib/data/repository", "@/modules/cotacoes/lib/data/demo-repository",
]);
const hooks = registerHooks({ resolve(spec, context, next) {
  if (mocked.has(spec)) return { url: fixture, shortCircuit: true };
  if (spec.startsWith("@/")) return { url: new URL("../src/" + spec.slice(2) + ".ts", import.meta.url).href, shortCircuit: true };
  return next(spec, context);
} });
const { markSupabasePurchaseOrderOpened } = await import("../src/modules/cotacoes/lib/data/supabase-operational.ts");
const { GET } = await import("../src/app/api/cotacoes/export/pedido/[token]/route.ts");
const { GET: getGeneratedOrders } = await import("../src/app/api/cotacoes/export/pedidos-gerados/route.ts");
const { GET: getQuotationOrders } = await import("../src/app/api/cotacoes/export/pedidos/[quotationId]/route.ts");
hooks.deregister();

function reset(status, openedAt = null) {
  Object.assign(state, { row: { id: "order", quotation_id: "quote", tenant_id: "qa", public_token: "test",
    module_type: "pharmacy", buyer_review_status: "approved", status, opened_at: openedAt }, writes: 0, beforeWrite: undefined });
}

test("primeiro acesso registra abertura de enviado ao vendedor; segundo preserva data", async () => {
  reset("enviado_ao_vendedor");
  const first = await markSupabasePurchaseOrderOpened("test");
  assert.equal(first.status, "aberto_pelo_vendedor");
  assert.ok(first.openedAt);
  assert.equal((await markSupabasePurchaseOrderOpened("test")).openedAt, first.openedAt);
  assert.equal(state.writes, 1);
});

test("abertura concorrente não regride pedido finalizado nem reescreve a data", async () => {
  reset("enviado_ao_vendedor");
  state.beforeWrite = () => { Object.assign(state.row, { status: "finalizado_pelo_vendedor", opened_at: "2026-11-05T18:06:00Z" }); };
  const result = await markSupabasePurchaseOrderOpened("test");
  assert.equal(result.status, "finalizado_pelo_vendedor");
  assert.equal(result.openedAt, "2026-11-05T18:06:00Z");
  assert.equal(state.writes, 0);
});

test("pedido finalizado sem abertura histórica e pedido pendente de aprovação não são alterados", async () => {
  reset("finalizado_pelo_vendedor");
  await markSupabasePurchaseOrderOpened("test");
  assert.equal(state.row.opened_at, null);
  reset("gerado");
  state.row.buyer_review_status = "pending";
  await assert.rejects(markSupabasePurchaseOrderOpened("test"), /não encontrado/);
  assert.equal(state.writes, 0);
});

test("Excel gerado conserva a filial histórica e a distribuidora do item", async () => {
  const response = await GET(new Request("https://mba.invalid/api/export"), { params: Promise.resolve({ token: "test" }) });
  assert.equal(response.status, 200);
  assert.equal(state.collectionTenant, "qa");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const summary = new Map();
  book.getWorksheet("Resumo").eachRow(row => summary.set(row.getCell(1).value, row.getCell(2).value));
  assert.equal(summary.get("Farmácia"), "Filial histórica");
  assert.equal(summary.get("Razão social"), "Razão histórica");
  assert.equal(summary.get("CNPJ comprador"), "11222333000262");
  assert.equal(summary.get("Distribuidora"), "Distribuidora fictícia");
  assert.equal(summary.get("Pedido mínimo (cadastro atual)"), 20);
  assert.equal(summary.get("Valor faturado"), 10);
  assert.deepEqual(book.getWorksheet("Pedido").getRow(2).values.slice(1, 10),
    ["Produto fictício", "0000000000001", "", "Distribuidora fictícia", 1, 1, 0, 10, 10]);
});

test("Excel autenticado conserva a identidade da unidade e recusa filtro ou cotação fora do escopo", async () => {
  const request = (path) => new Request("https://mba.invalid/" + path);
  const consolidated = await getGeneratedOrders(request("pedidos-gerados"));
  const filtered = await getGeneratedOrders(request("pedidos-gerados?pharmacyId=unit"));
  for (const response of [consolidated, filtered]) {
    assert.equal(response.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
    const items = book.worksheets[0];
    assert.equal(items.actualRowCount, 2);
    const row = Object.fromEntries(items.getRow(1).values.slice(1).map((header, i) => [header, items.getRow(2).getCell(i + 1).value]));
    assert.equal(row["CNPJ comprador"], "11222333000262");
    assert.equal(row["Razão social compradora"], "Razão histórica");
    assert.equal(row.Distribuidora, "Distribuidora fictícia");
    assert.equal(row["Total faturado"], 10);
  }
  assert.equal((await getGeneratedOrders(request("pedidos-gerados?pharmacyId=foreign"))).status, 404);
  assert.equal((await getQuotationOrders(request("pedidos/foreign"), { params: Promise.resolve({ quotationId: "foreign" }) })).status, 403);
  const quotation = await getQuotationOrders(request("pedidos/quote"), { params: Promise.resolve({ quotationId: "quote" }) });
  assert.equal(quotation.status, 200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await quotation.arrayBuffer()));
  const summary = new Map();
  book.getWorksheet("Resumo").eachRow(row => summary.set(row.getCell(1).value, row.getCell(2).value));
  assert.equal(summary.get("CNPJ comprador"), "11222333000262");
  assert.equal(summary.get("Razão social"), "Razão histórica");
  assert.equal(summary.get("Valor faturado"), 10);
});
