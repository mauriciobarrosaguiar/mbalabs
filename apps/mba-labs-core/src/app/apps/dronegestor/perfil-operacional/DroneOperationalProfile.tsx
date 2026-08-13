"use client";

import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, Loader2, Save, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Profile={operadorNome:string;cpfCnpj:string;registroMapa:string;processoSei:string;rtNome:string;rtConselho:string;rtRegistro:string;email:string;telefone:string;observacoes:string};
const empty:Profile={operadorNome:"",cpfCnpj:"",registroMapa:"",processoSei:"",rtNome:"",rtConselho:"",rtRegistro:"",email:"",telefone:"",observacoes:""};

export function DroneOperationalProfile(){
  const [profile,setProfile]=useState<Profile>(empty); const [canManage,setCanManage]=useState(false); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
  useEffect(()=>{void load();},[]);
  async function load(){setLoading(true);setMessage("");try{const response=await fetch("/api/dronegestor/perfil-operacional",{cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload?.error||"Falha ao carregar.");setProfile({...empty,...payload.profile});setCanManage(Boolean(payload.canManage));}catch(e){setMessage(e instanceof Error?e.message:"Falha ao carregar.");}finally{setLoading(false);}}
  async function save(){if(!canManage||saving)return;setSaving(true);setMessage("");try{const response=await fetch("/api/dronegestor/perfil-operacional",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({profile})});const payload=await response.json();if(!response.ok)throw new Error(payload?.error||"Falha ao salvar.");setProfile({...empty,...payload.profile});setMessage("Perfil operacional salvo.");}catch(e){setMessage(e instanceof Error?e.message:"Falha ao salvar.");}finally{setSaving(false);}}
  const completeness=useMemo(()=>{const required=[profile.operadorNome,profile.cpfCnpj,profile.registroMapa,profile.rtNome,profile.rtRegistro];return Math.round(required.filter(v=>v.trim()).length/required.length*100);},[profile]);
  const set=(key:keyof Profile,value:string)=>setProfile((p)=>({...p,[key]:value}));

  return <main className="min-h-screen bg-[#f4f8f1] px-4 py-5 text-[#143d31] sm:px-6 sm:py-8"><div className="mx-auto grid w-full max-w-3xl gap-4">
    <header className="flex items-center gap-3"><Link href="/apps/dronegestor" aria-label="Voltar" className="grid size-11 place-items-center rounded-2xl border border-[#d9e5dc] bg-white text-[#315d4d]"><ArrowLeft size={20}/></Link><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#087a55]">Dados do DroneGestor</p><h1 className="text-2xl font-black">Perfil operacional</h1><p className="mt-1 text-sm text-[#718078]">Cadastre uma vez e reutilize nos relatórios e conferências.</p></div></header>

    <section className="rounded-[26px] bg-[linear-gradient(145deg,#07533a,#00432f)] p-5 text-white"><div className="flex items-center justify-between gap-4"><div><span className="text-xs font-black uppercase tracking-[.14em] text-[#87ddb0]">Preenchimento</span><strong className="mt-1 block text-3xl font-black">{completeness}%</strong><p className="mt-1 text-xs leading-5 text-[#c5ddd1]">Os dados mais usados ficam centralizados para não digitar novamente em cada relatório.</p></div><span className="grid size-14 place-items-center rounded-[20px] bg-white/10 text-[#81ddad]"><ShieldCheck size={28}/></span></div></section>

    {loading?<div className="grid min-h-40 place-items-center rounded-2xl bg-white"><Loader2 className="animate-spin text-[#087a55]"/></div>:<>
      <Card icon={<Building2 size={22}/>} title="Empresa / operador" text="Dados que identificam o operador nas rotinas administrativas.">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Nome / razão social" value={profile.operadorNome} set={(v)=>set("operadorNome",v)} disabled={!canManage}/><Field label="CPF / CNPJ" value={profile.cpfCnpj} set={(v)=>set("cpfCnpj",v)} disabled={!canManage}/><Field label="Registro MAPA / SIPEAGRO" value={profile.registroMapa} set={(v)=>set("registroMapa",v)} disabled={!canManage}/><Field label="Processo SEI" value={profile.processoSei} set={(v)=>set("processoSei",v)} disabled={!canManage}/><Field label="E-mail" value={profile.email} set={(v)=>set("email",v)} disabled={!canManage}/><Field label="Telefone" value={profile.telefone} set={(v)=>set("telefone",v)} disabled={!canManage}/></div>
      </Card>
      <Card icon={<UserRoundCheck size={22}/>} title="Responsável técnico" text="Identificação do profissional responsável pela conferência técnica.">
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Nome do RT" value={profile.rtNome} set={(v)=>set("rtNome",v)} disabled={!canManage}/><Field label="Conselho" value={profile.rtConselho} set={(v)=>set("rtConselho",v)} disabled={!canManage} placeholder="Ex.: CREA"/><Field label="Registro profissional" value={profile.rtRegistro} set={(v)=>set("rtRegistro",v)} disabled={!canManage}/></div>
      </Card>
      <Card icon={<CheckCircle2 size={22}/>} title="Observações administrativas" text="Use para anotações internas. Não substitui documento, licença ou protocolo."><textarea value={profile.observacoes} onChange={(e)=>set("observacoes",e.target.value)} disabled={!canManage} rows={4} className="w-full rounded-2xl border border-[#d8e3db] bg-white p-3 text-sm" placeholder="Observações internas..."/></Card>
      {message&&<p className={`rounded-2xl px-4 py-3 text-sm font-bold ${message.includes("salvo")?"bg-[#d9f3e2] text-[#0d5a3f]":"bg-red-50 text-red-700"}`}>{message}</p>}
      {canManage&&<button type="button" onClick={()=>void save()} disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#087a55] px-5 font-black text-white shadow-sm disabled:opacity-60">{saving?<Loader2 size={18} className="animate-spin"/>:<Save size={18}/>}Salvar perfil</button>}
    </>}
  </div></main>;
}
function Card({icon,title,text,children}:{icon:React.ReactNode;title:string;text:string;children:React.ReactNode}){return <section className="rounded-[26px] border border-[#dce7df] bg-white p-5 shadow-sm"><div className="mb-4 flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f4eb] text-[#087a55]">{icon}</span><div><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-xs leading-5 text-[#738078]">{text}</p></div></div>{children}</section>}
function Field({label,value,set,disabled,placeholder}:{label:string;value:string;set:(v:string)=>void;disabled:boolean;placeholder?:string}){return <label className="grid gap-1.5"><span className="text-xs font-black text-[#4e675d]">{label}</span><input value={value} onChange={(e)=>set(e.target.value)} disabled={disabled} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-[#d8e3db] bg-white px-3 text-sm"/></label>}
