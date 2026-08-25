"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Bell, CalendarDays, CheckCircle2, MessageSquareText, Save, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type Section = "students" | "communication";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string }; section: Section };
type Student = { id: string; nome: string; turma_id: string | null; turma?: { nome: string } | null };
type Followup = { id: string; aluno_id: string; categoria: string; titulo: string; observacao: string; acao_planejada: string | null; prazo: string | null; status: string; visivel_responsavel: boolean; criado_em: string; aluno?: { nome: string } | null };
type Meeting = { id: string; aluno_id: string | null; responsavel_id: string | null; titulo: string; inicio: string; fim: string | null; local: string | null; pauta: string | null; status: string; aluno?: { nome: string } | null };
type Notice = { id: string; turma_id: string | null; titulo: string; resumo: string | null; conteudo: string; prioridade: string; exige_confirmacao: boolean; status: string; publicado_em: string | null; turma?: { nome: string } | null };
type Reading = { comunicado_id: string; lido_em: string; confirmado_em: string | null };
type GuardianLink = { aluno_id: string; responsavel_id: string; principal: boolean };
type Guardian = { id: string; nome: string };
type Tab = "alunos" | "registros" | "comunicados" | "reunioes";

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50";

export default function RoleSections({ supabase, profile, section }: Props) {
  const guardian = profile.papel === "responsavel";
  const manager = ["admin_escola", "direcao", "coordenacao"].includes(profile.papel);
  const [tab, setTab] = useState<Tab>(section === "students" ? "alunos" : "comunicados");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [followForm, setFollowForm] = useState({ aluno_id: "", categoria: "pedagogico", titulo: "", observacao: "", acao: "", prazo: "", visivel: true });
  const [meetingForm, setMeetingForm] = useState({ aluno_id: "", responsavel_id: "", titulo: "Reunião de acompanhamento", inicio: "", local: "", pauta: "" });
  const [noticeForm, setNoticeForm] = useState({ turma_id: "", titulo: "", resumo: "", conteudo: "", prioridade: "normal", exige_confirmacao: false });

  useEffect(() => setTab(section === "students" ? "alunos" : "comunicados"), [section]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const uid = auth.user?.id || "";
    setUserId(uid);
    if (authError || !uid) {
      setError("Não foi possível identificar o usuário.");
      setLoading(false);
      return;
    }

    if (section === "students") {
      const [studentResult, followResult] = await Promise.all([
        supabase.from("escola_alunos").select("id,nome,turma_id,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
        supabase.from("escola_acompanhamentos").select("id,aluno_id,categoria,titulo,observacao,acao_planejada,prazo,status,visivel_responsavel,criado_em,aluno:escola_alunos(nome)").order("criado_em", { ascending: false }).limit(120)
      ]);
      const firstError = studentResult.error || followResult.error;
      if (firstError) setError(firstError.message);
      setStudents((studentResult.data ?? []) as unknown as Student[]);
      setFollowups((followResult.data ?? []) as unknown as Followup[]);
    } else {
      const requests = await Promise.all([
        supabase.from("escola_alunos").select("id,nome,turma_id,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
        supabase.from("escola_comunicados").select("id,turma_id,titulo,resumo,conteudo,prioridade,exige_confirmacao,status,publicado_em,turma:escola_turmas(nome)").eq("status", "publicado").order("publicado_em", { ascending: false, nullsFirst: false }).limit(120),
        supabase.from("escola_comunicado_leituras").select("comunicado_id,lido_em,confirmado_em"),
        supabase.from("escola_reunioes").select("id,aluno_id,responsavel_id,titulo,inicio,fim,local,pauta,status,aluno:escola_alunos(nome)").order("inicio", { ascending: false }).limit(120)
      ]);
      const firstError = requests.find(item => item.error)?.error;
      if (firstError) setError(firstError.message);
      setStudents((requests[0].data ?? []) as unknown as Student[]);
      setNotices((requests[1].data ?? []) as unknown as Notice[]);
      setReadings((requests[2].data ?? []) as Reading[]);
      setMeetings((requests[3].data ?? []) as unknown as Meeting[]);

      if (manager) {
        const [linkResult, guardianResult] = await Promise.all([
          supabase.from("escola_aluno_responsaveis").select("aluno_id,responsavel_id,principal"),
          supabase.from("escola_perfis").select("id,nome").eq("papel", "responsavel").eq("ativo", true).order("nome")
        ]);
        if (linkResult.error || guardianResult.error) setError(linkResult.error?.message || guardianResult.error?.message || "Falha ao carregar responsáveis.");
        setLinks((linkResult.data ?? []) as GuardianLink[]);
        setGuardians((guardianResult.data ?? []) as Guardian[]);
      }
    }
    setLoading(false);
  }, [manager, section, supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!followForm.aluno_id && students[0]) setFollowForm(value => ({ ...value, aluno_id: students[0].id }));
    if (!meetingForm.aluno_id && students[0]) setMeetingForm(value => ({ ...value, aluno_id: students[0].id }));
  }, [students, followForm.aluno_id, meetingForm.aluno_id]);
  useEffect(() => {
    if (!manager || !meetingForm.aluno_id) return;
    const link = links.find(item => item.aluno_id === meetingForm.aluno_id && item.principal) || links.find(item => item.aluno_id === meetingForm.aluno_id);
    setMeetingForm(value => ({ ...value, responsavel_id: link?.responsavel_id || "" }));
  }, [links, manager, meetingForm.aluno_id]);

  async function save(action: () => PromiseLike<{ error?: { message: string } | null }>, success: string) {
    setSaving(true); setMessage(""); setError("");
    const result = await action();
    if (result.error) setError(result.error.message);
    else { setMessage(success); await load(); }
    setSaving(false);
  }

  async function saveFollow(event: React.FormEvent) {
    event.preventDefault();
    if (!manager || !userId) return;
    await save(() => supabase.from("escola_acompanhamentos").insert({ escola_id: profile.escola_id, aluno_id: followForm.aluno_id, autor_id: userId, categoria: followForm.categoria, titulo: followForm.titulo, observacao: followForm.observacao, acao_planejada: followForm.acao || null, prazo: followForm.prazo || null, status: "aberto", visivel_responsavel: followForm.visivel }), "Registro do aluno salvo.");
    setFollowForm(value => ({ ...value, titulo: "", observacao: "", acao: "", prazo: "" }));
  }

  async function saveMeeting(event: React.FormEvent) {
    event.preventDefault();
    if (!manager || !userId) return;
    await save(() => supabase.from("escola_reunioes").insert({ escola_id: profile.escola_id, aluno_id: meetingForm.aluno_id || null, responsavel_id: meetingForm.responsavel_id || null, criado_por: userId, titulo: meetingForm.titulo, inicio: new Date(meetingForm.inicio).toISOString(), local: meetingForm.local || null, pauta: meetingForm.pauta || null, status: "agendada" }), "Reunião agendada.");
    setMeetingForm(value => ({ ...value, inicio: "", local: "", pauta: "" }));
  }

  async function saveNotice(event: React.FormEvent) {
    event.preventDefault();
    if (!manager || !userId) return;
    await save(() => supabase.from("escola_comunicados").insert({ escola_id: profile.escola_id, turma_id: noticeForm.turma_id || null, autor_id: userId, titulo: noticeForm.titulo, resumo: noticeForm.resumo || null, conteudo: noticeForm.conteudo, prioridade: noticeForm.prioridade, exige_confirmacao: noticeForm.exige_confirmacao, status: "publicado", publicado_em: new Date().toISOString() }), "Comunicado publicado.");
    setNoticeForm(value => ({ ...value, titulo: "", resumo: "", conteudo: "" }));
  }

  async function markNotice(id: string, confirm: boolean) {
    await save(() => supabase.rpc("escola_mark_communication", { p_comunicado_id: id, p_confirmar: confirm }), confirm ? "Ciência registrada." : "Comunicado marcado como lido.");
  }

  const readingByNotice = useMemo(() => Object.fromEntries(readings.map(item => [item.comunicado_id, item])), [readings]);
  const tabs: Array<[Tab, string]> = section === "students" ? [["alunos", guardian ? "Meus filhos" : "Alunos"], ["registros", "Registros do aluno"]] : [["comunicados", "Comunicados"], ["reunioes", "Reuniões"]];

  if (loading) return <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando...</section>;

  return <section className="grid gap-5">
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab === id ? "bg-[#176b5b] text-white" : "text-slate-600"}`}>{label}</button>)}</nav>
    {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}

    {tab === "alunos" ? <Card title={guardian ? "Meus filhos" : "Alunos"} icon={<UsersRound size={20}/>}><div className="grid gap-3 md:grid-cols-2">{students.length ? students.map(student => <article key={student.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-black">{student.nome}</p><p className="mt-1 text-sm text-slate-500">{student.turma?.nome || "Sem turma"}</p></article>) : <Empty text="Nenhum aluno disponível."/>}</div></Card> : null}

    {tab === "registros" ? <div className={`grid gap-5 ${manager ? "lg:grid-cols-[.8fr_1.2fr]" : ""}`}>{manager ? <Card title="Novo registro" icon={<MessageSquareText size={20}/>}><form className="grid gap-3" onSubmit={saveFollow}><select className={field} value={followForm.aluno_id} onChange={event => setFollowForm(value => ({ ...value, aluno_id: event.target.value }))}>{students.map(student => <option key={student.id} value={student.id}>{student.nome}</option>)}</select><select className={field} value={followForm.categoria} onChange={event => setFollowForm(value => ({ ...value, categoria: event.target.value }))}><option value="pedagogico">Pedagógico</option><option value="comportamento">Comportamento</option><option value="atendimento_coordenacao">Atendimento da coordenação</option><option value="acompanhamento">Acompanhamento</option><option value="outro">Outro</option></select><input className={field} required placeholder="Título" value={followForm.titulo} onChange={event => setFollowForm(value => ({ ...value, titulo: event.target.value }))}/><textarea className={area} required placeholder="Observação" value={followForm.observacao} onChange={event => setFollowForm(value => ({ ...value, observacao: event.target.value }))}/><textarea className={area} placeholder="Ação planejada (opcional)" value={followForm.acao} onChange={event => setFollowForm(value => ({ ...value, acao: event.target.value }))}/><input className={field} type="date" value={followForm.prazo} onChange={event => setFollowForm(value => ({ ...value, prazo: event.target.value }))}/><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={followForm.visivel} onChange={event => setFollowForm(value => ({ ...value, visivel: event.target.checked }))}/> Visível ao responsável</label><button className={primary} disabled={saving || !followForm.aluno_id}><Save size={17}/> Salvar registro</button></form></Card> : null}<Card title={guardian ? "Acompanhamentos dos meus filhos" : "Registros recentes"} icon={<MessageSquareText size={20}/>}><div className="grid gap-3">{followups.length ? followups.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{item.aluno?.nome || "Aluno"}</p><p className="mt-1 text-sm font-bold">{item.titulo}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{item.status}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.observacao}</p>{item.acao_planejada ? <p className="mt-2 text-sm"><b>Ação:</b> {item.acao_planejada}</p> : null}</article>) : <Empty text="Nenhum registro disponível."/>}</div></Card></div> : null}

    {tab === "comunicados" ? <div className={`grid gap-5 ${manager ? "lg:grid-cols-[.8fr_1.2fr]" : ""}`}>{manager ? <Card title="Novo comunicado" icon={<Bell size={20}/>}><form className="grid gap-3" onSubmit={saveNotice}><input className={field} required placeholder="Título" value={noticeForm.titulo} onChange={event => setNoticeForm(value => ({ ...value, titulo: event.target.value }))}/><input className={field} placeholder="Resumo (opcional)" value={noticeForm.resumo} onChange={event => setNoticeForm(value => ({ ...value, resumo: event.target.value }))}/><textarea className={area} required placeholder="Comunicado" value={noticeForm.conteudo} onChange={event => setNoticeForm(value => ({ ...value, conteudo: event.target.value }))}/><select className={field} value={noticeForm.prioridade} onChange={event => setNoticeForm(value => ({ ...value, prioridade: event.target.value }))}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={noticeForm.exige_confirmacao} onChange={event => setNoticeForm(value => ({ ...value, exige_confirmacao: event.target.checked }))}/> Exigir ciência</label><button className={primary} disabled={saving}><Save size={17}/> Publicar</button></form></Card> : null}<Card title="Comunicados" icon={<Bell size={20}/>}><div className="grid gap-3">{notices.length ? notices.map(item => { const reading = readingByNotice[item.id]; return <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="font-black">{item.titulo}</p><p className="mt-1 text-xs font-bold text-[#176b5b]">{item.prioridade}</p></div>{reading ? <CheckCircle2 className="text-emerald-600" size={18}/> : null}</div>{item.resumo ? <p className="mt-2 text-sm font-bold">{item.resumo}</p> : null}<p className="mt-2 text-sm leading-6 text-slate-600">{item.conteudo}</p>{!manager && !reading ? <button type="button" className={`${secondary} mt-3`} onClick={() => void markNotice(item.id, item.exige_confirmacao)}>{item.exige_confirmacao ? "Li e estou ciente" : "Marcar como lido"}</button> : null}</article>; }) : <Empty text="Nenhum comunicado publicado."/>}</div></Card></div> : null}

    {tab === "reunioes" ? <div className={`grid gap-5 ${manager ? "lg:grid-cols-[.8fr_1.2fr]" : ""}`}>{manager ? <Card title="Agendar reunião" icon={<CalendarDays size={20}/>}><form className="grid gap-3" onSubmit={saveMeeting}><select className={field} value={meetingForm.aluno_id} onChange={event => setMeetingForm(value => ({ ...value, aluno_id: event.target.value }))}>{students.map(student => <option key={student.id} value={student.id}>{student.nome}</option>)}</select><select className={field} value={meetingForm.responsavel_id} onChange={event => setMeetingForm(value => ({ ...value, responsavel_id: event.target.value }))}><option value="">Sem responsável específico</option>{guardians.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><input className={field} required value={meetingForm.titulo} onChange={event => setMeetingForm(value => ({ ...value, titulo: event.target.value }))}/><input className={field} required type="datetime-local" value={meetingForm.inicio} onChange={event => setMeetingForm(value => ({ ...value, inicio: event.target.value }))}/><input className={field} placeholder="Local" value={meetingForm.local} onChange={event => setMeetingForm(value => ({ ...value, local: event.target.value }))}/><textarea className={area} placeholder="Pauta" value={meetingForm.pauta} onChange={event => setMeetingForm(value => ({ ...value, pauta: event.target.value }))}/><button className={primary} disabled={saving}><Save size={17}/> Agendar</button></form></Card> : null}<Card title="Reuniões" icon={<CalendarDays size={20}/>}><div className="grid gap-3">{meetings.length ? meetings.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-black">{item.titulo}</p><p className="mt-1 text-sm text-slate-500">{dateTime(item.inicio)}{item.aluno?.nome ? ` · ${item.aluno.nome}` : ""}{item.local ? ` · ${item.local}` : ""}</p>{item.pauta ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.pauta}</p> : null}</article>) : <Empty text="Nenhuma reunião disponível."/>}</div></Card></div> : null}
  </section>;
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 flex items-center gap-2 text-lg font-black"><span className="text-[#176b5b]">{icon}</span>{title}</h3>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }
function dateTime(value: string) { try { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Araguaina", dateStyle: "short", timeStyle: "short" }).format(new Date(value)); } catch { return "—"; } }
