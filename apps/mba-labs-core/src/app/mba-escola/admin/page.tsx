"use client";

import type { Session } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
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

type Tab = "visao" | "escolas" | "perfis" | "planos" | "pagamentos" | "auditoria";
type MetricTone = "blue" | "green" | "violet" | "amber";
type SchoolRow = { id: string; nome: string; slug: string; status: string };
type ProfileRow = { id: string; escola_id: string; nome: string; papel: string; email: string | null; ativo: boolean; is_teste: boolean; escola?: { nome?: string } | null };
type PlanRow = { id: string; nome: string; descricao: string | null; preco_mensal: number; limite_alunos: number | null; limite_usuarios: number | null; ativo: boolean };
type PaymentRow = { id: string; escola_id: string; valor: number; vencimento: string | null; pago_em: string | null; status: string; escola?: { nome?: string } | null };
type AuditRow = { id: string; acao: string; recurso: string; ator_tipo: string | null; criado_em: string; escola?: { nome?: string } | null };

type TabItem = { id: Tab; label: string; icon: LucideIcon };

const tabs: TabItem[] = [
  { id: "visao", label: "Visão geral", icon: LayoutDashboard },
  { id: "escolas", label: "Escolas", icon: School },
  { id: "perfis", label: "Perfis", icon: UsersRound },
  { id: "planos", label: "Planos", icon: ReceiptText },
  { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
  { id: "auditoria", label: "Auditoria", icon: ShieldCheck }
];

const field = "min-h-11 w-full rounded-xl border border-[#DCE2EC] bg-white px-3 py-2 text-sm text-[#172033] outline-none transition placeholder:text-slate-400 focus:border-[#6574D9] focus:ring-4 focus:ring-[#EEF1FF]";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4353C7] px-4 font-black text-white shadow-lg shadow-indigo-100 transition hover:-translate-y-0.5 hover:bg-[#3948B6] disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE2EC] bg-white px-3 text-sm font-bold text-[#465169] shadow-sm transition hover:bg-[#F7F8FC] disabled:opacity-50";

export default function MbaEscolaAdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("visao");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const load = useCallback(async (activeSession: Session) => {
    setLoading(true);
    setError("");

    const { data: admin, error: adminError } = await supabase
      .from("escola_super_admins")
      .select("user_id,ativo")
      .eq("user_id", activeSession.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (adminError || !admin) {
      setAuthorized(false);
      setError(adminError?.message || "Este usuário não possui acesso de ADMIN MBA.");
      setLoading(false);
      return;
    }

    setAuthorized(true);
    const [schoolRes, profileRes, planRes, paymentRes, auditRes] = await Promise.all([
      supabase.from("escola_escolas").select("id,nome,slug,status").order("nome"),
      supabase.from("escola_perfis").select("id,escola_id,nome,papel,email,ativo,is_teste,escola:escola_escolas(nome)").order("nome"),
      supabase.from("escola_planos").select("id,nome,descricao,preco_mensal,limite_alunos,limite_usuarios,ativo").order("preco_mensal"),
      supabase.from("escola_pagamentos").select("id,escola_id,valor,vencimento,pago_em,status,escola:escola_escolas(nome)").order("criado_em", { ascending: false }).limit(100),
      supabase.from("escola_auditoria").select("id,acao,recurso,ator_tipo,criado_em,escola:escola_escolas(nome)").order("criado_em", { ascending: false }).limit(150)
    ]);

    const firstError = [schoolRes, profileRes, planRes, paymentRes, auditRes].find(item => item.error)?.error;
    if (firstError) setError(firstError.message);

    setSchools((schoolRes.data ?? []) as SchoolRow[]);
    setProfiles((profileRes.data ?? []) as unknown as ProfileRow[]);
    setPlans((planRes.data ?? []) as PlanRow[]);
    setPayments((paymentRes.data ?? []) as unknown as PaymentRow[]);
    setAudit((auditRes.data ?? []) as unknown as AuditRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void load(data.session);
      else setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) void load(next);
      else {
        setAuthorized(false);
        setLoading(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [load]);

  const schoolMap = useMemo(() => new Map(schools.map(item => [item.id, item.nome])), [schools]);
  const activeSchools = schools.filter(item => ["ativa", "teste"].includes(item.status)).length;
  const activeProfiles = profiles.filter(item => item.ativo).length;
  const pendingPayments = payments.filter(item => item.status !== "pago").length;
  const refresh = () => {
    if (session) void load(session);
  };

  async function createSchool(formData: FormData) {
    const nome = String(formData.get("nome") || "").trim();
    if (!nome) return;
    const slug = `${normalizeSlug(nome)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error: actionError } = await supabase.from("escola_escolas").insert({ nome, slug, status: "teste" });
    setMessage(actionError ? "" : "Escola criada.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  async function changeSchoolStatus(id: string, status: string) {
    const { error: actionError } = await supabase.from("escola_escolas").update({ status }).eq("id", id);
    setMessage(actionError ? "" : "Status atualizado.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  async function removeSchool(id: string, nome: string) {
    if (!window.confirm(`Excluir a escola ${nome}? Os dados vinculados serão removidos.`)) return;
    const { error: actionError } = await supabase.from("escola_escolas").delete().eq("id", id);
    setMessage(actionError ? "" : "Escola excluída.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  async function createInvite(formData: FormData) {
    const escola_id = String(formData.get("escola_id") || "");
    const nome = String(formData.get("nome") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const papel = String(formData.get("papel") || "");
    if (!escola_id || !nome || !email || !papel) return;
    const { error: actionError } = await supabase.from("escola_convites").insert({ escola_id, nome, email, papel, status: "pendente" });
    setMessage(actionError ? "" : "Acesso escolar preparado. O usuário entrará com a mesma conta da MBA Labs.");
    setError(actionError?.message || "");
  }

  async function toggleProfile(profile: ProfileRow) {
    const { error: actionError } = await supabase.from("escola_perfis").update({ ativo: !profile.ativo }).eq("id", profile.id);
    setMessage(actionError ? "" : profile.ativo ? "Perfil inativado." : "Perfil reativado.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  async function removeProfile(profile: ProfileRow) {
    if (!window.confirm(`Remover o vínculo escolar de ${profile.nome}? A conta MBA Labs não será excluída.`)) return;
    const { error: actionError } = await supabase.from("escola_perfis").delete().eq("id", profile.id);
    setMessage(actionError ? "" : "Vínculo escolar removido. A conta central foi preservada.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  async function createPlan(formData: FormData) {
    const nome = String(formData.get("nome") || "").trim();
    if (!nome) return;
    const preco = Number(formData.get("preco_mensal") || 0);
    const { error: actionError } = await supabase.from("escola_planos").insert({
      nome,
      descricao: String(formData.get("descricao") || "").trim() || null,
      preco_mensal: Number.isFinite(preco) ? preco : 0,
      limite_alunos: Number(formData.get("limite_alunos") || 0) || null,
      limite_usuarios: Number(formData.get("limite_usuarios") || 0) || null,
      ativo: true
    });
    setMessage(actionError ? "" : "Plano criado.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  async function togglePlan(plan: PlanRow) {
    const { error: actionError } = await supabase.from("escola_planos").update({ ativo: !plan.ativo }).eq("id", plan.id);
    setMessage(actionError ? "" : "Plano atualizado.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  async function createPayment(formData: FormData) {
    const escola_id = String(formData.get("escola_id") || "");
    const valor = Number(formData.get("valor") || 0);
    const vencimento = String(formData.get("vencimento") || "") || null;
    if (!escola_id || !Number.isFinite(valor)) return;
    const { error: actionError } = await supabase.from("escola_pagamentos").insert({ escola_id, valor, vencimento, status: "pendente" });
    setMessage(actionError ? "" : "Cobrança registrada.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  async function markPaid(payment: PaymentRow) {
    const { error: actionError } = await supabase
      .from("escola_pagamentos")
      .update({ status: "pago", pago_em: new Date().toISOString() })
      .eq("id", payment.id);
    setMessage(actionError ? "" : "Pagamento marcado como pago.");
    setError(actionError?.message || "");
    if (!actionError) refresh();
  }

  if (loading) return <Loading />;

  if (!session) {
    return (
      <Centered>
        <ShieldCheck className="mx-auto text-[#4353C7]" size={44} />
        <h1 className="mt-5 text-2xl font-black">Acesse pela MBA Labs</h1>
        <p className="mt-3 text-slate-500">O MBA Escola usa a mesma autenticação do portal principal.</p>
        <Link className={`${primary} mt-6`} href="/login?next=/mba-escola/admin">Entrar na MBA Labs</Link>
      </Centered>
    );
  }

  if (!authorized) {
    return (
      <Centered>
        <Ban className="mx-auto text-rose-600" size={44} />
        <h1 className="mt-5 text-2xl font-black">Acesso exclusivo do ADMIN MBA</h1>
        <p className="mt-3 text-slate-500">Esta área é reservada ao proprietário da plataforma.</p>
        <Link className={`${secondary} mt-6`} href="/mba-escola">Voltar</Link>
      </Centered>
    );
  }

  return (
    <main className="cotacoes-module min-h-screen bg-[#F6F8FC] pb-12 text-[#172033]">
      <header className="border-b border-[#E7EBF3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 w-[min(1200px,calc(100%-32px))] items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#4353C7] to-[#19A89A] text-white shadow-lg shadow-indigo-100">
              <GraduationCap size={27} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight">MBA Escola</p>
              <p className="truncate text-sm text-slate-500">ADMIN MBA · Administração global</p>
            </div>
          </div>
          <Link className={secondary} href="/mba-escola">
            <ArrowLeft size={17} /> <span className="hidden sm:inline">Voltar ao MBA Escola</span><span className="sm:hidden">Voltar</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1200px,calc(100%-32px))] gap-5 py-6 sm:gap-6 sm:py-8">
        <section className="overflow-hidden rounded-[28px] border border-[#E1E6F2] bg-gradient-to-br from-[#EEF1FF] via-white to-[#EEF9F7] p-5 shadow-[0_22px_60px_-45px_rgba(30,41,59,0.45)] sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#5968CA]">Proprietário da plataforma</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Administração do MBA Escola</h1>
              <p className="mt-2 max-w-3xl leading-7 text-slate-500">Gerencie escolas, acessos, planos, cobranças e auditoria com uma visão mais limpa e direta.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#D7EEE9] bg-white px-3 py-2 text-sm font-black text-[#167F73] shadow-sm">
              <CheckCircle2 size={17} /> Ambiente ativo
            </div>
          </div>
        </section>

        <nav className="grid grid-cols-3 gap-2 rounded-[24px] border border-[#E2E7F0] bg-white p-2 shadow-[0_14px_45px_-38px_rgba(30,41,59,0.5)] sm:grid-cols-6">
          {tabs.map(item => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-[11px] font-black transition sm:min-h-[66px] sm:text-xs ${active ? "bg-[#4353C7] text-white shadow-lg shadow-indigo-200" : "bg-[#F8F9FC] text-[#667085] hover:bg-[#EEF1FF] hover:text-[#4353C7]"}`}
                onClick={() => setTab(item.id)}
                type="button"
              >
                <Icon size={20} strokeWidth={2.2} />
                <span className="text-center leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}

        {tab === "visao" ? (
          <section className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={<School />} label="Escolas" value={schools.length} tone="blue" />
              <Metric icon={<CheckCircle2 />} label="Ativas / teste" value={activeSchools} tone="green" />
              <Metric icon={<UsersRound />} label="Perfis ativos" value={activeProfiles} tone="violet" />
              <Metric icon={<ReceiptText />} label="Cobranças pendentes" value={pendingPayments} tone="amber" />
            </div>

            <Card title="Acessos rápidos" subtitle="Vá direto para as tarefas mais usadas do ADMIN MBA.">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <QuickAction icon={<Plus size={19} />} title="Nova escola" text="Cadastrar instituição" onClick={() => setTab("escolas")} />
                <QuickAction icon={<UserCog size={19} />} title="Novo acesso" text="Vincular perfil" onClick={() => setTab("perfis")} />
                <QuickAction icon={<ReceiptText size={19} />} title="Novo plano" text="Criar condição" onClick={() => setTab("planos")} />
                <QuickAction icon={<CreditCard size={19} />} title="Cobrança" text="Registrar pagamento" onClick={() => setTab("pagamentos")} />
              </div>
            </Card>
          </section>
        ) : null}

        {tab === "escolas" ? (
          <section className="grid gap-5">
            <Card title="Nova escola" subtitle="Cadastre uma nova instituição para iniciar a configuração.">
              <form action={createSchool} className="flex flex-col gap-3 sm:flex-row">
                <input className={field} name="nome" placeholder="Nome da escola" required />
                <button className={primary}><Plus size={17} /> Criar escola</button>
              </form>
            </Card>
            <Card title="Escolas cadastradas" subtitle={`${schools.length} escola(s) na plataforma.`}>
              <div className="grid gap-3">
                {schools.length ? schools.map(school => (
                  <article className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4 md:flex-row md:items-center" key={school.id}>
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF1FF] text-[#4353C7]"><School size={19} /></div>
                      <div>
                        <p className="font-black">{school.nome}</p>
                        <p className="mt-0.5 text-sm text-slate-500">{school.slug} · {school.status}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select className={`${field} w-auto`} value={school.status} onChange={event => void changeSchoolStatus(school.id, event.target.value)}>
                        <option value="teste">Teste</option>
                        <option value="ativa">Ativa</option>
                        <option value="inativa">Inativa</option>
                        <option value="bloqueada">Bloqueada</option>
                      </select>
                      <button className={secondary} onClick={() => void removeSchool(school.id, school.nome)} type="button"><Trash2 size={16} /> Excluir</button>
                    </div>
                  </article>
                )) : <Empty text="Nenhuma escola cadastrada." />}
              </div>
            </Card>
          </section>
        ) : null}

        {tab === "perfis" ? (
          <section className="grid gap-5">
            <Card title="Preparar acesso escolar" subtitle="O acesso usa a mesma conta da MBA Labs, sem criar outra senha.">
              <form action={createInvite} className="grid gap-3 md:grid-cols-2">
                <select className={field} name="escola_id" required>
                  <option value="">Selecione a escola</option>
                  {schools.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}
                </select>
                <input className={field} name="nome" placeholder="Nome" required />
                <input className={field} name="email" type="email" placeholder="E-mail da conta MBA Labs" required />
                <select className={field} name="papel" required>
                  <option value="admin_escola">Admin da Escola</option>
                  <option value="direcao">Direção</option>
                  <option value="coordenacao">Coordenação</option>
                  <option value="professor">Professor</option>
                  <option value="responsavel">Responsável</option>
                </select>
                <button className={`${primary} md:col-span-2`}><UserCog size={17} /> Preparar acesso</button>
              </form>
            </Card>

            <Card title="Perfis vinculados" subtitle={`${profiles.length} perfil(is) encontrado(s).`}>
              <div className="grid gap-3">
                {profiles.length ? profiles.map(profile => (
                  <article className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4 md:flex-row md:items-center" key={profile.id}>
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F2ECFF] text-[#7950B8]"><UsersRound size={19} /></div>
                      <div>
                        <p className="font-black">{profile.nome}</p>
                        <p className="mt-0.5 text-sm text-slate-500">{profile.email || "Sem e-mail"} · {roleLabel(profile.papel)} · {profile.escola?.nome || schoolMap.get(profile.escola_id) || "Escola"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className={secondary} onClick={() => void toggleProfile(profile)} type="button">{profile.ativo ? "Inativar" : "Ativar"}</button>
                      <button className={secondary} onClick={() => void removeProfile(profile)} type="button"><Trash2 size={16} /> Remover vínculo</button>
                    </div>
                  </article>
                )) : <Empty text="Nenhum perfil escolar vinculado." />}
              </div>
            </Card>
          </section>
        ) : null}

        {tab === "planos" ? (
          <section className="grid gap-5">
            <Card title="Novo plano" subtitle="Defina preço, limites e descrição do plano.">
              <form action={createPlan} className="grid gap-3 md:grid-cols-2">
                <input className={field} name="nome" placeholder="Nome do plano" required />
                <input className={field} name="preco_mensal" type="number" step="0.01" min="0" placeholder="Valor mensal" />
                <input className={field} name="limite_alunos" type="number" min="0" placeholder="Limite de alunos (opcional)" />
                <input className={field} name="limite_usuarios" type="number" min="0" placeholder="Limite de usuários (opcional)" />
                <textarea className={`${field} min-h-24 md:col-span-2`} name="descricao" placeholder="Descrição" />
                <button className={`${primary} md:col-span-2`}><Plus size={17} /> Criar plano</button>
              </form>
            </Card>

            <Card title="Planos" subtitle={`${plans.length} plano(s) cadastrado(s).`}>
              <div className="grid gap-3">
                {plans.length ? plans.map(plan => (
                  <article className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4 md:flex-row md:items-center" key={plan.id}>
                    <div>
                      <p className="font-black">{plan.nome}</p>
                      <p className="mt-0.5 text-sm text-slate-500">R$ {money(plan.preco_mensal)}/mês{plan.limite_alunos ? ` · ${plan.limite_alunos} alunos` : ""}</p>
                    </div>
                    <button className={secondary} onClick={() => void togglePlan(plan)} type="button">{plan.ativo ? "Inativar" : "Ativar"}</button>
                  </article>
                )) : <Empty text="Nenhum plano cadastrado." />}
              </div>
            </Card>
          </section>
        ) : null}

        {tab === "pagamentos" ? (
          <section className="grid gap-5">
            <Card title="Registrar cobrança" subtitle="Lance uma nova cobrança para uma escola.">
              <form action={createPayment} className="grid gap-3 md:grid-cols-3">
                <select className={field} name="escola_id" required>
                  <option value="">Escola</option>
                  {schools.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}
                </select>
                <input className={field} name="valor" type="number" step="0.01" min="0" placeholder="Valor" required />
                <input className={field} name="vencimento" type="date" />
                <button className={`${primary} md:col-span-3`}><CreditCard size={17} /> Registrar</button>
              </form>
            </Card>

            <Card title="Pagamentos" subtitle={`${payments.length} registro(s) financeiro(s).`}>
              <div className="grid gap-3">
                {payments.length ? payments.map(payment => (
                  <article className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4 md:flex-row md:items-center" key={payment.id}>
                    <div>
                      <p className="font-black">{payment.escola?.nome || schoolMap.get(payment.escola_id) || "Escola"}</p>
                      <p className="mt-0.5 text-sm text-slate-500">R$ {money(payment.valor)} · vencimento {formatDate(payment.vencimento)} · {payment.status}</p>
                    </div>
                    {payment.status !== "pago" ? (
                      <button className={secondary} onClick={() => void markPaid(payment)} type="button">Marcar pago</button>
                    ) : (
                      <span className="rounded-full bg-[#E8F8F4] px-3 py-1.5 text-sm font-black text-[#167F73]">Pago</span>
                    )}
                  </article>
                )) : <Empty text="Nenhuma cobrança registrada." />}
              </div>
            </Card>
          </section>
        ) : null}

        {tab === "auditoria" ? (
          <Card title="Auditoria técnica" subtitle="Histórico das ações administrativas da plataforma.">
            <div className="grid gap-2">
              {audit.length ? audit.map(item => (
                <article className="rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4" key={item.id}>
                  <p className="font-black">{item.acao} · {item.recurso}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.escola?.nome || "Plataforma"} · {item.ator_tipo || "sistema"} · {formatDateTime(item.criado_em)}</p>
                </article>
              )) : <Empty text="Nenhum evento de auditoria registrado." />}
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
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

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-[#E4E8F2] bg-white p-5 shadow-[0_18px_50px_-42px_rgba(30,41,59,0.5)] sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: MetricTone }) {
  const tones: Record<MetricTone, { card: string; icon: string; label: string; value: string }> = {
    blue: {
      card: "border-[#DCE3FF] bg-gradient-to-br from-[#F4F6FF] to-white",
      icon: "bg-[#E6EAFF] text-[#4353C7]",
      label: "text-[#6672A3]",
      value: "text-[#273678]"
    },
    green: {
      card: "border-[#D8EFEA] bg-gradient-to-br from-[#F2FBF9] to-white",
      icon: "bg-[#DFF7F2] text-[#168B7E]",
      label: "text-[#59827B]",
      value: "text-[#167F73]"
    },
    violet: {
      card: "border-[#E8DDF9] bg-gradient-to-br from-[#FAF7FF] to-white",
      icon: "bg-[#F0E8FF] text-[#7950B8]",
      label: "text-[#7D6B94]",
      value: "text-[#553780]"
    },
    amber: {
      card: "border-[#F4E4C7] bg-gradient-to-br from-[#FFF9EE] to-white",
      icon: "bg-[#FFF0D2] text-[#B87919]",
      label: "text-[#8E7651]",
      value: "text-[#95631A]"
    }
  };
  const style = tones[tone];

  return (
    <article className={`rounded-[22px] border p-4 shadow-[0_15px_40px_-36px_rgba(30,41,59,0.5)] sm:p-5 ${style.card}`}>
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${style.icon}`}>{icon}</div>
      <p className={`mt-4 text-sm font-bold ${style.label}`}>{label}</p>
      <p className={`mt-1 text-3xl font-black tracking-tight ${style.value}`}>{value}</p>
    </article>
  );
}

function QuickAction({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-3 rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#CDD5F8] hover:bg-[#F4F6FF] hover:shadow-md"
      onClick={onClick}
      type="button"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF1FF] text-[#4353C7]">{icon}</span>
      <span>
        <span className="block font-black">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[#D9DFEA] bg-[#FAFBFD] p-5 text-center text-sm text-slate-500">{text}</p>;
}

function roleLabel(value: string) {
  return (
    {
      admin_escola: "Admin da Escola",
      direcao: "Direção",
      coordenacao: "Coordenação",
      professor: "Professor",
      responsavel: "Responsável"
    } as Record<string, string>
  )[value] || value;
}

function normalizeSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string | null) {
  if (!value) return "não informado";
  try {
    return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T12:00:00-03:00`));
  } catch {
    return "não informado";
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "não informado";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Araguaina", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return "não informado";
  }
}
