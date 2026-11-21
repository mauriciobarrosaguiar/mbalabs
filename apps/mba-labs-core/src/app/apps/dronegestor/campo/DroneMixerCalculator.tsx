"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { calculateLoads,calculateProductForVolume,type ApplicationDoseUnit } from "@/lib/dronegestor-calculations";
type Product={id:string;nome:string;dose:number;unidade:ApplicationDoseUnit};
type Mission={ordemServicoId?:string;volume?:number;area?:number;tanque?:number;produtos?:Product[]};
const SLOT="dronegestor-mixer-calculator-slot";
const fmt=(v:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:4}).format(v);
export function DroneMixerCalculator(){
 const [slot,setSlot]=useState<HTMLElement|null>(null),[mission,setMission]=useState<Mission>({}),[mixer,setMixer]=useState(""),[progress,setProgress]=useState(0);
 useEffect(()=>{
  let last="", lastOwner="", lastOs="";
  const sync=()=>{
   const owner=localStorage.getItem("dronegestor:deviceOwner:v1")||"";
   if(owner!==lastOwner){lastOwner=owner;last="";setMixer("");setMission({});}
   if(localStorage.getItem("dronegestor:view:v3")!=="calda"){setSlot(null);return;}
   const raw=localStorage.getItem("dronegestor:mission:v2")||"{}",p=localStorage.getItem("dronegestor:progress:v2")||"0";
   const stamp=raw+"|"+p;
   if(stamp!==last){last=stamp;try{const parsed=JSON.parse(raw) as Mission;if(parsed.ordemServicoId!==lastOs){lastOs=parsed.ordemServicoId||"";setMixer("");}setMission(parsed);setProgress(Math.max(0,Number(JSON.parse(p))||0));}catch{setMission({});}}
   const title=Array.from(document.querySelectorAll("strong")).find(e=>e.textContent?.trim()==="Cálculo de calda");
   const root=title?.parentElement?.parentElement;
   if(!root?.parentElement)return;
   let node=document.getElementById(SLOT);
   if(!node){node=document.createElement("div");node.id=SLOT;root.insertAdjacentElement("afterend",node);}
   if(node.parentElement!==root.parentElement)root.insertAdjacentElement("afterend",node);
   setSlot(node);
  };
  sync();const timer=window.setInterval(sync,450);
  return()=>{window.clearInterval(timer);};
 },[]);
 const rate=Number(mission.volume),area=Math.max(0,Number(mission.area||0)-progress),tank=Number(mission.tanque),capacity=mixer.trim()?Number(mixer.replace(",",".")):0;
 let plan:ReturnType<typeof calculateLoads>|null=null,amounts:{name:string;value:string}[]=[];let message="";
 if(mixer.trim()){try{
   plan=calculateLoads(area,rate,capacity);
   const volume=Math.min(capacity,plan.totalL);
   const items=mission.produtos||[];
   if(!items.length||items.some(p=>!p.nome?.trim()||!Number.isFinite(Number(p.dose))||Number(p.dose)<=0))throw Error("Complete todos os produtos prescritos na OS.");
   amounts=items.map(p=>{const result=calculateProductForVolume(Number(p.dose),p.unidade,volume,rate);return{name:p.nome,value:fmt(result.amount)+" "+result.unit};});
  }catch(e){message=e instanceof Error?e.message:"Confira os dados da missão.";}}
 if(!slot)return null;
 return createPortal(<section className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
   <header><strong className="text-lg text-emerald-950">MBA Calda — misturador da operação</strong><p className="text-sm text-slate-600">Dados da missão atual. Informe apenas o volume útil do misturador; os produtos e a taxa vêm da OS. Cálculo, não liberação para preparo ou voo.</p></header>
   <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-white p-3">Área restante<strong className="block">{fmt(area)} ha</strong></div><div className="rounded-xl bg-white p-3">Taxa de aplicação<strong className="block">{rate>0?fmt(rate):"—"} L/ha</strong></div><div className="rounded-xl bg-white p-3">Tanque cadastrado<strong className="block">{tank>0?fmt(tank):"—"} L</strong></div></div>
   <label className="grid gap-1 text-sm font-bold">Misturador útil (L)<input className="min-h-12 rounded-xl border border-emerald-200 p-3" inputMode="decimal" value={mixer} onChange={e=>setMixer(e.target.value)}/></label>
   {message&&<p role="alert" className="text-sm text-red-800">{message}</p>}
   {plan&&!message&&<div className="grid gap-2 rounded-xl bg-emerald-950 p-4 text-white"><strong>QUANTO COLOCAR NO MISTURADOR</strong><p>{fmt(Math.min(capacity,plan.totalL))} L de calda final — {fmt(Math.min(capacity,plan.totalL)/rate)} ha</p>{amounts.map((p,i)=><div key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/10 p-3"><span>{p.name}</span><strong>{p.value}</strong></div>)}<p className="text-sm">Misturas completas: {plan.fullLoads} • parciais: {plan.partialLoads} • última: {fmt(plan.lastL)} L.</p></div>}
   <p className="text-xs text-slate-700">Antes de preparar, confira receituário, bula, EPI, compatibilidade, condição de campo e equipamento. Complete somente até o volume final da calda.</p>
 </section>,slot);
}
