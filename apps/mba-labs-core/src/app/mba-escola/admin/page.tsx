"use client";

import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Ban, CheckCircle2, CreditCard, GraduationCap, LoaderCircle, Plus, ReceiptText, School, ShieldCheck, Trash2, UserCog, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMbaEscolaSupabase } from "@/lib/mba-escola/supabase-client";

const supabase = getMbaEscolaSupabase();

type Tab = "visao" | "escolas" | "perfis" | "planos" | "pagamentos" | "auditoria";
type SchoolRow = { id: string; nome: string; slug: string; status: string };
type ProfileRow = { id: string; escola_id: string; nome: string; papel: string; email: string | null; ativo: boolean; is_teste: boolean; escola?: { nome?: string } | null };
type PlanRow = { id: string; nome: string; descricao: string | null; preco_mensal: number; limite_alunos: number | null; limite_usuarios: number | null; ativo: boolean };
type PaymentRow = { id: string; escola_id: string; valor: number; vencimento: string | null; pago_em: string | null; status: string; escola?: { nome?: string } | null };
type AuditRow = { id: string; acao: string; recurso: string; ator_tipo: string | null; criado_em: string; escola?: { nome?: string } | null };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "visao", label: "Visão geral" },
  { id: "escolas", label: "Escolas" },
  { id: "perfis", label: "Perfis" },
  { id: "planos", label: "Planos" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "auditoria", label: "Auditoria" }
];
const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50";

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
    setLoading(true); setError("");
    const { data: admin, error: adminError } = await supabase.from("escola_super_admins").select("user_id,ativo").eq("user_id", activeSession.user.id).eq("ativo", true).maybeSingle();
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
      if (data.session) void load(data.session); else setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) void load(next); else { setAuthorized(false); setLoading(false); }
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const schoolMap = useMemo(() => new Map(schools.map(item => [item.id, item.nome])), [schools]);
  const activeSchools = schools.filter(item => ["ativa", "teste"].includes(item.status)).length;
  const activeProfiles = profiles.filter(item => item.ativo).length;
  const pendingPayments = payments.filter(item => item.status !== "pago").length;
  const refresh = () => { if (session) void load(session); };

  async function createSchool(formData: FormData) {
    const nome = String(formData.get("nome") || "").trim();
    if (!nome) return;
    const slug = `${normalizeSlug(nome)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error: actionError } = await supabase.from("escola_escolas").insert({ nome, slug, status: "teste" });
    setMessage(actionError ? "" : "Escola criada."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  async function changeSchoolStatus(id: string, status: string) {
    const { error: actionError } = await supabase.from("escola_escolas").update({ status }).eq("id", id);
    setMessage(actionError ? "" : "Status atualizado."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  async function removeSchool(id: string, nome: string) {
    if (!window.confirm(`Excluir a escola ${nome}? Os dados vinculados serão removidos.`)) return;
    const { error: actionError } = await supabase.from("escola_escolas").delete().eq("id", id);
    setMessage(actionError ? "" : "Escola excluída."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  async function createInvite(formData: FormData) {
    const escola_id = String(formData.get("escola_id") || "");
    const nome = String(formData.get("nome") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const papel = String(formData.get("papel") || "");
    if (!escola_id || !nome || !email || !papel) return;
    const { error: actionError } = await supabase.from("escola_convites").insert({ escola_id, nome, email, papel, status: "pendente" });
    setMessage(actionError ? "" : "Acesso escolar preparado. O usuário entrará com a mesma conta da MBA Labs."); setError(actionError?.message || "");
  }

  async function toggleProfile(profile: ProfileRow) {
    const { error: actionError } = await supabase.from("escola_perfis").update({ ativo: !profile.ativo }).eq("id", profile.id);
    setMessage(actionError ? "" : profile.ativo ? "Perfil inativado." : "Perfil reativado."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  async function removeProfile(profile: ProfileRow) {
    if (!window.confirm(`Remover o vínculo escolar de ${profile.nome}? A conta MBA Labs não será excluída.`)) return;
    const { error: actionError } = await supabase.from("escola_perfis").delete().eq("id", profile.id);
    setMessage(actionError ? "" : "Vínculo escolar removido. A conta central foi preservada."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  async function createPlan(formData: FormData) {
    const nome = String(formData.get("nome") || "").trim();
    if (!nome) return;
    const preco = Number(formData.get("preco_mensal") || 0);
    const { error: actionError } = await supabase.from("escola_planos").insert({ nome, descricao: String(formData.get("descricao") || "").trim() || null, preco_mensal: Number.isFinite(preco) ? preco : 0, limite_alunos: Number(formData.get("limite_alunos") || 0) || null, limite_usuarios: Number(formData.get("limite_usuarios") || 0) || null, ativo: true });
    setMessage(actionError ? "" : "Plano criado."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  async function togglePlan(plan: PlanRow) {
    const { error: actionError } = await supabase.from("escola_planos").update({ ativo: !plan.ativo }).eq("id", plan.id);
    setMessage(actionError ? "" : "Plano atualizado."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  async function createPayment(formData: FormData) {
    const escola_id = String(formData.get("escola_id") || "");
    const valor = Number(formData.get("valor") || 0);
    const vencimento = String(formData.get("vencimento") || "") || null;
    if (!escola_id || !Number.isFinite(valor)) return;
    const { error: actionError } = await supabase.from("escola_pagamentos").insert({ escola_id, valor, vencimento, status: "pendente" });
    setMessage(actionError ? "" : "Cobrança registrada."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  async function markPaid(payment: PaymentRow) {
    const { error: actionError } = await supabase.from("escola_pagamentos").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", payment.id);
    setMessage(actionError ? "" : "Pagamento marcado como pago."); setError(actionError?.message || ""); if (!actionError) refresh();
  }

  if (loading) return <Loading/>;
  if (!session) return <Centered><ShieldCheck className="mx-auto text-[#176b5b]" size={44}/><h1 className="mt-5 text-2xl font-black">Acesse pela MBA Labs</h1><p className="mt-3 text-slate-500">O MBA Escola usa a mesma autenticação do portal principal.</p><Link className={`${primary} mt-6`} href="/login?next=/mba-escola/admin">Entrar na MBA Labs</Link></Centered>;
  if (!authorized) return <Centered><Ban className="mx-auto text-rose-600" size={44}/><h1 className="mt-5 text-2xl font-black">Acesso exclusivo do ADMIN MBA</h1><p className="mt-3 text-slate-500">Esta área é reservada ao proprietário da plataforma.</p><Link className={`${secondary} mt-6`} href="/mba-escola">Voltar</Link></Centered>;

  return <main className="min-h-screen bg-[#f5f8fb] pb-12 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-20 w-[min(1200px,calc(100%-32px))] items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white"><GraduationCap size={27}/></div><div><p className="font-black">MBA Escola</p><p className="text-sm text-slate-500">ADMIN MBA · Administração global</p></div></div><Link className={secondary} href="/mba-escola"><ArrowLeft size={17}/> Voltar ao MBA Escola</Link></div></header>
    <div className="mx-auto grid w-[min(1200px,calc(100%-32px))] gap-6 py-7">
      <section><p className="text-sm font-black text-[#176b5b]">PROPRIETÁRIO DA PLATAFORMA</p><h1 className="mt-1 text-3xl font-black">Administração do MBA Escola</h1><p className="mt-2 max-w-3xl leading-7 text-slate-500">Gerencie escolas, vínculos de acesso, planos, cobranças e auditoria. O conteúdo pedagógico permanece com cada escola.</p></section>
      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">{tabs.map(item => <button key={item.id} className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab === item.id ? "bg-[#176b5b] text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}</nav>
      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}

      {tab === "visao" ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<School/>} label="Escolas" value={schools.length}/><Metric icon={<CheckCircle2/>} label="Ativas / teste" value={activeSchools}/><Metric icon={<UsersRound/>} label="Perfis ativos" value={activeProfiles}/><Metric icon={<ReceiptText/>} label="Cobranças pendentes" value={pendingPayments}/></section> : null}

      {tab === "escolas" ? <section className="grid gap-5"><Card title="Nova escola"><form action={createSchool} className="flex flex-col gap-3 sm:flex-row"><input className={field} name="nome" placeholder="Nome da escola" required/><button className={primary}><Plus size={17}/> Criar escola</button></form></Card><Card title="Escolas cadastradas"><div className="grid gap-3">{schools.length ? schools.map(school => <article className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center" key={school.id}><div><p className="font-black">{school.nome}</p><p className="text-sm text-slate-500">{school.slug} · {school.status}</p></div><div className="flex flex-wrap gap-2"><select className={`${field} w-auto`} value={school.status} onChange={event => void changeSchoolStatus(school.id,event.target.value)}><option value="teste">Teste</option><option value="ativa">Ativa</option><option value="inativa">Inativa</option><option value="bloqueada">Bloqueada</option></select><button className={secondary} onClick={() => void removeSchool(school.id,school.nome)} type="button"><Trash2 size={16}/> Excluir</button></div></article>) : <Empty text="Nenhuma escola cadastrada."/>}</div></Card></section> : null}

      {tab === "perfis" ? <section className="grid gap-5"><Card title="Preparar acesso escolar"><p className="mb-4 text-sm leading-6 text-slate-500">O usuário precisa ter conta e permissão na MBA Labs. Ao entrar no MBA Escola, o convite é vinculado ao mesmo usuário — sem outra senha.</p><form action={createInvite} className="grid gap-3 md:grid-cols-2"><select className={field} name="escola_id" required><option value="">Selecione a escola</option>{schools.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><input className={field} name="nome" placeholder="Nome" required/><input className={field} name="email" type="email" placeholder="E-mail da conta MBA Labs" required/><select className={field} name="papel" required><option value="admin_escola">Admin da Escola</option><option value="direcao">Direção</option><option value="coordenacao">Coordenação</option><option value="professor">Professor</option><option value="responsavel">Responsável</option></select><button className={`${primary} md:col-span-2`}><UserCog size={17}/> Preparar acesso</button></form></Card><Card title="Perfis vinculados"><div className="grid gap-3">{profiles.length ? profiles.map(profile => <article className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center" key={profile.id}><div><p className="font-black">{profile.nome}</p><p className="text-sm text-slate-500">{profile.email || "Sem e-mail"} · {roleLabel(profile.papel)} · {profile.escola?.nome || schoolMap.get(profile.escola_id) || "Escola"}</p></div><div className="flex gap-2"><button className={secondary} onClick={() => void toggleProfile(profile)} type="button">{profile.ativo ? "Inativar" : "Ativar"}</button><button className={secondary} onClick={() => void removeProfile(profile)} type="button"><Trash2 size={16}/> Remover vínculo</button></div></article>) : <Empty text="Nenhum perfil escolar vinculado."/>}</div></Card></section> : null}

      {tab === "planos" ? <section className="grid gap-5"><Card title="Novo plano"><form action={createPlan} className="grid gap-3 md:grid-cols-2"><input className={field} name="nome" placeholder="Nome do plano" required/><input className={field} name="preco_mensal" type="number" step="0.01" min="0" placeholder="Valor mensal"/><input className={field} name="limite_alunos" type="number" min="0" placeholder="Limite de alunos (opcional)"/><input className={field} name="limite_usuarios" type="number" min="0" placeholder="Limite de usuários (opcional)"/><textarea className={`${field} min-h-24 md:col-span-2`} name="descricao" placeholder="Descrição"/><button className={`${primary} md:col-span-2`}><Plus size={17}/> Criar plano</button></form></Card><Card title="Planos"><div className="grid gap-3">{plans.length ? plans.map(plan => <article className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center" key={plan.id}><div><p className="font-black">{plan.nome}</p><p className="text-sm text-slate-500">R$ {money(plan.preco_mensal)}/mês{plan.limite_alunos ? ` · ${plan.limite_alunos} alunos` : ""}</p></div><button className={secondary} onClick={() => void togglePlan(plan)} type="button">{plan.ativo ? "Inativar" : "Ativar"}</button></article>) : <Empty text="Nenhum plano cadastrado."/>}</div></Card></section> : null}

      {tab === "pagamentos" ? <section className="grid gap-5"><Card title="Registrar cobrança"><form action={createPayment} className="grid gap-3 md:grid-cols-3"><select className={field} name="escola_id" required><option value="">Escola</option>{schools.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><input className={field} name="valor" type="number" step="0.01" min="0" placeholder="Valor" required/><input className={field} name="vencimento" type="date"/><button className={`${primary} md:col-span-3`}><CreditCard size={17}/> Registrar</button></form></Card><Card title="Pagamentos"><div className="grid gap-3">{payments.length ? payments.map(payment => <article className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center" key={payment.id}><div><p className="font-black">{payment.escola?.nome || schoolMap.get(payment.escola_id) || "Escola"}</p><p className="text-sm text-slate-500">R$ {money(payment.valor)} · vencimento {formatDate(payment.vencimento)} · {payment.status}</p></div>{payment.status !== "pago" ? <button className={secondary} onClick={() => void markPaid(payment)} type="button">Marcar pago</button> : <span className="text-sm font-black text-emerald-700">Pago</span>}</article>) : <Empty text="Nenhuma cobrança registrada."/>}</div></Card></section> : null}

      {tab === "auditoria" ? <Card title="Auditoria técnica"><p className="mb-4 text-sm text-slate-500">Histórico de ações administrativas. O ADMIN MBA não precisa abrir o conteúdo pedagógico das escolas para administrar a plataforma.</p><div className="grid gap-2">{audit.length ? audit.map(item => <article className="rounded-xl border border-slate-200 p-3" key={item.id}><p className="font-black">{item.acao} · {item.recurso}</p><p className="text-xs text-slate-500">{item.escola?.nome || "Plataforma"} · {item.ator_tipo || "sistema"} · {formatDateTime(item.criado_em)}</p></article>) : <Empty text="Nenhum evento de auditoria registrado."/>}</div></Card> : null}
    </div>
  </main>;
}

function Loading() { return <main className="grid min-h-screen place-items-center bg-[#f5f8fb]"><LoaderCircle className="animate-spin text-[#176b5b]" size={36}/></main>; }
function Centered({ children }: { children: React.ReactNode }) { return <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">{children}</section></main>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</section>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-[#176b5b]">{icon}</span><p className="mt-3 text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></article>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }
function roleLabel(value: string) { return ({ admin_escola: "Admin da Escola", direcao: "Direção", coordenacao: "Coordenação", professor: "Professor", responsavel: "Responsável" } as Record<string,string>)[value] || value; }
function normalizeSlug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function money(value: number) { return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(value: string | null) { if (!value) return "não informado"; try { return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0,10)}T12:00:00-03:00`)); } catch { return "não informado"; } }
function formatDateTime(value: string | null) { if (!value) return "não informado"; try { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Araguaina", dateStyle: "short", timeStyle: "short" }).format(new Date(value)); } catch { return "não informado"; } }
