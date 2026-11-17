"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, FileSpreadsheet, RefreshCw, TriangleAlert } from "lucide-react";

type Product={nome?:string;dose?:number;unidade?:string};
type Summary={ordemServicoNumero?:string;piloto?:string;clienteNome?:string;fazendaNome?:string;municipio?:string;uf?:string;areaConcluidaHa?:number;areaHa?:number;drone?:string;registroAnac?:string;cultura?:string;tipoAtividade?:string;produtos?:Product[];finalizadaEm?:string};
type Review={status:"aprovado"|"correcao";category?:string;classe?:string;tipoAeronave?:string;tipoServico?:string;observacao?:string;reviewedByName?:string;reviewedAt?:string};
type Item={id:string;summary:Summary;review:Review|null};
type Draft={category:string;classe:string;tipoAeronave:string;tipoServico:string;observacao:string};
const categoryOptions=[{value:"",label:"Selecione a categoria"},{value:"agrotoxico",label:"Agrotóxico"},{value:"bioinsumo",label:"Bioinsumo"},{value:"outros",label:"Fertilizante, adjuvante ou outro"},{value:"semeadura",label:"Semeadura"}];
function currentMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function dateLabel(value?:string){return value?new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"Data não informada"}
function initial(item:Item):Draft{return {category:item.review?.category||"",classe:item.review?.classe||"",tipoAeronave:item.review?.tipoAeronave||"ARP",tipoServico:item.review?.tipoServico||item.summary.tipoAtividade||"",observacao:item.review?.observacao||""}}
function OperationRow({item,done}:{item:Item;done:()=>void}){
  const [draft,setDraft]=useState<Draft>(()=>initial(item));
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const s=item.summary,p=s.produtos||[];
  const many=p.length>1;
  async function save(status:"aprovado"|"correcao"){
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/dronegestor/conferencia",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operationEventId:item.id,status,...draft})});
      const data=await r.json().catch(()=>null);
      if(!r.ok)throw new Error(data?.error||"Erro na conferência");
      done();
    }catch(e){setMessage(e instanceof Error?e.message:"Falha ao enviar revisão")}
    finally{setBusy(false)}
  }
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">OS {s.ordemServicoNumero||item.id.slice(0,8)}</span>
        <h3 className="mt-1 text-base font-black text-slate-900">{s.fazendaNome||s.clienteNome||"Operação em campo"}</h3>
        <p className="text-xs text-slate-600">{s.piloto||"Piloto não informado"} · {s.municipio||"Município pendente"}/{s.uf||"UF"} · {dateLabel(s.finalizadaEm)}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.review?.status==="aprovado"?"bg-emerald-100 text-emerald-900":item.review?.status==="correcao"?"bg-amber-100 text-amber-900":"bg-slate-100 text-slate-700"}`}>{item.review?.status==="aprovado"?"Aprovado":item.review?.status==="correcao"?"Correção solicitada":"Aguardando conferência"}</span>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
      <span><b>Área</b><br/>{Number(s.areaConcluidaHa??s.areaHa??0).toLocaleString("pt-BR")} ha</span>
      <span><b>Drone</b><br/>{s.drone||"—"}</span>
      <span><b>ANAC</b><br/>{s.registroAnac||"—"}</span>
      <span><b>Cultura</b><br/>{s.cultura||"—"}</span>
    </div>
    <p className="mt-3 text-xs text-slate-700"><strong>Produtos:</strong> {p.map(x=>`${x.nome||"Sem nome"} (${x.dose||"?"} ${x.unidade||""})`).join(", ")||"Nenhum produto informado"}</p>
    {many&&<p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"><TriangleAlert className="mt-0.5 shrink-0" size={15}/>Mais de um produto na mesma operação: exportação automática bloqueada até conferir como lançar sem duplicar área e horas.</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-xs font-bold text-slate-700">Categoria do produto
        <select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value,classe:""})} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">
          {categoryOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select></label>
      <label className="text-xs font-bold text-slate-700">Classe (conforme produto/receituário)
        <input value={draft.classe} onChange={e=>setDraft({...draft,classe:e.target.value})} placeholder="Ex.: Herbicida, Fungicida" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
      <label className="text-xs font-bold text-slate-700">Tipo de aeronave (modelo MAPA)
        <input value={draft.tipoAeronave} onChange={e=>setDraft({...draft,tipoAeronave:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"/></label>
      <label className="text-xs font-bold text-slate-700">Tipo de serviço (modelo MAPA)
        <input value={draft.tipoServico} onChange={e=>setDraft({...draft,tipoServico:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"/></label>
    </div>
    <label className="mt-3 block text-xs font-bold text-slate-700">Observação / motivo de correção
      <textarea value={draft.observacao} onChange={e=>setDraft({...draft,observacao:e.target.value})} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Oriente o piloto a corrigir os dados, caso necessário." />
    </label>
    {item.review?.reviewedAt&&<p className="mt-2 text-[11px] text-slate-500">Última revisão: {dateLabel(item.review.reviewedAt)} por {item.review.reviewedByName||"revisor"}</p>}
    {message&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{message}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button disabled={busy||many} onClick={()=>void save("aprovado")} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={17}/>Aprovar para MAPA</button>
      <button disabled={busy||!draft.observacao.trim()} onClick={()=>void save("correcao")} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-black text-amber-900 disabled:opacity-50"><TriangleAlert size={17}/>Solicitar correção</button>
    </div>
  </article>
}
export function AgroDocReviewCenter(){
  const [month,setMonth]=useState(currentMonth),[items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[reload,setReload]=useState(0);
  useEffect(()=>{
    let active=true;async function load(){
      setLoading(true);setError("");
      try{const r=await fetch(`/api/dronegestor/conferencia?month=${encodeURIComponent(month)}`,{cache:"no-store"}),p=await r.json().catch(()=>null);if(!r.ok)throw new Error(p?.error||"Falha ao carregar");
        if(active)setItems(p?.items||[]);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Falha ao consultar operações")}
      finally{if(active)setLoading(false)}
    }void load();return()=>{active=false}
  },[month,reload]);
  const approved=items.filter(x=>x.review?.status==="aprovado").length;
  return <main className="mx-auto w-full max-w-6xl bg-slate-50 px-3 py-5 text-slate-950 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-center gap-3"><Link href="/apps/dronegestor" className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white"><ArrowLeft size={19}/></Link><div className="flex-1"><p className="text-xs font-black uppercase tracking-widest text-emerald-800">MBA AgroDoc · DroneGestor</p><h1 className="text-2xl font-black">Conferência de operações</h1><p className="text-sm text-slate-600">Revisão rastreável antes da planilha oficial do MAPA.</p></div></header>
    <div className="mt-5 grid gap-2 sm:grid-cols-3">{[["1. Piloto","Envia o voo e anexa evidências"],["2. Gestor / RT","Confere e aprova os dados"],["3. MAPA","Extrai somente operações aprovadas"]].map(([a,b])=><div key={a} className="rounded-xl border border-emerald-100 bg-white p-3"><b className="text-sm text-emerald-900">{a}</b><p className="mt-1 text-xs text-slate-600">{b}</p></div>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><label className="text-sm font-bold">Competência <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="ml-2 min-h-11 rounded-xl border border-slate-300 bg-white px-3"/></label>
      <button onClick={()=>setReload(x=>x+1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold"><RefreshCw size={15}/>Atualizar</button>
      <Link href="/apps/dronegestor/relatorio-mensal" className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white no-underline"><FileSpreadsheet size={17}/>Relatório MAPA</Link>
    </div>
    <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-800"><ClipboardCheck size={18} className="mr-2 inline"/> {items.length} operações · {approved} aprovadas · {items.length-approved} pendentes ou devolvidas</div>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
    {loading?<p className="py-12 text-center text-slate-600">Carregando operações...</p>:items.length===0?<p className="mt-5 rounded-xl bg-white p-8 text-center text-sm text-slate-600">Nenhuma operação finalizada nesta competência.</p>:<div className="mt-4 grid gap-4">{items.map(item=><OperationRow key={item.id+`-${item.review?.reviewedAt||""}`} item={item} done={()=>setReload(x=>x+1)}/>)}</div>}
  </main>
}
