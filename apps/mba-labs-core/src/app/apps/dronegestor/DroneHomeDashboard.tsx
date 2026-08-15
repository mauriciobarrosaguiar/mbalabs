"use client";

import Link from "next/link";
import { BookOpenCheck, ChevronRight, ClipboardList, Drone, FileSpreadsheet, FileText, FolderCheck, History, MapPinned, PlaneTakeoff, Rocket, Scale, Settings2, Sprout, Thermometer, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DroneFirstOperationGuide } from "./DroneFirstOperationGuide";

type Mission = { area?:number; cultura?:string; alvo?:string; ordemServicoNumero?:string; fazendaNome?:string; talhaoNome?:string };
type Weather = { temperature?:number; windSpeed?:number; capturedAt?:string };
type Snapshot = { mission?:Mission; weather?:Weather; missionStatus?:string; status?:string };

function localJson<T>(key:string, fallback:T):T { try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function fmt(value:unknown, digits=1) { const n=Number(value); return Number.isFinite(n) ? new Intl.NumberFormat("pt-BR",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n) : "—"; }

export function DroneHomeDashboard({ userName, canManage }: { userName:string; canManage:boolean }) {
  const [snapshot,setSnapshot]=useState<Snapshot>({});
  const firstName=(userName||"Piloto").split(" ")[0];

  useEffect(()=>{
    const fromLocal:Snapshot={
      mission: localJson<Mission>("dronegestor:mission:v2",{}),
      weather: localJson<Weather>("dronegestor:weather",{}),
      missionStatus: localJson<string>("dronegestor:missionStatus:v4","rascunho")
    };
    setSnapshot(fromLocal);
    void fetch("/api/dronegestor/state",{cache:"no-store"}).then(async response=>{
      if(!response.ok) return;
      const payload=await response.json().catch(()=>null);
      const state=payload?.state && typeof payload.state==="object" ? payload.state as Snapshot : null;
      if(state) setSnapshot((current)=>({ ...current, ...state, mission: state.mission ?? current.mission, weather: state.weather ?? current.weather }));
    }).catch(()=>undefined);
  },[]);

  const mission=snapshot.mission??{};
  const weather=snapshot.weather??{};
  const ended=["finalizada","pendente_sync"].includes(String(snapshot.missionStatus||""));
  const hasMission=!ended&&Boolean(Number(mission.area)>0 || mission.cultura || mission.ordemServicoNumero);
  const resumeText=useMemo(()=>[
    Number(mission.area)>0 ? `${fmt(mission.area)} ha` : "",
    mission.cultura?.trim(),
    mission.alvo?.trim()
  ].filter(Boolean).join(" • "),[mission.area,mission.cultura,mission.alvo]);

  return <main className="min-h-screen bg-[#f4f8f1] px-4 pb-8 pt-5 text-[#143d31] sm:px-6 sm:pt-8">
    <div className="mx-auto w-full max-w-5xl">
      <section className="overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_82%_18%,rgba(42,163,112,.30),transparent_32%),linear-gradient(155deg,#074e36_0%,#003b2a_100%)] px-5 py-6 text-white shadow-[0_18px_40px_rgba(3,73,49,.12)] sm:px-8 sm:py-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-[#f0fbf3]"><Sprout size={16}/> DroneGestor</div>
        <h1 className="mt-5 text-[42px] font-black leading-[.96] tracking-[-.045em] sm:text-5xl">Olá,<br className="sm:hidden"/> {firstName}.</h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#d5e5dc] sm:text-base">Escolha o que vai fazer — o DroneGestor conduz a operação passo a passo.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-lg">
          <Metric icon={<Thermometer size={21}/>} value={weather.temperature!==undefined ? `${fmt(weather.temperature)}°C` : "—"} label="Modelo meteorológico"/>
          <Metric icon={<Wind size={21}/>} value={weather.windSpeed!==undefined ? `${fmt(weather.windSpeed)} km/h` : "—"} label="Vento modelo 10 m"/>
        </div>
      </section>

      <DroneFirstOperationGuide canManage={canManage}/>

      {hasMission && <Link href="/apps/dronegestor/campo" className="mt-4 flex items-center gap-4 rounded-[24px] border border-[#9fd8b9] bg-[#d7f4df] p-4 no-underline shadow-[0_10px_24px_rgba(25,111,77,.09)] sm:p-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-[20px] bg-[#087a55] text-white"><ClipboardList size={25}/></span>
        <span className="min-w-0 flex-1"><strong className="block text-lg font-black text-[#104b38]">Retomar missão</strong><span className="mt-1 block truncate text-sm text-[#5f776d]">{resumeText || mission.ordemServicoNumero || "Operação em preparação"}</span></span>
        <ChevronRight size={24} className="shrink-0 text-[#087a55]"/>
      </Link>}

      {ended && <Link href="/apps/dronegestor/pacote-operacao" className="mt-4 flex items-center gap-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4 no-underline shadow-sm sm:p-5"><span className="grid size-14 shrink-0 place-items-center rounded-[20px] bg-amber-600 text-white"><FolderCheck size={24}/></span><span className="min-w-0 flex-1"><strong className="block text-base font-black text-amber-950">Aplicação de campo concluída</strong><span className="mt-1 block text-sm text-amber-800">Confira documentos e pendências para encerrar a OS.</span></span><ChevronRight size={22} className="shrink-0 text-amber-700"/></Link>}

      <div className="mb-3 mt-7 flex items-end justify-between gap-3 px-1"><h2 className="text-sm font-black uppercase tracking-[.18em] text-[#64756c]">O que você quer fazer</h2></div>
      <section className="grid gap-3 sm:grid-cols-2">
        <Action href="/apps/dronegestor/campo" icon={<Rocket size={25}/>} title="Começar ou continuar operação" text="Calda, segurança, equipamento, SARPAS, voo e conclusão em campo." primary/>
        <Action href="/apps/dronegestor/gestao" icon={<ClipboardList size={25}/>} title="Preparar uma operação" text="Cadastre cliente, fazenda, talhão, abra a OS e defina o piloto."/>
        <Action href="/apps/dronegestor/documentos" icon={<PlaneTakeoff size={25}/>} title="SARPAS e documentos" text="Acompanhe autorização, SISANT e anexos obrigatórios da OS."/>
        <Action href="/apps/dronegestor/pacote-operacao" icon={<FolderCheck size={25}/>} title="Finalizar operação" text="Regularize pendências e encerre a OS somente quando o pacote estiver completo."/>
        <Action href="/apps/dronegestor/regulacao" icon={<Scale size={25}/>} title="Segurança e regras" text="Consulte MAPA, ANAC, DECEA, regra estadual e padrão interno."/>
        <Action href="/apps/dronegestor/fichas" icon={<History size={25}/>} title="Operações realizadas" text="Abra fichas, mapas, registros e histórico das aplicações."/>
        <Action href="/apps/dronegestor/produtos" icon={<BookOpenCheck size={25}/>} title="Produtos e bulas" text="Busque produto e informações técnicas revisadas."/>
        <Action href="/apps/dronegestor/relatorio-mensal" icon={<FileSpreadsheet size={25}/>} title="Relatório mensal MAPA" text="Consolide o mês, imprima e gere o XLSX para conferência/remessa."/>
        {canManage && <Action href="/apps/dronegestor/equipamentos" icon={<Settings2 size={25}/>} title="Drones e equipamentos" text="Cadastre o drone uma vez e reutilize os parâmetros."/>}
        {canManage && <Action href="/apps/dronegestor/perfil-operacional" icon={<FileText size={25}/>} title="Perfil operacional" text="Dados da empresa, operador e responsável técnico."/>}
      </section>

      <section className="mt-7 rounded-[26px] border border-[#dce8df] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#e9f5ed] text-[#087a55]"><MapPinned size={21}/></span><div><strong className="block text-sm font-black text-[#103d2f]">Fluxo simples para quem está no campo</strong><p className="mt-1 text-xs leading-5 text-[#718078]">Local → drone → OS/piloto → calda → segurança → documentos/liberação → aplicação → pacote final. O sistema indica o próximo passo sem exigir que o piloto decore o processo.</p></div></div>
      </section>
    </div>
  </main>;
}

function Metric({icon,value,label}:{icon:React.ReactNode;value:string;label:string}) { return <div className="rounded-[22px] bg-white/[.08] p-4"><span className="text-[#78d9a8]">{icon}</span><strong className="mt-3 block text-[22px] font-black tracking-[-.02em] text-white">{value}</strong><span className="mt-1 block text-[11px] leading-4 text-[#aec6ba]">{label}</span></div>; }
function Action({href,icon,title,text,primary=false}:{href:string;icon:React.ReactNode;title:string;text:string;primary?:boolean}) { return <Link href={href} className={`group flex items-center gap-4 rounded-[24px] border p-4 no-underline shadow-[0_7px_20px_rgba(26,80,59,.055)] transition active:scale-[.99] sm:p-5 ${primary?"border-[#b7dfc5] bg-white":"border-[#dce6df] bg-white"}`}><span className={`grid size-12 shrink-0 place-items-center rounded-[18px] ${primary?"bg-[#e7f4eb] text-[#087a55]":"bg-[#f0f5f1] text-[#34735c]"}`}>{icon}</span><span className="min-w-0 flex-1"><strong className="block text-[16px] font-black leading-5 text-[#123d30]">{title}</strong><span className="mt-1 block text-[13px] leading-5 text-[#738078]">{text}</span></span><ChevronRight size={21} className="shrink-0 text-[#27805f]"/></Link>; }
