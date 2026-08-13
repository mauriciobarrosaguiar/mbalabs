"use client";

import { Check, CircleHelp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DroneGeoMapEvidence } from "./DroneGeoMapEvidence";
import { DroneMapEvidence } from "./DroneMapEvidence";

type View = "inicio" | "nova" | "calda" | "estrategia" | "seguranca" | "controle" | "calibracao" | "checklist" | "sarpas" | "execucao" | "relatorios" | "config";
type Phase = { number:number; label:string; detail:string; views:View[] };
type Tip = { title:string; text:string };
const VIEW_KEY="dronegestor:view:v3";

const phases:Phase[]=[
  {number:1,label:"Operação",detail:"OS e dados",views:["nova"]},
  {number:2,label:"Calda",detail:"Produtos e cargas",views:["calda"]},
  {number:3,label:"Segurança",detail:"Mapa, clima e risco",views:["estrategia","seguranca"]},
  {number:4,label:"Equipamento",detail:"Ajustes e checklist",views:["controle","calibracao","checklist"]},
  {number:5,label:"Liberação",detail:"SARPAS e conferência",views:["sarpas"]},
  {number:6,label:"Aplicar",detail:"Execução e finalização",views:["execucao","relatorios"]}
];
const tips:Record<View,Tip>={
  inicio:{title:"O que fazer agora?",text:"Escolha uma OS ou retome a operação que já estava em andamento."},
  nova:{title:"Confira, não redigite",text:"Use os dados da OS e do drone cadastrado. Complete somente o que faltar nesta aplicação."},
  calda:{title:"Confira o cálculo",text:"Dose vem da receita/bula. O DroneGestor calcula total de calda, cargas e quantidade por carga."},
  estrategia:{title:"Orientação de segurança",text:"Confirme receita, bula e orientação técnica antes de seguir para o mapa e clima."},
  seguranca:{title:"Segurança no local",text:"Registre mapa, área sensível e clima medido no talhão antes de liberar o equipamento."},
  controle:{title:"Confira os ajustes",text:"Compare os valores calculados com o controle do drone e corrija divergências."},
  calibracao:{title:"Calibre na ordem",text:"Eliminar o ar → calibrar fluxômetro → calibrar bomba."},
  checklist:{title:"Faça a conferência física",text:"Marque somente depois de verificar cada item no equipamento e na área."},
  sarpas:{title:"Liberação para voo",text:"Confira o sistema oficial e registre a situação correta antes de iniciar."},
  execucao:{title:"Registre o que aconteceu",text:"A cada carga, informe hectares e volume realmente utilizados. Registre qualquer ocorrência."},
  relatorios:{title:"Feche a operação",text:"Confira área, volume, ocorrências e evidências antes de concluir."},
  config:{title:"Padrão da empresa",text:"Configurações internas são definidas pelo ADMIN/RT e não substituem legislação, bula ou receita."}
};

const validViews=new Set<View>(["inicio","nova","calda","estrategia","seguranca","controle","calibracao","checklist","sarpas","execucao","relatorios","config"]);
const replacements=new Map<string,string>([
  ["Estratégia e insight","Segurança • orientação técnica"],["Mapa e segurança","Segurança • mapa e clima"],["Parâmetros do controle","Equipamento • conferir ajustes"],["Calibração","Equipamento • calibração"],["Checklist pré-voo","Equipamento • checklist"],["SARPAS","Liberação para voo"],["Operação em andamento","Aplicar"],["Dados e relatórios","Finalização"],["Ver estratégia","Continuar para segurança"],["Analisar segurança","Conferir mapa e clima"],["Dados / rascunho","Finalização"],["Calcular calda","Calda"],["Dispensado após conferência oficial aplicável","Dispensado — somente após conferência oficial"],["Não aplicável ao caso após conferência","Não aplicável — somente após conferência do caso"],["Usar nuvem","Usar versão salva na nuvem"],["Manter aparelho","Usar versão deste aparelho"]
]);
function readView():View { try { const value=localStorage.getItem(VIEW_KEY) as View|null; return value&&validViews.has(value)?value:"inicio"; } catch { return "inicio"; } }
function phaseFor(view:View){ return phases.find((phase)=>phase.views.includes(view))??null; }
function simplifyVisibleLabels(view:View){
  if(typeof document==="undefined"||!document.body)return;
  const active=phaseFor(view), walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let node=walker.nextNode();
  while(node){ const current=node.nodeValue?.trim()||"", replacement=replacements.get(current); if(replacement&&node.nodeValue) node.nodeValue=node.nodeValue.replace(current,replacement); else if(/^Etapa\s+\d+\s+de\s+8$/i.test(current)&&active&&node.nodeValue) node.nodeValue=node.nodeValue.replace(current,`Fase ${active.number} de 6 • ${active.label}`); node=walker.nextNode(); }
}

export function DroneSimpleFlowUX(){
  const [view,setView]=useState<View>("inicio");
  useEffect(()=>{ let last=readView(); setView(last); simplifyVisibleLabels(last); const sync=()=>{ const next=readView(); if(next!==last){last=next;setView(next);} simplifyVisibleLabels(next); }; const observer=new MutationObserver(()=>simplifyVisibleLabels(readView())); observer.observe(document.body,{childList:true,subtree:true,characterData:true}); const interval=window.setInterval(sync,350); return()=>{observer.disconnect();window.clearInterval(interval);}; },[]);
  const active=useMemo(()=>phaseFor(view),[view]); const tip=tips[view]; const showMap=["estrategia","seguranca","execucao","relatorios"].includes(view); const progress=active?Math.round(active.number/6*100):0;

  return <>
    {active && <section className="bg-[#f4f8f1] px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#07533a,#00432f)] p-4 text-white shadow-[0_12px_30px_rgba(3,70,48,.10)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><span className="text-[11px] font-black uppercase tracking-[.14em] text-[#8fe0b4]">Fase {active.number} de 6</span><h2 className="mt-1 text-xl font-black leading-6">{active.label}</h2><p className="mt-1 text-xs text-[#c8ddd2]">{active.detail}</p></div>
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black">{active.number}</div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#65dca0] transition-all" style={{width:`${progress}%`}}/></div>
        <div className="mobile-hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {phases.map((phase)=>{ const done=phase.number<active.number, current=phase.number===active.number; return <div key={phase.number} className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-black ${current?"bg-[#65dca0] text-[#063b29]":done?"bg-white/12 text-white":"bg-black/10 text-white/55"}`}><span className="grid size-4 place-items-center rounded-full bg-white/10">{done?<Check size={10} strokeWidth={3}/>:phase.number}</span><span>{phase.label}</span></div>; })}
        </div>
      </div>
      <div className="mx-auto mt-2 flex w-full max-w-3xl gap-2 rounded-2xl border border-[#cfe4d7] bg-white px-3 py-3 shadow-sm"><CircleHelp size={18} className="mt-0.5 shrink-0 text-[#087a55]"/><div><strong className="block text-xs font-black text-[#123d30]">{tip.title}</strong><p className="mt-0.5 text-[11px] leading-4 text-[#6c7a72]">{tip.text}</p></div></div>
    </section>}
    {view==="seguranca" && <div className="bg-[#f4f8f1] px-3 pb-1 sm:px-5"><div className="mx-auto w-full max-w-3xl"><DroneGeoMapEvidence/></div></div>}
    {showMap && <DroneMapEvidence/>}
  </>;
}
