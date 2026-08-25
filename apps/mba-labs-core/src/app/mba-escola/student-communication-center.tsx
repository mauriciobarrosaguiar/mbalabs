"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, BellRing, CheckCircle2, Paperclip, ShieldAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import StudentSafetyPanel from "./student-safety-panel";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type Section = "students" | "communication";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string }; section: Section };
type Schedule = { id: string; turma_id: string; professor_id: string; disciplina_id: string; dia_semana: number; hora_inicio: string; hora_fim: string; sala: string | null; ano_letivo: number; turma?: { nome: string } | null; professor?: { nome: string } | null; disciplina?: { nome: string } | null };
type Attendance = { id: string; grade_id: string; turma_id: string; aluno_id: string; data_aula: string; status: "presente" | "falta" | "atrasado" | "saida_antecipada"; observacao: string | null; aluno?: { nome: string } | null };
type Justification = { id: string; frequencia_id: string; aluno_id: string; responsavel_id: string; motivo: string; descricao: string | null; status: "pendente" | "aprovada" | "recusada" | "correcao_solicitada"; observacao_analise: string | null; criado_em: string; aluno?: { nome: string } | null };
type JustFile = { id: string; justificativa_id: string; aluno_id: string; storage_path: string; nome_arquivo: string; mime_type: string | null };
type Incident = { id: string; grade_id: string | null; turma_id: string; tipo: string; data_evento: string; novo_horario_saida: string | null; motivo: string | null; criado_em: string };

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50";
const days = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function StudentCommunicationCenter({ supabase, profile, section }: Props) {
  const manager = ["admin_escola", "direcao", "coordenacao"].includes(profile.papel);
  const teacher = profile.papel === "professor";

  if (section === "students") return <section className="grid gap-5"><AbsencePanel supabase={supabase} profile={profile}/><StudentSafetyPanel supabase={supabase} profile={profile}/></section>;
  if (section === "communication" && manager) return <PriorityPanel supabase={supabase} profile={profile}/>;
  if (section === "communication" && teacher) return null;
  return null;
}

function AbsencePanel({ supabase, profile }: { supabase: SupabaseClient; profile: Props["profile"] }) {
  const manager = ["admin_escola", "direcao", "coordenacao"].includes(profile.papel);
  const guardian = profile.papel === "responsavel";
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [files, setFiles] = useState<JustFile[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [active, setActive] = useState("");
  const [reason, setReason] = useState("Doença");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id || "");
    const results = await Promise.all([
      supabase.from("escola_frequencias").select("id,grade_id,turma_id,aluno_id,data_aula,status,observacao,aluno:escola_alunos(nome)").order("data_aula", { ascending: false }).limit(500),
      supabase.from("escola_justificativas_falta").select("id,frequencia_id,aluno_id,responsavel_id,motivo,descricao,status,observacao_analise,criado_em,aluno:escola_alunos(nome)").order("criado_em", { ascending: false }).limit(200),
      supabase.from("escola_justificativa_arquivos").select("id,justificativa_id,aluno_id,storage_path,nome_arquivo,mime_type").order("criado_em", { ascending: false }).limit(200)
    ]);
    const firstError = results.find(item => item.error)?.error;
    if (firstError) setError(firstError.message);
    setAttendance((results[0].data ?? []) as unknown as Attendance[]);
    setJustifications((results[1].data ?? []) as unknown as Justification[]);
    setFiles((results[2].data ?? []) as JustFile[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function open(fileItem: JustFile) {
    setError("");
    const { data, error: signedError } = await supabase.storage.from("mba-escola-documentos").createSignedUrl(fileItem.storage_path, 120);
    if (signedError || !data?.signedUrl) { setError(signedError?.message || "Não foi possível abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function review(id: string, status: "aprovada" | "recusada" | "correcao_solicitada") {
    setWorking(true); setError(""); setMessage("");
    const { error: reviewError } = await supabase.rpc("escola_review_absence_justification", { p_justificativa_id: id, p_status: status, p_observacao: notes[id] || null });
    if (reviewError) setError(reviewError.message);
    else { setMessage("Análise atualizada."); await load(); }
    setWorking(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const absence = attendance.find(item => item.id === active);
    if (!absence) return;
    if (file && file.size > 10 * 1024 * 1024) { setError("O anexo deve ter no máximo 10 MB."); return; }
    setWorking(true); setError(""); setMessage("");
    const { data: justificationId, error: submitError } = await supabase.rpc("escola_guardian_submit_absence_justification", { p_frequencia_id: absence.id, p_motivo: reason, p_descricao: description || null });
    if (submitError || !justificationId) { setError(submitError?.message || "Não foi possível enviar."); setWorking(false); return; }

    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${profile.escola_id}/${absence.aluno_id}/${justificationId}/${Date.now()}-${safe}`;
      const upload = await supabase.storage.from("mba-escola-documentos").upload(path, file, { contentType: file.type || undefined });
      if (upload.error) { setError(`A justificativa foi criada, mas o anexo não foi enviado: ${upload.error.message}`); setWorking(false); await load(); return; }
      const metadata = await supabase.from("escola_justificativa_arquivos").insert({ justificativa_id: justificationId, escola_id: profile.escola_id, aluno_id: absence.aluno_id, responsavel_id: userId, storage_path: path, nome_arquivo: file.name, mime_type: file.type || null, tamanho: file.size });
      if (metadata.error) {
        await supabase.storage.from("mba-escola-documentos").remove([path]);
        setError(`A justificativa foi criada, mas o anexo não pôde ser registrado: ${metadata.error.message}`);
        setWorking(false); await load(); return;
      }
    }

    setMessage("Justificativa enviada para análise.");
    setActive(""); setDescription(""); setFile(null);
    await load();
    setWorking(false);
  }

  if (loading) return <Card title="Faltas e justificativas"><p className="text-sm text-slate-500">Carregando...</p></Card>;
  if (!manager && !guardian) return null;

  if (manager) return <Card title="Justificativas de ausência">
    <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">O MBA Escola não exige chamada diária. Esta área mantém apenas faltas já registradas e as justificativas enviadas pelas famílias.</p>
    {message ? <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
    {justifications.length ? justifications.map(item => {
      const absence = attendance.find(attendanceItem => attendanceItem.id === item.frequencia_id);
      const docs = files.filter(fileItem => fileItem.justificativa_id === item.id);
      return <article className="mb-3 rounded-2xl border border-slate-200 p-4" key={item.id}>
        <div className="flex justify-between gap-2"><div><p className="font-black">{item.aluno?.nome}</p><p className="text-sm text-slate-500">{formatDate(absence?.data_aula)} · {item.motivo}</p></div><Badge status={item.status}/></div>
        {item.descricao ? <p className="mt-2 text-sm">{item.descricao}</p> : null}
        {docs.length ? <div className="mt-3 flex flex-wrap gap-2">{docs.map(fileItem => <button className={secondary} key={fileItem.id} onClick={() => void open(fileItem)} type="button"><Paperclip size={15}/>{fileItem.nome_arquivo}</button>)}</div> : null}
        {["pendente", "correcao_solicitada"].includes(item.status) ? <div className="mt-3 grid gap-2"><input className={field} placeholder="Observação da escola" value={notes[item.id] || ""} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))}/><div className="flex flex-wrap gap-2"><button className={secondary} disabled={working} onClick={() => void review(item.id, "aprovada")} type="button"><CheckCircle2 size={15}/> Aprovar</button><button className={secondary} disabled={working} onClick={() => void review(item.id, "correcao_solicitada")} type="button"><AlertTriangle size={15}/> Pedir correção</button><button className={secondary} disabled={working} onClick={() => void review(item.id, "recusada")} type="button"><XCircle size={15}/> Recusar</button></div></div> : null}
      </article>;
    }) : <p className="text-sm text-slate-500">Nenhuma justificativa enviada.</p>}
  </Card>;

  const absences = attendance.filter(item => item.status === "falta");
  return <Card title="Faltas e justificativas">
    {message ? <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
    {absences.length ? absences.map(absence => {
      const justification = justifications.find(item => item.frequencia_id === absence.id);
      const canSubmit = !justification || ["recusada", "correcao_solicitada"].includes(justification.status);
      return <article className="mb-3 rounded-2xl border border-slate-200 p-4" key={absence.id}>
        <div className="flex justify-between"><div><p className="font-black">{absence.aluno?.nome}</p><p className="text-sm text-slate-500">Falta em {formatDate(absence.data_aula)}</p></div>{justification ? <Badge status={justification.status}/> : <span className="text-xs font-bold text-amber-700">Pendente</span>}</div>
        {justification?.observacao_analise ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm">{justification.observacao_analise}</p> : null}
        {canSubmit ? active === absence.id ? <form className="mt-3 grid gap-3" onSubmit={submit}><select className={field} value={reason} onChange={event => setReason(event.target.value)}><option>Doença</option><option>Consulta médica</option><option>Problema familiar</option><option>Transporte</option><option>Viagem</option><option>Outro</option></select><textarea className={area} placeholder="Explique a ausência" value={description} onChange={event => setDescription(event.target.value)}/><label className="grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm font-bold">Atestado ou comprovante (PDF/JPG/PNG, até 10 MB)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] || null)}/></label><button className={primary} disabled={working}>Enviar justificativa</button></form> : <button className={`${primary} mt-3`} onClick={() => setActive(absence.id)} type="button">Justificar ausência</button> : null}
      </article>;
    }) : <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Nenhuma falta registrada.</p>}
  </Card>;
}

function PriorityPanel({ supabase, profile }: { supabase: SupabaseClient; profile: Props["profile"] }) {
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ grade_id: "", data: today(), tipo: "saida_antecipada", horario: "", motivo: "" });

  const load = useCallback(async () => {
    const [gradeResult, incidentResult] = await Promise.all([
      supabase.from("escola_grade_horarios").select("id,turma_id,professor_id,disciplina_id,dia_semana,hora_inicio,hora_fim,sala,ano_letivo,turma:escola_turmas(nome),professor:escola_perfis!escola_grade_horarios_professor_id_fkey(nome),disciplina:escola_disciplinas(nome)").eq("ativo", true).order("dia_semana").order("hora_inicio"),
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
    if (!form.grade_id) return;
    setWorking(true); setError(""); setMessage("");
    const { error: publishError } = await supabase.rpc("escola_create_priority_schedule_notice", { p_grade_id: form.grade_id, p_data: form.data, p_tipo: form.tipo, p_motivo: form.motivo || null, p_novo_horario_saida: form.horario || null, p_substituto_id: null });
    if (publishError) setError(publishError.message);
    else { setMessage("Aviso urgente publicado e enviado para ciência dos responsáveis."); setForm(current => ({ ...current, horario: "", motivo: "" })); await load(); }
    setWorking(false);
  }

  return <div className="grid gap-5 lg:grid-cols-2">
    {message ? <p className="lg:col-span-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="lg:col-span-2 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
    <Card title="Aviso prioritário">
      {!schedule.length ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Cadastre a grade antes de vincular um aviso de alteração de aula.</p> : <form className="grid gap-3" onSubmit={submit}>
        <select className={field} value={form.grade_id} onChange={event => setForm(current => ({ ...current, grade_id: event.target.value }))}>{schedule.map(item => <option key={item.id} value={item.id}>{item.turma?.nome} · {item.disciplina?.nome} · {days[item.dia_semana]} {short(item.hora_inicio)}</option>)}</select>
        <select className={field} value={form.tipo} onChange={event => setForm(current => ({ ...current, tipo: event.target.value }))}><option value="saida_antecipada">Saída antecipada</option><option value="professor_ausente">Professor ausente</option><option value="aula_cancelada">Aula cancelada</option><option value="substituicao">Professor substituto</option></select>
        <input className={field} type="date" value={form.data} onChange={event => setForm(current => ({ ...current, data: event.target.value }))}/>
        <input className={field} type="time" value={form.horario} onChange={event => setForm(current => ({ ...current, horario: event.target.value }))}/>
        <textarea className={area} placeholder="Motivo / orientação" value={form.motivo} onChange={event => setForm(current => ({ ...current, motivo: event.target.value }))}/>
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800"><BellRing className="mr-2 inline" size={16}/>Será publicado como URGENTE e exigirá ciência.</p>
        <button className={primary} disabled={working}><ShieldAlert size={17}/> Publicar aviso</button>
      </form>}
    </Card>
    <Card title="Avisos recentes">{incidents.length ? incidents.map(item => <article className="mb-3 rounded-2xl border border-slate-200 p-4" key={item.id}><p className="font-black">{incidentLabel(item.tipo)}</p><p className="text-sm text-slate-500">{formatDate(item.data_evento)}{item.novo_horario_saida ? ` · saída ${short(item.novo_horario_saida)}` : ""}</p>{item.motivo ? <p className="mt-2 text-sm">{item.motivo}</p> : null}</article>) : <p className="text-sm text-slate-500">Nenhum aviso prioritário registrado.</p>}</Card>
  </div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-black">{title}</h3>{children}</section>; }
function Badge({ status }: { status: Justification["status"] }) { const labels = { pendente: "Em análise", aprovada: "Justificada", recusada: "Recusada", correcao_solicitada: "Correção solicitada" }; return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{labels[status]}</span>; }
function short(value?: string | null) { return value ? value.slice(0, 5) : "--:--"; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date()); }
function formatDate(value?: string | null) { if (!value) return "—"; const parts = value.slice(0, 10).split("-"); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value; }
function incidentLabel(type: string) { return ({ professor_ausente: "Professor ausente", saida_antecipada: "Saída antecipada", aula_cancelada: "Aula cancelada", substituicao: "Professor substituto" } as Record<string, string>)[type] || type; }
