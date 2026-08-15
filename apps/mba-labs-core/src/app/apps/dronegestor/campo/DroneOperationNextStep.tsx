"use client";

import { CheckCircle2, ChevronRight, ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type State = {
  osId:string;
  osNumero:string;
  label:string;
  phase:number;
  ready:boolean;
  final:boolean;
};

const MISSION_KEY="dronegestor:mission:v2";
function readJson<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}}
function positive(value:unknown){const n=Number(value);return Number.isFinite(n)&&n>0}
function allTrue(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))return false;const values=Object.values(value as Record<string,unknown>);return values.length>0&&values.every(item=>item===true)}

function readState():State{
  if(typeof window==="undefined")return{osId:"",osNumero:"",label:"",phase:1,ready:false,final:false};
  const m=readJson<Record<string,any>>(MISSION_KEY,{}),settings=readJson<Record<string,any>>("dronegestor:settings:v2",{}),weather=readJson<Record<string,any>>("dronegestor:weather",{}),calibration=readJson("dronegestor:calibration:v2",{}),checklist=readJson("dronegestor:checklist:v2",{}),status=String(readJson("dronegestor:missionStatus:v4","rascunho")||"rascunho"),started=Boolean(readJson("dronegestor:started:v3",false)),progress=Number(readJson("dronegestor:progress:v2",0))||0;
  const products=Array.isArray(m.produtos)?m.produtos:[];
  const missionReady=Boolean(String(m.cultura||"").trim()&&String(m.alvo||"").trim()&&String(m.tipoAtividade||"").trim()&&String(m.drone||"").trim()&&String(m.registroAnac||m.identificacaoAnac||"").trim()&&String(m.pontaModelo||m.pontaPulverizacao||"").trim()&&[m.area,m.volume,m.tanque,m.faixa,m.velocidadeKmh,m.alturaM].every(positive)&&products.length&&products.every((p:any)=>String(p?.nome||"").trim()&&positive(p?.dose)&&String(p?.unidade||"").trim()));
  const insight=Boolean(readJson("dronegestor:insightAccepted:v2",false));
  const risk=Boolean(readJson("dronegestor:riskAccepted:v2",false));
  const climate=Boolean(m.climaCampoConfirmado&&m.climaCampoMedidoEm&&String(m.direcaoVentoCampo||"").trim()&&Number.isFinite(Number(m.ventoCampoKmh))&&Number.isFinite(Number(m.temperaturaCampo))&&Number(m.umidadeCampo)>0&&Number(m.umidadeCampo)<=100);
  const sensitive=Boolean(m.semAreaSensivel===true||positive(m.distanciaSensivel));
  const marginBlocked=Boolean(settings.bloquearMargemPreventiva!==false&&m.semAreaSensivel!==true&&positive(m.distanciaSensivel)&&Number(m.distanciaSensivel)<Number(settings.margemPreventiva||90));
  const safety=Boolean(climate&&sensitive&&!marginBlocked&&(settings.insightsObrigatorios===false||insight)&&(settings.exigirConfirmacao===false||risk));
  const equipment=allTrue(calibration)&&allTrue(checklist);
  const gps=Number.isFinite(Number(weather.latitude))&&Number.isFinite(Number(weather.longitude));
  const release=Boolean(m.sarpasConfirmado===true&&m.sarpasSituacao==="autorizado"&&String(m.sarpasNumero||"").trim()&&gps);
  const final=["finalizada","pendente_sync"].includes(status);
  if(final)return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Conferir o pacote e encerrar a OS",phase:6,ready:true,final:true};
  if(!missionReady)return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Complete os dados da aplicação",phase:1,ready:false,final:false};
  if(!insight&&settings.insightsObrigatorios!==false)return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Confira o cálculo e a orientação técnica",phase:2,ready:false,final:false};
  if(!safety)return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Registre segurança, clima e risco",phase:3,ready:false,final:false};
  if(!equipment)return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Calibre e complete o checklist",phase:4,ready:false,final:false};
  if(!release)return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Conclua a autorização SARPAS e o GPS",phase:5,ready:false,final:false};
  if(!started)return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Tudo conferido: iniciar aplicação",phase:5,ready:true,final:false};
  if(progress<Number(m.area||0)-0.01)return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Registre área e volume executados",phase:6,ready:true,final:false};
  return{osId:String(m.ordemServicoId||""),osNumero:String(m.ordemServicoNumero||""),label:"Concluir aplicação em campo",phase:6,ready:true,final:false};
}

export function DroneOperationNextStep(){
  const[state,setState]=useState<State>({osId:"",osNumero:"",label:"",phase:1,ready:false,final:false});
  useEffect(()=>{const refresh=()=>setState(readState());refresh();const timer=window.setInterval(refresh,650);window.addEventListener("storage",refresh);window.addEventListener("dronegestor:sarpas-updated",refresh);return()=>{window.clearInterval(timer);window.removeEventListener("storage",refresh);window.removeEventListener("dronegestor:sarpas-updated",refresh)}},[]);
  const pct=useMemo(()=>Math.round(state.phase/6*100),[state.phase]);
  if(!state.osId)return null;
  return <section className="bg-[#f4f8f1] px-3 pt-2 sm:px-5"><div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#d7e6dc] bg-white px-3 py-3 shadow-sm">
    <div className="flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${state.final?"bg-amber-100 text-amber-700":state.ready?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-600"}`}>{state.final?<CheckCircle2 size={18}/>:<ClipboardList size={17}/>}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-black uppercase tracking-wide text-[#687970]">{state.osNumero||"OS ativa"} • fase {state.phase}/6</span><span className="text-[11px] font-black text-[#087a55]">{pct}%</span></div><strong className="mt-0.5 block text-[13px] leading-5 text-[#143d31]">Próximo passo: {state.label}</strong></div><ChevronRight size={17} className="shrink-0 text-[#7b9489]"/></div>
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#edf3ef]"><div className="h-full rounded-full bg-[#42b77d] transition-all" style={{width:`${pct}%`}}/></div>
  </div></section>;
}
