"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Bell,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  School,
  UserCheck,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "coordenacao" | "professor" | "responsavel" | "aluno";
type Profile = { nome: string; papel: Role; escola_id: string; escola: { nome: string } | null };
type ClassRow = { id: string; nome: string; ano_letivo: number; turno: string | null; professor_responsavel_id: string | null; ativa: boolean };
type Student = { id: string; nome: string; turma_id: string | null; perfil_id: string | null; ativo: boolean; turma?: { nome: string } | null };
type Lesson = { id: string; turma_id: string; data_aula: string; componente: string | null; titulo: string; conteudo_trabalhado: string; tarefa_casa: string | null; turma?: { nome: string } | null };
type Activity = { id: string; turma_id: string; professor_id: string; titulo: string; descricao: string; data_entrega: string | null; status: string; turma?: { nome: string } | null };
type Delivery = { atividade_id: string; aluno_id: string; situacao: string; entregue_em: string | null; comentario_professor: string | null; aluno?: { nome: string } | null };
type Followup = { id: string; aluno_id: string; categoria: string; titulo: string; observacao: string; acao_planejada: string | null; prazo: string | null; status: string; visivel_responsavel: boolean; aluno?: { nome: string } | null };
type Meeting = { id: string; aluno_id: string | null; responsavel_id: string | null; titulo: string; inicio: string; fim: string | null; local: string | null; pauta: string | null; status: string; aluno?: { nome: string } | null };
type Notice = { id: string; turma_id: string | null; titulo: string; resumo: string | null; conteudo: string; prioridade: string; exige_confirmacao: boolean; status: string; publicado_em: string | null; turma?: { nome: string } | null };
type Reading = { comunicado_id: string; lido_em: string; confirmado_em: string | null };
type GuardianLink = { aluno_id: string; responsavel_id: string; parentesco: string | null; principal: boolean };
type Person = { id: string; nome: string; papel: string; email: string | null };
type ChildLink = { aluno_id: string; parentesco: string | null; principal: boolean; aluno: Student | null };

type Props = { supabase: SupabaseClient; profile: Profile };

type Tab = "inicio" | "aulas" | "atividades" | "alunos" | "acompanhamentos" | "reunioes" | "comunicados";

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700";

export default function RoleWorkspace({ supabase, profile }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("inicio");
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<GuardianLink[]>([]);
  const [guardians, setGuardians] = useState<Person[]>([]);
  const [children, setChildren] = useState<ChildLink[]>([]);

  const [lessonForm, setLessonForm] = useState({ turma_id: "", data_aula: new Date().toISOString().slice(0, 10), componente: "", titulo: "", conteudo: "", tarefa: "" });
  const [activityForm, setActivityForm] = useState({ turma_id: "", titulo: "", descricao: "", data_entrega: "" });
  const [followForm, setFollowForm] = useState({ aluno_id: "", categoria: "pedagogico", titulo: "", observacao: "", acao: "", prazo: "", visivel: true });
  const [meetingForm, setMeetingForm] = useState({ aluno_id: "", responsavel_id: "", titulo: "Reunião de acompanhamento", inicio: "", local: "", pauta: "" });
  const [noticeForm, setNoticeForm] = useState({ turma_id: "", titulo: "", resumo: "", conteudo: "", prioridade: "normal", exige_confirmacao: false });

  const canWriteAcademic = profile.papel === "professor" || profile.papel === "coordenacao";
  const canCoordinate = profile.papel === "coordenacao";

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || "";
    setUserId(uid);

    if (!uid) {
      setLoading(false);
      return;
    }

    const common = await Promise.all([
      supabase.from("escola_turmas").select("id,nome,ano_letivo,turno,professor_responsavel_id,ativa").order("nome"),
      supabase.from("escola_alunos").select("id,nome,turma_id,perfil_id,ativo,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
      supabase.from("escola_aulas").select("id,turma_id,data_aula,componente,titulo,conteudo_trabalhado,tarefa_casa,turma:escola_turmas(nome)").order("data_aula", { ascending: false }).limit(50),
      supabase.from("escola_atividades").select("id,turma_id,professor_id,titulo,descricao,data_entrega,status,turma:escola_turmas(nome)").order("criado_em", { ascending: false }).limit(50),
      supabase.from("escola_acompanhamentos").select("id,aluno_id,categoria,titulo,observacao,acao_planejada,prazo,status,visivel_responsavel,aluno:escola_alunos(nome)").order("criado_em", { ascending: false }).limit(50),
      supabase.from("escola_reunioes").select("id,aluno_id,responsavel_id,titulo,inicio,fim,local,pauta,status,aluno:escola_alunos(nome)").order("inicio", { ascending: false }).limit(50),
      supabase.from("escola_comunicados").select("id,turma_id,titulo,resumo,conteudo,prioridade,exige_confirmacao,status,publicado_em,turma:escola_turmas(nome)").order("publicado_em", { ascending: false, nullsFirst: false }).limit(50),
      supabase.from("escola_comunicado_leituras").select("comunicado_id,lido_em,confirmado_em"),
      supabase.from("escola_atividade_entregas").select("atividade_id,aluno_id,situacao,entregue_em,comentario_professor,aluno:escola_alunos(nome)")
    ]);

    setClasses((common[0].data ?? []) as ClassRow[]);
    setStudents((common[1].data ?? []) as unknown as Student[]);
    setLessons((common[2].data ?? []) as unknown as Lesson[]);
    setActivities((common[3].data ?? []) as unknown as Activity[]);
    setFollowups((common[4].data ?? []) as unknown as Followup[]);
    setMeetings((common[5].data ?? []) as unknown as Meeting[]);
    setNotices((common[6].data ?? []) as unknown as Notice[]);
    setReadings((common[7].data ?? []) as Reading[]);
    setDeliveries((common[8].data ?? []) as unknown as Delivery[]);

    if (profile.papel === "professor" || profile.papel === "coordenacao") {
      const [{ data: links }, { data: people }] = await Promise.all([
        supabase.from("escola_aluno_responsaveis").select("aluno_id,responsavel_id,parentesco,principal"),
        supabase.from("escola_perfis").select("id,nome,papel,email").eq("papel", "responsavel").eq("ativo", true)
      ]);
      setGuardianLinks((links ?? []) as GuardianLink[]);
      setGuardians((people ?? []) as Person[]);
    }

    if (profile.papel === "responsavel") {
      const { data } = await supabase
        .from("escola_aluno_responsaveis")
        .select("aluno_id,parentesco,principal,aluno:escola_alunos(id,nome,turma_id,perfil_id,ativo,turma:escola_turmas(nome))")
        .eq("responsavel_id", uid);
      setChildren((data ?? []) as unknown as ChildLink[]);
    }

    setLoading(false);
  }, [profile.papel, supabase]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!lessonForm.turma_id && classes[0]) setLessonForm((v) => ({ ...v, turma_id: classes[0].id }));
    if (!activityForm.turma_id && classes[0]) setActivityForm((v) => ({ ...v, turma_id: classes[0].id }));
    if (!followForm.aluno_id && students[0]) setFollowForm((v) => ({ ...v, aluno_id: students[0].id }));
    if (!meetingForm.aluno_id && students[0]) setMeetingForm((v) => ({ ...v, aluno_id: students[0].id }));
  }, [classes, students, lessonForm.turma_id, activityForm.turma_id, followForm.aluno_id, meetingForm.aluno_id]);

  useEffect(() => {
    if (!meetingForm.aluno_id) return;
    const link = guardianLinks.find((item) => item.aluno_id === meetingForm.aluno_id && item.principal) || guardianLinks.find((item) => item.aluno_id === meetingForm.aluno_id);
    setMeetingForm((v) => ({ ...v, responsavel_id: link?.responsavel_id || "" }));
  }, [meetingForm.aluno_id, guardianLinks]);

  const childIds = useMemo(() => new Set(children.map((c) => c.aluno_id)), [children]);
  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const readingByNotice = useMemo(() => Object.fromEntries(readings.map((r) => [r.comunicado_id, r])), [readings]);

  async function runSave(action: () => Promise<{ error?: { message: string } | null }>, success: string) {
    setSaving(true);
    setMessage("");
    const result = await action();
    if (result.error) setMessage(`Não foi possível salvar: ${result.error.message}`);
    else {
      setMessage(success);
      await load();
    }
    setSaving(false);
  }

  async function saveLesson(event: React.FormEvent) {
    event.preventDefault();
    await runSave(() => supabase.from("escola_aulas").insert({
      escola_id: profile.escola_id,
      turma_id: lessonForm.turma_id,
      professor_id: userId,
      data_aula: lessonForm.data_aula,
      componente: lessonForm.componente || null,
      titulo: lessonForm.titulo,
      conteudo_trabalhado: lessonForm.conteudo,
      tarefa_casa: lessonForm.tarefa || null
    }), "Aula registrada com sucesso.");
    setLessonForm((v) => ({ ...v, titulo: "", conteudo: "", tarefa: "" }));
  }

  async function saveActivity(event: React.FormEvent) {
    event.preventDefault();
    await runSave(() => supabase.from("escola_atividades").insert({
      escola_id: profile.escola_id,
      turma_id: activityForm.turma_id,
      professor_id: userId,
      titulo: activityForm.titulo,
      descricao: activityForm.descricao,
      data_entrega: activityForm.data_entrega || null,
      status: "publicada"
    }), "Atividade publicada e distribuída aos alunos da turma.");
    setActivityForm((v) => ({ ...v, titulo: "", descricao: "", data_entrega: "" }));
  }

  async function saveFollowup(event: React.FormEvent) {
    event.preventDefault();
    await runSave(() => supabase.from("escola_acompanhamentos").insert({
      escola_id: profile.escola_id,
      aluno_id: followForm.aluno_id,
      autor_id: userId,
      categoria: followForm.categoria,
      titulo: followForm.titulo,
      observacao: followForm.observacao,
      acao_planejada: followForm.acao || null,
      prazo: followForm.prazo || null,
      status: "aberto",
      visivel_responsavel: followForm.visivel
    }), "Acompanhamento registrado.");
    setFollowForm((v) => ({ ...v, titulo: "", observacao: "", acao: "", prazo: "" }));
  }

  async function saveMeeting(event: React.FormEvent) {
    event.preventDefault();
    await runSave(() => supabase.from("escola_reunioes").insert({
      escola_id: profile.escola_id,
      aluno_id: meetingForm.aluno_id || null,
      responsavel_id: meetingForm.responsavel_id || null,
      criado_por: userId,
      titulo: meetingForm.titulo,
      inicio: new Date(meetingForm.inicio).toISOString(),
      local: meetingForm.local || null,
      pauta: meetingForm.pauta || null,
      status: "agendada"
    }), "Reunião agendada.");
  }

  async function saveNotice(event: React.FormEvent) {
    event.preventDefault();
    await runSave(() => supabase.from("escola_comunicados").insert({
      escola_id: profile.escola_id,
      turma_id: noticeForm.turma_id || null,
      autor_id: userId,
      titulo: noticeForm.titulo,
      resumo: noticeForm.resumo || null,
      conteudo: noticeForm.conteudo,
      prioridade: noticeForm.prioridade,
      exige_confirmacao: noticeForm.exige_confirmacao,
      status: "publicado",
      publicado_em: new Date().toISOString()
    }), "Comunicado publicado.");
    setNoticeForm((v) => ({ ...v, titulo: "", resumo: "", conteudo: "" }));
  }

  async function setDelivery(activityId: string, studentId: string, situation: string) {
    await runSave(() => supabase.from("escola_atividade_entregas").upsert({
      atividade_id: activityId,
      aluno_id: studentId,
      situacao: situation,
      entregue_em: situation === "entregue" ? new Date().toISOString() : null,
      atualizado_em: new Date().toISOString()
    }), "Situação da atividade atualizada.");
  }

  async function submitActivity(activityId: string) {
    await runSave(() => supabase.rpc("escola_student_submit_activity", { p_atividade_id: activityId }), "Atividade marcada como entregue.");
  }

  async function markNotice(noticeId: string, confirm: boolean) {
    await runSave(() => supabase.rpc("escola_mark_communication", { p_comunicado_id: noticeId, p_confirmar: confirm }), confirm ? "Ciência registrada." : "Comunicado marcado como lido.");
  }

  if (loading) return <section className="grid min-h-52 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={32} /></section>;

  const tabs = tabsForRole(profile.papel);

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map((item) => (
          <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab === item.id ? "bg-[#176b5b] text-white" : "text-slate-600 hover:bg-slate-50"}`} type="button">{item.label}</button>
        ))}
        <button className={`${secondary} ml-auto`} onClick={() => void load()} type="button"><RefreshCw size={16} /> Atualizar</button>
      </div>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}

      {tab === "inicio" ? <Overview role={profile.papel} classes={classes} students={students} activities={activities} meetings={meetings} children={children} /> : null}
      {tab === "aulas" ? <LessonsTab canWrite={canWriteAcademic} classes={classes} lessons={lessons} form={lessonForm} setForm={setLessonForm} save={saveLesson} saving={saving} /> : null}
      {tab === "atividades" ? <ActivitiesTab role={profile.papel} classes={classes} activities={activities} deliveries={deliveries} students={students} form={activityForm} setForm={setActivityForm} save={saveActivity} saving={saving} setDelivery={setDelivery} submitActivity={submitActivity} /> : null}
      {tab === "alunos" ? <StudentsTab students={profile.papel === "responsavel" ? children.map((c) => c.aluno).filter(Boolean) as Student[] : students} /> : null}
      {tab === "acompanhamentos" ? <FollowupsTab writable={canWriteAcademic} students={students} followups={profile.papel === "responsavel" ? followups.filter((f) => childIds.has(f.aluno_id)) : followups} form={followForm} setForm={setFollowForm} save={saveFollowup} saving={saving} /> : null}
      {tab === "reunioes" ? <MeetingsTab writable={canWriteAcademic} students={students} meetings={meetings} form={meetingForm} setForm={setMeetingForm} guardians={guardians} guardianLinks={guardianLinks} save={saveMeeting} saving={saving} /> : null}
      {tab === "comunicados" ? <NoticesTab role={profile.papel} writable={profile.papel === "professor" || canCoordinate} classes={classes} notices={notices} form={noticeForm} setForm={setNoticeForm} save={saveNotice} saving={saving} readingByNotice={readingByNotice} markNotice={markNotice} /> : null}
    </section>
  );
}

function tabsForRole(role: Role): { id: Tab; label: string }[] {
  if (role === "professor") return [
    { id: "inicio", label: "Visão geral" }, { id: "aulas", label: "Aulas" }, { id: "atividades", label: "Atividades" }, { id: "alunos", label: "Meus alunos" }, { id: "acompanhamentos", label: "Observações" }, { id: "reunioes", label: "Reuniões" }, { id: "comunicados", label: "Comunicados" }
  ];
  if (role === "coordenacao") return [
    { id: "inicio", label: "Visão geral" }, { id: "alunos", label: "Alunos" }, { id: "acompanhamentos", label: "Acompanhamentos" }, { id: "reunioes", label: "Reuniões" }, { id: "comunicados", label: "Comunicados" }, { id: "aulas", label: "Aulas" }, { id: "atividades", label: "Atividades" }
  ];
  if (role === "responsavel") return [
    { id: "inicio", label: "Resumo" }, { id: "alunos", label: "Meus filhos" }, { id: "atividades", label: "Atividades" }, { id: "aulas", label: "Aulas" }, { id: "acompanhamentos", label: "Acompanhamento" }, { id: "reunioes", label: "Reuniões" }, { id: "comunicados", label: "Comunicados" }
  ];
  return [{ id: "inicio", label: "Resumo" }, { id: "atividades", label: "Minhas atividades" }, { id: "aulas", label: "Minhas aulas" }, { id: "comunicados", label: "Comunicados" }];
}

function Overview({ role, classes, students, activities, meetings, children }: { role: Role; classes: ClassRow[]; students: Student[]; activities: Activity[]; meetings: Meeting[]; children: ChildLink[] }) {
  const cards = role === "responsavel" ? [
    ["Filhos vinculados", children.length, UsersRound], ["Atividades", activities.length, ClipboardList], ["Reuniões", meetings.length, CalendarDays]
  ] : role === "aluno" ? [
    ["Atividades", activities.length, ClipboardList], ["Turmas", classes.length, School], ["Agenda", meetings.length, CalendarDays]
  ] : [
    ["Turmas", classes.length, School], ["Alunos", students.length, UsersRound], ["Atividades", activities.length, ClipboardList], ["Reuniões", meetings.length, CalendarDays]
  ];
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, Icon]) => { const I = Icon as typeof School; return <article key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><I className="text-[#176b5b]" size={24} /><p className="mt-4 text-sm font-bold text-slate-500">{String(label)}</p><p className="mt-1 text-3xl font-black">{String(value)}</p></article>; })}</div>;
}

function LessonsTab({ canWrite, classes, lessons, form, setForm, save, saving }: any) {
  return <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
    {canWrite ? <Card title="Registrar aula" icon={BookOpenText}><form className="grid gap-3" onSubmit={save}><SelectClass classes={classes} value={form.turma_id} onChange={(v) => setForm((x: any) => ({ ...x, turma_id: v }))} /><input className={field} type="date" value={form.data_aula} onChange={(e) => setForm((x: any) => ({ ...x, data_aula: e.target.value }))} required /><input className={field} placeholder="Componente / disciplina" value={form.componente} onChange={(e) => setForm((x: any) => ({ ...x, componente: e.target.value }))} /><input className={field} placeholder="Título da aula" value={form.titulo} onChange={(e) => setForm((x: any) => ({ ...x, titulo: e.target.value }))} required /><textarea className={area} placeholder="Conteúdo trabalhado" value={form.conteudo} onChange={(e) => setForm((x: any) => ({ ...x, conteudo: e.target.value }))} required /><textarea className={area} placeholder="Tarefa de casa (opcional)" value={form.tarefa} onChange={(e) => setForm((x: any) => ({ ...x, tarefa: e.target.value }))} /><button className={primary} disabled={saving}><Save size={17} /> Salvar aula</button></form></Card> : null}
    <Card title="Aulas registradas" icon={BookOpenText}><ListEmpty empty={!lessons.length} text="Nenhuma aula registrada.">{lessons.map((l: Lesson) => <article key={l.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{l.titulo}</p><span className="text-xs font-bold text-slate-500">{formatDate(l.data_aula)}</span></div><p className="mt-1 text-sm font-bold text-[#176b5b]">{l.turma?.nome || l.componente || "Turma"}</p><p className="mt-2 text-sm leading-6 text-slate-600">{l.conteudo_trabalhado}</p>{l.tarefa_casa ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><b>Tarefa:</b> {l.tarefa_casa}</p> : null}</article>)}</ListEmpty></Card>
  </div>;
}

function ActivitiesTab({ role, classes, activities, deliveries, students, form, setForm, save, saving, setDelivery, submitActivity }: any) {
  const writable = role === "professor" || role === "coordenacao";
  return <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
    {writable ? <Card title="Nova atividade" icon={ClipboardList}><form className="grid gap-3" onSubmit={save}><SelectClass classes={classes} value={form.turma_id} onChange={(v) => setForm((x: any) => ({ ...x, turma_id: v }))} /><input className={field} placeholder="Título da atividade" value={form.titulo} onChange={(e) => setForm((x: any) => ({ ...x, titulo: e.target.value }))} required /><textarea className={area} placeholder="Descrição / instruções" value={form.descricao} onChange={(e) => setForm((x: any) => ({ ...x, descricao: e.target.value }))} required /><label className="grid gap-1 text-sm font-bold text-slate-600">Data de entrega<input className={field} type="date" value={form.data_entrega} onChange={(e) => setForm((x: any) => ({ ...x, data_entrega: e.target.value }))} /></label><button className={primary} disabled={saving}><Plus size={17} /> Publicar atividade</button></form></Card> : null}
    <Card title={writable ? "Atividades e entregas" : "Atividades"} icon={ClipboardList}><ListEmpty empty={!activities.length} text="Nenhuma atividade disponível.">{activities.map((a: Activity) => { const ownDelivery = deliveries.find((d: Delivery) => d.atividade_id === a.id); const classStudents = students.filter((s: Student) => s.turma_id === a.turma_id); return <article key={a.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-black">{a.titulo}</p><p className="text-xs font-bold text-[#176b5b]">{a.turma?.nome || "Turma"}</p></div><span className="text-xs font-bold text-slate-500">Entrega: {formatDate(a.data_entrega)}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{a.descricao}</p>{role === "aluno" ? <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><span className="text-sm font-bold">Status: {ownDelivery?.situacao || "pendente"}</span>{ownDelivery?.situacao !== "entregue" ? <button className={secondary} onClick={() => void submitActivity(a.id)} type="button"><CheckCircle2 size={16} /> Marcar entregue</button> : null}</div> : null}{writable && classStudents.length ? <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Entregas</p>{classStudents.map((s: Student) => { const d = deliveries.find((x: Delivery) => x.atividade_id === a.id && x.aluno_id === s.id); return <div key={s.id} className="flex items-center justify-between gap-2"><span className="text-sm font-bold">{s.nome}</span><select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold" value={d?.situacao || "pendente"} onChange={(e) => void setDelivery(a.id, s.id, e.target.value)}><option value="pendente">Pendente</option><option value="entregue">Entregue</option><option value="atrasada">Atrasada</option><option value="nao_entregue">Não entregue</option></select></div>; })}</div> : null}</article>; })}</ListEmpty></Card>
  </div>;
}

function StudentsTab({ students }: { students: Student[] }) {
  return <Card title="Alunos" icon={UsersRound}><ListEmpty empty={!students.length} text="Nenhum aluno disponível neste perfil."><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{students.map((s) => <article className="rounded-2xl border border-slate-200 p-4" key={s.id}><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 font-black text-[#176b5b]">{s.nome.slice(0, 1)}</div><div><p className="font-black">{s.nome}</p><p className="text-sm text-slate-500">{s.turma?.nome || "Sem turma"}</p></div></div></article>)}</div></ListEmpty></Card>;
}

function FollowupsTab({ writable, students, followups, form, setForm, save, saving }: any) {
  return <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">{writable ? <Card title="Registrar acompanhamento" icon={MessageSquareText}><form className="grid gap-3" onSubmit={save}><select className={field} value={form.aluno_id} onChange={(e) => setForm((x: any) => ({ ...x, aluno_id: e.target.value }))} required>{students.map((s: Student) => <option value={s.id} key={s.id}>{s.nome}</option>)}</select><select className={field} value={form.categoria} onChange={(e) => setForm((x: any) => ({ ...x, categoria: e.target.value }))}><option value="pedagogico">Pedagógico</option><option value="convivencia">Convivência</option><option value="frequencia">Frequência</option><option value="comportamento">Comportamento</option><option value="outro">Outro</option></select><input className={field} placeholder="Título" value={form.titulo} onChange={(e) => setForm((x: any) => ({ ...x, titulo: e.target.value }))} required /><textarea className={area} placeholder="Observação" value={form.observacao} onChange={(e) => setForm((x: any) => ({ ...x, observacao: e.target.value }))} required /><textarea className={area} placeholder="Ação planejada (opcional)" value={form.acao} onChange={(e) => setForm((x: any) => ({ ...x, acao: e.target.value }))} /><input className={field} type="date" value={form.prazo} onChange={(e) => setForm((x: any) => ({ ...x, prazo: e.target.value }))} /><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.visivel} onChange={(e) => setForm((x: any) => ({ ...x, visivel: e.target.checked }))} /> Visível ao responsável</label><button className={primary} disabled={saving}><Save size={17} /> Registrar</button></form></Card> : null}<Card title="Histórico de acompanhamento" icon={MessageSquareText}><ListEmpty empty={!followups.length} text="Nenhum acompanhamento registrado.">{followups.map((f: Followup) => <article key={f.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-2"><div><p className="font-black">{f.titulo}</p><p className="text-xs font-bold text-[#176b5b]">{f.aluno?.nome || "Aluno"} · {f.categoria}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{f.status}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{f.observacao}</p>{f.acao_planejada ? <p className="mt-2 text-sm"><b>Ação:</b> {f.acao_planejada}</p> : null}</article>)}</ListEmpty></Card></div>;
}

function MeetingsTab({ writable, students, meetings, form, setForm, guardians, guardianLinks, save, saving }: any) {
  const availableGuardians = guardianLinks.filter((l: GuardianLink) => l.aluno_id === form.aluno_id).map((l: GuardianLink) => guardians.find((g: Person) => g.id === l.responsavel_id)).filter(Boolean) as Person[];
  return <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">{writable ? <Card title="Agendar reunião" icon={CalendarDays}><form className="grid gap-3" onSubmit={save}><select className={field} value={form.aluno_id} onChange={(e) => setForm((x: any) => ({ ...x, aluno_id: e.target.value }))} required>{students.map((s: Student) => <option value={s.id} key={s.id}>{s.nome}</option>)}</select><select className={field} value={form.responsavel_id} onChange={(e) => setForm((x: any) => ({ ...x, responsavel_id: e.target.value }))}><option value="">Sem responsável definido</option>{availableGuardians.map((g) => <option value={g.id} key={g.id}>{g.nome}</option>)}</select><input className={field} placeholder="Título" value={form.titulo} onChange={(e) => setForm((x: any) => ({ ...x, titulo: e.target.value }))} required /><input className={field} type="datetime-local" value={form.inicio} onChange={(e) => setForm((x: any) => ({ ...x, inicio: e.target.value }))} required /><input className={field} placeholder="Local" value={form.local} onChange={(e) => setForm((x: any) => ({ ...x, local: e.target.value }))} /><textarea className={area} placeholder="Pauta" value={form.pauta} onChange={(e) => setForm((x: any) => ({ ...x, pauta: e.target.value }))} /><button className={primary} disabled={saving}><CalendarDays size={17} /> Agendar</button></form></Card> : null}<Card title="Reuniões" icon={CalendarDays}><ListEmpty empty={!meetings.length} text="Nenhuma reunião disponível.">{meetings.map((m: Meeting) => <article key={m.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-2"><div><p className="font-black">{m.titulo}</p><p className="text-xs font-bold text-[#176b5b]">{m.aluno?.nome || "Reunião geral"}</p></div><span className="text-xs font-bold text-slate-500">{formatDateTime(m.inicio)}</span></div>{m.local ? <p className="mt-2 text-sm"><b>Local:</b> {m.local}</p> : null}{m.pauta ? <p className="mt-2 text-sm text-slate-600">{m.pauta}</p> : null}</article>)}</ListEmpty></Card></div>;
}

function NoticesTab({ role, writable, classes, notices, form, setForm, save, saving, readingByNotice, markNotice }: any) {
  return <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">{writable ? <Card title="Publicar comunicado" icon={Bell}><form className="grid gap-3" onSubmit={save}><select className={field} value={form.turma_id} onChange={(e) => setForm((x: any) => ({ ...x, turma_id: e.target.value }))}><option value="">Toda a escola</option>{classes.map((c: ClassRow) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select><input className={field} placeholder="Título" value={form.titulo} onChange={(e) => setForm((x: any) => ({ ...x, titulo: e.target.value }))} required /><input className={field} placeholder="Resumo curto" value={form.resumo} onChange={(e) => setForm((x: any) => ({ ...x, resumo: e.target.value }))} /><textarea className={area} placeholder="Conteúdo do comunicado" value={form.conteudo} onChange={(e) => setForm((x: any) => ({ ...x, conteudo: e.target.value }))} required /><select className={field} value={form.prioridade} onChange={(e) => setForm((x: any) => ({ ...x, prioridade: e.target.value }))}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.exige_confirmacao} onChange={(e) => setForm((x: any) => ({ ...x, exige_confirmacao: e.target.checked }))} /> Exigir “Li e estou ciente”</label><button className={primary} disabled={saving}><Bell size={17} /> Publicar</button></form></Card> : null}<Card title="Comunicados" icon={Bell}><ListEmpty empty={!notices.length} text="Nenhum comunicado disponível.">{notices.map((n: Notice) => { const read = readingByNotice[n.id] as Reading | undefined; return <article key={n.id} className={`rounded-2xl border p-4 ${n.prioridade === "urgente" ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}><div className="flex flex-wrap justify-between gap-2"><div><p className="font-black">{n.titulo}</p><p className="text-xs font-bold text-[#176b5b]">{n.turma?.nome || "Toda a escola"}</p></div><span className="text-xs font-bold text-slate-500">{formatDate(n.publicado_em)}</span></div>{n.resumo ? <p className="mt-2 text-sm font-semibold text-slate-700">{n.resumo}</p> : null}<p className="mt-2 text-sm leading-6 text-slate-600">{n.conteudo}</p>{role === "responsavel" || role === "aluno" ? <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">{read ? <span className="text-xs font-bold text-emerald-700">Lido {read.confirmado_em ? "· ciência confirmada" : ""}</span> : <button className={secondary} onClick={() => void markNotice(n.id, false)} type="button"><UserCheck size={16} /> Marcar como lido</button>}{n.exige_confirmacao && !read?.confirmado_em ? <button className={primary} onClick={() => void markNotice(n.id, true)} type="button"><CheckCircle2 size={16} /> Li e estou ciente</button> : null}</div> : null}</article>; })}</ListEmpty></Card></div>;
}

function SelectClass({ classes, value, onChange }: { classes: ClassRow[]; value: string; onChange: (value: string) => void }) {
  return <select className={field} value={value} onChange={(e) => onChange(e.target.value)} required><option value="" disabled>Selecione a turma</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.ano_letivo}</option>)}</select>;
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof School; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-[#176b5b]"><Icon size={21} /></div><h2 className="text-xl font-black">{title}</h2></div>{children}</section>;
}

function ListEmpty({ empty, text, children }: { empty: boolean; text: string; children: React.ReactNode }) {
  return empty ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={25} /><p className="mt-2 font-bold text-slate-600">{text}</p></div> : <div className="grid gap-3">{children}</div>;
}

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  try { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`)); } catch { return "Sem data"; }
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem data";
  try { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); } catch { return "Sem data"; }
}
