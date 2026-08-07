"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { ArrowLeft, GraduationCap, LoaderCircle, LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SchoolManagement from "../school-management";

const supabase = createClient(
  "https://ihcfhuxxjllmqypzuzce.supabase.co",
  "sb_publishable_dEfjGxNY_xpLXKAE2atiag_vRHwqVLw",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "mba-escola-auth"
    }
  }
);

type Profile = {
  nome: string;
  papel: "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel" | "aluno";
  escola: { nome: string } | null;
};

export default function SchoolManagementPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: profileError } = await supabase
      .from("escola_perfis")
      .select("nome,papel,escola:escola_escolas(nome)")
      .eq("id", currentSession.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (profileError) setError(profileError.message);
    setProfile((data ?? null) as unknown as Profile | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void load(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void load(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, [load]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/mba-escola";
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f5f8fb]"><LoaderCircle className="animate-spin text-emerald-700" size={36} /></main>;

  if (!session) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl"><GraduationCap className="mx-auto text-[#176b5b]" size={38} /><h1 className="mt-4 text-2xl font-black">Entre no MBA Escola</h1><p className="mt-2 text-sm leading-6 text-slate-500">Faça login com o perfil Admin da Escola ou Direção para abrir esta área.</p><Link className="mt-5 inline-flex rounded-xl bg-[#176b5b] px-5 py-3 font-black text-white" href="/mba-escola">Ir para o login</Link></section></main>;
  }

  if (error || !profile || !["admin_escola", "direcao"].includes(profile.papel)) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4"><section className="max-w-lg rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-xl"><ShieldAlert className="mx-auto text-amber-600" size={40} /><h1 className="mt-4 text-2xl font-black">Área restrita</h1><p className="mt-2 text-sm leading-6 text-slate-500">Somente o Admin da Escola e a Direção podem acessar a gestão de turmas, alunos e equipe.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Link className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-bold" href="/mba-escola"><ArrowLeft size={17} /> Voltar</Link><button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white" onClick={() => void logout()} type="button"><LogOut size={17} /> Sair</button></div></section></main>;
  }

  return (
    <main className="cotacoes-module min-h-screen bg-[#f5f8fb] pb-10 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 py-3">
          <Link className="flex items-center gap-3" href="/mba-escola">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#176b5b] text-white"><GraduationCap size={25} /></div>
            <div><p className="font-black">MBA Escola</p><p className="text-sm text-slate-500">Gestão da escola</p></div>
          </Link>
          <div className="flex gap-2"><Link className="hidden min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-bold sm:flex" href="/mba-escola"><ArrowLeft size={17} /> Início</Link><button className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-bold" onClick={() => void logout()} type="button"><LogOut size={17} /> Sair</button></div>
        </div>
      </header>
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-7">
        <SchoolManagement supabase={supabase} schoolName={profile.escola?.nome || "Minha escola"} role={profile.papel as "admin_escola" | "direcao"} />
      </div>
    </main>
  );
}
