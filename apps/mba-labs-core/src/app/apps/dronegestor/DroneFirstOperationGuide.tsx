"use client";

import Link from "next/link";
import { Check, ChevronRight, Circle, Loader2, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Step = { key:string; label:string; detail:string; href:string; done:boolean };
type Setup = { profile:boolean; equipment:boolean; location:boolean; order:boolean };

async function json(url:string){const response=await fetch(url,{cache:"no-store"});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||"Falha ao carregar preparação inicial.");return payload;}

export function DroneFirstOperationGuide({canManage}:{canManage:boolean}){
  const[setup,setSetup]=useState<Setup|null>(null);
  const[failed,setFailed]=useState(false);

  useEffect(()=>{
    if(!canManage)return;
    let active=true;
    void Promise.all([
      json("/api/dronegestor/perfil-operacional"),
      json("/api/dronegestor/equipamentos"),
      json("/api/dronegestor/cadastros?type=cliente"),
      json("/api/dronegestor/cadastros?type=fazenda"),
      json("/api/dronegestor/cadastros?type=talhao"),
      json("/api/dronegestor/cadastros?type=os")
    ]).then(([profile,equipment,clients,farms,plots,orders])=>{
      if(!active)return;
      const p=profile?.profile??{};
      const profileOk=Boolean(String(p.operadorNome||"").trim()&&String(p.cpfCnpj||"").trim()&&String(p.registroMapa||"").trim());
      setSetup({
        profile:profileOk,
        equipment:Array.isArray(equipment?.items)&&equipment.items.length>0,
        location:Array.isArray(clients?.items)&&clients.items.length>0&&Array.isArray(farms?.items)&&farms.items.length>0&&Array.isArray(plots?.items)&&plots.items.length>0,
        order:Array.isArray(orders?.items)&&orders.items.some((item:any)=>["aberta","preparacao","em_preparacao","em_execucao","suspensa","campo_concluido"].includes(item?.data?.status||"aberta"))
      });
    }).catch(()=>{if(active)setFailed(true)});
    return()=>{active=false};
  },[canManage]);

  const steps=useMemo<Step[]>(()=>setup?[
    {key:"profile",label:"1. Identifique o operador",detail:"Complete os dados administrativos usados nos documentos.",href:"/apps/dronegestor/perfil-operacional",done:setup.profile},
    {key:"equipment",label:"2. Cadastre o drone",detail:"ANAC, tanque, atomizador e parâmetros ficam salvos para reutilizar.",href:"/apps/dronegestor/equipamentos",done:setup.equipment},
    {key:"location",label:"3. Cadastre o local",detail:"Cliente → fazenda → talhão. Faça isso uma vez e reutilize nas próximas OS.",href:"/apps/dronegestor/gestao",done:setup.location},
    {key:"order",label:"4. Abra a ordem de serviço",detail:"A OS liga local, aplicação e piloto responsável.",href:"/apps/dronegestor/gestao",done:setup.order}
  ]:[],[setup]);

  if(!canManage||failed)return null;
  if(!setup)return <section className="mt-4 flex min-h-14 items-center justify-center rounded-2xl border border-[#dce8df] bg-white text-sm text-[#6d7b74]"><Loader2 size={17} className="mr-2 animate-spin"/>Conferindo preparação inicial...</section>;
  if(steps.every(step=>step.done))return null;
  const next=steps.find(step=>!step.done)!;
  const doneCount=steps.filter(step=>step.done).length;

  return <section className="mt-4 overflow-hidden rounded-[24px] border border-[#cfe3d6] bg-white shadow-[0_8px_22px_rgba(26,80,59,.06)]">
    <div className="flex items-start gap-3 p-4 sm:p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e7f4eb] text-[#087a55]"><Route size={21}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm font-black text-[#123d30]">Primeiros passos</strong><span className="rounded-full bg-[#edf5ef] px-2.5 py-1 text-[11px] font-black text-[#477060]">{doneCount}/4</span></div><p className="mt-1 text-xs leading-5 text-[#718078]">O DroneGestor prepara o caminho. Faça apenas o próximo item.</p></div></div>
    <div className="border-t border-[#e4ece7] px-4 py-3 sm:px-5"><div className="grid gap-1.5">{steps.map(step=><div key={step.key} className={`flex items-start gap-2 text-xs ${step.done?"text-[#6e7e76]":"font-black text-[#153f31]"}`}>{step.done?<Check size={15} className="mt-0.5 shrink-0 text-[#087a55]"/>:<Circle size={14} className="mt-0.5 shrink-0 text-[#8aa398]"/>}<span>{step.label}</span></div>)}</div><Link href={next.href} className="mt-3 flex min-h-11 items-center justify-between rounded-xl bg-[#087a55] px-4 text-sm font-black text-white no-underline"><span>{next.label}</span><ChevronRight size={18}/></Link><p className="mt-2 text-[11px] leading-4 text-[#718078]">{next.detail}</p></div>
  </section>;
}
