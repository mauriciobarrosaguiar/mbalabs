"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { ArrowLeft, GraduationCap, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AgendaTimeline from "../agenda-timeline";

const supabase = createClient(
  "https://ihcfhuxxjllmqypzuzce.supabase.co",
  "sb_publishable_dEfjGxNY_xpLXKAE2atiag_vRHwqVLw",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "mba-escola-auth" } }
);

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel" | "aluno";
type Profile = { nome: string; papel: Role; escola_id: string; escola: { nome: string } | null };

type SupportedRole = Exclude<Role, "aluno">;

export default function AgendaPageClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("escola_perfis").select("nome,papel,escola_id,escola:escola_escolas(nome)").eq("id", session.user.id).eq("ativo", true).maybeSingle();
    setProfile(data as unknown as Profile | null);
    setLoading(false);
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  async function logout() { await supabase.auth.signOut(); window.location.href = "/mba-escola"; }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f5f8fb]"><LoaderCircle className="animate-spin text-emerald-700" size={36}/></main>;

  if (!session) return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto text-[#176b5b]" size={42}/><h1 className="mt-4 text-2xl font-black">Entre primeiro no MBA Escola</h1><p className="mt-3 text-slate-500">A agenda usa o mesmo acesso do portal escolar.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#176b5b] px-5 font-black text-white" href="/mba-escola">Ir para o login</Link></section></main>;

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-2xl font-black">Perfil escolar não encontrado</h1><Link href="/mba-escola" className="mt-5 inline-block font-black text-[#176b5b]">Voltar</Link></section></main>;

  if (profile.papel === "aluno") return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-2xl font-black">Agenda disponível pelo acesso do responsável</h1><p className="mt-3 leading-6 text-slate-500">O acompanhamento familiar está concentrado no perfil do responsável.</p><Link href="/mba-escola" className="mt-5 inline-block font-black text-[#176b5b]">Voltar</Link></section></main>;

  return <main className="cotacoes-module min-h-screen bg-[#f5f8fb] pb-10 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-20 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 py-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white"><GraduationCap size={28}/></div><div><p className="font-black">MBA Escola · Agenda</p><p className="text-sm text-slate-500">{profile.escola?.nome}</p></div></div><div className="flex gap-2"><Link href="/mba-escola" className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold"><ArrowLeft size={18}/> Portal</Link><button className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold" onClick={() => void logout()} type="button"><LogOut size={18}/> Sair</button></div></div></header>
    <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-7 py-7"><AgendaTimeline supabase={supabase} profile={{ nome: profile.nome, papel: profile.papel as SupportedRole, escola_id: profile.escola_id }}/></div>
  </main>;
}
