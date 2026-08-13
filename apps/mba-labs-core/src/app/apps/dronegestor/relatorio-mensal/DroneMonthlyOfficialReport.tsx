"use client";

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Printer, RefreshCcw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Product = { nome?: string; dose?: number; unidade?: string };
type Summary = {
  municipio?: string; uf?: string; drone?: string; registroAnac?: string; areaHa?: number; areaConcluidaHa?: number;
  tipoAtividade?: string; produtos?: Product[]; totalCaldaRealL?: number; totalCaldaL?: number; iniciadaEm?: string; finalizadaEm?: string;
};
type HistoryItem = { id:string; created_at:string; detalhes?: { finalizedAt?:string; summary?:Summary } };
type HeaderData = { operador:string; registroMapa:string; processoSei:string; responsavelTecnico:string };
const HEADER_KEY = "dronegestor:monthlyReportHeader:v1";

function currentMonth() { return new Date().toISOString().slice(0,7); }
function monthRange(month:string) { const [year, m] = month.split("-").map(Number); const start = new Date(Date.UTC(year, m-1, 1)); const end = new Date(Date.UTC(year, m, 1)); return { start:start.toISOString(), end:end.toISOString() }; }
function durationHours(start?:string,end?:string) { if(!start||!end) return 0; const a=Date.parse(start),b=Date.parse(end); return Number.isFinite(a)&&Number.isFinite(b)&&b>=a ? (b-a)/3600000 : 0; }
function n(value:unknown, decimals=2) { const parsed=Number(value); return new Intl.NumberFormat("pt-BR",{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(Number.isFinite(parsed)?parsed:0); }
function loadHeader():HeaderData { try { return { operador:"",registroMapa:"",processoSei:"",responsavelTecnico:"",...JSON.parse(localStorage.getItem(HEADER_KEY)||"{}") }; } catch { return {operador:"",registroMapa:"",processoSei:"",responsavelTecnico:""}; } }

type ReportRow = { municipioUf:string; arp:string; areaHa:number; horas:number; atividade:string; produto:string; volumeL:number; dose:string };

export function DroneMonthlyOfficialReport({userName}:{userName:string}) {
  const [month,setMonth] = useState(currentMonth());
  const [items,setItems] = useState<HistoryItem[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [header,setHeader] = useState<HeaderData>({operador:"",registroMapa:"",processoSei:"",responsavelTecnico:""});

  useEffect(()=>setHeader(loadHeader()),[]);
  useEffect(()=>{ localStorage.setItem(HEADER_KEY,JSON.stringify(header)); },[header]);

  async function load() {
    setLoading(true); setError("");
    try {
      const range=monthRange(month);
      const params=new URLSearchParams({history:"1",limit:"500",offset:"0",start:range.start,end:range.end});
      const response=await fetch(`/api/dronegestor/state?${params.toString()}`,{cache:"no-store"});
      const payload=await response.json().catch(()=>null);
      if(!response.ok) throw new Error(payload?.error||"Falha ao carregar o relatório mensal.");
      setItems(Array.isArray(payload?.items)?payload.items:[]);
    } catch (e) { setError(e instanceof Error?e.message:"Falha ao carregar o relatório mensal."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); },[month]);

  const rows=useMemo<ReportRow[]>(()=>{
    const out:ReportRow[]=[];
    for(const item of items){
      const s=item.detalhes?.summary??{};
      const products=s.produtos?.length?s.produtos:[{nome:"—",dose:0,unidade:""}];
      const area=Number(s.areaConcluidaHa??s.areaHa??0)||0;
      const hours=durationHours(s.iniciadaEm,s.finalizadaEm);
      const volume=Number(s.totalCaldaRealL??s.totalCaldaL??0)||0;
      products.forEach((product,index)=>out.push({
        municipioUf:[s.municipio,s.uf].filter(Boolean).join("/")||"—",
        arp:[s.drone,s.registroAnac].filter(Boolean).join(" • ")||"—",
        areaHa:index===0?area:0,
        horas:index===0?hours:0,
        atividade:s.tipoAtividade||"—",
        produto:product.nome||"—",
        volumeL:index===0?volume:0,
        dose:`${n(product.dose??0,2)} ${product.unidade||""}`.trim()
      }));
    }
    return out;
  },[items]);

  const totals=useMemo(()=>rows.reduce((acc,row)=>({area:acc.area+row.areaHa,hours:acc.hours+row.horas,volume:acc.volume+row.volumeL}),{area:0,hours:0,volume:0}),[rows]);
  const monthLabel=new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});

  return <main className="min-h-screen bg-slate-100 px-3 py-5 text-slate-950 sm:px-6 sm:py-8">
    <style>{`@media print { body{background:white!important} .no-print{display:none!important} .print-sheet{box-shadow:none!important;border:0!important;margin:0!important;max-width:none!important;padding:0!important} @page{size:A4 landscape;margin:10mm} input{border:0!important;padding:0!important;background:white!important} }`}</style>
    <div className="no-print mx-auto mb-4 flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Link href="/apps/dronegestor" className="grid size-11 place-items-center rounded-xl border border-slate-300 bg-white text-slate-700" aria-label="Voltar"><ArrowLeft size={19}/></Link><div><strong className="block text-xl">Relatório mensal MAPA</strong><span className="text-sm text-slate-600">Espelho para conferência e impressão</span></div></div>
      <div className="flex flex-wrap gap-2"><input type="month" value={month} onChange={(e)=>setMonth(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"/><button onClick={()=>void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 font-black"><RefreshCcw size={16}/>Atualizar</button><button onClick={()=>window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white"><Printer size={17}/>Imprimir / PDF</button></div>
    </div>

    <section className="no-print mx-auto mb-4 w-full max-w-7xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><TriangleAlert className="mr-2 inline" size={18}/><strong>Importante:</strong> o MAPA informa que, em 2026, a remessa oficial deve usar a planilha versão 01-01-2026 e ser enviada no processo SEI “Relatório Mensal Aviação Agrícola”. Esta tela reproduz os campos obrigatórios do art. 11 da Portaria MAPA 298/2021 para conferência e impressão; ela não protocola o relatório no SEI nem substitui a planilha oficial.</section>

    <section className="print-sheet mx-auto w-full max-w-7xl rounded-2xl border border-slate-300 bg-white p-5 shadow-sm sm:p-7">
      <header className="border-b-2 border-slate-950 pb-4 text-center"><div className="text-xs font-black uppercase tracking-[.14em]">Ministério da Agricultura e Pecuária — Aviação Agrícola</div><h1 className="mt-1 text-2xl font-black">RELATÓRIO MENSAL DE ATIVIDADES — ARP (DRONE)</h1><p className="mt-1 text-sm">Competência: <strong className="capitalize">{monthLabel}</strong> • Base legal: Portaria MAPA nº 298/2021, art. 11</p></header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Operador aeroagrícola" value={header.operador} onChange={(v)=>setHeader({...header,operador:v})} placeholder="Nome / razão social"/>
        <Field label="Registro MAPA / SIPEAGRO" value={header.registroMapa} onChange={(v)=>setHeader({...header,registroMapa:v})} placeholder="Número do registro"/>
        <Field label="Processo SEI" value={header.processoSei} onChange={(v)=>setHeader({...header,processoSei:v})} placeholder="Processo intercorrente"/>
        <Field label="Responsável / conferente" value={header.responsavelTecnico} onChange={(v)=>setHeader({...header,responsavelTecnico:v})} placeholder={userName}/>
      </div>

      {loading?<div className="py-16 text-center font-bold">Carregando...</div>:error?<div className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</div>:<div className="mt-5 overflow-x-auto"><table className="w-full border-collapse text-[11px]"><thead><tr className="bg-slate-100">{["Município/UF","ARP / identificação ANAC","Área aplicada (ha)","Horas de execução (h)","Tipo de atividade","Marca comercial","Volume aplicado (L)","Dosagem aplicada"].map((h)=><th key={h} className="border border-slate-400 px-2 py-2 text-left font-black">{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,index)=><tr key={index}><Cell>{row.municipioUf}</Cell><Cell>{row.arp}</Cell><Cell>{row.areaHa?n(row.areaHa):""}</Cell><Cell>{row.horas?n(row.horas):""}</Cell><Cell>{row.atividade}</Cell><Cell>{row.produto}</Cell><Cell>{row.volumeL?n(row.volumeL,1):""}</Cell><Cell>{row.dose}</Cell></tr>):<tr><td colSpan={8} className="border border-slate-400 px-3 py-10 text-center text-sm font-black">NENHUMA ATIVIDADE REALIZADA</td></tr>}</tbody><tfoot>{rows.length>0&&<tr className="font-black"><td colSpan={2} className="border border-slate-400 px-2 py-2 text-right">TOTAL DO MÊS</td><Cell>{n(totals.area)}</Cell><Cell>{n(totals.hours)}</Cell><td colSpan={2} className="border border-slate-400"></td><Cell>{n(totals.volume,1)}</Cell><td className="border border-slate-400"></td></tr>}</tfoot></table></div>}

      <div className="mt-5 grid gap-2 text-[10px] leading-4 text-slate-600"><p><strong>Critério de horas:</strong> calculadas a partir dos horários reais de início e término registrados em cada operação.</p><p><strong>Volume:</strong> utiliza o volume real de calda registrado nas cargas; quando ausente, usa o volume planejado salvo na operação. A conferência final deve ser feita antes da remessa.</p><p><strong>Fonte oficial 2026:</strong> página “Relatórios Mensais” do MAPA, atualizada em 27/02/2026, informa o uso da planilha versão 01-01-2026 e remessa via SEI.</p></div>

      <div className="mt-8 grid grid-cols-2 gap-10 text-center text-xs"><div className="border-t border-slate-500 pt-2">Responsável pelo preenchimento</div><div className="border-t border-slate-500 pt-2">Responsável técnico / conferência</div></div>
    </section>

    <div className="no-print mx-auto mt-4 flex w-full max-w-7xl items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><FileSpreadsheet size={16}/><span>Após conferir, use a planilha oficial 2026 disponibilizada pelo MAPA para a remessa via SEI.</span></div>
  </main>;
}

function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(value:string)=>void;placeholder:string}) { return <label className="grid gap-1 text-xs font-bold"><span>{label}</span><input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="min-h-10 rounded-lg border border-slate-300 px-2 text-sm placeholder:text-slate-400"/></label>; }
function Cell({children}:{children:React.ReactNode}) { return <td className="border border-slate-400 px-2 py-2 align-top">{children}</td>; }
