"use client";

import { AlertTriangle, Check, Clock3, CloudOff, CloudUpload, Droplets, MapPinned, Pause, Play, RotateCcw, Send, ShieldCheck, UserRound, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { snapshotDroneLocalState } from "./DronePersistenceSync";

type Product={id?:string;nome:string;dose:number;unidade:string};
type Mission={
  ordemServicoId?:string;ordemServicoNumero?:string;clienteNome?:string;fazendaNome?:string;talhaoNome?:string;
  cultura?:string;alvo?:string;tipoAtividade?:string;area:number;drone?:string;registroAnac?:string;
  volume:number;tanque:number;produtos:Product[];
};
type TankRecord={id:string;at:string;areaHa:number;volumeL:number;note?:string};
type Occurrence={id:string;at:string;text:string;categoria?:string;observacao?:string;latitude?:number|null;longitude?:number|null};
type PendingFinalization={operationId:string;pilotName:string;state:Record<string,unknown>;requestedAt:string;ordemServicoId?:string};
type Weather={latitude?:number;longitude?:number;capturedAt?:string};

const K={
  mission:"dronegestor:mission:v2",progress:"dronegestor:progress:v2",tanks:"dronegestor:tankRecords:v4",
  occurrences:"dronegestor:occurrences:v2",started:"dronegestor:started:v3",paused:"dronegestor:paused:v3",
  status:"dronegestor:missionStatus:v4",startedAt:"dronegestor:startedAt:v4",endedAt:"dronegestor:endedAt:v4",
  view:"dronegestor:view:v3",operationId:"dronegestor:operationId:v3",lastFinalized:"dronegestor:lastFinalizedOperationId:v3",
  queue:"dronegestor:finalizationQueue:v4",weather:"dronegestor:weather",calibration:"dronegestor:calibration:v2",
  checklist:"dronegestor:checklist:v2",insight:"dronegestor:insightAccepted:v2",risk:"dronegestor:riskAccepted:v2"
} as const;
const occurrenceTypes=["Clima mudou","Falha no drone","Bateria","Vazamento","Obstáculo","Risco de deriva","Acidente / queda","Outro"];

function read<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}}
function write(key:string,value:unknown){localStorage.setItem(key,JSON.stringify(value))}
function n(v:unknown){const x=Number(v);return Number.isFinite(x)?x:0}
function round(v:number,d=2){const f=10**d;return Math.round(v*f)/f}
function fmt(v:number,d=1){return new Intl.NumberFormat("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number.isFinite(v)?v:0)}
function id(prefix:string){return typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`}
function amount(product:Product,area:number,volumeL:number){const dose=n(product.dose);let value=0,unit="";if(product.unidade==="mL/ha"){value=area*dose;unit="mL"}else if(product.unidade==="L/ha"){value=area*dose;unit="L"}else if(product.unidade==="g/ha"){value=area*dose;unit="g"}else if(product.unidade==="kg/ha"){value=area*dose;unit="kg"}else if(product.unidade==="mL/100L"){value=volumeL/100*dose;unit="mL"}else if(product.unidade==="g/100L"){value=volumeL/100*dose;unit="g"}if(unit==="mL"&&value>=1000)return{value:value/1000,unit:"L"};if(unit==="g"&&value>=1000)return{value:value/1000,unit:"kg"};return{value,unit}}
function clock(iso:string){if(!iso)return"—";const d=new Date(iso);return Number.isNaN(d.getTime())?"—":d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
function elapsed(start:string,now:number){const ms=Math.max(0,now-Date.parse(start||""));if(!Number.isFinite(ms))return"—";const total=Math.floor(ms/60000);return`${Math.floor(total/60)}h ${String(total%60).padStart(2,"0")}min`}

export function DroneGuidedFieldMode({pilotName}:{pilotName:string}){
  const[active,setActive]=useState(false),[mission,setMission]=useState<Mission|null>(null),[progress,setProgress]=useState(0),[tanks,setTanks]=useState<TankRecord[]>([]),[occurrences,setOccurrences]=useState<Occurrence[]>([]),[paused,setPaused]=useState(false),[startedAt,setStartedAt]=useState(""),[online,setOnline]=useState(true),[now,setNow]=useState(()=>Date.now());
  const[areaInput,setAreaInput]=useState(""),[volumeInput,setVolumeInput]=useState(""),[notice,setNotice]=useState(""),[occOpen,setOccOpen]=useState(false),[occType,setOccType]=useState(occurrenceTypes[0]),[occNote,setOccNote]=useState(""),[finishing,setFinishing]=useState(false);

  useEffect(()=>{
    const refresh=()=>{
      const view=localStorage.getItem(K.view)||"";const started=Boolean(read(K.started,false));
      const should=view==="execucao"&&started;
      setActive(should);
      if(!should)return;
      setMission(read<Mission|null>(K.mission,null));setProgress(n(read(K.progress,0)));setTanks(read<TankRecord[]>(K.tanks,[]));setOccurrences(read<Occurrence[]>(K.occurrences,[]));setPaused(Boolean(read(K.paused,false)));setStartedAt(read(K.startedAt,""));
    };
    const connectivity=()=>setOnline(navigator.onLine);
    refresh();connectivity();
    const timer=window.setInterval(refresh,700),clockTimer=window.setInterval(()=>setNow(Date.now()),30000);
    window.addEventListener("online",connectivity);window.addEventListener("offline",connectivity);window.addEventListener("pageshow",refresh);
    return()=>{window.clearInterval(timer);window.clearInterval(clockTimer);window.removeEventListener("online",connectivity);window.removeEventListener("offline",connectivity);window.removeEventListener("pageshow",refresh)};
  },[]);

  useEffect(()=>{
    if(!active)return;
    const persist=()=>{write(K.progress,progress);write(K.tanks,tanks);write(K.occurrences,occurrences);write(K.paused,paused);write(K.status,paused?"pausada":"em_execucao")};
    persist();const timer=window.setInterval(persist,900);return()=>window.clearInterval(timer);
  },[active,progress,tanks,occurrences,paused]);

  const totalArea=Math.max(0,n(mission?.area)),remaining=Math.max(0,totalArea-progress),areaDone=totalArea>0&&progress>=totalArea-.01;
  const actualVolume=useMemo(()=>tanks.reduce((s,r)=>s+n(r.volumeL),0),[tanks]);
  const nextLoad=useMemo(()=>{
    const rate=Math.max(0,n(mission?.volume)),capacity=Math.max(0,n(mission?.tanque));if(!rate||!capacity||!remaining)return{volume:0,area:0,products:[] as Array<{product:Product;result:{value:number;unit:string};formula:string}>};
    const volume=Math.min(capacity,remaining*rate),area=volume/rate;
    const products=(mission?.produtos||[]).filter(p=>p.nome&&n(p.dose)>0).map(product=>{const result=amount(product,area,volume);const formula=product.unidade.includes("/100L")?`${fmt(n(product.dose),3)} × (${fmt(volume,1)} ÷ 100) = ${fmt(result.value,3)} ${result.unit}`:`${fmt(n(product.dose),3)} × ${fmt(area,2)} = ${fmt(result.value,3)} ${result.unit}`;return{product,result,formula}});
    return{volume,area,products};
  },[mission,remaining]);

  function flash(text:string){setNotice(text);window.setTimeout(()=>setNotice(""),4500)}
  function fillNext(){if(!nextLoad.area)return;setAreaInput(String(round(nextLoad.area,3)));setVolumeInput(String(round(nextLoad.volume,2)));flash("Valores calculados preenchidos. Ajuste se o realizado for diferente.")}
  function registerLoad(){if(paused)return flash("Retome a aplicação antes de registrar a carga.");const area=n(areaInput),volume=n(volumeInput);if(area<=0||volume<=0)return flash("Informe a área e o volume realmente aplicados nesta carga.");if(area>remaining+.01)return flash(`A área informada ultrapassa os ${fmt(remaining,2)} ha restantes.`);if(n(mission?.tanque)>0&&volume>n(mission?.tanque)+.01)return flash("O volume ultrapassa a capacidade cadastrada do tanque. Confira antes de salvar.");const rec:TankRecord={id:id("tanque"),at:new Date().toISOString(),areaHa:round(area,3),volumeL:round(volume,2)};const next=[...tanks,rec],nextProgress=round(Math.min(totalArea,progress+area),3);setTanks(next);setProgress(nextProgress);write(K.tanks,next);write(K.progress,nextProgress);setAreaInput("");setVolumeInput("");flash(nextProgress>=totalArea-.01?"Área planejada atingida. Confira o resumo e conclua a aplicação em campo.":"Carga registrada. O próximo cálculo já foi atualizado.")}
  function undo(){if(paused||!tanks.length)return;const last=tanks[tanks.length-1];if(!window.confirm(`Desfazer a última carga de ${fmt(last.areaHa,2)} ha / ${fmt(last.volumeL,1)} L?`))return;const next=tanks.slice(0,-1),nextProgress=round(Math.max(0,progress-last.areaHa),3);setTanks(next);setProgress(nextProgress);write(K.tanks,next);write(K.progress,nextProgress)}
  function togglePause(){const next=!paused;setPaused(next);write(K.paused,next);write(K.status,next?"pausada":"em_execucao");flash(next?"Aplicação pausada. Os dados continuam salvos neste aparelho.":"Aplicação retomada.")}
  function saveOccurrence(){const note=occNote.trim(),weather=read<Weather>(K.weather,{});const text=`${occType}${note?`: ${note}`:""}`;const item:Occurrence={id:id("oc"),at:new Date().toISOString(),text,categoria:occType,observacao:note,latitude:Number.isFinite(Number(weather.latitude))?Number(weather.latitude):null,longitude:Number.isFinite(Number(weather.longitude))?Number(weather.longitude):null};const next=[...occurrences,item];setOccurrences(next);write(K.occurrences,next);setOccOpen(false);setOccNote("");flash("Ocorrência registrada com horário e localização disponível.")}
  function openMap(){const button=document.querySelector('button[aria-label="Registrar mapa usado no voo"]') as HTMLButtonElement|null;if(button){button.click();return}flash("Abra o botão “Mapa do voo” na tela de Campo para anexar a evidência desta OS.")}
  function leaveField(){write(K.view,"inicio");window.location.reload()}

  async function sendFinalization(payload:PendingFinalization){const response=await fetch("/api/dronegestor/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state:payload.state,operationId:payload.operationId,pilotName:payload.pilotName}),cache:"no-store",keepalive:true});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error||"Não foi possível registrar a aplicação.");if(payload.ordemServicoId&&data?.osConcluida!==true)throw new Error("A aplicação foi salva, mas a OS ainda não confirmou a conclusão em campo.");return data}
  function buildFinalState(end:string){const currentMission=read<Record<string,unknown>>(K.mission,{}),state=snapshotDroneLocalState({mission:currentMission,progressHa:progress,tankRecords:tanks,insightAccepted:Boolean(read(K.insight,false)),riskAccepted:Boolean(read(K.risk,false)),calibration:read(K.calibration,{}),checklist:read(K.checklist,{}),occurrences,weather:read(K.weather,{}),operationStarted:false,paused:false,missionStatus:"pendente_sync",startedAt,endedAt:end} as any) as Record<string,unknown>;state.concluida=true;state.concluidaNoDispositivoEm=end;return state}
  async function finish(){if(finishing||!areaDone)return flash("Conclua 100% da área real antes de finalizar o campo.");if(!window.confirm(`Concluir a aplicação em campo com ${fmt(progress,2)} ha e ${tanks.length} carga(s) registradas?`))return;setFinishing(true);const end=new Date().toISOString(),operationId=localStorage.getItem(K.operationId)||id("op");localStorage.setItem(K.operationId,operationId);const state=buildFinalState(end);state.operationId=operationId;const payload:PendingFinalization={operationId,pilotName,state,requestedAt:end,ordemServicoId:mission?.ordemServicoId};write(K.endedAt,end);
    if(!navigator.onLine){const queue=read<PendingFinalization[]>(K.queue,[]);if(!queue.some(i=>i.operationId===operationId))write(K.queue,[...queue,payload]);write(K.started,false);write(K.paused,false);write(K.status,"pendente_sync");write(K.view,"relatorios");setFinishing(false);flash("Sem internet: a conclusão ficou protegida neste aparelho e será enviada quando o sinal voltar.");window.setTimeout(()=>window.location.reload(),1300);return}
    try{await sendFinalization(payload);localStorage.setItem(K.lastFinalized,operationId);write(K.started,false);write(K.paused,false);write(K.status,"finalizada");write(K.view,"relatorios");window.location.href="/apps/dronegestor/pacote-operacao"}catch(error){const queue=read<PendingFinalization[]>(K.queue,[]);if(!queue.some(i=>i.operationId===operationId))write(K.queue,[...queue,payload]);write(K.started,false);write(K.paused,false);write(K.status,"pendente_sync");write(K.view,"relatorios");setFinishing(false);flash(error instanceof Error?`${error.message} A conclusão ficou protegida para nova tentativa.`:"Conclusão protegida para sincronização.");window.setTimeout(()=>window.location.reload(),1600)}
  }

  if(!active||!mission)return null;
  const pct=totalArea>0?Math.min(100,progress/totalArea*100):0;
  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#f4f8f1] text-slate-950">
    <div className="mx-auto min-h-screen w-full max-w-2xl pb-28">
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${paused?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{paused?<Pause size={21}/>:<Play size={21}/>}</span><div className="min-w-0 flex-1"><span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Modo Campo • {mission.ordemServicoNumero||"OS ativa"}</span><h1 className="truncate text-lg font-black">{paused?"Aplicação pausada":"Aplicação em andamento"}</h1></div><button onClick={leaveField} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600">Sair da tela</button></div>
      </header>

      <div className="grid gap-4 p-3 sm:p-5">
        <div className={`flex items-start gap-3 rounded-2xl border p-3 ${online?"border-emerald-200 bg-emerald-50 text-emerald-950":"border-amber-300 bg-amber-50 text-amber-950"}`}>{online?<Wifi className="mt-0.5 shrink-0" size={18}/>:<CloudOff className="mt-0.5 shrink-0" size={18}/>}<div><strong className="text-sm">{online?"Conectado • dados salvos neste aparelho":"Sem internet • continue trabalhando"}</strong><p className="mt-0.5 text-xs leading-5">{online?"O DroneGestor mantém uma cópia local durante a aplicação.":"Área, cargas e ocorrências continuam sendo salvas no celular. A sincronização volta automaticamente quando houver sinal."}</p></div></div>

        <section className="rounded-[28px] bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white shadow-lg">
          <div className="grid gap-3 sm:grid-cols-2"><div><span className="text-xs font-bold text-emerald-200">Piloto</span><strong className="mt-1 flex items-center gap-2 text-lg"><UserRound size={18}/>{pilotName}</strong></div><div><span className="text-xs font-bold text-emerald-200">Drone</span><strong className="mt-1 block text-lg">{mission.drone||"—"}</strong></div><div><span className="text-xs font-bold text-emerald-200">Área</span><strong className="mt-1 block">{[mission.fazendaNome,mission.talhaoNome].filter(Boolean).join(" • ")||"Talhão da OS"}</strong></div><div><span className="text-xs font-bold text-emerald-200">Início / tempo</span><strong className="mt-1 flex items-center gap-2"><Clock3 size={17}/>{clock(startedAt)} • {elapsed(startedAt,now)}</strong></div></div>
          <div className="mt-5 flex items-end justify-between gap-3"><div><span className="text-xs font-bold text-emerald-200">Progresso real</span><strong className="mt-1 block text-5xl">{fmt(pct,0)}%</strong></div><div className="text-right"><span className="text-xs text-emerald-200">Área restante</span><strong className="block text-xl">{fmt(remaining,2)} ha</strong></div></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all" style={{width:`${pct}%`}}/></div><p className="mt-2 text-sm text-emerald-100">{fmt(progress,2)} de {fmt(totalArea,2)} ha • {tanks.length} carga(s) • {fmt(actualVolume,1)} L registrados</p>
        </section>

        {!areaDone&&<section className="rounded-[26px] border border-sky-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-800"><Droplets size={21}/></span><div><strong className="block text-base font-black">Próxima carga</strong><p className="mt-1 text-sm leading-5 text-slate-600">O sistema calcula. Você confere antes de preparar e registra o que realmente foi aplicado ao terminar a carga.</p></div></div>
          <div className="mt-4 rounded-2xl bg-sky-50 p-4"><div className="grid grid-cols-2 gap-3"><div><span className="text-xs text-slate-500">Misturador (M)</span><strong className="block text-xl">{fmt(nextLoad.volume,1)} L</strong></div><div><span className="text-xs text-slate-500">Vazão (V)</span><strong className="block text-xl">{fmt(n(mission.volume),1)} L/ha</strong></div></div><div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-black text-sky-950">M ÷ V = {fmt(nextLoad.volume,1)} ÷ {fmt(n(mission.volume),1)} = {fmt(nextLoad.area,2)} ha</div></div>
          <div className="mt-3 grid gap-2">{nextLoad.products.map(({product,result,formula})=><div key={`${product.nome}-${product.unidade}`} className="rounded-xl border border-slate-200 p-3"><span className="text-xs font-bold text-slate-500">Produto</span><strong className="block">{product.nome}</strong><p className="mt-1 text-sm font-black text-emerald-800">{formula}</p><small className="text-slate-500">Quantidade calculada: {fmt(result.value,3)} {result.unit}</small></div>)}</div>
          <button type="button" onClick={fillNext} disabled={paused} className="mt-3 min-h-12 w-full rounded-xl bg-sky-700 px-4 font-black text-white disabled:opacity-40">Usar valores desta carga</button>
          <div className="mt-4 border-t border-slate-100 pt-4"><strong className="text-sm">Ao terminar esta carga, confirme o realizado</strong><div className="mt-2 grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs font-black text-slate-600">Área real (ha)<input value={areaInput} onChange={e=>setAreaInput(e.target.value)} disabled={paused} type="number" step="any" className="min-h-12 rounded-xl border border-slate-200 px-3 text-base"/></label><label className="grid gap-1 text-xs font-black text-slate-600">Volume usado (L)<input value={volumeInput} onChange={e=>setVolumeInput(e.target.value)} disabled={paused} type="number" step="any" className="min-h-12 rounded-xl border border-slate-200 px-3 text-base"/></label></div><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={registerLoad} disabled={paused} className="min-h-12 rounded-xl bg-emerald-700 px-3 font-black text-white disabled:opacity-40"><Check className="mr-1 inline" size={18}/>Confirmar carga</button><button onClick={undo} disabled={paused||!tanks.length} className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 font-black text-slate-700 disabled:opacity-40"><RotateCcw className="mr-1 inline" size={18}/>Desfazer última</button></div></div>
        </section>}

        {!areaDone&&<section className="grid grid-cols-2 gap-3"><button onClick={togglePause} className={`min-h-16 rounded-2xl border px-3 font-black ${paused?"border-emerald-200 bg-emerald-50 text-emerald-900":"border-slate-200 bg-white text-slate-800"}`}>{paused?<><Play className="mr-2 inline"/>Retomar</>:<><Pause className="mr-2 inline"/>Pausar</>}</button><button onClick={()=>setOccOpen(true)} className="min-h-16 rounded-2xl border border-amber-200 bg-amber-50 px-3 font-black text-amber-950"><AlertTriangle className="mr-2 inline"/>Ocorrência</button></section>}

        {occurrences.length>0&&<section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><strong>Ocorrências</strong><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-900">{occurrences.length}</span></div><div className="mt-3 grid gap-2">{occurrences.slice(-3).reverse().map(item=><div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><strong>{item.categoria||item.text}</strong><span className="ml-2 text-xs text-slate-500">{clock(item.at)}</span>{item.observacao&&<p className="mt-1 text-slate-600">{item.observacao}</p>}</div>)}</div></section>}

        {areaDone&&<section className="rounded-[28px] border-2 border-emerald-300 bg-emerald-50 p-5"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-emerald-700" size={26}/><div><span className="text-xs font-black uppercase tracking-wider text-emerald-700">Aplicação em campo concluída</span><h2 className="mt-1 text-xl font-black text-emerald-950">Confira antes de concluir</h2></div></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><Summary label="Área prevista" value={`${fmt(totalArea,2)} ha`}/><Summary label="Área realizada" value={`${fmt(progress,2)} ha`}/><Summary label="Cargas" value={String(tanks.length)}/><Summary label="Ocorrências" value={String(occurrences.length)}/><Summary label="Início" value={clock(startedAt)}/><Summary label="Duração" value={elapsed(startedAt,now)}/></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={openMap} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 font-black text-emerald-800"><MapPinned size={19}/>Registrar mapa usado no voo</button><button onClick={()=>void finish()} disabled={finishing} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white disabled:opacity-50">{finishing?<CloudUpload className="animate-pulse" size={19}/>:<Send size={19}/>}Concluir aplicação em campo</button></div><p className="mt-3 text-xs leading-5 text-emerald-900/75">Depois da conclusão, a OS segue para regularização e encerramento do pacote. O piloto não precisa refazer a aplicação se faltar algum documento.</p></section>}

        {notice&&<div className="fixed bottom-4 left-3 right-3 z-[130] mx-auto max-w-lg rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl">{notice}</div>}
      </div>
    </div>

    {occOpen&&<div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-2 sm:items-center"><section className="w-full max-w-lg rounded-[26px] bg-white p-4 shadow-2xl"><h2 className="text-lg font-black">O que aconteceu?</h2><p className="mt-1 text-sm text-slate-600">Escolha uma opção. O sistema registra horário e a localização disponível.</p><div className="mt-3 grid grid-cols-2 gap-2">{occurrenceTypes.map(type=><button key={type} onClick={()=>setOccType(type)} className={`min-h-12 rounded-xl border px-2 text-sm font-black ${occType===type?"border-amber-400 bg-amber-50 text-amber-950":"border-slate-200 bg-white text-slate-700"}`}>{type}</button>)}</div><label className="mt-3 grid gap-1 text-sm font-black text-slate-700">Observação opcional<textarea value={occNote} onChange={e=>setOccNote(e.target.value)} rows={3} className="rounded-xl border border-slate-200 p-3 font-normal" placeholder="Ex.: vento aumentou e a aplicação foi pausada."/></label><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setOccOpen(false)} className="min-h-12 rounded-xl border border-slate-200 bg-white font-black text-slate-700">Cancelar</button><button onClick={saveOccurrence} className="min-h-12 rounded-xl bg-amber-700 font-black text-white">Registrar ocorrência</button></div></section></div>}
  </div>
}

function Summary({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-white/80 p-3"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block text-base text-slate-950">{value}</strong></div>}
