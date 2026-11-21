"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

type Mode="solo"|"equipe";
type Profile={modoOperacao?:Mode;[key:string]:unknown};

export function DroneTeamMode({canAdministerCompany=false}:{canAdministerCompany?:boolean}){
  const [profile,setProfile]=useState<Profile>({modoOperacao:"solo"});
  const [canManage,setCanManage]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const mode:Mode=profile.modoOperacao==="equipe"?"equipe":"solo";

  useEffect(()=>{void load()},[]);
  async function load(){setLoading(true);try{const response=await fetch("/api/dronegestor/perfil-operacional",{cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload?.error||"Falha ao carregar.");setProfile(payload.profile||{modoOperacao:"solo"});setCanManage(Boolean(payload.canManage));}catch(error){setMessage(error instanceof Error?error.message:"Falha ao carregar.");}finally{setLoading(false)}}
  async function choose(next:Mode){if(!canManage||saving||next===mode)return;setSaving(true);setMessage("");try{const response=await fetch("/api/dronegestor/perfil-operacional",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({profile:{...profile,modoOperacao:next}})});const payload=await response.json();if(!response.ok)throw new Error(payload?.error||"Falha ao salvar.");setProfile(payload.profile);setMessage(next==="solo"?"Modo solo ativado.":"Modo equipe ativado.");}catch(error){setMessage(error instanceof Error?error.message:"Falha ao salvar.");}finally{setSaving(false)}}

  return <main className="agro-page-compact min-h-screen bg-slate-50 px-3 pb-28 pt-4 text-[#143d31] sm:px-6 sm:py-8"><div className="mx-auto grid w-full max-w-3xl gap-4">
    <header className="flex items-center gap-3"><Link href="/apps/dronegestor" className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#d9e5dc] bg-white text-[#315d4d]" aria-label="Voltar"><ArrowLeft size={20}/></Link><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#087a55]">Minha operação</p><h1 className="text-2xl font-black">Minha equipe</h1><p className="mt-1 text-sm text-[#718078]">Escolha como deseja organizar a operação.</p></div></header>

    {canAdministerCompany&&<section className="rounded-2xl border border-emerald-200 bg-white p-5"><h2 className="font-black">Funcionários e acessos</h2><p className="mt-2 text-sm text-slate-600">Cadastre os funcionários da sua empresa e escolha o perfil de cada um no DroneGestor.</p><Link href="/apps/dronegestor/funcionarios" className="agro-primary-action mt-3 flex min-h-12 items-center justify-center rounded-xl bg-[#087a55] px-4 font-bold text-white">Cadastrar funcionários</Link></section>}
    {loading?<div className="grid min-h-40 place-items-center rounded-2xl bg-white"><Loader2 className="animate-spin text-[#087a55]"/></div>:<>
      <section className="rounded-[26px] border border-[#dce7df] bg-white p-4 shadow-sm sm:p-5"><div className="agro-compact-grid grid grid-cols-2 gap-2"><Option active={mode==="solo"} disabled={!canManage||saving} onClick={()=>void choose("solo")} icon={<UserRound size={21}/>} title="Solo" text="Você é gestor e piloto."/><Option active={mode==="equipe"} disabled={!canManage||saving} onClick={()=>void choose("equipe")} icon={<UsersRound size={21}/>} title="Equipe" text="Você gerencia pilotos."/></div></section>
      <section className={`rounded-[26px] border p-5 ${mode==="solo"?"border-emerald-200 bg-emerald-50":"border-[#dce7df] bg-white"}`}><div className="flex items-start gap-3"><CheckCircle2 size={21} className="mt-0.5 shrink-0 text-[#087a55]"/><div><strong className="block">{mode==="solo"?"Modo solo ativo":"Modo equipe ativo"}</strong><p className="mt-1 text-sm leading-5 text-[#61746a]">{mode==="solo"?"Você não precisa cadastrar pilotos. Abra suas ordens de serviço para preparar e executar as aplicações.":"Cadastre o piloto e crie o acesso dele sem sair do DroneGestor."}</p></div></div>{mode==="solo"&&<Link href="/apps/dronegestor/gestao" className="agro-primary-action mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[#087a55] px-4 text-sm font-bold text-white">Abrir minhas operações</Link>}{mode==="equipe"&&<Link href="/apps/dronegestor/pilotos" className="agro-primary-action mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[#087a55] px-4 text-sm font-black text-white no-underline">Cadastrar ou gerenciar pilotos</Link>}</section>
      {message&&<p className="rounded-2xl border border-[#dce7df] bg-white px-4 py-3 text-sm font-bold">{message}</p>}
    </>}
  </div></main>;
}

function Option({active,disabled,onClick,icon,title,text}:{active:boolean;disabled:boolean;onClick:()=>void;icon:React.ReactNode;title:string;text:string}){return <button type="button" disabled={disabled} onClick={onClick} className={`min-h-24 rounded-xl border p-3 text-left ${active?"border-[#087a55] bg-[#e8f4eb] text-[#0b6245]":"border-[#d8e3db] bg-white text-[#566b61]"}`}>{icon}<strong className="mt-2 block">{title}</strong><span className="mt-1 block text-xs leading-4">{text}</span></button>}
