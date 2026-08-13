"use client";

import { ExternalLink, Info, Scale, ShieldCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { RegulatoryRule } from "@/lib/dronegestor-regulations";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function DroneRegulationExplorer({ federal, stateRules }: { federal: RegulatoryRule[]; stateRules: Record<string, RegulatoryRule[]> }) {
  const [uf, setUf] = useState("TO");
  const selected = useMemo(() => stateRules[uf] ?? [], [stateRules, uf]);

  return <div className="grid gap-5">
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <label className="grid max-w-xs gap-1.5 text-sm font-black text-slate-800"><span>Estado da operação</span><select value={uf} onChange={(event)=>setUf(event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-950">{UFS.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
      <p className="mt-3 text-sm leading-6 text-slate-600">Primeiro valem as regras federais específicas para ARP. Regras estaduais entram como camada adicional somente quando a fonte e a aplicabilidade ao drone estão claras.</p>
    </section>

    <section className="grid gap-3">
      <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-700" size={20}/><h2 className="text-xl font-black text-slate-950">Regras federais para ARP</h2></div>
      {federal.map((rule)=><RuleCard key={rule.id} rule={rule}/>) }
    </section>

    <section className="grid gap-3">
      <div className="flex items-center gap-2"><Scale className="text-slate-700" size={20}/><h2 className="text-xl font-black text-slate-950">Camada estadual — {uf}</h2></div>
      {selected.length ? selected.map((rule)=><RuleCard key={rule.id} rule={rule}/>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm leading-6 text-slate-600"><Info className="mr-2 inline" size={17}/><strong>Nenhuma regra estadual específica de ARP foi cadastrada como verificada para {uf}.</strong> Isso não significa ausência de legislação estadual. O sistema mantém o piso federal e exige conferência de bula, receita e normas locais aplicáveis.</div>}
    </section>
  </div>;
}

function RuleCard({rule}:{rule:RegulatoryRule}) {
  const review = rule.applicability === "review";
  return <article className={`rounded-2xl border p-5 ${review?"border-amber-200 bg-amber-50":"border-emerald-100 bg-white"}`}>
    <div className="flex items-start gap-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${review?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-700"}`}>{review?<TriangleAlert size={19}/>:<ShieldCheck size={19}/>}</span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-base text-slate-950">{rule.title}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${rule.applicability==="automatic"?"bg-emerald-100 text-emerald-800":rule.applicability==="review"?"bg-amber-100 text-amber-900":"bg-slate-100 text-slate-700"}`}>{rule.applicability==="automatic"?"aplicação direta":rule.applicability==="review"?"exige conferência":"informativo"}</span></div><p className="mt-2 text-sm leading-6 text-slate-700">{rule.summary}</p>{rule.minimumDistanceM!=null&&<p className="mt-2 text-sm font-black text-slate-950">Distância citada na fonte: {rule.minimumDistanceM} m{review?" — não bloqueia ARP automaticamente":""}</p>}{rule.notes?.map((note,index)=><p key={index} className="mt-2 text-xs leading-5 text-slate-600">• {note}</p>)}<div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><span className="font-bold text-slate-500">{rule.sourceArticle || "Fonte oficial"} • verificado em {new Date(`${rule.verifiedAt}T12:00:00`).toLocaleDateString("pt-BR")}</span><a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black text-emerald-700">Abrir fonte <ExternalLink size={13}/></a></div></div>
    </div>
  </article>;
}
