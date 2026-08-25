"use client";

import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, GraduationCap, LayoutDashboard, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMbaEscolaSupabase } from "@/lib/mba-escola/supabase-client";
import SchoolPortal from "./school-portal";

const supabase = getMbaEscolaSupabase();

type SchoolRole = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type PortalRole = SchoolRole;
type Profile = { nome: string; papel: SchoolRole; escola_id: string; escola: { nome: string } | null };
type Admin = { nome: string; email: string };
type SchoolRow = { id: string; nome: string; status: string };

export default function MbaEscolaClientV2() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null); const [admin, setAdmin] = useState<Admin | null>(null); const [schools, setSchools] = useState<SchoolRow[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setAuthLoading(false); });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadAccount = useCallback(async () => {
    if (!session?.user) return;
    setPageLoading(true); setAdmin(null); setProfile(null); setSchools([]);
    const { data: adminData } = await supabase.from("escola_super_admins").select("nome,email").eq("user_id", session.user.id).eq("ativo", true).maybeSingle();
    if (adminData) {
      setAdmin(adminData as Admin);
      const { data: schoolData } = await supabase.from("escola_escolas").select("id,nome,status").order("nome");
      setSchools((schoolData ?? []) as SchoolRow[]); setPageLoading(false); return;
    }
    const { data: profileData } = await supabase.from("escola_perfis").select("nome,papel,escola_id,escola:escola_escolas(nome)").eq("id", session.user.id).eq("ativo", true).maybeSingle();
    if (profileData) setProfile(profileData as unknown as Profile);
    setPageLoading(false);
  }, [session]);
  useEffect(() => { void loadAccount(); }, [loadAccount]);

  const firstName = useMemo(() => (admin?.nome || profile?.nome || session?.user.email || "Usuário").split(" ")[0], [admin, profile, session]);

  if (authLoading && !session) return <Loading/>;
  if (!session) return <Centered><ShieldCheck className="mx-auto text-amber-600" size={42}/><h1 className="mt-5 text-2xl font-black">Sessão escolar indisponível</h1><p className="mt-3 text-slate-500">Volte à entrada do MBA Escola para renovar automaticamente o acesso pela MBA Labs.</p><Link className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 font-bold text-white" href="/mba-escola">Renovar acesso</Link></Centered>;
  if (pageLoading) return <Loading/>;
  if (!profile && !admin) return <Centered><ShieldCheck className="mx-auto text-amber-600" size={42}/><h1 className="mt-5 text-2xl font-black">Acesso não vinculado</h1><p className="mt-3 text-slate-500">Este usuário não possui um perfil escolar ativo e liberado.</p><Link className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 font-bold text-white" href="/dashboard">Voltar para MBA Labs</Link></Centered>;

  return <main className="cotacoes-module min-h-screen bg-[#f5f8fb] pb-10 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-20 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 py-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white"><GraduationCap size={28}/></div><div><p className="font-black">MBA Escola</p><p className="text-sm text-slate-500">{admin ? "Administração MBA" : profile?.escola?.nome}</p></div></div><Link className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold" href="/dashboard"><LayoutDashboard size={18}/> MBA Labs</Link></div></header>
    <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-7 py-7"><section><p className="text-sm font-black text-[#176b5b]">{admin ? "ADMIN MBA · Proprietário" : roleLabel(profile!.papel)}</p><h1 className="mt-1 text-3xl font-black">Olá, {firstName}</h1><p className="mt-2 leading-7 text-slate-500">{admin ? "Controle global do MBA Escola." : roleDescription(profile!.papel)}</p></section>{admin ? <OwnerDashboard schools={schools}/> : <SchoolPortal supabase={supabase} profile={profile as Profile & { papel: PortalRole }}/>}</div>
  </main>;
}

function Loading(){return <main className="grid min-h-screen place-items-center bg-[#f5f8fb]"><LoaderCircle className="animate-spin text-emerald-700" size={36}/></main>;}
function Centered({children}:{children:React.ReactNode}){return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900"><section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">{children}</section></main>;}
function OwnerDashboard({schools}:{schools:SchoolRow[]}){return <><section className="grid gap-4 sm:grid-cols-3"><Metric label="Escolas cadastradas" value={String(schools.length)}/><Metric label="Nível de acesso" value="Proprietário"/><Metric label="Ambiente" value="Ativo"/></section><section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><p className="text-sm font-black uppercase tracking-[.14em] text-emerald-700">Central administrativa</p><h2 className="mt-2 text-2xl font-black">Painel do ADMIN MBA</h2><p className="mt-2 text-emerald-800">Escolas, perfis, planos, pagamentos e auditoria.</p></div><Link className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#176b5b] px-5 font-black text-white" href="/mba-escola/admin"><LayoutDashboard size={20}/> Abrir painel</Link></div></section><section className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-2xl font-black">Escolas</h2><div className="mt-4 grid gap-2">{schools.map(school=><div className="flex justify-between rounded-xl border border-slate-200 p-4" key={school.id}><b>{school.nome}</b><span className="text-sm">{school.status}</span></div>)}</div></section></>;}
function Metric({label,value}:{label:string;value:string}){return <article className="rounded-3xl border border-slate-200 bg-white p-5"><CheckCircle2 className="text-[#176b5b]"/><p className="mt-3 text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></article>;}
function roleLabel(role:SchoolRole){return({admin_escola:"Admin da Escola",direcao:"Direção",coordenacao:"Coordenação",professor:"Professor",responsavel:"Responsável"} as Record<SchoolRole,string>)[role];}
function roleDescription(role:SchoolRole){if(role==="admin_escola"||role==="direcao")return"Administre a escola em cinco áreas simples: Hoje, Acadêmico, Alunos, Comunicação e Gestão.";if(role==="coordenacao")return"Acompanhe o dia, a rotina acadêmica, alunos, comunicação e relatórios.";if(role==="professor")return"Veja o dia, suas aulas, atividades, alunos e comunicação em uma única navegação.";if(role==="responsavel")return"Acompanhe seus filhos, pendências e agenda sem precisar procurar em vários módulos.";return"Acompanhamento disponível pelo perfil Responsável.";}
