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
  School,
  ShieldCheck,
  UserPlus,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const SUPABASE_URL = "https://ihcfhuxxjllmqypzuzce.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dEfjGxNY_xpLXKAE2atiag_vRHwqVLw";

type SchoolProfile = {
  nome: string;
  papel: "direcao" | "coordenacao" | "professor" | "responsavel";
  escola_id: string;
  escola: { nome: string } | null;
};

type SuperAdmin = {
  nome: string;
  email: string;
};

type SchoolRow = {
  id: string;
  nome: string;
  status: string;
};

type Announcement = {
  id: string;
  titulo: string;
  resumo: string | null;
  publicado_em: string | null;
};

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "mba-escola-auth"
  }
});

export default function MbaEscolaClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<"login" | "first-access">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    navigator.serviceWorker?.register("/mba-escola-sw.js", { scope: "/mba-escola/" }).catch(() => undefined);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadAccount = useCallback(async () => {
    if (!session?.user) return;

    setContentLoading(true);
    setProfile(null);
    setSuperAdmin(null);
    setSchools([]);
    setAnnouncements([]);

    const { data: adminData } = await supabase
      .from("escola_super_admins")
      .select("nome, email")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminData) {
      setSuperAdmin(adminData as SuperAdmin);
      const { data: schoolData } = await supabase
        .from("escola_escolas")
        .select("id, nome, status")
        .order("nome");
      setSchools((schoolData ?? []) as SchoolRow[]);
      setContentLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("escola_perfis")
      .select("nome, papel, escola_id, escola:escola_escolas(nome)")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileData) {
      const normalizedProfile = profileData as unknown as SchoolProfile;
      setProfile(normalizedProfile);

      const { data: announcementData } = await supabase
        .from("escola_comunicados")
        .select("id, titulo, resumo, publicado_em")
        .eq("status", "publicado")
        .order("publicado_em", { ascending: false })
        .limit(5);
      setAnnouncements((announcementData ?? []) as Announcement[]);
    }

    setContentLoading(false);
  }, [session]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const firstName = useMemo(() => {
    const name = superAdmin?.nome || profile?.nome || session?.user.email || "Usuário";
    return name.split(" ")[0];
  }, [profile, session, superAdmin]);

  async function submitAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormLoading(true);
    setMessage("");

    try {
      if (mode === "first-access") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/mba-escola`
          }
        });

        if (error) {
          setMessage(error.message.includes("registered")
            ? "Este e-mail já possui cadastro. Use a opção Entrar."
            : "Não foi possível criar o acesso. Verifique o e-mail e a senha.");
          return;
        }

        if (!data.session) {
          setMessage("Cadastro criado. Confira seu e-mail e confirme o acesso antes de entrar.");
          setMode("login");
          setPassword("");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        setMessage("E-mail ou senha incorretos. No primeiro acesso, escolha a opção abaixo.");
      }
    } finally {
      setFormLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
    setSuperAdmin(null);
  }

  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fb] text-slate-900">
        <LoaderCircle className="animate-spin text-emerald-700" size={36} />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f5f8fb] px-4 py-8 text-slate-900 sm:grid sm:place-items-center">
        <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 md:grid-cols-[1.05fr_.95fr]">
          <div className="hidden bg-[#176b5b] p-12 text-white md:flex md:flex-col md:justify-between">
            <div>
              <div className="mb-10 grid h-16 w-16 place-items-center rounded-2xl bg-white/15">
                <GraduationCap size={38} />
              </div>
              <p className="text-sm font-black uppercase tracking-[.18em] text-emerald-100">MBA Escola</p>
              <h1 className="mt-4 text-4xl font-black leading-tight">A escola e a família no mesmo lugar.</h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-emerald-50/90">
                Comunicados, atividades, reuniões e acompanhamento do aluno em uma tela simples.
              </p>
            </div>
            <div className="grid gap-4 text-sm font-semibold text-emerald-50">
              <p className="flex items-center gap-3"><CheckCircle2 size={22} /> Informações organizadas e fáceis de encontrar</p>
              <p className="flex items-center gap-3"><ShieldCheck size={22} /> Acesso separado e protegido</p>
            </div>
          </div>

          <div className="p-6 sm:p-10 md:p-12">
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white">
                <GraduationCap size={28} />
              </div>
              <div>
                <p className="text-xl font-black">MBA Escola</p>
                <p className="text-sm text-slate-500">Portal da família e da escola</p>
              </div>
            </div>

            <p className="text-sm font-black uppercase tracking-[.16em] text-[#176b5b]">
              {mode === "login" ? "Acesso seguro" : "Ativação do acesso"}
            </p>
            <h2 className="mt-3 text-3xl font-black">
              {mode === "login" ? "Entre na sua conta" : "Crie sua senha"}
            </h2>
            <p className="mb-8 mt-3 leading-7 text-slate-500">
              {mode === "login"
                ? "Use o e-mail e a senha cadastrados no MBA Escola."
                : "Use o e-mail que recebeu o convite e defina sua senha. Você pode usar a mesma senha do MBA Labs."}
            </p>

            <form className="grid gap-5" onSubmit={submitAccess}>
              <label className="grid gap-2 font-bold">
                E-mail
                <input
                  className="min-h-13 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seuemail@exemplo.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="grid gap-2 font-bold">
                Senha
                <input
                  className="min-h-13 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  required
                  type="password"
                  value={password}
                />
              </label>

              {message ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                  {message}
                </p>
              ) : null}

              <button
                className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#176b5b] px-5 font-black text-white hover:bg-[#0f5548] disabled:opacity-60"
                disabled={formLoading}
                type="submit"
              >
                {formLoading ? <LoaderCircle className="animate-spin" size={21} /> : mode === "login" ? <ShieldCheck size={21} /> : <UserPlus size={21} />}
                {formLoading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar meu acesso"}
              </button>
            </form>

            <button
              className="mt-5 w-full rounded-xl py-3 text-sm font-black text-[#176b5b]"
              onClick={() => {
                setMode(mode === "login" ? "first-access" : "login");
                setMessage("");
              }}
              type="button"
            >
              {mode === "login" ? "Primeiro acesso" : "Já tenho uma conta"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (contentLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fb] text-slate-900">
        <LoaderCircle className="animate-spin text-emerald-700" size={36} />
      </main>
    );
  }

  if (!profile && !superAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <ShieldCheck className="mx-auto text-amber-600" size={42} />
          <h1 className="mt-5 text-2xl font-black">Acesso ainda não vinculado</h1>
          <p className="mt-3 leading-7 text-slate-500">
            O cadastro existe, mas este e-mail não possui convite ativo para nenhuma escola.
          </p>
          <button className="mt-6 rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white" onClick={logout} type="button">
            Sair
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f8fb] pb-10 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 w-[min(1120px,calc(100%-32px))] items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white">
              <GraduationCap size={28} />
            </div>
            <div>
              <p className="font-black">MBA Escola</p>
              <p className="text-sm text-slate-500">{superAdmin ? "Administração MBA Labs" : profile?.escola?.nome}</p>
            </div>
          </div>
          <button className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-bold" onClick={logout} type="button">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1120px,calc(100%-32px))] gap-7 py-7">
        <section>
          <p className="text-sm font-black text-[#176b5b]">{superAdmin ? "Dono do sistema" : roleLabel(profile?.papel)}</p>
          <h1 className="mt-1 text-3xl font-black">Olá, {firstName}</h1>
          <p className="mt-2 leading-7 text-slate-500">
            {superAdmin
              ? "Acompanhe as escolas cadastradas e a implantação do MBA Escola."
              : profile?.papel === "responsavel"
                ? "Veja as principais informações escolares dos seus filhos."
                : "Veja os principais registros e ações da rotina escolar."}
          </p>
        </section>

        {superAdmin ? (
          <OwnerDashboard schools={schools} />
        ) : (
          <SchoolDashboard profile={profile!} announcements={announcements} />
        )}
      </div>
    </main>
  );
}

function OwnerDashboard({ schools }: { schools: SchoolRow[] }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={<School size={24} />} label="Escolas cadastradas" value={String(schools.length)} />
        <Metric icon={<UsersRound size={24} />} label="Perfis disponíveis" value="4" />
        <Metric icon={<ShieldCheck size={24} />} label="Ambiente" value="Protegido" />
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-black text-[#176b5b]">Implantação</p>
        <h2 className="mt-1 text-2xl font-black">Escolas</h2>
        <div className="mt-5 grid gap-3">
          {schools.map((school) => (
            <article className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4" key={school.id}>
              <div>
                <p className="font-black">{school.nome}</p>
                <p className="mt-1 text-sm text-slate-500">Status: {school.status === "teste" ? "Em implantação" : school.status}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Ativa</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SchoolDashboard({ profile, announcements }: { profile: SchoolProfile; announcements: Announcement[] }) {
  const guardian = profile.papel === "responsavel";
  const shortcuts = guardian
    ? [
        ["Comunicados", "Avisos da escola e da turma", Bell],
        ["Atividades", "Tarefas e trabalhos pendentes", ClipboardList],
        ["Reuniões", "Datas, horários e registros", CalendarDays],
        ["Meus filhos", "Acompanhamento individual", UsersRound]
      ]
    : [
        ["Comunicado", "Publique uma informação", Bell],
        ["Registrar aula", "Conteúdo e tarefa do dia", BookOpenText],
        ["Atividade", "Crie e acompanhe entregas", ClipboardList],
        ["Reunião", "Agende com os responsáveis", CalendarDays]
      ];

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {shortcuts.map(([label, description, Icon]) => {
          const ShortcutIcon = Icon as typeof Bell;
          return (
            <article className="min-h-36 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" key={String(label)}>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-[#e9f6f2] text-[#176b5b]">
                <ShortcutIcon size={23} />
              </div>
              <h2 className="font-black">{String(label)}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">{String(description)}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-black text-[#176b5b]">Mural</p>
        <h2 className="mt-1 text-2xl font-black">Informações recentes</h2>
        <div className="mt-5 grid gap-3">
          {announcements.length ? announcements.map((announcement) => (
            <article className="rounded-2xl border border-slate-200 p-4" key={announcement.id}>
              <p className="font-black">{announcement.titulo}</p>
              {announcement.resumo ? <p className="mt-1 text-sm leading-6 text-slate-500">{announcement.resumo}</p> : null}
              <p className="mt-2 text-xs font-semibold text-slate-400">{formatDate(announcement.publicado_em)}</p>
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
              <p className="font-black">Nenhuma informação nova</p>
              <p className="mt-2 text-sm text-slate-500">Quando a escola publicar um comunicado, ele aparecerá aqui.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="text-[#176b5b]">{icon}</span>
      <p className="mt-4 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </article>
  );
}

function roleLabel(role?: SchoolProfile["papel"]) {
  const labels = {
    direcao: "Direção",
    coordenacao: "Coordenação",
    professor: "Professor",
    responsavel: "Responsável"
  };
  return role ? labels[role] : "Portal escolar";
}

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}
