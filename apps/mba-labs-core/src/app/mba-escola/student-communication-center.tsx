"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BellRing, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string }; section: "communication" };
type Schedule = { id: string; turma_id: string; professor_id: string; disciplina_id: string; dia_semana: number; hora_inicio: string; hora_fim: string; sala: string | null; ano_letivo: number; turma?: { nome: string } | null; disciplina?: { nome: string } | null };
type Incident = { id: string; grade_id: string | null; turma_id: string; tipo: string; data_evento: string; novo_horario_saida: string | null; motivo: string | null; criado_em: string };

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const days = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function StudentCommunicationCenter({ supabase, profile }: Props) {
  const manager = ["admin_escola", "direcao", "coordenacao"].includes(profile.papel);
  if (!manager) return null;
  return <PriorityPanel supabase={supabase}/>;
}

function PriorityPanel({ supabase }: { supabase: SupabaseClient }) {
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ grade_id: "", data: today(), tipo: "saida_antecipada", horario: "", motivo: "" });

  const load = useCallback(async () => {
    const [gradeResult, incidentResult] = await Promise.all([
      supabase.from("escola_grade_horarios").select("id,turma_id,professor_id,disciplina_id,dia_semana,hora_inicio,hora_fim,sala,ano_letivo,turma:escola_turmas(nome),disciplina:escola_disciplinas(nome)").eq("ativo", true).order("dia_semana").order("hora_inicio"),
      supabase.from("escola_intercorrencias_grade").select("id,grade_id,turma_id,tipo,data_evento,novo_horario_saida,motivo,criado_em").order("criado_em", { ascending: false }).limit(100)
    ]);
    if (gradeResult.error || incidentResult.error) setError(gradeResult.error?.message || incidentResult.error?.message || "");
    setSchedule((gradeResult.data ?? []) as unknown as Schedule[]);
    setIncidents((incidentResult.data ?? []) as Incident[]);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!form.grade_id && schedule[0]) setForm(current => ({ ...current, grade_id: schedule[0].id })); }, [schedule, form.grade_id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.grade_id || !form.data || !form.horario || !form.motivo.trim()) {
      setMessage("");
      setError("Informe data, horário e motivo antes de publicar o aviso prioritário.");
      return;
    }
    setWorking(true); setError(""); setMessage("");
    const { error: publishError } = await supabase.rpc("escola_create_priority_schedule_notice", {
      p_grade_id: form.grade_id,
      p_data: form.data,
      p_tipo: form.tipo,
      p_motivo: form.motivo || null,
      p_novo_horario_saida: form.horario || null,
      p_substituto_id: null
    });
    if (publishError) setError(publishError.message);
    else {
      setMessage("Aviso urgente publicado e enviado para ciência dos responsáveis.");
      setForm(current => ({ ...current, horario: "", motivo: "" }));
      await load();
    }
    setWorking(false);
  }

  return <div className="grid gap-5 lg:grid-cols-2">
    {message ? <p className="lg:col-span-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="lg:col-span-2 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
    <Card title="Aviso prioritário">
      {!schedule.length ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Cadastre a grade antes de vincular um aviso de alteração de aula.</p> : <form className="grid gap-3" onSubmit={submit}>
        <select className={field} value={form.grade_id} onChange={event => setForm(current => ({ ...current, grade_id: event.target.value }))}>{schedule.map(item => <option key={item.id} value={item.id}>{item.turma?.nome} · {item.disciplina?.nome} · {days[item.dia_semana]} {short(item.hora_inicio)}</option>)}</select>
        <select className={field} value={form.tipo} onChange={event => setForm(current => ({ ...current, tipo: event.target.value }))}><option value="saida_antecipada">Saída antecipada</option><option value="professor_ausente">Professor ausente</option><option value="aula_cancelada">Aula cancelada</option><option value="substituicao">Professor substituto</option></select>
        <input aria-label="Data do aviso" className={field} required type="date" value={form.data} onChange={event => setForm(current => ({ ...current, data: event.target.value }))}/>
        <input aria-label="Horário do aviso" className={field} required type="time" value={form.horario} onChange={event => setForm(current => ({ ...current, horario: event.target.value }))}/>
        <textarea aria-label="Motivo ou orientação" className={area} placeholder="Motivo / orientação" required value={form.motivo} onChange={event => setForm(current => ({ ...current, motivo: event.target.value }))}/>
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800"><BellRing className="mr-2 inline" size={16}/>Será publicado como URGENTE e exigirá ciência.</p>
        <button className={primary} disabled={working}><ShieldAlert size={17}/> Publicar aviso</button>
      </form>}
    </Card>
    <Card title="Avisos recentes">{incidents.length ? incidents.map(item => <article className="mb-3 rounded-2xl border border-slate-200 p-4" key={item.id}><p className="font-black">{incidentLabel(item.tipo)}</p><p className="text-sm text-slate-500">{formatDate(item.data_evento)}{item.novo_horario_saida ? ` · saída ${short(item.novo_horario_saida)}` : ""}</p>{item.motivo ? <p className="mt-2 text-sm">{item.motivo}</p> : null}</article>) : <p className="text-sm text-slate-500">Nenhum aviso prioritário registrado.</p>}</Card>
  </div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-black">{title}</h3>{children}</section>; }
function short(value?: string | null) { return value ? value.slice(0, 5) : "--:--"; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date()); }
function formatDate(value?: string | null) { if (!value) return "—"; const parts = value.slice(0, 10).split("-"); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value; }
function incidentLabel(type: string) { return ({ professor_ausente: "Professor ausente", saida_antecipada: "Saída antecipada", aula_cancelada: "Aula cancelada", substituicao: "Professor substituto" } as Record<string, string>)[type] || type; }
