"use client";
import {useState} from "react";
import {Download} from "lucide-react";
import {financialPeriod,financialGroups,financialTotals,financeCsv,validDate,type FinanceEntry} from "@/lib/agrovoo-finance";
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v/100);
const input="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
export function AgroVooFinanceReports({entries,today,demo}:{entries:FinanceEntry[];today:string;demo:boolean}){
 const [start,setStart]=useState(today.slice(0,7)+"-01"),[end,setEnd]=useState(today);
 const [basis,setBasis]=useState<"caixa"|"competencia"|"previsao">("caixa");
 const [group,setGroup]=useState<"category"|"cost_center"|"os_id"|"counterparty">("category");
 const valid=validDate(start)&&validDate(end)&&start<=end;
 const selected=valid?financialPeriod(entries,start,end,basis):[];
 const totals=financialTotals(selected),rows=financialGroups(selected,group);
 const balanceBefore=valid?financialTotals(entries.filter(e=>e.status==="liquidado"&&e.settled_date&&e.settled_date<start)).net:0;
 const daily=financialGroups(selected.map(e=>({...e,category:(basis==="caixa"?e.settled_date:basis==="previsao"?e.due_date:e.competence_date||e.due_date)||""})),"category").sort((a,b)=>a.key.localeCompare(b.key));
 let running=balanceBefore;
 const days=daily.map(d=>({...d,balance:running+=d.net}));
 function download(){if(!valid)return;const url=URL.createObjectURL(new Blob([financeCsv(selected)],{type:"text/csv;charset=utf-8;"}));const link=document.createElement("a");link.href=url;link.download=(demo?"SIMULACAO-":"")+"agrovoo-"+basis+"-"+start+"-"+end+".csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="grid gap-4">
   <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
     <h2 className="text-base font-bold">Relatórios financeiros</h2>
     <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
       <label className="grid gap-1 text-sm font-semibold">Data inicial<input type="date" className={input} value={start} onChange={e=>setStart(e.target.value)}/></label>
       <label className="grid gap-1 text-sm font-semibold">Data final<input type="date" className={input} value={end} onChange={e=>setEnd(e.target.value)}/></label>
       <label className="grid gap-1 text-sm font-semibold">Regime<select className={input} value={basis} onChange={e=>setBasis(e.target.value as typeof basis)}><option value="caixa">Caixa realizado</option><option value="competencia">Resultado por competência</option><option value="previsao">Previsão de vencimentos</option></select></label>
       <label className="grid gap-1 text-sm font-semibold">Agrupar por<select className={input} value={group} onChange={e=>setGroup(e.target.value as typeof group)}><option value="category">Categoria</option><option value="cost_center">Centro de custo</option><option value="os_id">Ordem de serviço</option><option value="counterparty">Cliente / fornecedor</option></select></label>
     </div>
     <button disabled={!valid} type="button" onClick={download} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#185a47] px-4 text-sm font-semibold text-white disabled:opacity-40"><Download size={16}/> Exportar CSV (Excel)</button>
     {!valid&&<p role="alert" className="mt-2 text-sm text-red-700">Informe um período válido.</p>}
   </div>
   {valid&&<>
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{label:"Receitas",value:totals.revenue},{label:"Despesas",value:totals.expense},{label:"Resultado",value:totals.net}].map(m=><div key={m.label} className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-sm text-slate-600">{m.label}</span><strong className={"mt-2 block text-2xl font-bold "+(m.value<0?"text-red-700":"text-slate-900")}>{money(m.value)}</strong></div>)}</div>
   <p className="text-xs text-slate-600">{basis==="competencia"?"Demonstrativo gerencial de receitas e despesas registradas na competência. Não equivale a DRE contábil completa.":basis==="previsao"?"Valores pendentes por vencimento, sem garantia de recebimento ou pagamento.":"Somente lançamentos liquidados no período."}</p>
   <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
     <h2 className="bg-[#123e38] px-4 py-3 font-bold text-white">{group==="os_id"?"Resultado por ordem de serviço":"Resultado agrupado"}</h2>
     <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr>{["Grupo","Receita","Despesa","Resultado","Margem"].map(h=><th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.key} className="border-b border-slate-100"><td className="p-3 font-semibold">{r.label}</td><td className="p-3">{money(r.revenue)}</td><td className="p-3">{money(r.expense)}</td><td className="p-3">{money(r.net)}</td><td className="p-3">{r.revenue?((r.net/r.revenue)*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%":"—"}</td></tr>)}</tbody></table></div>
     {!rows.length&&<p className="p-4 text-sm text-slate-500">Nenhum lançamento neste período.</p>}
     {group==="os_id"&&<p className="p-3 text-xs text-slate-500">Resultado direto dos lançamentos vinculados à OS; despesas gerais não são rateadas automaticamente.</p>}
   </article>
   <article className="overflow-hidden rounded-lg border border-slate-200 bg-white"><h2 className="bg-[#123e38] px-4 py-3 font-bold text-white">{basis==="caixa"?"Fluxo de caixa diário":basis==="previsao"?"Previsão diária":"Resultado diário por competência"}</h2>
     {basis==="caixa"&&<p className="p-3 text-sm">Resultado acumulado registrado antes do período: <strong>{money(balanceBefore)}</strong>. Não representa saldo bancário.</p>}
     <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs"><tr>{["Data","Receita","Despesa","Resultado",...(basis==="caixa"?["Acumulado registrado"]:[])].map(h=><th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>{days.map(d=><tr key={d.key} className="border-b border-slate-100"><td className="p-3">{d.key}</td><td className="p-3">{money(d.revenue)}</td><td className="p-3">{money(d.expense)}</td><td className="p-3">{money(d.net)}</td>{basis==="caixa"&&<td className="p-3">{money(d.balance)}</td>}</tr>)}</tbody></table></div>
     {!days.length&&<p className="p-4 text-sm text-slate-500">Sem movimentos neste período.</p>}
   </article>
   </>}
 </section>;
}
