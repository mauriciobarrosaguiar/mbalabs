"use client";

import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Crown,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  School,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMbaEscolaSupabase } from "@/lib/mba-escola/supabase-client";
import SchoolPortal from "./school-portal";

const supabase = getMbaEscolaSupabase();

type SchoolRole = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type PortalRole = SchoolRole;
type Profile = { nome: string; papel: SchoolRole; escola_id: string; escola: { nome: string } | null };
type MembershipRow = {
  escola_id: string;
  escola_nome: string;
  escola_status: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  papel: string;
  ativo: boolean;
  is_teste: boolean;
  criado_em: string;
};
type Admin = { nome: string; email: string };
type SchoolRow = { id: string; nome: string; status: string };
type MetricTone = "blue" | "violet" | "green";

const validRoles = new Set<SchoolRole>(["admin_escola", "direcao", "coordenacao", "professor", "responsavel"]);

export default function MbaEscolaClientV2() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [switchingSchool, setSwitchingSchool] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Profile[]>([]);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadAccount = useCallback(async () => {
    if (!session?.user) return;
    setPageLoading(true);
    setAccountError("");
    setAdmin(null);
    setProfile(null);
    setMemberships([]);
    setSchools([]);

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

    const [membershipResult, currentSchoolResult] = await Promise.all([
      supabase.rpc("escola_my_memberships"),
      supabase.rpc("escola_current_school_id")
    ]);

    if (membershipResult.error) {
      setAccountError(membershipResult.error.message);
      setPageLoading(false);
      return;
    }

    const rows = ((membershipResult.data ?? []) as MembershipRow[]).filter(
      row => row.ativo && ["ativa", "teste"].includes(row.escola_status) && validRoles.has(row.papel as SchoolRole)
    );
    const available = rows.map(toProfile);
    setMemberships(available);

    if (!available.length) {
      setPageLoading(false);
      return;
    }

    let selectedSchoolId = typeof currentSchoolResult.data === "string" ? currentSchoolResult.data : "";
    let selected = available.find(item => item.escola_id === selectedSchoolId) ?? null;

    if (!selected) {
      selected = available[0];
      const { error: selectionError } = await supabase.rpc("escola_select_school", { p_escola_id: selected.escola_id });
      if (selectionError) {
        setAccountError(selectionError.message);
        setPageLoading(false);
        return;
      }
      selectedSchoolId = selected.escola_id;
    }

    setProfile(selected);
    setPageLoading(false);
  }, [session]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function selectSchool(escolaId: string) {
    if (!profile || profile.escola_id === escolaId || switchingSchool) return;
    const next = memberships.find(item => item.escola_id === escolaId);
    if (!next) return;

    setSwitchingSchool(true);
    setAccountError("");
    const { error } = await supabase.rpc("escola_select_school", { p_escola_id: escolaId });
    if (error) setAccountError(error.message);
    else {
      setProfile(next);
      window.history.replaceState(null, "", "/mba-escola");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setSwitchingSchool(false);
  }

  const firstName = useMemo(
    () => (admin?.nome || profile?.nome || session?.user.email || "Usuário").split(" ")[0],
    [admin, profile, session]
  );

  if (authLoading && !session) return <Loading />;

  if (!session) {
    return (
      <Centered>
        <ShieldCheck className="mx-auto text-amber-600" size={42} />
        <h1 className="mt-5 text-2xl font-black">Sessão escolar indisponível</h1>
        <p className="mt-3 text-slate-500">
          Volte à entrada do MBA Escola para renovar automaticamente o acesso pela MBA Labs.
        </p>
        <Link
          className="mt-6 inline-flex rounded-xl bg-[#4353C7] px-5 py-3 font-bold text-white shadow-lg shadow-indigo-200"
          href="/mba-escola"
        >
          Renovar acesso
        </Link>
      </Centered>
    );
  }

  if (pageLoading) return <Loading />;

  if (!profile && !admin) {
    return (
      <Centered>
        <ShieldCheck className="mx-auto text-amber-600" size={42} />
        <h1 className="mt-5 text-2xl font-black">Acesso não vinculado</h1>
        <p className="mt-3 text-slate-500">Este usuário não possui um vínculo escolar ativo e liberado.</p>
        {accountError ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{accountError}</p> : null}
        <Link
          className="mt-6 inline-flex rounded-xl bg-[#4353C7] px-5 py-3 font-bold text-white shadow-lg shadow-indigo-200"
          href="/dashboard"
        >
          Voltar para MBA Labs
        </Link>
      </Centered>
    );
  }

  return (
    <main className="cotacoes-module min-h-screen bg-[#F6F8FC] pb-12 text-[#172033]">
      <header className="border-b border-[#E7EBF3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 w-[min(1180px,calc(100%-32px))] flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#4353C7] to-[#19A89A] text-white shadow-lg shadow-indigo-100">
              <GraduationCap size={28} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight">MBA Escola</p>
              <p className="truncate text-sm text-slate-500">{admin ? "Administração MBA" : profile?.escola?.nome}</p>
            </div>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {!admin && profile && memberships.length > 1 ? (
              <label className="min-w-0">
                <span className="sr-only">Selecionar escola</span>
                <select
                  aria-label="Selecionar escola"
                  className="min-h-11 max-w-[230px] rounded-xl border border-[#DDE3EE] bg-white px-3 text-sm font-black text-[#2F3A52] shadow-sm outline-none focus:border-[#6574D9] focus:ring-4 focus:ring-[#EEF1FF] sm:max-w-[320px]"
                  disabled={switchingSchool}
                  onChange={event => void selectSchool(event.target.value)}
                  value={profile.escola_id}
                >
                  {memberships.map(item => (
                    <option key={`${item.escola_id}:${item.papel}`} value={item.escola_id}>
                      {item.escola?.nome || "Escola"} · {roleLabel(item.papel)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {switchingSchool ? <LoaderCircle className="animate-spin text-[#4353C7]" size={19} /> : null}
            <Link
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#DDE3EE] bg-white px-3.5 text-sm font-black text-[#2F3A52] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              href="/dashboard"
            >
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline">MBA Labs</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-6 py-6 sm:py-8">
        {accountError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{accountError}</p> : null}

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3546AE] via-[#5061D3] to-[#1FA69A] p-6 text-white shadow-[0_24px_60px_-34px_rgba(67,83,199,0.75)] sm:p-8">
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 left-20 h-44 w-44 rounded-full bg-cyan-200/10 blur-2xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.12em] text-white/90">
                {admin ? <Crown size={15} /> : <Sparkles size={15} />}
                {admin ? "ADMIN MBA · Proprietário" : roleLabel(profile!.papel)}
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Olá, {firstName}</h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
                {admin ? "Sua central para acompanhar e administrar toda a operação do MBA Escola." : roleDescription(profile!.papel)}
              </p>
              {!admin && memberships.length > 1 ? (
                <p className="mt-3 text-sm font-bold text-white/75">Você possui acesso a {memberships.length} escolas. Use o seletor acima para alternar com segurança.</p>
              ) : null}
            </div>
            {admin ? (
              <Link
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 font-black text-[#3546AE] shadow-lg shadow-indigo-950/10 transition hover:-translate-y-0.5"
                href="/mba-escola/admin"
              >
                Abrir administração <ArrowRight size={19} />
              </Link>
            ) : null}
          </div>
        </section>

        {admin ? (
          <OwnerDashboard schools={schools} />
        ) : (
          <SchoolPortal key={`${profile!.escola_id}:${profile!.papel}`} supabase={supabase} profile={profile as Profile & { papel: PortalRole }} />
        )}
      </div>
    </main>
  );
}

function toProfile(row: MembershipRow): Profile {
  return {
    nome: row.nome,
    papel: row.papel as SchoolRole,
    escola_id: row.escola_id,
    escola: { nome: row.escola_nome }
  };
}

function Loading() {
  return (
    <main className="cotacoes-module grid min-h-screen place-items-center bg-[#F6F8FC]">
      <LoaderCircle className="animate-spin text-[#4353C7]" size={36} />
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="cotacoes-module grid min-h-screen place-items-center bg-[#F6F8FC] p-4 text-[#172033]">
      <section className="w-full max-w-lg rounded-[28px] border border-[#E5EAF2] bg-white p-8 text-center shadow-[0_24px_70px_-45px_rgba(30,41,59,0.5)]">
        {children}
      </section>
    </main>
  );
}

function OwnerDashboard({ schools }: { schools: SchoolRow[] }) {
  const activeSchools = schools.filter(school => ["ativa", "teste"].includes(school.status)).length;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<School size={21} />} label="Escolas cadastradas" value={String(schools.length)} tone="blue" />
        <Metric icon={<Crown size={21} />} label="Nível de acesso" value="Proprietário" tone="violet" />
        <Metric icon={<Activity size={21} />} label="Ambiente" value="Ativo" tone="green" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <article className="rounded-[24px] border border-[#E4E8F2] bg-white p-5 shadow-[0_18px_50px_-40px_rgba(30,41,59,0.55)] sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF1FF] text-[#4353C7]">
              <LayoutDashboard size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#6876D8]">Central administrativa</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#172033]">Painel do ADMIN MBA</h2>
              <p className="mt-2 leading-6 text-slate-500">Escolas, perfis, planos, pagamentos e auditoria em um único lugar.</p>
              <Link
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#4353C7] px-4 font-black text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-[#3847B4]"
                href="/mba-escola/admin"
              >
                Abrir painel <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#D8EFEA] bg-gradient-to-br from-[#F2FBF9] to-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#59827B]">Escolas operacionais</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-[#167F73]">{activeSchools}</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#DFF7F2] text-[#168B7E]">
              <CheckCircle2 size={25} />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">Considera escolas ativas e ambientes de teste.</p>
        </article>
      </section>

      <section className="rounded-[24px] border border-[#E4E8F2] bg-white p-5 shadow-[0_18px_50px_-42px_rgba(30,41,59,0.5)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">Rede MBA Escola</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Escolas cadastradas</h2>
          </div>
          <span className="rounded-full bg-[#EEF1FF] px-3 py-1 text-sm font-black text-[#4353C7]">{schools.length}</span>
        </div>

        {schools.length ? (
          <div className="mt-4 grid gap-2">
            {schools.map(school => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#EDF0F5] bg-[#FAFBFD] p-4" key={school.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#4353C7] shadow-sm">
                    <School size={19} />
                  </div>
                  <b className="truncate">{school.nome}</b>
                </div>
                <span className="shrink-0 rounded-full bg-[#E8F8F4] px-2.5 py-1 text-xs font-black capitalize text-[#167F73]">{school.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-[#D9DFEA] bg-[#FAFBFD] px-5 py-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EEF1FF] text-[#4353C7]">
              <School size={23} />
            </div>
            <p className="mt-3 font-black">Nenhuma escola cadastrada ainda</p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Abra o painel administrativo para criar a primeira escola e iniciar os testes.</p>
          </div>
        )}
      </section>
    </>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: MetricTone }) {
  const styles: Record<MetricTone, { card: string; icon: string; label: string; value: string }> = {
    blue: {
      card: "border-[#DCE3FF] bg-gradient-to-br from-[#F4F6FF] to-white",
      icon: "bg-[#E6EAFF] text-[#4353C7]",
      label: "text-[#6672A3]",
      value: "text-[#273678]"
    },
    violet: {
      card: "border-[#E8DDF9] bg-gradient-to-br from-[#FAF7FF] to-white",
      icon: "bg-[#F0E8FF] text-[#7950B8]",
      label: "text-[#7D6B94]",
      value: "text-[#553780]"
    },
    green: {
      card: "border-[#D8EFEA] bg-gradient-to-br from-[#F2FBF9] to-white",
      icon: "bg-[#DFF7F2] text-[#168B7E]",
      label: "text-[#59827B]",
      value: "text-[#167F73]"
    }
  };
  const style = styles[tone];

  return (
    <article className={`rounded-[22px] border p-4 shadow-[0_15px_40px_-36px_rgba(30,41,59,0.5)] sm:p-5 ${style.card}`}>
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${style.icon}`}>{icon}</div>
      <p className={`mt-4 text-sm font-bold ${style.label}`}>{label}</p>
      <p className={`mt-1 text-2xl font-black tracking-tight ${style.value}`}>{value}</p>
    </article>
  );
}

function roleLabel(role: SchoolRole) {
  return (
    {
      admin_escola: "Admin da Escola",
      direcao: "Direção",
      coordenacao: "Coordenação",
      professor: "Professor",
      responsavel: "Responsável"
    } as Record<SchoolRole, string>
  )[role];
}

function roleDescription(role: SchoolRole) {
  if (role === "admin_escola" || role === "direcao") return "Administre a escola em cinco áreas simples: Hoje, Acadêmico, Alunos, Comunicação e Gestão.";
  if (role === "coordenacao") return "Acompanhe o dia, a rotina acadêmica, alunos, comunicação e relatórios.";
  if (role === "professor") return "Veja o dia, suas aulas, atividades, alunos e comunicação em uma única navegação.";
  if (role === "responsavel") return "Acompanhe seus filhos, pendências e agenda sem precisar procurar em vários módulos.";
  return "Acompanhamento disponível pelo perfil Responsável.";
}
