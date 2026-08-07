"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import {
  Bell,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  UserPlus,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import OwnerAdmin from "./owner-admin";

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
  papel: "direcao" | "coordenacao" | "professor" | "responsavel";
  escola_id: string;
  escola: { nome: string } | null;
};

type Admin = { nome: string; email: string };
type Announcement = { id: string; titulo: string; resumo: string | null; publicado_em: string | null };
type AuthMode = "login" | "signup" | "recovery";

type Shortcut = {
  title: string;
  description: string;
  icon: typeof Bell;
};

export default function MbaEscolaClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    navigator.serviceWorker?.register("/mba-escola-sw.js", { scope: "/mba-escola/" }).catch(() => undefined);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setMessage("Digite abaixo a nova senha para este acesso.");
      }
      setAuthLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const loadAccount = useCallback(async () => {
    if (!session?.user || mode === "recovery") return;

    setPageLoading(true);
    setAdmin(null);
    setProfile(null);
    setAnnouncements([]);

    const { data: adminData } = await supabase
      .from("escola_super_admins")
      .select("nome, email")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminData) {
      setAdmin(adminData as Admin);
      setPageLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("escola_perfis")
      .select("nome, papel, escola_id, escola:escola_escolas(nome)")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as unknown as Profile);
      const { data: notices } = await supabase
        .from("escola_comunicados")
        .select("id, titulo, resumo, publicado_em")
        .eq("status", "publicado")
        .order("publicado_em", { ascending: false })
        .limit(5);
      setAnnouncements((notices ?? []) as Announcement[]);
    }

    setPageLoading(false);
  }, [mode, session]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const firstName = useMemo(() => {
    return (admin?.nome || profile?.nome || session?.user.email || "Usuário").split(" ")[0];
  }, [admin, profile, session]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setMessage("");

    try {
      if (mode === "recovery") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setMessage("Não foi possível alterar a senha. Tente novamente.");
          return;
        }
        setMode("login");
        setPassword("");
        setMessage("Senha alterada com sucesso.");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/mba-escola` }
        });

        if (error) {
          setMessage("Não foi possível criar o acesso. Confira o e-mail ou tente entrar.");
          return;
        }

        if (!data.session) {
          setMode("login");
          setPassword("");
          setMessage("Cadastro criado. Confirme o e-mail recebido e depois entre no sistema.");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) setMessage("E-mail ou senha incorretos. No primeiro acesso, crie sua senha.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
    setAdmin(null);
    setMode("login");
  }

  if (mode === "recovery") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white"><ShieldCheck size={26} /></div>
          <p className="text-sm font-black uppercase tracking-[.14em] text-[#176b5b]">Segurança</p>
          <h1 className="mt-2 text-2xl font-black">Defina sua nova senha</h1>
          <form className="mt-6 grid gap-4" onSubmit={submit}>
            <input
              className="min-h-[52px] rounded-2xl border border-slate-300 px-4 outline-none focus:border-emerald-700"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nova senha"
              required
              type="password"
              value={password}
            />
            {message ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}
            <button className="min-h-[52px] rounded-2xl bg-[#176b5b] px-5 font-black text-white" type="submit">Salvar nova senha</button>
          </form>
        </section>
      </main>
    );
  }

  if (authLoading && !session) return <LoadingScreen />;

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f5f8fb] px-4 py-8 text-slate-900 sm:grid sm:place-items-center">
        <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 md:grid-cols-[1.05fr_.95fr]">
          <aside className="hidden bg-[#176b5b] p-12 text-white md:flex md:flex-col md:justify-between">
            <div>
              <div className="mb-10 grid h-16 w-16 place-items-center rounded-2xl bg-white/15"><GraduationCap size={38} /></div>
              <p className="text-sm font-black uppercase tracking-[.18em] text-emerald-100">MBA Escola</p>
              <h1 className="mt-4 text-4xl font-black leading-tight">A escola e a família no mesmo lugar.</h1>
              <p className="mt-5 text-lg leading-8 text-emerald-50/90">Comunicados, atividades, reuniões e acompanhamento do aluno em uma tela simples.</p>
            </div>
            <p className="flex items-center gap-3 font-semibold text-emerald-50"><ShieldCheck size={22} /> Acesso próprio e protegido</p>
          </aside>

          <div className="p-6 sm:p-10 md:p-12">
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white"><GraduationCap size={28} /></div>
              <div>
                <p className="text-xl font-black">MBA Escola</p>
                <p className="text-sm text-slate-500">Portal da família e da escola</p>
              </div>
            </div>

            <p className="text-sm font-black uppercase tracking-[.16em] text-[#176b5b]">{mode === "login" ? "Acesso seguro" : "Primeiro acesso"}</p>
            <h2 className="mt-3 text-3xl font-black">{mode === "login" ? "Entre na sua conta" : "Crie sua senha"}</h2>
            <p className="mb-8 mt-3 leading-7 text-slate-500">
              {mode === "login" ? "Use o e-mail e a senha cadastrados no MBA Escola." : "Use o e-mail liberado pela administração e escolha sua senha."}
            </p>

            <form className="grid gap-5" onSubmit={submit}>
              <label className="grid gap-2 font-bold">E-mail
                <input className="min-h-[52px] rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100" onChange={(event) => setEmail(event.target.value)} placeholder="seuemail@exemplo.com" required type="email" value={email} />
              </label>
              <label className="grid gap-2 font-bold">Senha
                <input className="min-h-[52px] rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100" minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" required type="password" value={password} />
              </label>

              {message ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">{message}</p> : null}

              <button className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#176b5b] px-5 font-black text-white disabled:opacity-60" disabled={authLoading} type="submit">
                {authLoading ? <LoaderCircle className="animate-spin" size={21} /> : mode === "login" ? <ShieldCheck size={21} /> : <UserPlus size={21} />}
                {authLoading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar meu acesso"}
              </button>
            </form>

            <button className="mt-5 w-full py-3 text-sm font-black text-[#176b5b]" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} type="button">
              {mode === "login" ? "Primeiro acesso" : "Já tenho uma conta"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (pageLoading) return <LoadingScreen />;

  if (!profile && !admin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900">
        <section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <ShieldCheck className="mx-auto text-amber-600" size={42} />
          <h1 className="mt-5 text-2xl font-black">Acesso não vinculado</h1>
          <p className="mt-3 leading-7 text-slate-500">Este e-mail ainda não possui convite ativo para uma escola.</p>
          <button className="mt-6 rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white" onClick={logout} type="button">Sair</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f8fb] pb-10 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white"><GraduationCap size={28} /></div>
            <div>
              <p className="font-black">MBA Escola</p>
              <p className="text-sm text-slate-500">{admin ? "Administração geral" : profile?.escola?.nome}</p>
            </div>
          </div>
          <button className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold" onClick={logout} type="button"><LogOut size={18} /> Sair</button>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-7 py-7">
        <section>
          <p className="text-sm font-black text-[#176b5b]">{admin ? "Dono do sistema" : roleLabel(profile?.papel)}</p>
          <h1 className="mt-1 text-3xl font-black">Olá, {firstName}</h1>
          <p className="mt-2 leading-7 text-slate-500">
            {admin ? "Gerencie escolas, usuários, acessos e implantação do MBA Escola." : profile?.papel === "responsavel" ? "Acompanhe as informações escolares dos seus filhos." : "Veja os principais registros e ações da rotina escolar."}
          </p>
        </section>

        {admin ? <OwnerAdmin ownerName={admin.nome} supabase={supabase} /> : <SchoolDashboard profile={profile!} announcements={announcements} />}
      </div>
    </main>
  );
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] text-slate-900"><LoaderCircle className="animate-spin text-emerald-700" size={36} /></main>;
}

function SchoolDashboard({ profile, announcements }: { profile: Profile; announcements: Announcement[] }) {
  const isGuardian = profile.papel === "responsavel";
  const shortcuts: Shortcut[] = isGuardian
    ? [
        { title: "Comunicados", description: "Avisos da escola e da turma", icon: Bell },
        { title: "Atividades", description: "Tarefas e trabalhos pendentes", icon: ClipboardList },
        { title: "Reuniões", description: "Datas e registros", icon: CalendarDays },
        { title: "Meus filhos", description: "Acompanhamento individual", icon: UsersRound }
      ]
    : [
        { title: "Comunicado", description: "Publique uma informação", icon: Bell },
        { title: "Registrar aula", description: "Conteúdo e tarefa do dia", icon: BookOpenText },
        { title: "Atividade", description: "Crie e acompanhe entregas", icon: ClipboardList },
        { title: "Reunião", description: "Agende com os responsáveis", icon: CalendarDays }
      ];

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {shortcuts.map(({ title, description, icon: Icon }) => (
          <article className="min-h-36 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" key={title}>
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-[#176b5b]"><Icon size={23} /></div>
            <h2 className="font-black">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#176b5b]">Mural</p>
            <h2 className="text-2xl font-black">Informações recentes</h2>
          </div>
          <MessageSquareText className="text-[#176b5b]" />
        </div>

        {announcements.length ? (
          <div className="grid gap-3">
            {announcements.map((announcement) => (
              <article className="rounded-2xl border border-slate-200 p-4" key={announcement.id}>
                <div className="flex items-start gap-3">
                  <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Bell size={18} /></div>
                  <div>
                    <h3 className="font-black">{announcement.titulo}</h3>
                    {announcement.resumo ? <p className="mt-1 text-sm leading-6 text-slate-500">{announcement.resumo}</p> : null}
                    <p className="mt-2 text-xs font-semibold text-slate-400">{formatDate(announcement.publicado_em)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
            <CheckCircle2 className="mx-auto text-emerald-700" size={28} />
            <p className="mt-3 font-black">Nenhuma informação nova</p>
            <p className="mt-1 text-sm text-slate-500">Os comunicados da escola aparecerão aqui.</p>
          </div>
        )}
      </section>
    </>
  );
}

function roleLabel(role?: Profile["papel"]) {
  const labels = { direcao: "Direção", coordenacao: "Coordenação", professor: "Professor", responsavel: "Responsável" };
  return role ? labels[role] : "Portal escolar";
}

function formatDate(value: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}
