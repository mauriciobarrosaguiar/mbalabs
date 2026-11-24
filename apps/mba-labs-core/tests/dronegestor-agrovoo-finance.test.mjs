import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseAmountCents,validDate,validateFinanceInput,summarizeFinance,nextFinanceState,financeToday} from "../src/lib/agrovoo-finance.ts";
const entry=(overrides={})=>({id:"x",kind:"receita",description:"Serviço",category:"Serviços",amount_cents:10000,due_date:"2026-11-24",status:"pendente",settled_date:null,...overrides});
test("Financeiro: valores em centavos sem erro de ponto flutuante",()=>{
  assert.equal(parseAmountCents("12,34"),1234);
  assert.equal(parseAmountCents("0,01"),1);
  for(const raw of ["0","-1","2,333","1e6","", "1.234,56"])assert.throws(()=>parseAmountCents(raw));
});
test("Financeiro: datas reais e horário local do Tocantins",()=>{
  assert.equal(validDate("2026-02-29"),false);
  assert.equal(validDate("2024-02-29"),true);
  assert.equal(financeToday(new Date("2026-11-25T01:00:00Z")),"2026-11-24");
});
test("Financeiro: valida payload e não aceita propriedade de escopo fornecida pelo cliente",()=>{
  const input=validateFinanceInput({...entry(),scope_id:"outra",status:"liquidado"});
  assert.deepEqual(input,{kind:"receita",description:"Serviço",category:"Serviços",amount_cents:10000,due_date:"2026-11-24"});
  assert.throws(()=>validateFinanceInput(entry({amount_cents:1.5})));
  assert.throws(()=>validateFinanceInput(entry({kind:"outro"})));
});
test("Financeiro: contas pendentes, vencidas e caixa mensal excluem cancelamentos",()=>{
  const items=[entry(),entry({kind:"despesa",amount_cents:3500,due_date:"2026-11-23"}),entry({status:"liquidado",settled_date:"2026-11-10",amount_cents:20000}),entry({kind:"despesa",status:"liquidado",settled_date:"2026-11-11",amount_cents:8000}),entry({status:"liquidado",settled_date:"2026-10-20",amount_cents:50000}),entry({status:"cancelado",amount_cents:90000})];
  assert.deepEqual(summarizeFinance(items,"2026-11-24","2026-11"),{receivable:10000,payable:3500,overdue:1,dueToday:1,received:20000,paid:8000,net:12000});
});
test("Financeiro: liquidação não futura e registros encerrados imutáveis",()=>{
  assert.deepEqual(nextFinanceState(entry(),"liquidar","2026-11-24","2026-11-24"),{status:"liquidado",settled_date:"2026-11-24"});
  assert.deepEqual(nextFinanceState(entry(),"cancelar",null,"2026-11-24"),{status:"cancelado",settled_date:null});
  assert.throws(()=>nextFinanceState(entry(),"liquidar","2026-11-25","2026-11-24"));
  assert.throws(()=>nextFinanceState(entry({status:"liquidado"}),"cancelar",null,"2026-11-24"));
});
test("Financeiro: API desabilitada por padrão, autorização administrativa e escopo em todas as mutações",()=>{
  const source=readFileSync(new URL("../src/app/api/dronegestor/financeiro/route.ts",import.meta.url),"utf8");
  assert.ok(source.includes('process.env.AGROVOO_FINANCE_ENABLED!=="true"'));
  assert.ok(source.includes("!canAdministerDroneCompany(role)"));
  assert.ok(source.includes('scope_kind:c.scope_kind,scope_id:c.scope_id,created_by:c.user'));
  assert.ok(source.includes('scope(db.from(TABLE).update('));
  assert.ok(source.includes('.eq("status","pendente")'));
  assert.ok(source.includes('count>(data??[]).length'));
  const ui=readFileSync(new URL("../src/app/apps/dronegestor/agrovoo/financeiro/AgroVooFinanceClient.tsx",import.meta.url),"utf8");
  assert.ok(ui.includes('demo?{...input,id:crypto.randomUUID()'));
  assert.ok(ui.includes('demo?{...item,...next}:await mutate'));
});
