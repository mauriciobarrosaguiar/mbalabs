"use client";

import { CheckCircle2, Loader2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Pilot={id:string;nome:string;usuarioId?:string};
type Order={entityId:string;data:{numero?:string;fazendaNome?:string;talhaoNome?:string;status?:string;pilotoResponsavelId?:string;pilotoResponsavelNome?:string}};
const SLOT_ID="dronegestor-os-pilot-step";

function findHost(){
  const heading=Array.from(document.querySelectorAll("h1")).find(node=>node.textContent?.includes("ordens de serviço"));
  const header=heading?.closest("header");
  return header?.parentElement??null;
}

export function DroneOsPilotStep({canManage}:{canManage:boolean}){
  const[slot,setSlot]=useState<HTMLElement|null>(null),[pilots,setPilots]=useState<Pilot[]>([]),[orders,setOrders]=useState<Order[]>([]),[currentUserId,setCurrentUserId]=useState(""),[currentUserName,setCurrentUserName]=useState("Gestor"),[orderId,setOrderId]=useState(""),[pilotChoice,setPilotChoice]=useState("self"),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");

  useEffect(()=>{
    if(!canManage)return;
    const mount=()=>{
      const host=findHost();if(!host)return;
      let node=document.getElementById(SLOT_ID);
      if(!node){node=document.createElement("div");node.id=SLOT_ID;const header=host.querySelector("header");header?.insertAdjacentElement("afterend",node)}
      setSlot(node);
    };
    mount();const observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[canManage]);

  async function load(){
    if(!canManage)return;
    setLoading(true);
    try{
      const[p,o]=await Promise.all([fetch("/api/dronegestor/pilotos",{cache:"no-store"}),fetch("/api/dronegestor/cadastros?type=os",{cache:"no-store"})]);
      const[pp,op]=await Promise.all([p.json().catch(()=>null),o.json().catch(()=>null)]);
      if(!p.ok)throw new Error(pp?.error||"Falha ao carregar pilotos.");if(!o.ok)throw new Error(op?.error||"Falha ao carregar OS.");
      const open=((op?.items||[]) as Order[]).filter(item=>["aberta","preparacao","em_preparacao"].includes(item.data.status||"aberta"));
      setPilots((pp?.items||[]) as Pilot[]);setOrders(open);setCurrentUserId(String(pp?.currentUserId||""));setCurrentUserName(String(pp?.currentUserName||"Gestor"));setOrderId(current=>current&&open.some(item=>item.entityId===current)?current:(open.find(item=>!item.data.pilotoResponsavelId)?.entityId||open[0]?.entityId||""));
    }catch(error){setMessage(error instanceof Error?error.message:"Falha ao carregar responsáveis.")}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[canManage]);

  const linked=useMemo(()=>pilots.filter(item=>Boolean(item.usuarioId)),[pilots]);
  const selected=useMemo(()=>orders.find(item=>item.entityId===orderId)||null,[orders,orderId]);
  const selectedPilot=useMemo(()=>pilotChoice==="self"?null:linked.find(item=>item.id===pilotChoice)||null,[pilotChoice,linked]);

  async function assign(){
    if(!selected||saving||!currentUserId)return;
    const pilotId=pilotChoice==="self"?currentUserId:String(selectedPilot?.usuarioId||"");
    const pilotName=pilotChoice==="self"?currentUserName:String(selectedPilot?.nome||"");
    if(!pilotId)return setMessage("O piloto precisa ter login MBA ativo para receber a OS.");
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/dronegestor/cadastros",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"os",entityId:selected.entityId,data:{pilotoResponsavelId:pilotId,pilotoResponsavelNome:pilotName}}),cache:"no-store"});
      const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||"Falha ao vincular piloto.");
      setMessage(`${selected.data.numero||"OS"} vinculada a ${pilotName}.`);await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Falha ao vincular piloto.")}finally{setSaving(false)}
  }

  if(!canManage||!slot)return null;
  return createPortal(<section className="mb-4 rounded-3xl border border-[#cfe3d6] bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f4eb] text-[#087a55]"><UserRound size={21}/></span><div className="min-w-0 flex-1"><strong className="block text-base font-black text-[#123d30]">Piloto responsável da OS</strong><p className="mt-1 text-xs leading-5 text-[#718078]">Depois de criar a OS, defina quem vai executar. Pode ser você mesmo ou um piloto da equipe.</p></div></div>
    {loading?<div className="mt-3 flex items-center gap-2 text-sm text-[#718078]"><Loader2 size={16} className="animate-spin"/>Carregando...</div>:orders.length===0?<div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f4f8f5] px-3 py-3 text-xs font-bold text-[#60736a]"><CheckCircle2 size={16} className="text-[#087a55]"/>Crie uma OS abaixo; a atribuição do piloto aparecerá aqui.</div>:<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-1 text-xs font-black text-[#4e675d]"><span>OS</span><select value={orderId} onChange={e=>setOrderId(e.target.value)} className="min-h-11 rounded-xl border border-[#d8e3db] bg-white px-3 text-sm"><option value="">Selecione...</option>{orders.map(item=><option key={item.entityId} value={item.entityId}>{item.data.numero||"OS"} — {item.data.fazendaNome||item.data.talhaoNome||"Operação"}</option>)}</select></label><label className="grid gap-1 text-xs font-black text-[#4e675d]"><span>Piloto</span><select value={pilotChoice} onChange={e=>setPilotChoice(e.target.value)} className="min-h-11 rounded-xl border border-[#d8e3db] bg-white px-3 text-sm"><option value="self">{currentUserName} — gestor/piloto</option>{linked.map(item=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><button type="button" onClick={()=>void assign()} disabled={saving||!orderId} className="min-h-11 self-end rounded-xl bg-[#087a55] px-4 text-sm font-black text-white disabled:opacity-40">{saving?"Salvando...":"Vincular"}</button></div>}
    {selected?.data.pilotoResponsavelNome&&<p className="mt-2 text-[11px] text-[#60736a]">Responsável atual: <strong>{selected.data.pilotoResponsavelNome}</strong></p>}
    {message&&<p className="mt-3 rounded-xl bg-[#f4f8f5] px-3 py-2 text-xs font-bold text-[#315d4d]">{message}</p>}
  </section>,slot);
}
