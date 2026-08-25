"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, RefreshCw, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type Area = "academico" | "alunos" | "comunicacao" | "gestao" | "pendencias" | "agenda";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string }; onNavigate: (area: Area) => void };
type Schedule = { id: string; hora_inicio: string; hora_fim: string; turma?: { nome: string } | null; disciplina?: { nome: string } | null };
type Call = { grade_id: string; data_aula: string };
type Notice = { id: string; titulo: string; prioridade: string; exige_confirmacao: boolean; publicado_em: string | null };
type Reading = { comunicado_id: string; confirmado_em: string | null };
type Recipient = { autorizacao_id: string; aluno_id: string };
type AuthResponse = { autorizacao_id: string; aluno_id: string };
type Occurrence = { id: string; exige_ciencia: boolean; titulo: string };
type Awareness = { ocorrencia_id: string; responsavel_id: string };
type Meeting = { id: string; titulo: string; inicio: string; aluno?: { nome: string } | null };

export default function TodayDashboard({ supabase, profile, onNavigate }: Props) {
  const today = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date()), []);
  const weekday = useMemo(() => { const d = new Date(`${today}T12:00:00-03:00`).getDay(); return d === 0 ? 7 : d; }, [today]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [userId, setUserId] = useState("");
  const [schedule, setSchedule] = useState<Schedule[]>([]); const [calls, setCalls] = useState<Call[]>([]); const [notices, setNotices] = useState<Notice[]>([]); const [readings, setReadings] = useState<Reading[]>([]); const [recipients, setRecipients] = useState<Recipient[]>([]); const [responses, setResponses] = useState<AuthResponse[]>([]); const [occurrences, setOccurrences] = useState<Occurrence[]>([]); const [awareness, setAwareness] = useState<Awareness[]>([]); const [meetings, setMeetings] = useState<Meeting[]>([]); const [pendingJustifications, setPendingJustifications] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError(""); const { data: auth } = await supabase.auth.getUser(); setUserId(auth.user?.id || "");
    const reqs = await Promise.all([
      supabase.from("escola_grade_horarios").select("id,hora_inicio,hora_fim,turma:escola_turmas(nome),disciplina:escola_disciplinas(nome)").eq("ativo", true).eq("dia_semana", weekday).order("hora_inicio"),
      supabase.from("escola_chamadas").select("grade_id,data_aula").eq("data_aula", today),
      supabase.from("escola_comunicados").select("id,titulo,prioridade,exige_confirmacao,publicado_em").eq("status", "publicado").order("publicado_em", { ascending: false }).limit(50),
      supabase.from("escola_comunicado_leituras").select("comunicado_id,confirmado_em"),
      supabase.from("escola_autorizacao_destinatarios").select("autorizacao_id,aluno_id"),
      supabase.from("escola_autorizacao_respostas").select("autorizacao_id,aluno_id"),
      supabase.from("escola_ocorrencias_aluno").select("id,exige_ciencia,titulo").eq("status", "aberta").order("criado_em", { ascending: false }).limit(100),
      supabase.from("escola_ocorrencia_ciencias").select("ocorrencia_id,responsavel_id"),
      supabase.from("escola_reunioes").select("id,titulo,inicio,aluno:escola_alunos(nome)").gte("inicio", `${today}T00:00:00-03:00`).order("inicio").limit(30),
      supabase.from("escola_justificativas_falta").select("id", { count: "exact", head: true }).in("status", ["pendente", "correcao_solicitada"])
    ]);
    const firstError = reqs.find(x => x.error)?.error; if (firstError) setError(firstError.message);
    setSchedule((reqs[0].data ?? []) as unknown as Schedule[]); setCalls((reqs[1].data ?? []) as Call[]); setNotices((reqs[2].data ?? []) as Notice[]); setReadings((reqs[3].data ?? []) as Reading[]); setRecipients((reqs[4].data ?? []) as Recipient[]); setResponses((reqs[5].data ?? []) as AuthResponse[]); setOccurrences((reqs[6].data ?? []) as Occurrence[]); setAwareness((reqs[7].data ?? []) as Awareness[]); setMeetings((reqs[8].data ?? []) as unknown as Meeting[]); setPendingJustifications(reqs[9].count ?? 0); setLoading(false);
  }, [supabase, today, weekday]);
  useEffect(() => { void load(); }, [load]);

  const pendingCalls = schedule.filter(s => !calls.some(c => c.grade_id === s.id)).length;
  const unreadNotices = notices.filter(n => !readings.some(r => r.comunicado_id === n.id)).length;
  const pendingAuth = recipients.filter(r => !responses.some(x => x.autorizacao_id === r.autorizacao_id && x.aluno_id === r.aluno_id)).length;
  const pendingAwareness = profile.papel === "responsavel" ? occurrences.filter(o => o.exige_ciencia && !awareness.some(a => a.ocorrencia_id === o.id && a.responsavel_id === userId)).length : occurrences.filter(o => o.exige_ciencia).length;
  const nextMeeting = meetings[0];

  if (loading) return <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">Montando o resumo de hoje...</section>;
  const responsible = profile.papel === "responsavel";
  return <section className="grid gap-5">
    <div className="flex flex-col justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 md:flex-row md:items-center"><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Hoje · {formatDate(today)}</p><h2 className="mt-1 text-2xl font-black text-emerald-950">O que precisa da sua atenção</h2><p className="mt-1 text-sm text-emerald-800">Uma visão curta das pendências e próximos compromissos.</p></div><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-800" onClick={() => void load()}><RefreshCw size={16}/> Atualizar</button></div>
    {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {!responsible ? <Card icon={<UsersRound/>} label="Chamadas pendentes" value={pendingCalls} detail={`${schedule.length} aula(s) na grade de hoje`} onClick={() => onNavigate("academico")}/> : null}
      <Card icon={<Bell/>} label="Comunicados não lidos" value={unreadNotices} detail="Avisos aguardando leitura" onClick={() => onNavigate(responsible ? "pendencias" : "comunicacao")}/>
      <Card icon={<ClipboardCheck/>} label="Autorizações pendentes" value={pendingAuth} detail="Respostas ainda não registradas" onClick={() => onNavigate(responsible ? "pendencias" : "comunicacao")}/>
      <Card icon={<AlertTriangle/>} label={responsible ? "Ciências pendentes" : "Ocorrências com ciência"} value={pendingAwareness} detail="Registros que exigem confirmação" onClick={() => onNavigate("alunos")}/>
      {!responsible ? <Card icon={<CheckCircle2/>} label="Justificativas em análise" value={pendingJustifications} detail="Faltas aguardando decisão" onClick={() => onNavigate("alunos")}/> : null}
      <Card icon={<CalendarDays/>} label="Próxima reunião" value={nextMeeting ? formatTime(nextMeeting.inicio) : "—"} detail={nextMeeting ? `${nextMeeting.titulo}${nextMeeting.aluno?.nome ? ` · ${nextMeeting.aluno.nome}` : ""}` : "Nenhuma reunião futura visível"} onClick={() => onNavigate(responsible ? "agenda" : "comunicacao")}/>
    </div>
    {!responsible && schedule.length ? <section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-lg font-black"><Clock3 size={19}/> Aulas de hoje</h3><div className="mt-4 grid gap-2">{schedule.slice(0,8).map(s => { const done = calls.some(c => c.grade_id === s.id); return <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3" key={s.id}><div><p className="font-black">{formatShort(s.hora_inicio)}–{formatShort(s.hora_fim)} · {s.turma?.nome}</p><p className="text-sm text-slate-500">{s.disciplina?.nome || "Disciplina"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${done ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{done ? "Chamada salva" : "Pendente"}</span></div>; })}</div></section> : null}
  </section>;
}
function Card({ icon, label, value, detail, onClick }: { icon: React.ReactNode; label: string; value: number | string; detail: string; onClick: () => void }) { return <button className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300" onClick={onClick} type="button"><span className="text-[#176b5b]">{icon}</span><p className="mt-3 text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></button>; }
function formatDate(v: string) { const [y,m,d] = v.split("-"); return `${d}/${m}/${y}`; }
function formatShort(v: string) { return v.slice(0,5); }
function formatTime(v: string) { try { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Araguaina", hour: "2-digit", minute: "2-digit" }).format(new Date(v)); } catch { return "—"; } }
