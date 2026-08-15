"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Cloud, FileText, FolderCheck, Loader2, MapPinned, PlaneTakeoff, Printer, RefreshCw, Save, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Mission={ordemServicoId?:string;ordemServicoNumero?:string;clienteNome?:string;fazendaNome?:string;talhaoNome?:string;municipio?:string;uf?:string;cultura?:string;alvo?:string;area?:number;drone?:string;registroAnac?:string;sarpasSituacao?:string;sarpasNumero?:string;responsavelPropriedade?:string;enderecoPropriedade?:string;[key:string]:unknown};
type Doc={id:string;tipo:string;nome:string;url:string};
type Evidence={url?:string}|null;
type Sarpas={status?:string;numero?:string}|null;
type ClosureStatus=""|"pendente_regularizacao"|"pronto"|"concluida"|"cancelada";
type OperationPayload={ok:boolean;state?:Record<string,any>;source?:"finalized"|"live"|"os";pilotName?:string;syncUpdatedAt?:string;canManage?:boolean;os?:{id:string;status:string;numero?:string;fechamentoStatus?:string;pendencias?:string[];responsavelPropriedade?:string;enderecoPropriedade?:string};error?:string};

function readJson<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}}
function localMission():Mission{const current=readJson<Mission>("dronegestor:mission:v2",{});if(current.ordemServicoId)return current;return{...readJson<Mission>("dronegestor:activeMissionContext:v1",{}),...current}}
function ptDate(value:string){if(!value)return"";const d=new Date(value);return Number.isNaN(d.getTime())?"":d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}

export function DroneOperationPackage(){
  const[osId,setOsId]=useState(""),[mission,setMission]=useState<Mission>({}),[snapshot,setSnapshot]=useState<Record<string,any>>({});
  const[docs,setDocs]=useState<Doc[]>([]),[mapa,setMapa]=useState<Evidence>(null),[sarpas,setSarpas]=useState<Sarpas>(null);
  const[loading,setLoading]=useState(true),[checking,setChecking]=useState(false),[savingProperty,setSavingProperty]=useState(false);
  const[serverMissing,setServerMissing]=useState<string[]>([]),[closureStatus,setClosureStatus]=useState<ClosureStatus>(""),[osStatus,setOsStatus]=useState(""),[message,setMessage]=useState(""),[closed,setClosed]=useState(false);
  const[responsavel,setResponsavel]=useState(""),[endereco,setEndereco]=useState(""),[source,setSource]=useState<OperationPayload["source"]>("os"),[pilotName,setPilotName]=useState(""),[syncUpdatedAt,setSyncUpdatedAt]=useState(""),[canManage,setCanManage]=useState(false);

  async function load(targetId:string){
    if(!targetId){setLoading(false);return}
    setLoading(true);setMessage("");
    try{
      const encoded=encodeURIComponent(targetId);
      const[o,d,m,s]=await Promise.all([
        fetch(`/api/dronegestor/operacao-os?osId=${encoded}`,{cache:"no-store"}),
        fetch(`/api/dronegestor/documentos?osId=${encoded}`,{cache:"no-store"}),
        fetch(`/api/dronegestor/mapa?osId=${encoded}`,{cache:"no-store"}),
        fetch(`/api/dronegestor/sarpas?osId=${encoded}`,{cache:"no-store"})
      ]);
      const[op,dp,mp,sp]=await Promise.all([o.json().catch(()=>null),d.json().catch(()=>null),m.json().catch(()=>null),s.json().catch(()=>null)]);
      if(!o.ok||!op?.ok)throw new Error(op?.error||"Não foi possível abrir esta OS.");
      const payload=op as OperationPayload,state=payload.state&&typeof payload.state==="object"?payload.state:{},nextMission=(state.mission&&typeof state.mission==="object"?state.mission:{}) as Mission;
      setSnapshot(state);setMission(nextMission);setSource(payload.source||"os");setPilotName(payload.pilotName||"");setSyncUpdatedAt(payload.syncUpdatedAt||"");setCanManage(payload.canManage===true);
      setOsStatus(payload.os?.status||"");setClosureStatus((payload.os?.fechamentoStatus||"") as ClosureStatus);setClosed(payload.os?.status==="concluida"||payload.os?.fechamentoStatus==="concluida");setServerMissing(Array.isArray(payload.os?.pendencias)?payload.os!.pendencias!:[]);
      const resp=payload.os?.responsavelPropriedade||nextMission.responsavelPropriedade||"",addr=payload.os?.enderecoPropriedade||nextMission.enderecoPropriedade||"";setResponsavel(String(resp));setEndereco(String(addr));
      if(nextMission.ordemServicoId){localStorage.setItem("dronegestor:mission:v2",JSON.stringify(nextMission));localStorage.setItem("dronegestor:activeMissionContext:v1",JSON.stringify(nextMission));}
      if(d.ok)setDocs(dp?.items??[]);if(m.ok)setMapa(mp?.evidence??null);if(s.ok)setSarpas(sp?.sarpas??null);
    }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível abrir os dados da OS.")}
    finally{setLoading(false)}
  }

  useEffect(()=>{const query=new URLSearchParams(window.location.search).get("osId")||"",fallback=localMission().ordemServicoId||"",target=query||fallback;setOsId(target);void load(target)},[]);

  function closurePayload(){return{...snapshot,mission:{...(snapshot.mission??{}),...mission,responsavelPropriedade:responsavel.trim(),enderecoPropriedade:endereco.trim()}}}
  async function closure(action:"status"|"save_pending"|"finalize"){
    if(!osId)return;setChecking(true);setMessage("");
    try{
      const response=await fetch("/api/dronegestor/fechamento",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,osId,snapshot:closurePayload()}),cache:"no-store"});
      const payload=await response.json().catch(()=>null),nextMissing=Array.isArray(payload?.missing)?payload.missing:[];
      setServerMissing(nextMissing);setClosureStatus(String(payload?.status||"") as ClosureStatus);setOsStatus(String(payload?.osStatus||osStatus));
      if(payload?.closed===true||payload?.status==="concluida"){setClosed(true);setClosureStatus("concluida");localStorage.setItem("dronegestor:closureStatus:v1",JSON.stringify("concluida"));localStorage.setItem("dronegestor:missionStatus:v4",JSON.stringify("finalizada"));localStorage.setItem("dronegestor:started:v3",JSON.stringify(false));}
      if(action==="save_pending"&&response.ok)setMessage(nextMissing.length?"Pendências salvas. O campo continua concluído e você pode regularizar depois, de qualquer aparelho.":"Conferência salva. A OS está pronta para encerramento.");
      if(action==="finalize"&&response.ok)setMessage("OS encerrada. O fechamento foi feito com os dados do campo salvos no servidor.");
      if(!response.ok&&payload?.error)setMessage(payload.error);
    }catch{setMessage("Não foi possível conferir o encerramento agora. Nenhuma informação foi apagada.")}
    finally{setChecking(false)}
  }
  useEffect(()=>{if(osId&&!loading)void closure("status")},[osId,loading]);

  async function saveProperty(){
    if(!osId||!responsavel.trim()||!endereco.trim())return;setSavingProperty(true);setMessage("");
    try{
      const response=await fetch("/api/dronegestor/operacao-os",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({osId,responsavelPropriedade:responsavel.trim(),enderecoPropriedade:endereco.trim()})}),payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.ok)throw new Error(payload?.error||"Não foi possível salvar os dados da propriedade.");
      const next={...mission,responsavelPropriedade:responsavel.trim(),enderecoPropriedade:endereco.trim()};setMission(next);localStorage.setItem("dronegestor:mission:v2",JSON.stringify(next));localStorage.setItem("dronegestor:activeMissionContext:v1",JSON.stringify(next));setMessage("Dados da propriedade salvos na OS. Eles ficam disponíveis em qualquer aparelho.");window.setTimeout(()=>void closure("status"),50);
    }catch(error){setMessage(error instanceof Error?error.message:"Falha ao salvar dados da propriedade.")}
    finally{setSavingProperty(false)}
  }

  const pending=useMemo(()=>{const items=[...serverMissing];if(!mission.clienteNome||!mission.fazendaNome||!mission.talhaoNome)items.push("Cliente, fazenda e talhão");if(!mission.municipio||!mission.uf)items.push("Município e UF");if(!mission.drone||!mission.registroAnac)items.push("Drone e identificação ANAC");if(!responsavel.trim())items.push("Responsável/proprietário da propriedade");if(!endereco.trim())items.push("Endereço ou referência cadastral da propriedade");if(!mapa?.url)items.push("Mapa/evidência do voo");const sarpasStatus=sarpas?.status||mission.sarpasSituacao||"";if(sarpasStatus!=="autorizado")items.push("Autorização SARPAS conferida");if(sarpasStatus==="autorizado"&&!(sarpas?.numero||mission.sarpasNumero))items.push("Referência SARPAS registrada");return Array.from(new Set(items))},[mission,mapa,sarpas,serverMissing,responsavel,endereco]);
  const fieldCompleted=["campo_concluido","concluida"].includes(osStatus),ready=fieldCompleted&&closureStatus==="pronto"&&pending.length===0&&!closed,hasServerFieldData=source==="finalized"||source==="live";
  const docsHref=osId?`/apps/dronegestor/documentos?osId=${encodeURIComponent(osId)}`:"/apps/dronegestor/documentos";

  if(loading)return <main className="min-h-screen bg-[#f4f8f1] px-4 py-10 text-[#143d31]"><div className="mx-auto grid min-h-60 max-w-3xl place-items-center rounded-3xl bg-white"><div className="text-center"><Loader2 className="mx-auto animate-spin"/><strong className="mt-3 block">Abrindo dados da OS...</strong><p className="mt-1 text-sm text-slate-500">Buscando a aplicação salva pelo piloto no servidor.</p></div></div></main>;

  return <main className="min-h-screen bg-[#f4f8f1] px-3 pb-28 pt-4 text-[#143d31] sm:px-6 sm:py-8"><div className="mx-auto w-full max-w-5xl">
    <header className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Link href={canManage?"/apps/dronegestor/gestao":"/apps/dronegestor"} className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#d6e5dc] bg-white text-[#276650]"><ArrowLeft size={20}/></Link><div className="min-w-0"><h1 className="text-2xl font-black">Encerrar OS</h1><p className="text-sm text-[#6b7c73]">Campo concluído → regularização → encerramento.</p></div></div><button onClick={()=>window.print()} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#087a55] text-white" aria-label="Imprimir"><Printer size={19}/></button></header>

    {!osId?<section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5"><TriangleAlert className="mr-2 inline" size={18}/><strong>Nenhuma OS foi selecionada.</strong><p className="mt-2 text-sm">Abra o Painel do gestor e toque na OS que deseja regularizar ou encerrar.</p><Link href="/apps/dronegestor/gestao" className="mt-3 inline-flex rounded-xl bg-amber-700 px-4 py-3 font-black text-white no-underline">Abrir Painel do gestor</Link></section>:<>
      <section className={`mt-5 rounded-3xl border p-4 ${hasServerFieldData?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}><div className="flex items-start gap-3"><Cloud className={hasServerFieldData?"text-emerald-700":"text-amber-700"}/><div><strong className="block">{source==="finalized"?"Dados finais do piloto carregados do servidor":source==="live"?"Última sincronização do piloto carregada":"Aguardando dados completos do campo"}</strong><p className="mt-1 text-sm leading-6">{hasServerFieldData?`Você pode regularizar e encerrar esta OS neste aparelho${pilotName?` — operação de ${pilotName}`:""}.`:"A OS existe, mas a cópia completa da aplicação ainda não chegou ao servidor. Não encerre até a sincronização."}</p>{syncUpdatedAt&&<p className="mt-1 text-xs font-bold text-slate-500">Dados recebidos: {ptDate(syncUpdatedAt)}</p>}</div></div></section>
      <section className="mt-4 rounded-3xl bg-[#064e3b] p-5 text-white"><span className="text-xs font-black uppercase tracking-wider text-emerald-200">{mission.ordemServicoNumero||"OS selecionada"}</span><h2 className="mt-2 text-xl font-black">{mission.fazendaNome||"Fazenda"} • {mission.talhaoNome||"Talhão"}</h2><p className="mt-2 text-sm text-emerald-100">{mission.clienteNome||"Cliente"} • {mission.cultura||"—"} • {Number(mission.area)||0} ha</p></section>

      <section className="mt-4 grid gap-2 sm:grid-cols-3"><Stage ok={fieldCompleted||closed} title="1. Campo" detail={closed||fieldCompleted?"Aplicação concluída pelo piloto":"Aguardando conclusão da aplicação"}/><Stage ok={pending.length===0&&fieldCompleted} title="2. Regularização" detail={pending.length===0&&fieldCompleted?"Pacote obrigatório completo":`${pending.length} pendência(s) para conferir`}/><Stage ok={closed} title="3. Encerramento" detail={closed?"OS encerrada":ready?"Pronta para encerrar":"Bloqueado até concluir as etapas anteriores"}/></section>

      <section className="mt-4 rounded-3xl border border-[#d9e8df] bg-white p-5"><strong>Dados complementares da propriedade</strong><p className="mt-1 text-sm text-slate-600">Salvos na própria OS para que gestor e RT vejam em qualquer aparelho.</p>{!canManage&&<p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">O piloto pode consultar estes dados. A regularização e o encerramento são feitos pelo gestor/RT.</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold"><span>Responsável / proprietário *</span><input value={responsavel} disabled={!canManage} onChange={e=>setResponsavel(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3"/></label><label className="grid gap-1 text-sm font-bold"><span>Endereço / referência *</span><input value={endereco} disabled={!canManage} onChange={e=>setEndereco(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3"/></label></div>{canManage&&<button type="button" disabled={!responsavel.trim()||!endereco.trim()||closed||savingProperty} onClick={()=>void saveProperty()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40">{savingProperty?<Loader2 className="animate-spin" size={17}/>:<Save size={17}/>}Salvar na OS</button>}</section>

      <section className={`mt-4 rounded-3xl border p-5 ${closed||ready?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}><div className="flex items-start gap-3">{closed||ready?<CheckCircle2 className="shrink-0 text-emerald-700"/>:<TriangleAlert className="shrink-0 text-amber-700"/>}<div className="min-w-0 flex-1"><strong className="block">{closed?"OS encerrada":ready?"Pronta para encerrar a OS":fieldCompleted?"Campo concluído — regularização pendente":"A aplicação em campo ainda não foi concluída"}</strong><p className="mt-1 text-sm">{closed?"O fechamento definitivo foi realizado após a conferência completa.":ready?"Todos os itens obrigatórios estão completos. O próximo clique encerra definitivamente esta OS.":fieldCompleted?"Complete apenas o que falta abaixo. O piloto não precisa refazer a aplicação.":"O piloto precisa concluir a aplicação antes do encerramento definitivo."}</p></div>{checking&&<Loader2 className="animate-spin" size={18}/>}</div>
        {!closed&&pending.length>0&&<div className="mt-3 grid gap-2">{pending.map(item=><div key={item} className="rounded-xl bg-white px-3 py-2 text-sm font-bold">• {item}</div>)}</div>}
        {!closed&&<div className={`mt-4 grid gap-2 ${canManage?"sm:grid-cols-2":""}`}><button type="button" disabled={checking} onClick={()=>void closure("status")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 disabled:opacity-50"><RefreshCw size={18}/>Rever pendências</button>{canManage&&<button type="button" disabled={checking||(!hasServerFieldData&&ready)} onClick={()=>void closure(ready?"finalize":"save_pending")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:opacity-50 ${ready?"bg-emerald-700":"bg-amber-700"}`}>{ready?<CheckCircle2 size={18}/>:<Save size={18}/>} {ready?"Encerrar OS definitivamente":"Salvar pendências para regularizar"}</button>}</div>}
        {message&&<p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold">{message}</p>}
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Link href={docsHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#087a55] px-4 text-center font-black text-white no-underline"><PlaneTakeoff size={18}/>SARPAS e documentos</Link><Link href={canManage?"/apps/dronegestor/gestao":"/apps/dronegestor/campo"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#c8ddd1] bg-white px-4 text-center font-black text-[#176a4c] no-underline"><MapPinned size={18}/>{canManage?"Voltar ao painel":"Voltar à operação"}</Link><Link href="/apps/dronegestor/relatorio-mensal" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#c8ddd1] bg-white px-4 text-center font-black text-[#176a4c] no-underline"><FileText size={18}/>Relatório MAPA</Link></div>
      <section className="mt-4 rounded-3xl border border-[#d9e8df] bg-white p-5"><div className="flex items-center gap-2"><FolderCheck size={19}/><strong>Arquivos vinculados</strong></div><p className="mt-2 text-sm text-slate-600">{docs.length} documento(s) vinculado(s) a esta OS.</p></section>
    </>}
  </div></main>
}

function Stage({ok,title,detail}:{ok:boolean;title:string;detail:string}){return <div className={`rounded-2xl border p-3 ${ok?"border-emerald-200 bg-emerald-50":"border-slate-200 bg-white"}`}><div className="flex items-center gap-2">{ok?<CheckCircle2 size={17} className="text-emerald-700"/>:<TriangleAlert size={17} className="text-amber-600"/>}<strong className="text-sm">{title}</strong></div><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p></div>}
