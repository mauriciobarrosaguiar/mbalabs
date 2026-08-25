"use client";

import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowLeft,
  Ban,
  Bell,
  CheckCircle2,
  CreditCard,
  FileSearch,
  GraduationCap,
  LoaderCircle,
  Plus,
  ReceiptText,
  School,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMbaEscolaSupabase } from "@/lib/mba-escola/supabase-client";

const supabase = getMbaEscolaSupabase();

type Tab = "visao" | "escolas" | "perfis" | "conteudo" | "planos" | "pagamentos" | "auditoria";
type SchoolRow = { id: string; nome: string; slug: string; status: string };
type ProfileRow = {
  id: string;
  escola_id: string;
  nome: string;
  papel: string;
  email: string | null;
  ativo: boolean;
  is_teste: boolean;
  escola?: { nome?: string } | null;
};
type PlanRow = {
  id: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  limite_alunos: number | null;
  limite_usuarios: number | null;
  ativo: boolean;
};
type PaymentRow = {
  id: string;
  escola_id: string;
  valor: number;
  vencimento: string | null;
  pago_em: string | null;
  status: string;
  escola?: { nome?: string } | null;
};
type AuditRow = {
  id: string;
  acao: string;
  recurso: string;
  ator_tipo: string | null;
  criado_em: string;
  escola?: { nome?: string } | null;
};
type ContentTable = "escola_comunicados" | "escola_atividades" | "escola_aulas" | "escola_acompanhamentos";
type ContentRow = {
  id: string;
  table: ContentTable;
  type: string;
  title: string;
  status: string;
  schoolId: string;
  date: string | null;
};

const testAccounts = [
  ["Admin da Escola", "admin.escola@mbaescola.test"],
  ["Direção", "direcao@mbaescola.test"],
  ["Coordenação", "coordenador@mbaescola.test"],
  ["Professor", "professor@mbaescola.test"],
  ["Responsável", "responsavel@mbaescola.test"]
] as const;

export default function MbaEscolaAdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("visao");
  const [message, setMessage] = useState("");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);

  const load = useCallback(async (activeSession: Session) => {
    setLoading(true);
    setMessage("");

    const { data: admin } = await supabase
      .from("escola_super_admins")
      .select("user_id,ativo")
      .eq("user_id", activeSession.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (!admin) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);

    const [schoolRes, profileRes, planRes, paymentRes, auditRes, commRes, activityRes, classRes, followRes] = await Promise.all([
      supabase.from("escola_escolas").select("id,nome,slug,status").order("nome"),
      supabase.from("escola_perfis").select("id,escola_id,nome,papel,email,ativo,is_teste,escola:escola_escolas(nome)").order("nome"),
      supabase.from("escola_planos").select("id,nome,descricao,preco_mensal,limite_alunos,limite_usuarios,ativo").order("preco_mensal"),
      supabase.from("escola_pagamentos").select("id,escola_id,valor,vencimento,pago_em,status,escola:escola_escolas(nome)").order("criado_em", { ascending: false }).limit(50),
      supabase.from("escola_auditoria").select("id,acao,recurso,ator_tipo,criado_em,escola:escola_escolas(nome)").order("criado_em", { ascending: false }).limit(100),
      supabase.from("escola_comunicados").select("id,escola_id,titulo,status,criado_em").order("criado_em", { ascending: false }).limit(40),
      supabase.from("escola_atividades").select("id,escola_id,titulo,status,criado_em").order("criado_em", { ascending: false }).limit(40),
      supabase.from("escola_aulas").select("id,escola_id,titulo,criado_em").order("criado_em", { ascending: false }).limit(40),
      supabase.from("escola_acompanhamentos").select("id,escola_id,titulo,status,criado_em").order("criado_em", { ascending: false }).limit(40)
    ]);

    setSchools((schoolRes.data ?? []) as SchoolRow[]);
    setProfiles((profileRes.data ?? []) as unknown as ProfileRow[]);
    setPlans((planRes.data ?? []) as PlanRow[]);
    setPayments((paymentRes.data ?? []) as unknown as PaymentRow[]);
    setAudit((auditRes.data ?? []) as unknown as AuditRow[]);

    const merged: ContentRow[] = [
      ...((commRes.data ?? []) as Array<{ id: string; escola_id: string; titulo: string; status: string; criado_em: string | null }>).map((item) => ({ id: item.id, table: "escola_comunicados" as const, type: "Comunicado", title: item.titulo, status: item.status, schoolId: item.escola_id, date: item.criado_em })),
      ...((activityRes.data ?? []) as Array<{ id: string; escola_id: string; titulo: string; status: string; criado_em: string | null }>).map((item) => ({ id: item.id, table: "escola_atividades" as const, type: "Atividade", title: item.titulo, status: item.status, schoolId: item.escola_id, date: item.criado_em })),
      ...((classRes.data ?? []) as Array<{ id: string; escola_id: string; titulo: string; criado_em: string | null }>).map((item) => ({ id: item.id, table: "escola_aulas" as const, type: "Aula", title: item.titulo, status: "registrada", schoolId: item.escola_id, date: item.criado_em })),
      ...((followRes.data ?? []) as Array<{ id: string; escola_id: string; titulo: string; status: string; criado_em: string | null }>).map((item) => ({ id: item.id, table: "escola_acompanhamentos" as const, type: "Acompanhamento", title: item.titulo, status: item.status, schoolId: item.escola_id, date: item.criado_em }))
    ].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

    setContent(merged.slice(0, 80));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void load(data.session);
      else setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void load(nextSession);
      else {
        setAuthorized(false);
        setLoading(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [load]);

  const schoolName = useMemo(() => new Map(schools.map((school) => [school.id, school.nome])), [schools]);
  const refresh = () => { if (session) void load(session); };

  async function createSchool(formData: FormData) {
    const nome = String(formData.get("nome") || "").trim();
    if (!nome) return;
    const slug = `${normalizeSlug(nome)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("escola_escolas").insert({ nome, slug, status: "teste" });
    setMessage(error ? error.message : "Escola criada.");
    if (!error) refresh();
  }

  async function changeSchoolStatus(id: string, status: string) {
    const { error } = await supabase.from("escola_escolas").update({ status }).eq("id", id);
    setMessage(error ? error.message : "Status da escola atualizado.");
    if (!error) refresh();
  }

  async function removeSchool(id: string, nome: string) {
    if (!window.confirm(`Excluir a escola ${nome}? Os dados escolares vinculados também serão removidos.`)) return;
    const { error } = await supabase.from("escola_escolas").delete().eq("id", id);
    setMessage(error ? error.message : "Escola excluída.");
    if (!error) refresh();
  }

  async function createInvite(formData: FormData) {
    const escola_id = String(formData.get("escola_id") || "");
    const nome = String(formData.get("nome") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const papel = String(formData.get("papel") || "");
    if (!escola_id || !nome || !email || !papel) return;
    const { error } = await supabase.from("escola_convites").insert({ escola_id, nome, email, papel, status: "pendente" });
    setMessage(error ? error.message : "Convite criado. O usuário deve entrar com a conta já liberada na MBA Labs.");
  }

  async function toggleProfile(profile: ProfileRow) {
    const { error } = await supabase.from("escola_perfis").update({ ativo: !profile.ativo }).eq("id", profile.id);
    setMessage(error ? error.message : profile.ativo ? "Perfil inativado." : "Perfil reativado.");
    if (!error) refresh();
  }

  async function removeProfile(profile: ProfileRow) {
    if (!window.confirm(`Excluir o perfil ${profile.nome}?`)) return;
    const { error } = await supabase.from("escola_perfis").delete().eq("id", profile.id);
    setMessage(error ? error.message : "Perfil removido do MBA Escola.");
    if (!error) refresh();
  }

  async function createPlan(formData: FormData) {
    const nome = String(formData.get("nome") || "").trim();
    const preco = Number(formData.get("preco_mensal") || 0);
    if (!nome) return;
    const { error } = await supabase.from("escola_planos").insert({
      nome,
      descricao: String(formData.get("descricao") || "").trim() || null,
      preco_mensal: Number.isFinite(preco) ? preco : 0,
      limite_alunos: Number(formData.get("limite_alunos") || 0) || null,
      limite_usuarios: Number(formData.get("limite_usuarios") || 0) || null,
      ativo: true
    });
    setMessage(error ? error.message : "Plano criado.");
    if (!error) refresh();
  }

  async function togglePlan(plan: PlanRow) {
    const { error } = await supabase.from("escola_planos").update({ ativo: !plan.ativo }).eq("id", plan.id);
    setMessage(error ? error.message : "Plano atualizado.");
    if (!error) refresh();
  }

  async function createPayment(formData: FormData) {
    const escola_id = String(formData.get("escola_id") || "");
    const valor = Number(formData.get("valor") || 0);
    const vencimento = String(formData.get("vencimento") || "") || null;
    if (!escola_id || !Number.isFinite(valor)) return;
    const { error } = await supabase.from("escola_pagamentos").insert({ escola_id, valor, vencimento, status: "pendente" });
    setMessage(error ? error.message : "Cobrança registrada.");
    if (!error) refresh();
  }

  async function markPaid(payment: PaymentRow) {
    const { error } = await supabase.from("escola_pagamentos").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", payment.id);
    setMessage(error ? error.message : "Pagamento marcado como pago.");
    if (!error) refresh();
  }

  async function removeContent(item: ContentRow) {
    if (!window.confirm(`Excluir ${item.type.toLowerCase()}: ${item.title}?`)) return;
    const { error } = await supabase.from(item.table).delete().eq("id", item.id);
    setMessage(error ? error.message : "Conteúdo excluído.");
    if (!error) refresh();
  }

  if (loading) return <Loading />;

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900">
        <section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <ShieldCheck className="mx-auto text-[#176b5b]" size={44} />
          <h1 className="mt-5 text-2xl font-black">Renove o acesso pelo MBA Escola</h1>
          <p className="mt-3 text-slate-500">A sessão escolar é criada automaticamente a partir da MBA Labs.</p>
          <Link className="mt-6 inline-flex rounded-2xl bg-[#176b5b] px-5 py-3 font-black text-white" href="/mba-escola">Renovar acesso</Link>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900">
        <section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <Ban className="mx-auto text-rose-600" size={44} />
          <h1 className="mt-5 text-2xl font-black">Acesso exclusivo do ADMIN MBA</h1>
          <p className="mt-3 text-slate-500">Esta área só pode ser aberta pelo proprietário do MBA Escola.</p>
          <Link className="mt-6 inline-flex rounded-2xl border border-slate-300 px-5 py-3 font-black" href="/mba-escola">Voltar</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f8fb] pb-12 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 w-[min(1280px,calc(100%-28px))] items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white"><GraduationCap size={28} /></div><div><p className="font-black">MBA Escola</p><p className="text-sm text-slate-500">ADMIN MBA · Proprietário</p></div></div>
          <Link className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-bold" href="/mba-escola"><ArrowLeft size={18} /> Portal</Link>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1280px,calc(100%-28px))] gap-6 py-7">
        <section><p className="text-sm font-black uppercase tracking-[.16em] text-[#176b5b]">Controle total</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Painel do proprietário</h1><p className="mt-2 max-w-3xl leading-7 text-slate-500">Escolas, usuários, publicações, planos, cobranças e auditoria em um único lugar.</p></section>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {([
            ["visao", "Visão geral", ShieldCheck], ["escolas", "Escolas", School], ["perfis", "Perfis", UserCog],
            ["conteudo", "Conteúdo", FileSearch], ["planos", "Planos", CreditCard], ["pagamentos", "Pagamentos", ReceiptText], ["auditoria", "Auditoria", Activity]
          ] as const).map(([key, label, Icon]) => (
            <button key={key} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === key ? "bg-[#176b5b] text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setTab(key)} type="button"><Icon size={17} />{label}</button>
          ))}
        </nav>

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}

        {tab === "visao" ? <Overview schools={schools} profiles={profiles} content={content} payments={payments} /> : null}
        {tab === "escolas" ? <SchoolsTab schools={schools} createSchool={createSchool} changeStatus={changeSchoolStatus} removeSchool={removeSchool} /> : null}
        {tab === "perfis" ? <ProfilesTab schools={schools} profiles={profiles} createInvite={createInvite} toggleProfile={toggleProfile} removeProfile={removeProfile} /> : null}
        {tab === "conteudo" ? <ContentTab content={content} schoolName={schoolName} removeContent={removeContent} /> : null}
        {tab === "planos" ? <PlansTab plans={plans} createPlan={createPlan} togglePlan={togglePlan} /> : null}
        {tab === "pagamentos" ? <PaymentsTab schools={schools} payments={payments} createPayment={createPayment} markPaid={markPaid} /> : null}
        {tab === "auditoria" ? <AuditTab audit={audit} /> : null}
      </div>
    </main>
  );
}

function Overview({ schools, profiles, content, payments }: { schools: SchoolRow[]; profiles: ProfileRow[]; content: ContentRow[]; payments: PaymentRow[] }) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Escolas" value={String(schools.length)} icon={<School size={23} />} />
        <Metric label="Perfis" value={String(profiles.length)} icon={<UsersRound size={23} />} />
        <Metric label="Conteúdos" value={String(content.length)} icon={<Bell size={23} />} />
        <Metric label="Cobranças pendentes" value={String(payments.filter((p) => p.status === "pendente" || p.status === "atrasado").length)} icon={<CreditCard size={23} />} />
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-[#176b5b]">Ambiente de testes</p><h2 className="mt-1 text-2xl font-black">Acessos fake</h2><p className="mt-2 text-sm text-slate-500">Todos usam a senha <strong className="text-slate-900">123456</strong>.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{testAccounts.map(([role, email]) => <div className="rounded-2xl border border-slate-200 p-4" key={email}><p className="font-black">{role}</p><p className="mt-1 break-all text-sm text-slate-500">{email}</p></div>)}</div>
      </section>
    </div>
  );
}

function SchoolsTab({ schools, createSchool, changeStatus, removeSchool }: { schools: SchoolRow[]; createSchool: (f: FormData) => Promise<void>; changeStatus: (id: string, status: string) => Promise<void>; removeSchool: (id: string, nome: string) => Promise<void> }) {
  return <div className="grid gap-5 lg:grid-cols-[340px_1fr]"><FormCard title="Adicionar escola"><form action={createSchool} className="grid gap-3"><Input name="nome" placeholder="Nome da escola" /><Submit label="Criar escola" /></form></FormCard><ListCard title="Escolas cadastradas">{schools.map((school) => <Row key={school.id} title={school.nome} subtitle={`Status: ${school.status}`}><select className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold" value={school.status} onChange={(e) => void changeStatus(school.id, e.target.value)}><option value="teste">Teste</option><option value="ativa">Ativa</option><option value="bloqueada">Bloqueada</option><option value="cancelada">Cancelada</option></select><IconButton label="Excluir" danger onClick={() => void removeSchool(school.id, school.nome)} icon={<Trash2 size={17} />} /></Row>)}</ListCard></div>;
}

function ProfilesTab({ schools, profiles, createInvite, toggleProfile, removeProfile }: { schools: SchoolRow[]; profiles: ProfileRow[]; createInvite: (f: FormData) => Promise<void>; toggleProfile: (p: ProfileRow) => Promise<void>; removeProfile: (p: ProfileRow) => Promise<void> }) {
  return <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><FormCard title="Adicionar perfil"><form action={createInvite} className="grid gap-3"><Input name="nome" placeholder="Nome" /><Input name="email" placeholder="E-mail" type="email" /><Select name="escola_id" options={schools.map((s) => [s.id, s.nome])} placeholder="Selecione a escola" /><Select name="papel" options={[["admin_escola","Admin da Escola"],["direcao","Direção"],["coordenacao","Coordenação"],["professor","Professor"],["responsavel","Responsável"]]} placeholder="Selecione o cargo" /><Submit label="Criar convite" /></form></FormCard><ListCard title="Perfis e acessos">{profiles.map((profile) => <Row key={profile.id} title={profile.nome} subtitle={`${roleLabel(profile.papel)} · ${profile.escola?.nome || "Escola"}${profile.is_teste ? " · TESTE" : ""}`}><span className={`rounded-full px-3 py-1 text-xs font-black ${profile.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{profile.ativo ? "Ativo" : "Inativo"}</span><IconButton label={profile.ativo ? "Inativar" : "Reativar"} onClick={() => void toggleProfile(profile)} icon={profile.ativo ? <Ban size={17} /> : <CheckCircle2 size={17} />} /><IconButton label="Excluir" danger onClick={() => void removeProfile(profile)} icon={<Trash2 size={17} />} /></Row>)}</ListCard></div>;
}

function ContentTab({ content, schoolName, removeContent }: { content: ContentRow[]; schoolName: Map<string, string>; removeContent: (item: ContentRow) => Promise<void> }) {
  return <ListCard title="Tudo que foi publicado/registrado">{content.length ? content.map((item) => <Row key={`${item.table}-${item.id}`} title={item.title} subtitle={`${item.type} · ${schoolName.get(item.schoolId) || "Escola"} · ${item.status} · ${formatDate(item.date)}`}><IconButton label="Excluir" danger onClick={() => void removeContent(item)} icon={<Trash2 size={17} />} /></Row>) : <Empty text="Nenhum conteúdo registrado." />}</ListCard>;
}

function PlansTab({ plans, createPlan, togglePlan }: { plans: PlanRow[]; createPlan: (f: FormData) => Promise<void>; togglePlan: (p: PlanRow) => Promise<void> }) {
  return <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><FormCard title="Novo plano"><form action={createPlan} className="grid gap-3"><Input name="nome" placeholder="Nome do plano" /><Input name="descricao" placeholder="Descrição" required={false} /><Input name="preco_mensal" placeholder="Preço mensal" type="number" step="0.01" /><Input name="limite_alunos" placeholder="Limite de alunos" type="number" required={false} /><Input name="limite_usuarios" placeholder="Limite de usuários" type="number" required={false} /><Submit label="Criar plano" /></form></FormCard><ListCard title="Planos">{plans.map((plan) => <Row key={plan.id} title={plan.nome} subtitle={`R$ ${Number(plan.preco_mensal).toFixed(2)} / mês · ${plan.limite_alunos ?? "∞"} alunos · ${plan.limite_usuarios ?? "∞"} usuários`}><IconButton label={plan.ativo ? "Inativar" : "Ativar"} onClick={() => void togglePlan(plan)} icon={plan.ativo ? <Ban size={17} /> : <CheckCircle2 size={17} />} /></Row>)}</ListCard></div>;
}

function PaymentsTab({ schools, payments, createPayment, markPaid }: { schools: SchoolRow[]; payments: PaymentRow[]; createPayment: (f: FormData) => Promise<void>; markPaid: (p: PaymentRow) => Promise<void> }) {
  return <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><FormCard title="Registrar cobrança"><form action={createPayment} className="grid gap-3"><Select name="escola_id" options={schools.map((s) => [s.id, s.nome])} placeholder="Selecione a escola" /><Input name="valor" placeholder="Valor" type="number" step="0.01" /><Input name="vencimento" type="date" required={false} /><Submit label="Registrar cobrança" /></form></FormCard><ListCard title="Pagamentos">{payments.length ? payments.map((payment) => <Row key={payment.id} title={`${payment.escola?.nome || "Escola"} · R$ ${Number(payment.valor).toFixed(2)}`} subtitle={`${payment.status} · vencimento ${formatDate(payment.vencimento)}`}><span className={`rounded-full px-3 py-1 text-xs font-black ${payment.status === "pago" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{payment.status}</span>{payment.status !== "pago" ? <IconButton label="Marcar pago" onClick={() => void markPaid(payment)} icon={<CheckCircle2 size={17} />} /> : null}</Row>) : <Empty text="Nenhuma cobrança registrada." />}</ListCard></div>;
}

function AuditTab({ audit }: { audit: AuditRow[] }) {
  return <ListCard title="Auditoria do sistema">{audit.length ? audit.map((item) => <Row key={item.id} title={`${item.acao.toUpperCase()} · ${item.recurso}`} subtitle={`${item.escola?.nome || "Sistema"} · ${item.ator_tipo || "sistema"} · ${formatDateTime(item.criado_em)}`} />) : <Empty text="Ainda não há registros de auditoria." />}</ListCard>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-[#176b5b]">{icon}</span><p className="mt-4 text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></article>; }
function FormCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">{title}</h2><div className="mt-4">{children}</div></section>; }
function ListCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">{title}</h2><div className="mt-4 grid gap-3">{children}</div></section>; }
function Row({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) { return <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><p className="font-black">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p></div>{children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}</article>; }
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} required={props.required ?? true} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#176b5b] focus:ring-4 focus:ring-emerald-100" />; }
function Select({ name, options, placeholder }: { name: string; options: ReadonlyArray<readonly [string, string]>; placeholder: string }) { return <select name={name} required defaultValue="" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"><option value="" disabled>{placeholder}</option>{options.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>; }
function Submit({ label }: { label: string }) { return <button className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white" type="submit"><Plus size={18} />{label}</button>; }
function IconButton({ label, icon, onClick, danger }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) { return <button className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-black ${danger ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`} onClick={onClick} type="button">{icon}{label}</button>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center text-sm font-bold text-slate-500">{text}</div>; }
function Loading() { return <main className="grid min-h-screen place-items-center bg-[#f5f8fb]"><LoaderCircle className="animate-spin text-[#176b5b]" size={38} /></main>; }
function roleLabel(role: string) { return ({ admin_escola: "Admin da Escola", direcao: "Direção", coordenacao: "Coordenação", professor: "Professor", responsavel: "Responsável", aluno: "Aluno" } as Record<string, string>)[role] || role; }
function normalizeSlug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function formatDate(value: string | null) { if (!value) return "não informado"; try { return new Intl.DateTimeFormat("pt-BR").format(new Date(value)); } catch { return "não informado"; } }
function formatDateTime(value: string | null) { if (!value) return "não informado"; try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); } catch { return "não informado"; } }
