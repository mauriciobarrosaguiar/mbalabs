"use client";

import { useEffect, useState } from "react";
import { Button } from "@/modules/cotacoes/components/ui/button";

type Choice={value:string;label:string;tenantId?:string};
type ReportRow={
 empresa:string;cnpj:string;empresaId:string;cotacao:string;cotacaoId:string;
 modulo:string;data:string;prazo:string;situacaoCotacao:string;
 representante:string;representanteId:string;empresaRepresentante:string;
 distribuidora:string;distribuidoraId:string;situacaoResposta:string;dataResposta:string;
 produtoSolicitado:string;resultado:string;produto:string;quantidadeSolicitada:string|number;quantidadeDisponivel:string|number;precoUnitario:string|number;
};
type Payload={rows:ReportRow[];total:number;quotations:number;companies:Choice[];representatives:Choice[];distributors:Choice[];page:number};

export function AdminQuotationReports(){
 const [rows,setRows]=useState<ReportRow[]>([]);
 const [total,setTotal]=useState(0),[quotations,setQuotations]=useState(0),[page,setPage]=useState(0);
 const [companies,setCompanies]=useState<Choice[]>([]),[reps,setReps]=useState<Choice[]>([]),[distributors,setDistributors]=useState<Choice[]>([]);
 const [tenant,setTenant]=useState(""),[distributor,setDistributor]=useState(""),[rep,setRep]=useState("");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 function params(nextPage=page) {
  const p=new URLSearchParams({page:String(nextPage)});
  if(tenant)p.set("empresa",tenant);
  if(distributor)p.set("distribuidora",distributor);
  if(rep)p.set("representante",rep);
  if(from)p.set("inicio",from);
  if(to)p.set("fim",to);
  return p;
 }
 async function load(nextPage=0){
  setLoading(true);setError("");
  try{
   const response=await fetch(`/api/cotacoes/admin/relatorios?${params(nextPage)}`,{cache:"no-store"});
   const data=await response.json() as Payload & {error?:string};
   if(!response.ok)throw new Error(data.error??"Não foi possível obter os relatórios.");
   setRows(data.rows);setTotal(data.total);setQuotations(data.quotations);
   setCompanies(data.companies);setReps(data.representatives);setDistributors(data.distributors);setPage(nextPage);
  }catch(e){setError(e instanceof Error?e.message:"Falha ao consultar");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load(0);},[]);
 const field="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900";
 return <div className="min-w-0 space-y-5">
  <div>
   <h2 className="text-2xl font-bold text-slate-950">Central de cotações e respostas</h2>
   <p className="mt-1 text-sm text-slate-600">Visão exclusiva do administrador central. Inclui cotações históricas, vendedores convidados, respostas e ofertas registradas.</p>
  </div>
  <form onSubmit={e=>{e.preventDefault();void load(0);}} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
   <label className="min-w-0 text-sm font-medium text-slate-700">Empresa
    <select className={field} value={tenant} onChange={e=>{setTenant(e.target.value);setDistributor("");setRep("");}}>
     <option value="">Todas as empresas</option>{companies.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
    </select>
   </label>
   <label className="min-w-0 text-sm font-medium text-slate-700">Distribuidora
    <select className={field} value={distributor} onChange={e=>setDistributor(e.target.value)}>
     <option value="">Todas as distribuidoras</option>{distributors.filter(x=>!tenant||x.tenantId===tenant).map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
    </select>
   </label>
   <label className="min-w-0 text-sm font-medium text-slate-700">Representante
    <select className={field} value={rep} onChange={e=>setRep(e.target.value)}>
     <option value="">Todos os representantes</option>{reps.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
    </select>
   </label>
   <label className="min-w-0 text-sm font-medium text-slate-700">De
    <input aria-label="Data inicial" type="date" className={field} value={from} onChange={e=>setFrom(e.target.value)}/>
   </label>
   <label className="min-w-0 text-sm font-medium text-slate-700">Até
    <input aria-label="Data final" type="date" className={field} value={to} onChange={e=>setTo(e.target.value)}/>
   </label>
   <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-5">
    <Button type="submit" disabled={loading} className="bg-teal-700 text-white hover:bg-teal-800">{loading?"Consultando...":"Filtrar cotações"}</Button>
    <Button type="button" variant="outline" disabled={loading} onClick={()=>{const u=new URLSearchParams(params(0));u.set("formato","csv");window.location.assign(`/api/cotacoes/admin/relatorios?${u}`);}}>
     Exportar todas as linhas em CSV
    </Button>
   </div>
  </form>
  {error?<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>:null}
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
   <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">Cotações encontradas</p><strong className="text-2xl text-slate-950">{quotations.toLocaleString("pt-BR")}</strong></div>
   <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">Linhas no relatório</p><strong className="text-2xl text-slate-950">{total.toLocaleString("pt-BR")}</strong></div>
   <div className="col-span-2 rounded-xl border bg-white p-4 sm:col-span-1"><p className="text-sm text-slate-600">Exportação</p><strong className="text-sm text-slate-950">Todas as empresas ou filtros escolhidos</strong></div>
  </div>
  <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
   <p className="mb-3 text-sm text-slate-600">Cada linha identifica a cotação, o vendedor e a oferta de um produto; vendedores pendentes também aparecem, sem valores inventados.</p>
   <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
    <table className="w-full min-w-[1100px] text-left text-xs">
     <thead className="bg-slate-100 text-slate-700"><tr>
      {["Empresa / CNPJ","Cotação / ID","Data","Situação","Representante","Distribuidora","Resposta","Produto solicitado / ofertado","Qtd solicitada","Qtd disponível","Preço unitário","Resultado"].map(k=><th key={k} className="p-3">{k}</th>)}
     </tr></thead>
     <tbody>{rows.map((x,i)=><tr key={x.cotacaoId+"-"+x.representanteId+"-"+i} className="border-t border-slate-200 align-top text-slate-800">
       <td className="p-3 font-semibold">{x.empresa}<p className="mt-1 font-normal">{x.cnpj}</p></td><td className="p-3">{x.cotacao}<p className="mt-1 break-all text-slate-500">{x.cotacaoId}</p></td><td className="p-3">{x.data}</td>
       <td className="p-3">{x.situacaoCotacao}</td><td className="p-3">{x.representante||"Sem convite"}</td>
       <td className="p-3">{x.distribuidora||"—"}</td><td className="p-3">{x.situacaoResposta}</td>
       <td className="p-3">{x.produtoSolicitado||"—"}<p className="mt-1 text-slate-500">Oferta: {x.produto||"—"}</p></td><td className="p-3">{x.quantidadeSolicitada??"—"}</td><td className="p-3">{x.quantidadeDisponivel??"—"}</td>
       <td className="p-3">{x.precoUnitario!==""&&x.precoUnitario!=null?Number(x.precoUnitario).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"—"}</td><td className="p-3">{x.resultado||"—"}</td>
     </tr>)}</tbody>
    </table>
    {!loading&&!rows.length?<p className="p-6 text-center text-slate-600">Nenhuma cotação ou resposta corresponde aos filtros.</p>:null}
   </div>
   <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
    <p>Mostrando até 50 linhas — página {page+1} de {Math.max(1,Math.ceil(total/50))}</p>
    <div className="flex gap-2">
     <Button variant="outline" disabled={page===0||loading} onClick={()=>void load(page-1)}>Anterior</Button>
     <Button variant="outline" disabled={(page+1)*50>=total||loading} onClick={()=>void load(page+1)}>Próxima</Button>
    </div>
   </div>
  </section>
 </div>;
}
