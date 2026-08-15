"use client";

import Link from "next/link";
import { FileCheck2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type Item={id:string;created_at:string;detalhes?:{finalizedAt?:string;summary?:{ordemServicoId?:string;ordemServicoNumero?:string;clienteNome?:string;fazendaNome?:string;talhaoNome?:string;piloto?:string;areaConcluidaHa?:number;areaHa?:number}}};
function date(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString("pt-BR")}
function area(value:unknown){const n=Number(value);return new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0)}

export function DroneHistoryPackageLinks(){
  const[items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true);
  useEffect(()=>{void fetch("/api/dronegestor/state?history=1&limit=200&offset=0",{cache:"no-store"}).then(r=>r.json()).then(p=>{if(Array.isArray(p?.items))setItems(p.items.filter((i:Item)=>i?.detalhes?.summary?.ordemServicoId).slice(0,20))}).catch(()=>{}).finally(()=>setLoading(false))},[]);
  if(loading)return <section className="mx-auto mb-4 w-full max-w-6xl px-3"><div className="flex items-center gap-2 rounded-2xl border border-emerald-900 bg-slate-950/60 p-4 text-sm text-emerald-100"><Loader2 className="animate-spin" size={17}/>Carregando pacotes finais...</div></section>;
  if(!items.length)return null;
  return <section className="mx-auto mb-4 w-full max-w-6xl px-3"><div className="rounded-2xl border border-emerald-900 bg-slate-950/70 p-4 text-emerald-50"><div className="flex items-center gap-2"><FileCheck2 className="text-emerald-400" size={19}/><div><strong className="block">Pacotes finais das operações</strong><p className="text-xs text-slate-400">Abra o resumo e o PDF da OS sem depender do aparelho que fez o voo.</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{items.map(item=>{const s=item.detalhes?.summary||{},id=String(s.ordemServicoId||"");return <Link key={item.id} href={`/apps/dronegestor/pacote-operacao?osId=${encodeURIComponent(id)}`} className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 no-underline transition hover:bg-emerald-950/70"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm text-emerald-100">{s.ordemServicoNumero||"OS"} • {s.fazendaNome||s.clienteNome||"Operação"}</strong><p className="mt-1 truncate text-xs text-slate-400">{[s.talhaoNome,s.piloto].filter(Boolean).join(" • ")||"Dados da operação"}</p></div><div className="shrink-0 text-right"><span className="block text-sm font-black text-emerald-300">{area(s.areaConcluidaHa??s.areaHa)} ha</span><span className="text-[11px] text-slate-500">{date(item.detalhes?.finalizedAt||item.created_at)}</span></div></div></Link>})}</div></div></section>;
}
