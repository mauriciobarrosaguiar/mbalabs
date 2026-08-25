"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Paperclip, Save, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "responsavel";
type Props = { supabase: SupabaseClient; profile: { papel: Role; escola_id: string } };
type Student = { id: string; nome: string; turma?: { nome: string } | null };
type Absence = { id: string; aluno_id: string; data_aula: string; observacao: string | null; aluno?: { nome: string } | null };
type Justification = { id: string; frequencia_id: string; aluno_id: string; responsavel_id: string; motivo: string; descricao: string | null; status: "pendente" | "aprovada" | "recusada" | "correcao_solicitada"; observacao_analise: string | null; criado_em: string; aluno?: { nome: string } | null };
type JustFile = { id: string; justificativa_id: string; aluno_id: string; storage_path: string; nome_arquivo: string; mime_type: string | null };

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50";

export default function AbsenceExceptionPanel({ supabase, profile }: Props) {
  const manager = profile.papel !== "responsavel";
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [files, setFiles] = useState<JustFile[]>([]);
  const [register, setRegister] = useState({ aluno_id: "", data: today(), observacao: "" });
  const [active, setActive] = useState("");
  const [reason, setReason] = useState("Doença");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const uid = auth.user?.id || "";
    setUserId(uid);
    if (authError || !uid) { setError("Não foi possível identificar o usuário."); setLoading(false); return; }
    const requests = await Promise.all([
      supabase.from("escola_alunos").select("id,nome,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
      supabase.from("escola_frequencias").select("id,aluno_id,data_aula,observacao,aluno:escola_alunos(nome)").eq("status", "falta").order("data_aula", { ascending: false }).limit(400),
      supabase.from("escola_justificativas_falta").select("id,frequencia_id,aluno_id,responsavel_id,motivo,descricao,status,observacao_analise,criado_em,aluno:escola_alunos(nome)").order("criado_em", { ascending: false }).limit(300),
      supabase.from("escola_justificativa_arquivos").select("id,justificativa_id,aluno_id,storage_path,nome_arquivo,mime_type").order("criado_em", { ascending: false }).limit(300)
    ]);
    const firstError = requests.find(item => item.error)?.error;
    if (firstError) setError(firstError.message);
    const studentData = (requests[0].data ?? []) as unknown as Student[];
    setStudents(studentData);
    setAbsences((requests[1].data ?? []) as unknown as Absence[]);
    setJustifications((requests[2].data ?? []) as unknown as Justification[]);
    setFiles((requests[3].data ?? []) as JustFile[]);
    setRegister(value => ({ ...value, aluno_id: value.aluno_id || studentData[0]?.id || "" }));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function registerAbsence(event: React.FormEvent) {
    event.preventDefault();
    if (!manager || !register.aluno_id) return;
    setWorking(true); setError(""); setMessage("");
    const { error: rpcError } = await supabase.rpc("escola_register_absence", { p_aluno_id: register.aluno_id, p_data_aula: register.data, p_observacao: register.observacao || null });
    if (rpcError) setError(rpcError.message);
    else { setMessage("Falta registrada. O responsável já poderá justificá-la."); setRegister(value => ({ ...value, data: today(), observacao: "" })); await load(); }
    setWorking(false);
  }

  async function review(id: string, status: "aprovada" | "recusada" | "correcao_solicitada") {
    setWorking(true); setError(""); setMessage("");
    const { error: rpcError } = await supabase.rpc("escola_review_absence_justification", { p_justificativa_id: id, p_status: status, p_observacao: notes[id] || null });
    if (rpcError) setError(rpcError.message); else { setMessage("Análise atualizada."); await load(); }
    setWorking(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const absence = absences.find(item => item.id === active);
    if (!absence) return;
    if (file && file.size > 10 * 1024 * 1024) { setError("O anexo deve ter no máximo 10 MB."); return; }
    setWorking(true); setError(""); setMessage("");
    const { data: justificationId, error: rpcError } = await supabase.rpc("escola_guardian_submit_absence_justification", { p_frequencia_id: absence.id, p_motivo: reason, p_descricao: description || null });
    if (rpcError || !justificationId) { setError(rpcError?.message || "Não foi possível enviar a justificativa."); setWorking(false); return; }

    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${profile.escola_id}/${absence.aluno_id}/${justificationId}/${Date.now()}-${safe}`;
      const upload = await supabase.storage.from("mba-escola-documentos").upload(path, file, { contentType: file.type || undefined });
      if (upload.error) { setError(`A justificativa foi criada, mas o anexo não foi enviado: ${upload.error.message}`); setWorking(false); await load(); return; }
      const metadata = await supabase.from("escola_justificativa_arquivos").insert({ justificativa_id: justificationId, escola_id: profile.escola_id, aluno_id: absence.aluno_id, responsavel_id: userId, storage_path: path, nome_arquivo: file.name, mime_type: file.type || null, tamanho: file.size });
      if (metadata.error) { await supabase.storage.from("mba-escola-documentos").remove([path]); setError(`A justificativa foi criada, mas o anexo não pôde ser registrado: ${metadata.error.message}`); setWorking(false); await load(); return; }
    }

    setMessage("Justificativa enviada para análise."); setActive(""); setDescription(""); setFile(null); await load(); setWorking(false);
  }

  async function open(fileItem: JustFile) {
    setError("");
    const { data, error: signedError } = await supabase.storage.from("mba-escola-documentos").createSignedUrl(fileItem.storage_path, 120);
    if (signedError || !data?.signedUrl) { setError(signedError?.message || "Não foi possível abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) return <Card title="Faltas e justificativas"><p className="text-sm text-slate-500">Carregando...</p></Card>;

  return <section className="grid gap-5">
    {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}
    {manager ? <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
      <Card title="Registrar falta"><p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Registre somente quem faltou. Não há chamada nem marcação de presença.</p><form className="grid gap-3" onSubmit={registerAbsence}><select className={field} required value={register.aluno_id} onChange={event => setRegister(value => ({ ...value, aluno_id: event.target.value }))}>{students.map(student => <option key={student.id} value={student.id}>{student.nome}{student.turma?.nome ? ` · ${student.turma.nome}` : ""}</option>)}</select><input className={field} type="date" required value={register.data} onChange={event => setRegister(value => ({ ...value, data: event.target.value }))}/><textarea className={area} placeholder="Observação opcional" value={register.observacao} onChange={event => setRegister(value => ({ ...value, observacao: event.target.value }))}/><button className={primary} disabled={working || !register.aluno_id}><Save size={17}/> Registrar falta</button></form></Card>
      <Card title="Justificativas para análise">{justifications.length ? justifications.map(item => { const absence = absences.find(value => value.id === item.frequencia_id); const docs = files.filter(value => value.justificativa_id === item.id); return <article className="mb-3 rounded-2xl border border-slate-200 p-4" key={item.id}><div className="flex justify-between gap-2"><div><p className="font-black">{item.aluno?.nome}</p><p className="text-sm text-slate-500">{formatDate(absence?.data_aula)} · {item.motivo}</p></div><Badge status={item.status}/></div>{item.descricao ? <p className="mt-2 text-sm">{item.descricao}</p> : null}{docs.length ? <div className="mt-3 flex flex-wrap gap-2">{docs.map(doc => <button className={secondary} key={doc.id} onClick={() => void open(doc)} type="button"><Paperclip size={15}/>{doc.nome_arquivo}</button>)}</div> : null}{["pendente", "correcao_solicitada"].includes(item.status) ? <div className="mt-3 grid gap-2"><input className={field} placeholder="Observação da escola" value={notes[item.id] || ""} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))}/><div className="flex flex-wrap gap-2"><button className={secondary} disabled={working} onClick={() => void review(item.id, "aprovada")} type="button"><CheckCircle2 size={15}/> Aprovar</button><button className={secondary} disabled={working} onClick={() => void review(item.id, "correcao_solicitada")} type="button"><AlertTriangle size={15}/> Pedir correção</button><button className={secondary} disabled={working} onClick={() => void review(item.id, "recusada")} type="button"><XCircle size={15}/> Recusar</button></div></div> : null}</article>; }) : <Empty text="Nenhuma justificativa aguardando análise."/>}</Card>
    </div> : <Card title="Faltas e justificativas">{absences.length ? absences.map(absence => { const justification = justifications.find(item => item.frequencia_id === absence.id); const canSubmit = !justification || ["recusada", "correcao_solicitada"].includes(justification.status); return <article className="mb-3 rounded-2xl border border-slate-200 p-4" key={absence.id}><div className="flex justify-between gap-2"><div><p className="font-black">{absence.aluno?.nome}</p><p className="text-sm text-slate-500">Falta em {formatDate(absence.data_aula)}</p></div>{justification ? <Badge status={justification.status}/> : <span className="text-xs font-bold text-amber-700">Pendente</span>}</div>{justification?.observacao_analise ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm">{justification.observacao_analise}</p> : null}{canSubmit ? active === absence.id ? <form className="mt-3 grid gap-3" onSubmit={submit}><select className={field} value={reason} onChange={event => setReason(event.target.value)}><option>Doença</option><option>Consulta médica</option><option>Problema familiar</option><option>Transporte</option><option>Viagem</option><option>Outro</option></select><textarea className={area} placeholder="Explique a ausência" value={description} onChange={event => setDescription(event.target.value)}/><label className="grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm font-bold">Atestado ou comprovante (PDF/JPG/PNG, até 10 MB)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] || null)}/></label><button className={primary} disabled={working}>Enviar justificativa</button></form> : <button className={`${primary} mt-3`} onClick={() => setActive(absence.id)} type="button">Justificar ausência</button> : null}</article>; }) : <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Nenhuma falta registrada.</p>}</Card>}
  </section>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-black">{title}</h3>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }
function Badge({ status }: { status: string }) { const text = status === "aprovada" ? "Aprovada" : status === "recusada" ? "Recusada" : status === "correcao_solicitada" ? "Corrigir" : "Pendente"; return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black">{text}</span>; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date()); }
function formatDate(value?: string | null) { if (!value) return "—"; const [year, month, day] = value.slice(0, 10).split("-"); return `${day}/${month}/${year}`; }
