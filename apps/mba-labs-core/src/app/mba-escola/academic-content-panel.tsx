"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ClipboardList, LoaderCircle, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string } };
type ClassRow = { id: string; nome: string };
type Student = { id: string; nome: string; turma_id: string | null };
type Activity = { id: string; turma_id: string; professor_id: string; titulo: string; descricao: string; data_entrega: string | null; status: string; turma?: { nome: string } | null };
type Delivery = { atividade_id: string; aluno_id: string; situacao: string; entregue_em: string | null };

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-28 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";

export default function AcademicContentPanel({ supabase, profile }: Props) {
  const teacher = profile.papel === "professor";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activityForm, setActivityForm] = useState({ turma_id: "", titulo: "", descricao: "", data_entrega: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id || "");
    const reqs = await Promise.all([
      supabase.from("escola_turmas").select("id,nome").eq("ativa", true).order("nome"),
      supabase.from("escola_alunos").select("id,nome,turma_id").eq("ativo", true).order("nome"),
      supabase.from("escola_atividades").select("id,turma_id,professor_id,titulo,descricao,data_entrega,status,turma:escola_turmas(nome)").order("criado_em", { ascending: false }).limit(120),
      supabase.from("escola_atividade_entregas").select("atividade_id,aluno_id,situacao,entregue_em")
    ]);
    const firstError = reqs.find(item => item.error)?.error;
    if (firstError) setError(firstError.message);
    setClasses((reqs[0].data ?? []) as ClassRow[]);
    setStudents((reqs[1].data ?? []) as Student[]);
    setActivities((reqs[2].data ?? []) as unknown as Activity[]);
    setDeliveries((reqs[3].data ?? []) as Delivery[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!activityForm.turma_id && classes[0]) setActivityForm(current => ({ ...current, turma_id: classes[0].id }));
  }, [classes, activityForm.turma_id]);

  async function run(action: () => PromiseLike<{ error?: { message: string } | null }>, success: string) {
    setSaving(true); setError(""); setMessage("");
    const result = await action();
    if (result.error) setError(result.error.message);
    else { setMessage(success); await load(); }
    setSaving(false);
  }

  async function saveActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!teacher || !userId) return;
    await run(() => supabase.from("escola_atividades").insert({
      escola_id: profile.escola_id,
      turma_id: activityForm.turma_id,
      professor_id: userId,
      titulo: activityForm.titulo,
      descricao: activityForm.descricao,
      data_entrega: activityForm.data_entrega || null,
      status: "publicada"
    }), "Informativo da atividade para casa publicado.");
    setActivityForm(current => ({ ...current, titulo: "", descricao: "", data_entrega: "" }));
  }

  async function setDelivery(activityId: string, studentId: string, status: string) {
    if (!teacher) return;
    await run(() => supabase.from("escola_atividade_entregas").upsert({
      atividade_id: activityId,
      aluno_id: studentId,
      situacao: status,
      entregue_em: status === "entregue" ? new Date().toISOString() : null,
      atualizado_em: new Date().toISOString()
    }), "Situação da atividade atualizada.");
  }

  const activitySummary = useMemo(() => Object.fromEntries(activities.map(activity => {
    const classStudents = students.filter(student => student.turma_id === activity.turma_id);
    const delivered = classStudents.filter(student => deliveries.some(item => item.atividade_id === activity.id && item.aluno_id === student.id && item.situacao === "entregue")).length;
    return [activity.id, { total: classStudents.length, delivered }];
  })), [activities, students, deliveries]);

  if (loading) return <section className="grid min-h-44 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={28}/></section>;

  return <section className="grid gap-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Atividades</p>
      <h2 className="mt-1 text-2xl font-black">Atividades para casa</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">As aulas do professor são definidas pela grade. Aqui ficam somente os informativos e o acompanhamento das atividades enviadas para casa.</p>
    </header>

    {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}

    <div className={`grid gap-5 ${teacher ? "lg:grid-cols-[.8fr_1.2fr]" : ""}`}>
      {teacher ? <Card title="Informar atividade para casa" icon={<ClipboardList size={20}/>}>
        <form className="grid gap-3" onSubmit={saveActivity}>
          <label className="grid gap-1 text-sm font-bold text-slate-600">Turma<ClassSelect classes={classes} value={activityForm.turma_id} set={value => setActivityForm(current => ({ ...current, turma_id: value }))}/></label>
          <label className="grid gap-1 text-sm font-bold text-slate-600">Atividade<input className={field} placeholder="Ex.: Exercícios de Matemática" required value={activityForm.titulo} onChange={event => setActivityForm(current => ({ ...current, titulo: event.target.value }))}/></label>
          <label className="grid gap-1 text-sm font-bold text-slate-600">Informativo para casa<textarea className={area} placeholder="Informe o que deve ser feito, páginas, material necessário ou demais orientações." required value={activityForm.descricao} onChange={event => setActivityForm(current => ({ ...current, descricao: event.target.value }))}/></label>
          <label className="grid gap-1 text-sm font-bold text-slate-600">Prazo / entrega (opcional)<input className={field} type="date" value={activityForm.data_entrega} onChange={event => setActivityForm(current => ({ ...current, data_entrega: event.target.value }))}/></label>
          <button className={primary} disabled={saving || !activityForm.turma_id}><Plus size={17}/> Publicar informativo</button>
        </form>
      </Card> : null}

      <Card title={teacher ? "Atividades das minhas turmas" : "Atividades publicadas"} icon={<ClipboardList size={20}/>}>
        {activities.length ? <div className="grid gap-3">{activities.map(activity => {
          const summary = activitySummary[activity.id] || { total: 0, delivered: 0 };
          return <article className="rounded-2xl border border-slate-200 p-4" key={activity.id}>
            <p className="font-black">{activity.titulo}</p>
            <p className="mt-1 text-xs font-bold text-[#176b5b]">{activity.turma?.nome || "Turma"}{activity.data_entrega ? ` · Prazo ${date(activity.data_entrega)}` : ""}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{activity.descricao}</p>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold">Entregues: {summary.delivered} de {summary.total}</p>
            {teacher ? <div className="mt-3 grid gap-2">{students.filter(student => student.turma_id === activity.turma_id).map(student => {
              const delivery = deliveries.find(item => item.atividade_id === activity.id && item.aluno_id === student.id);
              return <div className="flex items-center justify-between gap-2" key={student.id}>
                <span className="text-sm">{student.nome}</span>
                <select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={delivery?.situacao || "pendente"} onChange={event => void setDelivery(activity.id, student.id, event.target.value)}>
                  <option value="pendente">Pendente</option>
                  <option value="entregue">Entregue</option>
                  <option value="atrasada">Atrasada</option>
                  <option value="nao_entregue">Não entregue</option>
                </select>
              </div>;
            })}</div> : null}
          </article>;
        })}</div> : <Empty text="Nenhuma atividade para casa publicada."/>}
      </Card>
    </div>
  </section>;
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 flex items-center gap-2 text-lg font-black"><span className="text-[#176b5b]">{icon}</span>{title}</h3>{children}</section>; }
function ClassSelect({ classes, value, set }: { classes: ClassRow[]; value: string; set: (value: string) => void }) { return <select className={field} value={value} onChange={event => set(event.target.value)}><option value="" disabled>Selecione a turma</option>{classes.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }
function date(value?: string | null) { if (!value) return "—"; const parts = value.slice(0, 10).split("-"); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value; }
