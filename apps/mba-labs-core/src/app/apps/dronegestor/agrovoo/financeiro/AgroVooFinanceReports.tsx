"use client";
import {useState} from "react";
import {Download} from "lucide-react";
import {financialPeriod,financialGroups,financialTotals,financeCsv,validDate,formatFinanceDate,type FinanceEntry} from "@/lib/agrovoo-finance";
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v/100);
const input="w-full min-w-0 min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
export function AgroVooFinanceReports({entries,today,demo}:{entries:FinanceEntry[];today:string;demo:boolean}){
 const [start,setStart]=useState(today.slice(0,7)+"-01"),[end,setEnd]=useState(today);
 const [basis,setBasis]=useState<"caixa"|"competencia"|"previsao">("caixa");
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
 const [group,setGroup]=useState<"category"|"cost_center"|"os_id"|"counterparty">("category");
 const valid=validDate(start)&&validDate(end)&&start<=end;
 const selected=valid?financialPeriod(entries,start,end,basis):[];
 const totals=financialTotals(selected),rows=financialGroups(selected,group);
 const balanceBefore=valid?financialTotals(entries.filter(e=>e.status==="liquidado"&&e.settled_date&&e.settled_date<start)).net:0;
 const daily=financialGroups(selected.map(e=>({...e,category:(basis==="caixa"?e.settled_date:basis==="previsao"?e.due_date:e.competence_date||e.due_date)||""})),"category").sort((a,b)=>a.key.localeCompare(b.key));
 let running=balanceBefore;
 const days=daily.map(d=>({...d,balance:running+=d.net}));
 function downloadCsv(){if(!valid)return;const url=URL.createObjectURL(new Blob([financeCsv(selected)],{type:"text/csv;charset=utf-8;"}));const link=document.createElement("a");link.href=url;link.download=(demo?"SIMULACAO-":"")+"agrovoo-"+basis+"-"+start+"-"+end+".csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function downloadXlsx(){
   if(!valid||exporting)return;
   setExporting(true);setExportError("");
   try{
     const {financeWorkbook}=await import("@/lib/agrovoo-finance-xlsx");
     const workbook=await financeWorkbook(selected,{start,end,basis,group,demo},rows,totals);
     const buffer=await workbook.xlsx.writeBuffer();
     const url=URL.createObjectURL(new Blob([new Uint8Array(buffer)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
     const link=document.createElement("a");link.href=url;link.download=(demo?"SIMULACAO-":"")+"agrovoo-"+basis+"-"+start+"-"+end+".xlsx";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }catch{setExportError("Não foi possível gerar o Excel. Tente novamente ou use CSV.");}finally{setExporting(false);}
 }
 return <section className="grid min-w-0 gap-3 sm:gap-4">
   <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
     <h2 className="text-base font-bold">Relatórios financeiros</h2>
     <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
       <label className="grid gap-1 text-sm font-semibold">Data inicial<input type="date" className={input} value={start} onChange={e=>setStart(e.target.value)}/></label>
       <label className="grid gap-1 text-sm font-semibold">Data final<input type="date" className={input} value={end} onChange={e=>setEnd(e.target.value)}/></label>
       <label className="grid gap-1 text-sm font-semibold">Regime<select className={input} value={basis} onChange={e=>setBasis(e.target.value as typeof basis)}><option value="caixa">Caixa realizado</option><option value="competencia">Resultado por competência</option><option value="previsao">Previsão de vencimentos</option></select></label>
       <label className="grid gap-1 text-sm font-semibold">Agrupar por<select className={input} value={group} onChange={e=>setGroup(e.target.value as typeof group)}><option value="category">Categoria</option><option value="cost_center">Centro de custo</option><option value="os_id">Ordem de serviço</option><option value="counterparty">Cliente / fornecedor</option></select></label>
     </div>
     <button disabled={!valid} type="button" onClick={downloadCsv} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#185a47] px-4 text-sm font-semibold text-white disabled:opacity-40"><Download size={16}/> Exportar CSV</button>
     <button disabled={!valid||exporting} type="button" onClick={()=>void downloadXlsx()} className="mt-3 mr-2 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#185a47] px-4 text-sm font-semibold text-white disabled:opacity-40"><Download size={16}/> {exporting?"Gerando Excel...":"Exportar Excel (.xlsx)"}</button>
     {exportError&&<p role="alert" className="mt-2 text-sm text-red-700">{exportError}</p>}
     {!valid&&<p role="alert" className="mt-2 text-sm text-red-700">Informe um período válido.</p>}
   </div>
   {valid&&<>
   <div className="agro-compact-grid grid grid-cols-2 gap-2 sm:grid-cols-3">{[{label:"Receitas",value:totals.revenue,color:"text-emerald-800"},{label:"Despesas",value:totals.expense,color:"text-red-700"},{label:"Resultado",value:totals.net,color:totals.net<0?"text-red-700":"text-emerald-800"}].map((m,i)=><div key={m.label} className={"min-w-0 rounded-lg border border-slate-200 bg-white p-3 "+(i===2?"col-span-2 bg-slate-50 sm:col-span-1":"")}><span className="text-xs font-semibold text-slate-600">{m.label}</span><strong className={"mt-1 block break-words text-lg font-bold tabular-nums sm:text-xl "+m.color}>{money(m.value)}</strong></div>)}</div>
   <p className="text-xs text-slate-600">{basis==="competencia"?"Demonstrativo gerencial de receitas e despesas registradas na competência. Não equivale a DRE contábil completa.":basis==="previsao"?"Valores pendentes por vencimento, sem garantia de recebimento ou pagamento.":"Somente lançamentos liquidados no período."}</p>
   <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
     <h2 className="bg-[#123e38] px-4 py-3 font-bold text-white">{group==="os_id"?"Resultado por ordem de serviço":"Resultado agrupado"}</h2>
     <div className="hidden overflow-x-auto md:block" role="region" aria-label="Tabela financeira" tabIndex={0}><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr>{["Grupo","Receita","Despesa","Resultado","Margem"].map(h=><th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.key} className="border-b border-slate-100"><td className="p-3 font-semibold">{r.label}</td><td className="p-3">{money(r.revenue)}</td><td className="p-3">{money(r.expense)}</td><td className="p-3">{money(r.net)}</td><td className="p-3">{r.revenue?((r.net/r.revenue)*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%":"—"}</td></tr>)}</tbody></table></div>
     <div className="grid gap-2 p-2.5 md:hidden">{rows.map(r=><article key={r.key} className="min-w-0 rounded-lg border border-slate-200 p-3"><h3 className="break-words text-sm font-semibold text-slate-900">{r.label}</h3><dl className="agro-compact-grid mt-2 grid grid-cols-2 gap-2"><ReportValue label="Receita" value={money(r.revenue)} color="text-emerald-800"/><ReportValue label="Despesa" value={money(r.expense)} color="text-red-700"/><ReportValue label="Resultado" value={money(r.net)} color={r.net<0?"text-red-700":"text-emerald-800"}/><ReportValue label="Margem" value={r.revenue?((r.net/r.revenue)*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%":"—"}/></dl></article>)}</div>
     {!rows.length&&<p className="p-4 text-sm text-slate-500">Nenhum lançamento neste período.</p>}
     {group==="os_id"&&<p className="p-3 text-xs text-slate-500">Resultado direto dos lançamentos vinculados à OS; despesas gerais não são rateadas automaticamente.</p>}
   </article>
   <article className="overflow-hidden rounded-lg border border-slate-200 bg-white"><h2 className="bg-[#123e38] px-4 py-3 font-bold text-white">{basis==="caixa"?"Fluxo de caixa diário":basis==="previsao"?"Previsão diária":"Resultado diário por competência"}</h2>
     {basis==="caixa"&&<p className="p-3 text-sm">Resultado acumulado registrado antes do período: <strong>{money(balanceBefore)}</strong>. Não representa saldo bancário.</p>}
     <div className="hidden overflow-x-auto md:block" role="region" aria-label="Tabela financeira" tabIndex={0}><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs"><tr>{["Data","Receita","Despesa","Resultado",...(basis==="caixa"?["Acumulado registrado"]:[])].map(h=><th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>{days.map(d=><tr key={d.key} className="border-b border-slate-100"><td className="whitespace-nowrap p-3">{formatFinanceDate(d.key)}</td><td className="p-3">{money(d.revenue)}</td><td className="p-3">{money(d.expense)}</td><td className="p-3">{money(d.net)}</td>{basis==="caixa"&&<td className="p-3">{money(d.balance)}</td>}</tr>)}</tbody></table></div>
     <div className="grid gap-2 p-2.5 md:hidden">{days.map(d=><article key={d.key} className="min-w-0 rounded-lg border border-slate-200 p-3"><h3 className="text-sm font-semibold text-slate-900">{formatFinanceDate(d.key)}</h3><dl className="agro-compact-grid mt-2 grid grid-cols-2 gap-2"><ReportValue label="Receita" value={money(d.revenue)} color="text-emerald-800"/><ReportValue label="Despesa" value={money(d.expense)} color="text-red-700"/><ReportValue label="Resultado" value={money(d.net)} color={d.net<0?"text-red-700":"text-emerald-800"}/>{basis==="caixa"&&<ReportValue label="Acumulado registrado" value={money(d.balance)}/>}</dl></article>)}</div>
     {!days.length&&<p className="p-4 text-sm text-slate-500">Sem movimentos neste período.</p>}
   </article>
   </>}
 </section>;
}

function ReportValue({label,value,color="text-slate-900"}:{label:string;value:string;color?:string}){return <div className="min-w-0"><dt className="text-[11px] text-slate-500">{label}</dt><dd className={"mt-0.5 break-words text-sm font-semibold tabular-nums "+color}>{value}</dd></div>;}
