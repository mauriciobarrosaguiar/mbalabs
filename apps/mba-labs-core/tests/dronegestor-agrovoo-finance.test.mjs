import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseAmountCents,maskFinanceAmount,maskedFinanceCents,formatFinanceCents,validDate,validateFinanceInput,summarizeFinance,nextFinanceState,financeToday,financialPeriod,financialGroups,financialTotals,financeCsv,formatFinanceDate} from "../src/lib/agrovoo-finance.ts";
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

test("Financeiro: competência, caixa e previsão separam liquidados e pendentes",()=>{
 const a=entry({competence_date:"2026-10-15",due_date:"2026-11-24",status:"liquidado",settled_date:"2026-11-24"});
 const b=entry({id:"b",kind:"despesa",competence_date:"2026-11-10",due_date:"2026-12-01"});
 const x=entry({id:"c",status:"cancelado",competence_date:"2026-11-01"});
 assert.deepEqual(financialPeriod([a,b,x],"2026-11-01","2026-11-30","caixa"),[a]);
 assert.deepEqual(financialPeriod([a,b,x],"2026-11-01","2026-11-30","competencia"),[b]);
 assert.deepEqual(financialPeriod([a,b,x],"2026-12-01","2026-12-31","previsao"),[b]);
 assert.throws(()=>financialPeriod([],"2026-12-01","2026-11-01","caixa"));
});
test("Financeiro: rentabilidade direta agrupa por ID e não confunde OS distintas",()=>{
 const data=[entry({os_id:"a",os_label:"OS 01",amount_cents:50000}),entry({os_id:"a",kind:"despesa",amount_cents:13000}),entry({os_id:"b",os_label:"OS 01",amount_cents:20000}),entry({kind:"despesa",amount_cents:3000}),entry({os_id:"a",status:"cancelado",amount_cents:90000})];
 const grouped=financialGroups(data,"os_id");
 assert.equal(grouped.length,3);
 assert.equal(grouped.find(x=>x.key==="a").net,37000);
 assert.equal(grouped.find(x=>x.key==="").net,-3000);
 assert.deepEqual(financialTotals(data),{revenue:70000,expense:16000,net:54000});
});
test("Financeiro: CSV protege fórmulas e exporta valores em centavos corretamente",()=>{
 const csv=financeCsv([entry({description:'=1+1; "teste"',counterparty:"  @SUM(1)",amount_cents:1234})]);
 assert.ok(csv.includes("'=1+1; \"\"teste\"\""));
 assert.ok(csv.includes("'  @SUM(1)"));
 assert.ok(csv.includes('"12,34"'));
});
test("Financeiro: campos adicionais validados; OS real é conferida no escopo e edição é concorrente",()=>{
 const id="00000000-0000-4000-8000-000000000001";
 const data=validateFinanceInput({...entry(),os_id:id,competence_date:"2026-11-15",cost_center:" Operação ",counterparty:"Cliente"});
 assert.equal(data.os_id,id);assert.equal(data.cost_center,"Operação");
 assert.throws(()=>validateFinanceInput({...entry(),os_id:"invalida"}));
 assert.throws(()=>validateFinanceInput({...entry(),competence_date:"2026-11-31"}));
 const source=readFileSync(new URL("../src/app/api/dronegestor/financeiro/route.ts",import.meta.url),"utf8");
 assert.ok(source.includes('.eq("acao","ordem_servico")'));
 assert.ok(source.includes('query.eq("empresa_id",c.scope_id):query.eq("usuario_id",c.scope_id)'));
 assert.ok(source.includes('.eq("updated_at",entry.updated_at)'));
});

test("Financeiro mobile: datas civis brasileiras sem mudança de dia",()=>{
  assert.equal(formatFinanceDate("2026-11-24"),"24/11/2026");
  assert.equal(formatFinanceDate("2024-02-29"),"29/02/2024");
  assert.equal(formatFinanceDate("2026-02-30"),"—");
  assert.equal(formatFinanceDate(null),"—");
});
test("Financeiro mobile: relatórios em cartões preservam colunas, margens e acumulado",()=>{
  const ui=readFileSync(new URL("../src/app/apps/dronegestor/agrovoo/financeiro/AgroVooFinanceReports.tsx",import.meta.url),"utf8");
  assert.equal((ui.match(/hidden overflow-x-auto md:block/g)||[]).length,2);
  assert.match(ui,/md:hidden.*rows.map/);
  assert.match(ui,/md:hidden.*days.map/);
  assert.ok(ui.includes('label="Margem"'));
  assert.ok(ui.includes('label="Acumulado registrado"'));
  assert.ok(ui.includes("formatFinanceDate(d.key)"));
  const board=readFileSync(new URL("../src/app/apps/dronegestor/agrovoo/financeiro/AgroVooFinanceClient.tsx",import.meta.url),"utf8");
  assert.ok(board.includes("index===metrics.length-1"));
  assert.ok(board.includes("formatFinanceDate(x.due_date)"));
  assert.ok(!board.includes("scrollIntoView"));
  assert.ok(board.includes("dialog.showModal()"));
  assert.ok(board.includes('showAccounts("receita")'));
  assert.ok(board.includes('showAccounts("despesa")'));
  assert.ok(board.includes('tab==="resumo"&&'));
  assert.ok(board.includes('tab==="lancamentos"&&'));
  assert.ok(board.includes('onClick={()=>openForm("despesa")}'));
});

test("Máscara monetária: digitação em centavos, milhar e edição sem arredondamento",()=>{
 const samples=[["1","0,01"],["12","0,12"],["120","1,20"],["1200","12,00"],["12000","120,00"],["120000","1.200,00"],["1200000","12.000,00"]];
 for(const [raw,display] of samples){assert.equal(maskFinanceAmount(raw),display);assert.equal(maskedFinanceCents(display),Number(raw));}
 let value="";for(const digit of "120000")value=maskFinanceAmount(value+digit,value);
 assert.equal(value,"1.200,00");assert.equal(formatFinanceCents(450000),"4.500,00");
 assert.equal(maskFinanceAmount("1.200,0","1.200,00"),"120,00");
 assert.equal(maskFinanceAmount("","1.200,00"),"");
 assert.equal(maskFinanceAmount("999999999999","12,00"),"12,00");
 assert.equal(maskFinanceAmount("abc","12,00"),"12,00");
 assert.throws(()=>maskedFinanceCents("0,00"));
});
test("Excel nativo: tipos de célula, datas, larguras, totais e simulação",async()=>{
 const {financeWorkbook}=await import("../src/lib/agrovoo-finance-xlsx.ts");
 const ExcelJS=(await import("exceljs")).default;
 const entries=[entry({description:"=1+1",amount_cents:450000,status:"liquidado",settled_date:"2026-11-26"}),entry({kind:"despesa",amount_cents:90000,status:"liquidado",settled_date:"2026-11-26"})];
 const workbook=await financeWorkbook(entries,{start:"2026-11-01",end:"2026-11-26",basis:"caixa",group:"category",demo:true},financialGroups(entries,"category"),financialTotals(entries));
 const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
 const sheet=reopened.getWorksheet("Lançamentos"),summary=reopened.getWorksheet("Resumo");
 assert.match(sheet.getCell("A1").value,/SIMULAÇÃO/);
 assert.equal(sheet.getCell("B5").value,"=1+1");assert.equal(sheet.getCell("K5").value,4500);
 assert.equal(sheet.getCell("I5").value.toISOString().slice(0,10),"2026-11-26");
 assert.equal(sheet.getCell("I5").numFmt,"dd/mm/yyyy");assert.ok(sheet.getColumn(9).width>=16);
 assert.equal(summary.getCell("D6").value,3600);
});
test("Financeiro: máscara aplicada ao formulário e rodapé fixo opt-in",()=>{
 const ui=readFileSync(new URL("../src/app/apps/dronegestor/agrovoo/financeiro/AgroVooFinanceClient.tsx",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/app/apps/dronegestor/agrodoc.css",import.meta.url),"utf8");
 assert.ok(ui.includes('inputMode="numeric"'));assert.ok(ui.includes("maskedFinanceCents(form.amount)"));
 assert.ok(ui.includes("agrovoo-dialog-actions"));assert.ok(css.includes(".agrovoo-dialog-scroll"));
});
