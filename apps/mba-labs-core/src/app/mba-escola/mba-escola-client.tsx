"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import {
  Bell,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  School,
  ShieldCheck,
  UserPlus,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SchoolManagement from "./school-management";

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

type SchoolRole = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel" | "aluno";

type Profile = {
  nome: string;
  papel: SchoolRole;
  escola_id: string;
  escola: { nome: string } | null;
};

type Admin = { nome: string; email: string };
type SchoolRow = { id: string; nome: string; status: string };
type Announcement = { id: string; titulo: string; resumo: string | null; publicado_em: string | null };
type Shortcut = { title: string; description: string; icon: typeof Bell };

export default function MbaEscolaClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    navigator.serviceWorker?.register("/mba-escola-sw.js", { scope: "/mba-escola/" }).catch(() => undefined);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const loadAccount = useCallback(async () => {
    if (!session?.user) return;

    setPageLoading(true);
    setAdmin(null);
    setProfile(null);
    setSchools([]);
    setAnnouncements([]);

    const { data: adminData } = await supabase
      .from("escola_super_admins")
      .select("nome,email")
      .eq("user_id", session.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (adminData) {
      setAdmin(adminData as Admin);
      const { data: schoolData } = await supabase
        .from("escola_escolas")
        .select("id,nome,status")
        .order("nome");
      setSchools((schoolData ?? []) as SchoolRow[]);
      setPageLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("escola_perfis")
      .select("nome,papel,escola_id,escola:escola_escolas(nome)")
      .eq("id", session.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as unknown as Profile);
      const { data: notices } = await supabase
        .from("escola_comunicados")
        .select("id,titulo,resumo,publicado_em")
        .eq("status", "publicado")
        .order("publicado_em", { ascending: false })
        .limit(5);
      setAnnouncements((notices ?? []) as Announcement[]);
    }

    setPageLoading(false);
  }, [session]);

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
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/mba-escola` }
        });

        if (error) {
          setMessage("Não foi possível criar o acesso. Confira o e-mail liberado pela escola.");
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

      if (error) setMessage("E-mail ou senha incorretos.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
    setAdmin(null);
    setSchools([]);
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
              <div><p className="text-xl font-black">MBA Escola</p><p className="text-sm text-slate-500">Portal da família e da escola</p></div>
            </div>

            <p className="text-sm font-black uppercase tracking-[.16em] text-[#176b5b]">{mode === "login" ? "Acesso seguro" : "Primeiro acesso"}</p>
            <h2 className="mt-3 text-3xl font-black">{mode === "login" ? "Entre na sua conta" : "Crie sua senha"}</h2>
            <p className="mb-8 mt-3 leading-7 text-slate-500">{mode === "login" ? "Use o e-mail e a senha cadastrados no MBA Escola." : "Use o e-mail previamente liberado pela escola."}</p>

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
          <p className="mt-3 leading-7 text-slate-500">Este e-mail ainda não possui um perfil ativo no MBA Escola.</p>
          <button className="mt-6 rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white" onClick={logout} type="button">Sair</button>
        </section>
      </main>
    );
  }

  const isSchoolManager = profile?.papel === "admin_escola" || profile?.papel === "direcao";

  return (
    <main className={`min-h-screen bg-[#f5f8fb] pb-10 text-slate-900 ${isSchoolManager ? "cotacoes-module" : ""}`}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white"><GraduationCap size={28} /></div>
            <div><p className="font-black">MBA Escola</p><p className="text-sm text-slate-500">{admin ? "Administração MBA" : profile?.escola?.nome}</p></div>
          </div>
          <button className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold" onClick={logout} type="button"><LogOut size={18} /> Sair</button>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-7 py-7">
        <section>
          <p className="text-sm font-black text-[#176b5b]">{admin ? "ADMIN MBA · Proprietário" : roleLabel(profile?.papel)}</p>
          <h1 className="mt-1 text-3xl font-black">Olá, {firstName}</h1>
          <p className="mt-2 leading-7 text-slate-500">{admin ? "Controle total do MBA Escola, escolas, perfis, conteúdo, planos e pagamentos." : roleDescription(profile!.papel)}</p>
        </section>

        {admin ? (
          <OwnerDashboard schools={schools} />
        ) : isSchoolManager ? (
          <SchoolManagement
            supabase={supabase}
            schoolName={profile?.escola?.nome || "Minha escola"}
            role={profile!.papel as "admin_escola" | "direcao"}
          />
        ) : (
          <SchoolDashboard profile={profile!} announcements={announcements} />
        )}
      </div>
    </main>
  );
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] text-slate-900"><LoaderCircle className="animate-spin text-emerald-700" size={36} /></main>;
}

function OwnerDashboard({ schools }: { schools: SchoolRow[] }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={<School size={24} />} label="Escolas cadastradas" value={String(schools.length)} />
        <Metric icon={<ShieldCheck size={24} />} label="Nível de acesso" value="Proprietário" />
        <Metric icon={<CheckCircle2 size={24} />} label="Ambiente" value="Ativo" />
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[.14em] text-emerald-700">Central administrativa</p>
            <h2 className="mt-2 text-2xl font-black text-emerald-950">Painel completo do ADMIN MBA</h2>
            <p className="mt-2 max-w-2xl leading-7 text-emerald-800">Cadastre, edite, bloqueie ou exclua escolas e perfis. Analise publicações, configure planos, pagamentos e consulte a auditoria do sistema.</p>
          </div>
          <Link className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#176b5b] px-5 font-black text-white" href="/mba-escola/admin"><LayoutDashboard size={20} /> Abrir painel completo</Link>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-[#176b5b]">Escolas</p>
        <h2 className="mt-1 text-2xl font-black">Ambientes cadastrados</h2>
        <div className="mt-5 grid gap-3">
          {schools.map((school) => (
            <article className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4" key={school.id}>
              <div><p className="font-black">{school.nome}</p><p className="mt-1 text-sm text-slate-500">{school.status === "teste" ? "Em implantação" : school.status}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${school.status === "bloqueada" || school.status === "cancelada" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{school.status}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SchoolDashboard({ profile, announcements }: { profile: Profile; announcements: Announcement[] }) {
  const shortcuts = shortcutsForRole(profile.papel);

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
          <div><p className="text-sm font-black text-[#176b5b]">Mural</p><h2 className="mt-1 text-2xl font-black">Informações recentes</h2></div>
          <MessageSquareText className="text-[#176b5b]" />
        </div>

        {announcements.length ? (
          <div className="grid gap-3">
            {announcements.map((notice) => (
              <article className="rounded-2xl border border-slate-200 p-4" key={notice.id}>
                <div className="flex items-start gap-3">
                  <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Bell size={18} /></div>
                  <div><p className="font-black">{notice.titulo}</p>{notice.resumo ? <p className="mt-1 text-sm leading-6 text-slate-500">{notice.resumo}</p> : null}<p className="mt-2 text-xs font-semibold text-slate-400">{formatDate(notice.publicado_em)}</p></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={28} /><p className="mt-3 font-black">Nenhuma informação nova</p><p className="mt-1 text-sm text-slate-500">Os comunicados autorizados para este perfil aparecerão aqui.</p></div>
        )}
      </section>
    </>
  );
}

function shortcutsForRole(role: SchoolRole): Shortcut[] {
  if (role === "responsavel") return [
    { title: "Comunicados", description: "Avisos da escola e da turma", icon: Bell },
    { title: "Atividades", description: "Tarefas e trabalhos dos filhos", icon: ClipboardList },
    { title: "Reuniões", description: "Datas, horários e registros", icon: CalendarDays },
    { title: "Meus filhos", description: "Acompanhamento individual", icon: UsersRound }
  ];

  if (role === "aluno") return [
    { title: "Minhas atividades", description: "Tarefas e trabalhos pendentes", icon: ClipboardList },
    { title: "Minhas aulas", description: "Conteúdo trabalhado em sala", icon: BookOpenText },
    { title: "Agenda", description: "Datas e compromissos escolares", icon: CalendarDays },
    { title: "Comunicados", description: "Avisos liberados para sua turma", icon: Bell }
  ];

  if (role === "admin_escola" || role === "direcao") return [
    { title: "Equipe e acessos", description: "Professores, coordenação e perfis", icon: UsersRound },
    { title: "Turmas e alunos", description: "Organização da escola", icon: School },
    { title: "Comunicados", description: "Publique informações oficiais", icon: Bell },
    { title: "Reuniões", description: "Agendamentos e registros", icon: CalendarDays }
  ];

  if (role === "coordenacao") return [
    { title: "Acompanhamentos", description: "Ocorrências e evolução dos alunos", icon: UsersRound },
    { title: "Comunicados", description: "Publique informações pedagógicas", icon: Bell },
    { title: "Turmas", description: "Acompanhe professores e alunos", icon: School },
    { title: "Reuniões", description: "Agende com responsáveis", icon: CalendarDays }
  ];

  return [
    { title: "Registrar aula", description: "Conteúdo e tarefa do dia", icon: BookOpenText },
    { title: "Atividade", description: "Crie e acompanhe entregas", icon: ClipboardList },
    { title: "Meus alunos", description: "Acompanhe suas turmas", icon: UsersRound },
    { title: "Reunião", description: "Agende com responsáveis", icon: CalendarDays }
  ];
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-[#176b5b]">{icon}</span><p className="mt-4 text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></article>;
}

function roleLabel(role?: SchoolRole) {
  const labels: Record<SchoolRole, string> = {
    admin_escola: "Admin da Escola",
    direcao: "Direção",
    coordenacao: "Coordenação",
    professor: "Professor",
    responsavel: "Responsável",
    aluno: "Aluno"
  };
  return role ? labels[role] : "Portal escolar";
}

function roleDescription(role: SchoolRole) {
  if (role === "admin_escola") return "Gerencie a operação da sua escola sem acesso às configurações globais da MBA.";
  if (role === "direcao") return "Acompanhe a escola, equipe, alunos, comunicados e reuniões.";
  if (role === "coordenacao") return "Acompanhe turmas, alunos, professores, ocorrências e reuniões.";
  if (role === "professor") return "Registre aulas, atividades e acompanhe apenas suas turmas e alunos vinculados.";
  if (role === "responsavel") return "Acompanhe somente as informações escolares dos seus filhos vinculados.";
  return "Acompanhe suas aulas, atividades, agenda e comunicados da sua turma.";
}

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
  } catch {
    return "Data não informada";
  }
}
