"use client";

import Link from "next/link";
import { Check, CheckCircle2, CircleHelp, FileText, FolderCheck, PlaneTakeoff, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DroneGeoMapEvidence } from "./DroneGeoMapEvidence";
import { DroneMapEvidence } from "./DroneMapEvidence";

type View = "inicio" | "nova" | "calda" | "estrategia" | "seguranca" | "controle" | "calibracao" | "checklist" | "sarpas" | "execucao" | "relatorios" | "config";
type Phase = { number:number; label:string; detail:string; views:View[] };
type Tip = { title:string; text:string };
type Readiness = { ready:boolean; pending:string[]; status:string };

const VIEW_KEY="dronegestor:view:v3";
const STATUS_KEY="dronegestor:missionStatus:v4";

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
  sarpas:{title:"Liberação para voo",text:"Confira o sistema oficial. O quadro abaixo mostra exatamente o que ainda impede o início."},
  execucao:{title:"Registre o que aconteceu",text:"A cada carga, informe hectares e volume realmente utilizados. Registre qualquer ocorrência."},
  relatorios:{title:"Feche a operação",text:"Confira área, volume, ocorrências e evidências. Depois use o pacote da operação para conferir a documentação."},
  config:{title:"Padrão da empresa",text:"Configurações internas são definidas pelo ADMIN/RT e não substituem legislação, bula ou receita."}
};

const validViews=new Set<View>(["inicio","nova","calda","estrategia","seguranca","controle","calibracao","checklist","sarpas","execucao","relatorios","config"]);
const replacements=new Map<string,string>([
  ["Estratégia e insight","Segurança • orientação técnica"],
  ["Mapa e segurança","Segurança • mapa e clima"],
  ["Parâmetros do controle","Equipamento • conferir ajustes"],
  ["Calibração","Equipamento • calibração"],
  ["Checklist pré-voo","Equipamento • checklist"],
  ["SARPAS","Liberação para voo"],
  ["Operação em andamento","Aplicar"],
  ["Dados e relatórios","Finalização"],
  ["Ver estratégia","Continuar para segurança"],
  ["Analisar segurança","Conferir mapa e clima"],
  ["Dados / rascunho","Finalização"],
  ["Calcular calda","Calda"],
  ["Dispensado após conferência oficial aplicável","Dispensado — somente após conferência oficial"],
  ["Não aplicável ao caso após conferência","Não aplicável — somente após conferência do caso"],
  ["Usar nuvem","Usar versão salva na nuvem"],
  ["Manter aparelho","Usar versão deste aparelho"],
  ["O mapa/polígono completo do talhão e o relatório mensal oficial ainda são módulos separados em implantação; este rascunho não os substitui.","Mapa, pacote da operação e relatório mensal estão disponíveis no DroneGestor. Este rascunho continua sendo apenas uma conferência operacional."]
]);

function readJson<T>(key:string,fallback:T):T { try { const raw=localStorage.getItem(key); return raw?JSON.parse(raw) as T:fallback; } catch { return fallback; } }
function readView():View { try { const value=localStorage.getItem(VIEW_KEY) as View|null; return value&&validViews.has(value)?value:"inicio"; } catch { return "inicio"; } }
function phaseFor(view:View){ return phases.find((phase)=>phase.views.includes(view))??null; }
function completeBooleans(value:unknown){ const object=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{}; const values=Object.values(object); return values.length>0&&values.every((item)=>item===true); }
function numberOk(value:unknown){ const n=Number(value); return Number.isFinite(n)&&n>0; }

function readReadiness():Readiness {
  if(typeof window==="undefined")return{ready:false,pending:[],status:"rascunho"};
  const mission=readJson<Record<string,any>>("dronegestor:mission:v2",{});
  const settings=readJson<Record<string,any>>("dronegestor:settings:v2",{insightsObrigatorios:true,exigirConfirmacao:true,margemPreventiva:90,bloquearMargemPreventiva:true});
  const weather=readJson<Record<string,any>>("dronegestor:weather",{});
  const calibration=readJson<Record<string,any>>("dronegestor:calibration:v2",{});
  const checklist=readJson<Record<string,any>>("dronegestor:checklist:v2",{});
  const insight=Boolean(readJson("dronegestor:insightAccepted:v2",false));
  const risk=Boolean(readJson("dronegestor:riskAccepted:v2",false));
  const products=Array.isArray(mission.produtos)?mission.produtos:[];
  const pending:string[]=[];

  const basicFields=[mission.cultura,mission.alvo,mission.tipoAtividade,mission.drone,mission.registroAnac||mission.identificacaoAnac,mission.pontaModelo||mission.pontaPulverizacao];
  if(basicFields.some((item)=>!String(item||"").trim())||![mission.area,mission.volume,mission.tanque,mission.faixa,mission.velocidadeKmh,mission.alturaM].every(numberOk)) pending.push("Dados obrigatórios da missão ou do drone");
  if(!products.length||products.some((p:any)=>!String(p?.nome||"").trim()||!numberOk(p?.dose)||!String(p?.unidade||"").trim())) pending.push("Produto, dose e unidade");
  const climateOk=mission.climaCampoConfirmado===true&&Boolean(mission.climaCampoMedidoEm)&&String(mission.direcaoVentoCampo||"").trim()&&Number.isFinite(Number(mission.ventoCampoKmh))&&Number.isFinite(Number(mission.temperaturaCampo))&&Number(mission.umidadeCampo)>0&&Number(mission.umidadeCampo)<=100;
  if(!climateOk) pending.push("Medição climática de campo confirmada");
  const sensitiveOk=mission.semAreaSensivel===true||numberOk(mission.distanciaSensivel);
  if(!sensitiveOk) pending.push("Área sensível / distância preventiva");
  if(settings.bloquearMargemPreventiva!==false&&mission.semAreaSensivel!==true&&numberOk(mission.distanciaSensivel)&&Number(mission.distanciaSensivel)<Number(settings.margemPreventiva||90)) pending.push(`Distância abaixo do padrão interno de ${Number(settings.margemPreventiva||90)} m`);
  if(settings.insightsObrigatorios!==false&&!insight) pending.push("Orientação/insight obrigatório confirmado");
  if(settings.exigirConfirmacao!==false&&!risk) pending.push("Confirmação final de risco");
  if(!completeBooleans(calibration)) pending.push("Calibração completa");
  if(!completeBooleans(checklist)) pending.push("Checklist pré-voo completo");
  const sarpasOk=mission.sarpasConfirmado===true&&Boolean(mission.sarpasSituacao)&&(mission.sarpasSituacao!=="autorizado"||String(mission.sarpasNumero||"").trim());
  if(!sarpasOk) pending.push("Situação SARPAS conferida");
  const gpsOk=Number.isFinite(Number(weather.latitude))&&Number.isFinite(Number(weather.longitude));
  if(!gpsOk) pending.push("Ponto GPS da operação");
  if(localStorage.getItem("dronegestor:syncConflict:v4")) pending.push("Conflito de sincronização");

  const status=String(readJson(STATUS_KEY,"rascunho")||"rascunho");
  return {ready:pending.length===0,pending,status};
}

function simplifyVisibleLabels(view:View){
  if(typeof document==="undefined"||!document.body)return;
  const active=phaseFor(view), walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let node=walker.nextNode();
  while(node){ const current=node.nodeValue?.trim()||"", replacement=replacements.get(current); if(replacement&&node.nodeValue) node.nodeValue=node.nodeValue.replace(current,replacement); else if(/^Etapa\s+\d+\s+de\s+8$/i.test(current)&&active&&node.nodeValue) node.nodeValue=node.nodeValue.replace(current,`Fase ${active.number} de 6 • ${active.label}`); node=walker.nextNode(); }
}

export function DroneSimpleFlowUX(){
  const [view,setView]=useState<View>("inicio");
  const [readiness,setReadiness]=useState<Readiness>({ready:false,pending:[],status:"rascunho"});
  useEffect(()=>{
    let last=readView();
    const refresh=()=>{const next=readView();if(next!==last){last=next;setView(next);}setReadiness(readReadiness());simplifyVisibleLabels(next);};
    setView(last); refresh();
    const observer=new MutationObserver(()=>simplifyVisibleLabels(readView()));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    const interval=window.setInterval(refresh,450);
    window.addEventListener("storage",refresh);
    return()=>{observer.disconnect();window.clearInterval(interval);window.removeEventListener("storage",refresh);};
  },[]);

  const active=useMemo(()=>phaseFor(view),[view]);
  const tip=tips[view];
  const showMap=["estrategia","seguranca","execucao","relatorios"].includes(view);
  const progress=active?Math.round(active.number/6*100):0;
  const closed=["finalizada","pendente_sync"].includes(readiness.status);

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

    {view==="sarpas" && <section className="bg-[#f4f8f1] px-3 pt-2 sm:px-5"><div className="mx-auto w-full max-w-3xl">
      <div className={`rounded-2xl border p-4 shadow-sm ${readiness.ready?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${readiness.ready?"bg-emerald-600 text-white":"bg-amber-100 text-amber-800"}`}>{readiness.ready?<CheckCircle2 size={20}/>:<TriangleAlert size={20}/>}</span>
          <div className="min-w-0 flex-1"><strong className={`block text-sm font-black ${readiness.ready?"text-emerald-950":"text-amber-950"}`}>{readiness.ready?"Pronto para iniciar a aplicação":"Ainda não liberar o voo"}</strong><p className="mt-1 text-xs leading-5 text-slate-700">{readiness.ready?"Todas as verificações locais necessárias para liberar o botão de início estão completas.":"Resolva os itens abaixo. O botão de iniciar continuará bloqueado até a conferência."}</p></div>
        </div>
        {!readiness.ready&&<div className="mt-3 grid gap-1.5">{readiness.pending.map((item)=><div key={item} className="flex items-start gap-2 rounded-xl bg-white/75 px-3 py-2 text-xs font-bold text-amber-950"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500"/>{item}</div>)}</div>}
      </div>
    </div></section>}

    {view==="seguranca" && <div className="bg-[#f4f8f1] px-3 pb-1 sm:px-5"><div className="mx-auto w-full max-w-3xl"><DroneGeoMapEvidence/></div></div>}

    {view==="relatorios"&&closed&&<section className="bg-[#f4f8f1] px-3 pt-2 sm:px-5"><div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#cfe4d7] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9f5ed] text-[#087a55]"><FolderCheck size={20}/></span><div><strong className="block text-sm font-black text-[#123d30]">Próximo passo: conferir o fechamento</strong><p className="mt-1 text-xs leading-5 text-[#6c7a72]">A aplicação terminou. Agora confira o dossiê e os documentos antes de considerar a OS administrativamente encerrada.</p></div></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Link href="/apps/dronegestor/pacote-operacao" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087a55] px-3 text-xs font-black text-white no-underline"><FolderCheck size={16}/> Pacote da operação</Link>
        <Link href="/apps/dronegestor/documentos" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfe4d7] bg-white px-3 text-xs font-black text-[#14533e] no-underline"><PlaneTakeoff size={16}/> Documentos / SARPAS</Link>
        <Link href="/apps/dronegestor/fichas" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfe4d7] bg-white px-3 text-xs font-black text-[#14533e] no-underline"><FileText size={16}/> Ficha da operação</Link>
      </div>
    </div></section>}

    {showMap && <DroneMapEvidence/>}
  </>;
}
