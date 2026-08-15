"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Circle, Loader2, LockKeyhole, PlaneTakeoff, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Item={id:string;label:string;ok:boolean;detail:string;nextView?:string};
type Release={ready:boolean;nextId:string;nextView:string;items:Item[];error?:string;osStatus?:string;pilotName?:string};

const EMPTY:Release={ready:false,nextId:"",nextView:"",items:[]};
function readJson<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}}
function snapshot(){return{
  mission:readJson<Record<string,unknown>>("dronegestor:mission:v2",{}),
  calibration:readJson("dronegestor:calibration:v2",{}),
  checklist:readJson("dronegestor:checklist:v2",{}),
  weather:readJson("dronegestor:weather",{}),
  riskAccepted:Boolean(readJson("dronegestor:riskAccepted:v2",false)),
  insightAccepted:Boolean(readJson("dronegestor:insightAccepted:v2",false))
}}
function currentOsId(){const m=readJson<Record<string,any>>("dronegestor:mission:v2",{});return String(m.ordemServicoId||"")}
function openField(view:string){localStorage.setItem("dronegestor:view:v3",view);window.location.reload()}

export function DroneOperationNextStep(){
  const[release,setRelease]=useState<Release>(EMPTY),[loading,setLoading]=useState(false),[expanded,setExpanded]=useState(false),[notice,setNotice]=useState("");
  const lastSignature=useRef("");
  const started=Boolean(typeof window!=="undefined"&&readJson("dronegestor:started:v3",false));
  const missionStatus=typeof window!=="undefined"?String(readJson("dronegestor:missionStatus:v4","rascunho")):"rascunho";
  const osId=typeof window!=="undefined"?currentOsId():"";

  async function refresh(force=false){
    const id=currentOsId();if(!id){setRelease(EMPTY);return}
    const snap=snapshot(),signature=JSON.stringify(snap);
    if(!force&&signature===lastSignature.current)return;
    lastSignature.current=signature;setLoading(true);
    try{
      const response=await fetch("/api/dronegestor/preflight",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({osId:id,snapshot:snap}),cache:"no-store"});
      const payload=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(payload?.error||"Não foi possível conferir a liberação.");
      setRelease({ready:Boolean(payload?.ready),nextId:String(payload?.nextId||""),nextView:String(payload?.nextView||""),items:Array.isArray(payload?.items)?payload.items:[],error:payload?.error,osStatus:String(payload?.osStatus||""),pilotName:String(payload?.pilotName||"")});
    }catch(error){setRelease(current=>({...current,ready:false,error:error instanceof Error?error.message:"Falha ao conferir a liberação."}))}
    finally{setLoading(false)}
  }

  useEffect(()=>{
    void refresh(true);
    const timer=window.setInterval(()=>void refresh(false),650);
    const force=()=>void refresh(true);
    window.addEventListener("focus",force);window.addEventListener("pageshow",force);window.addEventListener("dronegestor:sarpas-updated",force);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",force);window.removeEventListener("pageshow",force);window.removeEventListener("dronegestor:sarpas-updated",force)};
  },[]);

  useEffect(()=>{
    const guard=(event:Event)=>{
      const el=event.target instanceof Element?event.target.closest("button"):null;if(!el)return;
      const label=(el.textContent||"").trim();if(!label.includes("Iniciar operação"))return;
      if(release.ready)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const next=release.items.find(item=>!item.ok);
      setNotice(loading?"Aguarde a conferência do DroneGestor.":next?`Antes de iniciar: ${next.detail}`:release.error||"Ainda existe uma pendência antes do voo.");
      window.setTimeout(()=>setNotice(""),5000);
    };
    document.addEventListener("click",guard,true);return()=>document.removeEventListener("click",guard,true)
  },[release,loading]);

  const done=useMemo(()=>release.items.filter(item=>item.ok).length,[release.items]);
  const next=release.items.find(item=>!item.ok)||null;
  if(!osId)return null;

  if(["finalizada","pendente_sync"].includes(missionStatus))return <section className="bg-[#f4f8f1] px-3 pt-2 sm:px-5"><div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-950"><CheckCircle2 size={20} className="shrink-0"/><div className="min-w-0 flex-1"><strong className="block text-sm">Aplicação em campo concluída</strong><p className="mt-0.5 text-xs leading-5">{missionStatus==="pendente_sync"?"A conclusão está protegida e aguardando sincronização.":"Agora confira pendências e faça o encerramento administrativo da OS."}</p></div>{missionStatus==="finalizada"&&<button type="button" onClick={()=>window.location.href="/apps/dronegestor/pacote-operacao"} className="min-h-10 shrink-0 rounded-xl bg-amber-700 px-3 text-xs font-black text-white">Encerrar OS</button>}</div></section>;

  if(started)return <section className="bg-[#f4f8f1] px-3 pt-2 sm:px-5"><div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950"><PlaneTakeoff size={20} className="shrink-0"/><div><strong className="block text-sm">Operação em andamento</strong><p className="mt-0.5 text-xs leading-5">Registre área e volume realmente executados. A liberação pré-voo já foi concluída.</p></div></div></section>;

  function solve(){
    if(release.ready)return openField("sarpas");
    if(!next)return void refresh(true);
    if(next.id==="pilot")return void(window.location.href="/apps/dronegestor/gestao");
    if(next.id==="documents"||next.id==="sarpas")return void(window.location.href="/apps/dronegestor/documentos");
    openField(next.nextView||release.nextView||"nova");
  }

  return <section className="bg-[#f4f8f1] px-3 pt-2 sm:px-5"><div className={`mx-auto w-full max-w-3xl rounded-3xl border p-4 shadow-sm ${release.ready?"border-emerald-300 bg-emerald-50":"border-amber-200 bg-white"}`}>
    <div className="flex items-start gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${release.ready?"bg-emerald-600 text-white":"bg-amber-100 text-amber-800"}`}>{loading?<Loader2 size={20} className="animate-spin"/>:release.ready?<PlaneTakeoff size={21}/>:<LockKeyhole size={20}/>}</span><div className="min-w-0 flex-1"><span className={`text-[11px] font-black uppercase tracking-[.12em] ${release.ready?"text-emerald-700":"text-amber-700"}`}>{release.ready?"Pronto para iniciar":"Ainda não liberado"}</span><h2 className="mt-1 text-lg font-black text-[#143d31]">{release.ready?"Tudo conferido para iniciar a operação":next?`Próximo passo: ${next.label}`:"Conferindo a operação..."}</h2><p className="mt-1 text-sm leading-6 text-[#60736a]">{release.ready?"O DroneGestor conferiu piloto, drone, missão, segurança, documentos, SARPAS e GPS. A autorização oficial continua sendo a registrada no SARPAS.":next?.detail||release.error||"Aguarde alguns segundos."}</p></div></div>

    <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Status pré-voo">{release.items.map(item=><div key={item.id} className="grid justify-items-center gap-1"><span className={`grid size-7 place-items-center rounded-full ${item.ok?"bg-emerald-600 text-white":"bg-slate-100 text-slate-400"}`}>{item.ok?<CheckCircle2 size={15}/>:<Circle size={13}/>}</span><span className="max-w-full truncate text-[9px] font-black text-[#60736a]">{item.label}</span></div>)}</div>
    {release.items.length>0&&<div className="mt-3 flex items-center justify-between text-xs font-bold text-[#60736a]"><span>{done} de {release.items.length} conferidos</span><button type="button" onClick={()=>setExpanded(value=>!value)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-black text-[#176a4c]">{expanded?"Ocultar detalhes":"Ver detalhes"}{expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button></div>}

    {expanded&&<div className="mt-3 grid gap-2">{release.items.map(item=><div key={item.id} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${item.ok?"bg-emerald-50 text-emerald-950":"bg-amber-50 text-amber-950"}`}>{item.ok?<CheckCircle2 size={16} className="mt-0.5 shrink-0"/>:<TriangleAlert size={16} className="mt-0.5 shrink-0"/>}<div><strong className="block">{item.label}</strong><span className="mt-0.5 block leading-5">{item.detail}</span></div></div>)}</div>}

    <button type="button" onClick={solve} disabled={loading} className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:opacity-50 ${release.ready?"bg-emerald-700":"bg-amber-700"}`}>{loading?<><Loader2 size={18} className="animate-spin"/>Conferindo...</>:release.ready?<><PlaneTakeoff size={18}/>Ir para iniciar operação</>:<><RefreshCw size={18}/>{next?.id==="pilot"?"Definir piloto responsável":next?.id==="documents"?"Resolver documentos":next?.id==="sarpas"?"Resolver SARPAS":next?.id==="gps"?"Registrar GPS":"Resolver agora"}</>}</button>
    {notice&&<div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-950"><TriangleAlert size={16} className="mt-0.5 shrink-0"/>{notice}</div>}
  </div></section>;
}
