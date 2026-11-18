"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, ExternalLink, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

type State="pendente"|"andamento"|"concluido"|"nao_aplica";
type TaskState={status:State;validade:string;numero:string;justificativa:string};
type Diagnostic={tipo:string;uf:string;modo:string;documento:string;quantidadeDrones:number;checklist:Record<string,TaskState>};
type Task={id:string;name:string;owner:string;link:string;description:string;conditional?:boolean};
const TASKS:Task[]=[
 {id:"anac",name:"Cadastro da aeronave / SISANT",owner:"Proprietário / gestor",link:"https://sistemas.anac.gov.br/sisant",description:"Cadastre a aeronave aplicável e mantenha certificado válido"},
 {id:"anatel",name:"Homologação ANATEL",owner:"Proprietário / gestor",link:"https://www.gov.br/anatel/pt-br/assuntos/certificacao-de-produtos",description:"Confira se o equipamento e os rádios já possuem homologação"},
 {id:"decea",name:"Acesso ao espaço aéreo / SARPAS",owner:"Piloto e gestor",link:"https://sarpas.decea.mil.br/",description:"Documente cadastro e solicite acesso para cada operação quando requerido"},
 {id:"mapa",name:"Registro do operador / SIPEAGRO",owner:"Administrador",link:"https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/registro",description:"Regularize a atividade aeroagrícola conforme o tipo do operador"},
 {id:"caar",name:"Qualificação CAAR",owner:"Piloto / aplicador",link:"https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola",description:"Verifique a habilitação e os certificados dos profissionais"},
 {id:"crea",name:"Responsável técnico / CREA / ART",owner:"Responsável técnico",link:"https://www.confea.org.br/",description:"Verifique vínculo, ART e registro, conforme perfil da empresa",conditional:true},
 {id:"ibama",name:"CTF/APP e obrigações ambientais",owner:"Administrador / responsável ambiental",link:"https://www.gov.br/ibama/pt-br/servicos/cadastros/ctf/ctf-app",description:"Analise se a atividade está enquadrada e se o cadastro é exigível",conditional:true},
 {id:"estadual",name:"Cadastro/obrigações do Estado",owner:"Administrador / RT",link:"https://www.to.gov.br/adapec",description:"Confirme exigências do órgão estadual conforme UF e atividade",conditional:true},
 {id:"relatorio",name:"Relatório mensal MAPA / SEI",owner:"Gestor / RT",link:"https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/relatorios-mensais/relatorios-mensais",description:"Consolide as operações validadas no modelo oficial de 2026"}
];
const TYPES=[["produtor_rural","Produtor rural"],["prestador_servicos","Prestador de serviços"],["usina","Usina"],["cooperativa","Cooperativa"]];
const STATUSES:[State,string][]=[["pendente","A fazer"],["andamento","Em andamento"],["concluido","Regularizado (conferir validade)"],["nao_aplica","Não se aplica (justificar)"]];
const UFS="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
function empty():Diagnostic{return {tipo:"prestador_servicos",uf:"TO",modo:"equipe",documento:"",quantidadeDrones:1,checklist:{}}}
function dateStatus(value:string){if(!value)return null;const days=Math.ceil((Date.parse(value+"T12:00:00")-Date.now())/86400000);return days<0?"Vencido":days<=30?"Vence em até 30 dias":null}
function taskItem(d:Diagnostic,id:string):TaskState{return d.checklist[id]??{status:"pendente",validade:"",numero:"",justificativa:""}}
export function AgroDocDiagnostic(){
 const [data,setData]=useState<Diagnostic>(empty),[canManage,setCanManage]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const [tab,setTab]=useState<"perfil"|"regularizacao">("perfil");
 const pending=useMemo(()=>TASKS.filter(x=>taskItem(data,x.id).status!=="concluido"&&taskItem(data,x.id).status!=="nao_aplica").length,[data]);
 useEffect(()=>{void(async()=>{try{const r=await fetch("/api/dronegestor/diagnostico",{cache:"no-store"}),j=await r.json().catch(()=>null);if(!r.ok)throw new Error(j?.error||"Falha ao carregar");setCanManage(Boolean(j?.canManage));if(j?.diagnostico)setData({...empty(),...j.diagnostico,checklist:j.diagnostico.checklist||{}})}catch(e){setMessage(e instanceof Error?e.message:"Erro ao carregar")}finally{setLoading(false)}})()},[]);
 async function save(){setSaving(true);setMessage("");try{const r=await fetch("/api/dronegestor/diagnostico",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),j=await r.json().catch(()=>null);if(!r.ok)throw new Error(j?.error||"Erro ao salvar");setMessage("Diagnóstico e pendências atualizados no histórico da empresa.")}catch(e){setMessage(e instanceof Error?e.message:"Não foi possível salvar")}finally{setSaving(false)}}
 function setTask(id:string,patch:Partial<TaskState>){setData(d=>({...d,checklist:{...d.checklist,[id]:{...taskItem(d,id),...patch}}}))}
 return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 sm:px-6 sm:py-9">
  <div className="mx-auto max-w-5xl">
   <header className="flex items-start gap-3"><Link href="/apps/dronegestor" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white"><ArrowLeft size={20}/></Link><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">MBA AgroDoc · Controle contínuo</p><h1 className="text-2xl font-black sm:text-3xl">Diagnóstico e regularização</h1><p className="mt-1 text-sm leading-6 text-slate-600">Identifique seu enquadramento, organize registros e saiba quem deve agir em cada pendência.</p></div></header>
   <section className="mt-5 grid gap-3 sm:grid-cols-3">
     {[[String(TASKS.length),"Obrigações para conferir"],[String(pending),"Pendentes ou em andamento"],[String(TASKS.length-pending),"Concluídas ou justificadas"]].map(([n,l])=><div key={l} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-2xl font-black text-emerald-900">{n}</div><p className="text-xs text-slate-600">{l}</p></div>)}
   </section>
   <div className="mt-4 flex gap-2"><button onClick={()=>setTab("perfil")} className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-black ${tab==="perfil"?"bg-emerald-700 text-white":"border border-slate-300 bg-white text-slate-800"}`}>1. Tipo de operação</button><button onClick={()=>setTab("regularizacao")} className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-black ${tab==="regularizacao"?"bg-emerald-700 text-white":"border border-slate-300 bg-white text-slate-800"}`}>2. Pendências e documentos</button></div>
   {loading?<p className="p-8 text-center">Carregando...</p>:tab==="perfil"?<section className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
      <label className="text-sm font-bold">Perfil do operador<select disabled={!canManage} value={data.tipo} onChange={e=>setData({...data,tipo:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">{TYPES.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
      <label className="text-sm font-bold">UF principal<select disabled={!canManage} value={data.uf} onChange={e=>setData({...data,uf:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">{UFS.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label className="text-sm font-bold">CPF/CNPJ da operação<input disabled={!canManage} value={data.documento} onChange={e=>setData({...data,documento:e.target.value})} placeholder="Somente números" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"/></label>
      <label className="text-sm font-bold">Quantidade de drones<input disabled={!canManage} type="number" min={0} max={999} value={data.quantidadeDrones} onChange={e=>setData({...data,quantidadeDrones:Number(e.target.value)})} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"/></label>
      <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><TriangleAlert className="mr-1 inline" size={15}/> A categoria define quais exigências analisar, mas não dispensa automaticamente registros. A aplicabilidade deve ser conferida nas normas e documentos da operação.</div>
      <button onClick={()=>setTab("regularizacao")} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white sm:col-span-2">Continuar para regularizações</button>
   </section>:<div className="mt-4 grid gap-3">
     {TASKS.map(task=>{const current=taskItem(data,task.id),warning=dateStatus(current.validade);return <section key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
       <div className="flex flex-wrap items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><ShieldCheck size={20}/></span><div className="min-w-0 flex-1"><h2 className="text-base font-black">{task.name}</h2><p className="mt-1 text-xs text-slate-600">{task.description}</p><p className="mt-2 text-xs font-bold text-emerald-900">Responsável: {task.owner}{task.conditional?" · Conferir aplicabilidade":""}</p></div><a href={task.id==="estadual"&&data.uf!=="TO"?"https://www.gov.br/pt-br":task.link} rel="noreferrer" target="_blank" className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-emerald-800">Portal <ExternalLink size={14}/></a></div>
       <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-bold text-slate-700">Situação<select disabled={!canManage} value={current.status} onChange={e=>setTask(task.id,{status:e.target.value as State})} className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-2 text-xs">{STATUSES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">Registro / nº protocolo<input disabled={!canManage} value={current.numero} onChange={e=>setTask(task.id,{numero:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 px-2 text-xs" placeholder="Se houver"/></label>
        <label className="text-xs font-bold text-slate-700">Validade (se houver)<input disabled={!canManage} type="date" value={current.validade} onChange={e=>setTask(task.id,{validade:e.target.value})} className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 px-2 text-xs"/></label>
       </div>
       {(current.status==="nao_aplica"||warning)&&<div className="mt-2">{warning&&<p className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-red-700"><TriangleAlert size={14}/>{warning}</p>}{current.status==="nao_aplica"&&<label className="block text-xs font-bold">Motivo de não aplicabilidade<textarea disabled={!canManage} value={current.justificativa} onChange={e=>setTask(task.id,{justificativa:e.target.value})} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs"/></label>}</div>}
     </section>})}
     <Link href="/apps/dronegestor/conferencia" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white no-underline"><ClipboardCheck size={18}/> Conferir operações do mês</Link>
   </div>}
   {message&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</p>}
   {canManage&&<button disabled={saving||loading} onClick={()=>void save()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white disabled:opacity-50">{saving?<RefreshCw size={17} className="animate-spin"/>:<CheckCircle2 size={17}/>}Salvar diagnóstico e situação dos documentos</button>}
   {!canManage&&<p className="mt-4 text-xs font-bold text-slate-600">Consulta liberada. Atualizações cadastrais são feitas pelo gestor ou responsável técnico.</p>}
  </div>
 </main>;
}
