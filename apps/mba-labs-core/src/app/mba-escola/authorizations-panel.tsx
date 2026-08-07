"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  UsersRound,
  XCircle
} from "lucide-react";
import { useCallback, useMemo, useState, useEffect } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "responsavel";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string } };
type ClassRow = { id: string; nome: string };
type Student = { id: string; nome: string; turma_id: string | null; turma?: { nome: string } | null };
type Authorization = {
  id: string;
  turma_id: string | null;
  destino_tipo: "escola" | "turma" | "alunos";
  tipo: string;
  titulo: string;
  descricao: string;
  local: string | null;
  data_evento: string | null;
  prazo_resposta: string | null;
  prioridade: "normal" | "importante" | "urgente";
  permite_observacao: boolean;
  status: "rascunho" | "publicada" | "encerrada" | "cancelada";
  criado_em: string;
  turma?: { nome: string } | null;
};
type Recipient = {
  id: string;
  autorizacao_id: string;
  aluno_id: string;
  aluno?: { nome: string; turma_id: string | null; turma?: { nome: string } | null } | null;
};
type ResponseRow = {
  id: string;
  autorizacao_id: string;
  aluno_id: string;
  responsavel_id: string;
  decisao: "autorizada" | "recusada";
  observacao: string | null;
  respondido_em: string;
  atualizado_em: string;
};
type HistoryRow = {
  id: string;
  autorizacao_id: string;
  aluno_id: string;
  responsavel_id: string;
  decisao: "autorizada" | "recusada";
  observacao: string | null;
  registrado_em: string;
};

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50";

const types = [
  ["evento", "Evento escolar"],
  ["passeio", "Passeio"],
  ["viagem", "Viagem"],
  ["uso_imagem", "Uso de imagem"],
  ["saida_especial", "Saída especial"],
  ["medicamento", "Medicamento"],
  ["atividade_externa", "Atividade externa"],
  ["outro", "Outro"]
] as const;

export default function AuthorizationsPanel({ supabase, profile }: Props) {
  const manager = profile.papel !== "responsavel";
  const guardian = profile.papel === "responsavel";
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingResponse, setEditingResponse] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [form, setForm] = useState({
    destino: "escola" as "escola" | "turma" | "alunos",
    turma_id: "",
    tipo: "evento",
    titulo: "",
    descricao: "",
    local: "",
    data_evento: "",
    prazo: "",
    prioridade: "importante",
    permite_observacao: true
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const reqs = await Promise.all([
      supabase.from("escola_turmas").select("id,nome").eq("ativa", true).order("nome"),
      supabase.from("escola_alunos").select("id,nome,turma_id,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
      supabase.from("escola_autorizacoes").select("id,turma_id,destino_tipo,tipo,titulo,descricao,local,data_evento,prazo_resposta,prioridade,permite_observacao,status,criado_em,turma:escola_turmas(nome)").order("criado_em", { ascending: false }).limit(100),
      supabase.from("escola_autorizacao_destinatarios").select("id,autorizacao_id,aluno_id,aluno:escola_alunos(nome,turma_id,turma:escola_turmas(nome))"),
      supabase.from("escola_autorizacao_respostas").select("id,autorizacao_id,aluno_id,responsavel_id,decisao,observacao,respondido_em,atualizado_em"),
      manager ? supabase.from("escola_autorizacao_resposta_historico").select("id,autorizacao_id,aluno_id,responsavel_id,decisao,observacao,registrado_em").order("registrado_em", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null })
    ]);
    const firstError = reqs.find((item) => item.error)?.error;
    if (firstError) setError(firstError.message);
    setClasses((reqs[0].data ?? []) as ClassRow[]);
    setStudents((reqs[1].data ?? []) as unknown as Student[]);
    setAuthorizations((reqs[2].data ?? []) as unknown as Authorization[]);
    setRecipients((reqs[3].data ?? []) as unknown as Recipient[]);
    setResponses((reqs[4].data ?? []) as ResponseRow[]);
    setHistory((reqs[5].data ?? []) as HistoryRow[]);
    setLoading(false);
  }, [manager, supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!form.turma_id && classes[0]) setForm((v) => ({ ...v, turma_id: classes[0].id }));
  }, [classes, form.turma_id]);

  async function mutate(action: () => PromiseLike<{ error?: { message: string } | null }>, success: string) {
    setWorking(true);
    setError("");
    setMessage("");
    const result = await action();
    if (result.error) setError(result.error.message);
    else {
      setMessage(success);
      await load();
    }
    setWorking(false);
  }

  async function createAuthorization(event: React.FormEvent) {
    event.preventDefault();
    await mutate(() => supabase.rpc("escola_create_authorization", {
      p_destino_tipo: form.destino,
      p_turma_id: form.destino === "turma" ? form.turma_id : null,
      p_aluno_ids: form.destino === "alunos" ? selectedStudents : null,
      p_tipo: form.tipo,
      p_titulo: form.titulo,
      p_descricao: form.descricao,
      p_local: form.local || null,
      p_data_evento: form.data_evento ? new Date(form.data_evento).toISOString() : null,
      p_prazo_resposta: form.prazo ? new Date(form.prazo).toISOString() : null,
      p_prioridade: form.prioridade,
      p_permite_observacao: form.permite_observacao
    }), "Autorização publicada para os responsáveis.");
    setForm((v) => ({ ...v, titulo: "", descricao: "", local: "", data_evento: "", prazo: "" }));
    setSelectedStudents([]);
  }

  async function respond(authorizationId: string, studentId: string, decision: "autorizada" | "recusada") {
    const key = `${authorizationId}:${studentId}`;
    await mutate(() => supabase.rpc("escola_respond_authorization", {
      p_autorizacao_id: authorizationId,
      p_aluno_id: studentId,
      p_decisao: decision,
      p_observacao: notes[key] || null
    }), decision === "autorizada" ? "Participação autorizada." : "Participação não autorizada.");
    setEditingResponse("");
  }

  async function closeAuthorization(id: string) {
    await mutate(() => supabase.rpc("escola_close_authorization", { p_autorizacao_id: id }), "Autorização encerrada.");
  }

  const pendingTotal = useMemo(() => {
    if (!guardian) return 0;
    return recipients.filter((recipient) => {
      const auth = authorizations.find((item) => item.id === recipient.autorizacao_id);
      const response = responses.find((item) => item.autorizacao_id === recipient.autorizacao_id && item.aluno_id === recipient.aluno_id);
      return auth?.status === "publicada" && !isExpired(auth) && !response;
    }).length;
  }, [guardian, recipients, authorizations, responses]);

  if (loading) return <section className="grid min-h-52 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={32} /></section>;

  return (
    <section className="grid gap-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Avisos e autorizações</p>
            <h2 className="mt-1 text-2xl font-black">{manager ? "Autorizações da escola" : "Autorizações dos meus filhos"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{manager ? "Publique pedidos de autorização e acompanhe quem autorizou, recusou ou ainda não respondeu." : `${pendingTotal} autorização(ões) aguardando sua resposta.`}</p>
          </div>
          <button className={secondary} disabled={working} onClick={() => void load()} type="button"><RefreshCw size={16} /> Atualizar</button>
        </div>
      </header>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}

      {manager ? (
        <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
          <Card title="Nova autorização" icon={ClipboardCheck}>
            <form className="grid gap-3" onSubmit={createAuthorization}>
              <label className="grid gap-1 text-sm font-bold text-slate-600">Destinatários
                <select className={field} value={form.destino} onChange={(e) => setForm((v) => ({ ...v, destino: e.target.value as typeof form.destino }))}>
                  <option value="escola">Todos os alunos da escola</option>
                  <option value="turma">Uma turma</option>
                  <option value="alunos">Alunos selecionados</option>
                </select>
              </label>
              {form.destino === "turma" ? <label className="grid gap-1 text-sm font-bold text-slate-600">Turma<select className={field} value={form.turma_id} onChange={(e) => setForm((v) => ({ ...v, turma_id: e.target.value }))}>{classes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label> : null}
              {form.destino === "alunos" ? <div className="max-h-56 overflow-auto rounded-2xl border border-slate-200 p-3"><p className="mb-2 text-sm font-black">Selecione os alunos</p><div className="grid gap-2">{students.map((student) => <label key={student.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={(e) => setSelectedStudents((current) => e.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} /> <span><b>{student.nome}</b>{student.turma?.nome ? ` · ${student.turma.nome}` : ""}</span></label>)}</div></div> : null}
              <label className="grid gap-1 text-sm font-bold text-slate-600">Tipo<select className={field} value={form.tipo} onChange={(e) => setForm((v) => ({ ...v, tipo: e.target.value }))}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <input className={field} required placeholder="Título — ex.: Festa Junina 2026" value={form.titulo} onChange={(e) => setForm((v) => ({ ...v, titulo: e.target.value }))} />
              <textarea className={area} required placeholder="Explique o evento, passeio ou motivo da autorização" value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} />
              <input className={field} placeholder="Local (opcional)" value={form.local} onChange={(e) => setForm((v) => ({ ...v, local: e.target.value }))} />
              <label className="grid gap-1 text-sm font-bold text-slate-600">Data/hora do evento<input className={field} type="datetime-local" value={form.data_evento} onChange={(e) => setForm((v) => ({ ...v, data_evento: e.target.value }))} /></label>
              <label className="grid gap-1 text-sm font-bold text-slate-600">Prazo para responder<input className={field} type="datetime-local" value={form.prazo} onChange={(e) => setForm((v) => ({ ...v, prazo: e.target.value }))} /></label>
              <label className="grid gap-1 text-sm font-bold text-slate-600">Prioridade<select className={field} value={form.prioridade} onChange={(e) => setForm((v) => ({ ...v, prioridade: e.target.value }))}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select></label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.permite_observacao} onChange={(e) => setForm((v) => ({ ...v, permite_observacao: e.target.checked }))} /> Permitir observação do responsável</label>
              <button className={primary} disabled={working || (form.destino === "alunos" && !selectedStudents.length)}><Save size={17} /> Publicar autorização</button>
            </form>
          </Card>
          <ManagerList authorizations={authorizations} recipients={recipients} responses={responses} history={history} closeAuthorization={closeAuthorization} working={working} />
        </div>
      ) : (
        <GuardianList authorizations={authorizations} recipients={recipients} responses={responses} students={students} notes={notes} setNotes={setNotes} editingResponse={editingResponse} setEditingResponse={setEditingResponse} respond={respond} working={working} />
      )}
    </section>
  );
}

function ManagerList({ authorizations, recipients, responses, history, closeAuthorization, working }: any) {
  return <Card title="Acompanhamento das respostas" icon={ShieldCheck}>
    {!authorizations.length ? <Empty text="Nenhuma autorização publicada." /> : <div className="grid gap-4">{authorizations.map((auth: Authorization) => {
      const dest = recipients.filter((item: Recipient) => item.autorizacao_id === auth.id);
      const resps = responses.filter((item: ResponseRow) => item.autorizacao_id === auth.id);
      const authorized = resps.filter((item: ResponseRow) => item.decisao === "autorizada").length;
      const refused = resps.filter((item: ResponseRow) => item.decisao === "recusada").length;
      const pending = Math.max(dest.length - resps.length, 0);
      const expired = isExpired(auth);
      return <article key={auth.id} className={`rounded-2xl border p-4 ${auth.prioridade === "urgente" ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{auth.titulo}</p><p className="mt-1 text-xs font-bold text-[#176b5b]">{typeLabel(auth.tipo)} · {destinationLabel(auth)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${auth.status === "publicada" && !expired ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{expired && auth.status === "publicada" ? "prazo encerrado" : auth.status}</span></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{auth.descricao}</p>
        <EventMeta auth={auth} />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><MetricMini label="Autorizados" value={authorized} tone="emerald" /><MetricMini label="Recusados" value={refused} tone="rose" /><MetricMini label="Pendentes" value={pending} tone="amber" /></div>
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3">{dest.map((recipient: Recipient) => { const response = resps.find((item: ResponseRow) => item.aluno_id === recipient.aluno_id); return <div key={recipient.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-2.5"><div><p className="text-sm font-black">{recipient.aluno?.nome || "Aluno"}</p><p className="text-xs text-slate-500">{recipient.aluno?.turma?.nome || "Sem turma"}</p></div><span className={`rounded-full px-2 py-1 text-xs font-black ${response?.decisao === "autorizada" ? "bg-emerald-50 text-emerald-700" : response?.decisao === "recusada" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{response ? response.decisao === "autorizada" ? "Autorizado" : "Não autorizado" : "Pendente"}</span>{response?.observacao ? <p className="w-full text-xs text-slate-500"><b>Observação:</b> {response.observacao}</p> : null}</div>; })}</div>
        {history.some((item: HistoryRow) => item.autorizacao_id === auth.id) ? <details className="mt-3 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-black text-slate-600">Histórico de respostas e alterações</summary><div className="mt-2 grid gap-2">{history.filter((item: HistoryRow) => item.autorizacao_id === auth.id).map((item: HistoryRow) => { const recipient = dest.find((x: Recipient) => x.aluno_id === item.aluno_id); return <p key={item.id} className="text-xs leading-5 text-slate-600">{formatDateTime(item.registrado_em)} · <b>{recipient?.aluno?.nome || "Aluno"}</b> · {item.decisao === "autorizada" ? "autorizado" : "não autorizado"}{item.observacao ? ` · ${item.observacao}` : ""}</p>; })}</div></details> : null}
        {auth.status === "publicada" ? <button className={`${secondary} mt-3`} disabled={working} onClick={() => void closeAuthorization(auth.id)} type="button">Encerrar autorização</button> : null}
      </article>;
    })}</div>}
  </Card>;
}

function GuardianList({ authorizations, recipients, responses, students, notes, setNotes, editingResponse, setEditingResponse, respond, working }: any) {
  const cards = recipients.map((recipient: Recipient) => ({ recipient, auth: authorizations.find((item: Authorization) => item.id === recipient.autorizacao_id), student: students.find((item: Student) => item.id === recipient.aluno_id), response: responses.find((item: ResponseRow) => item.autorizacao_id === recipient.autorizacao_id && item.aluno_id === recipient.aluno_id) })).filter((item: any) => item.auth);
  cards.sort((a: any, b: any) => Number(!a.response && !isExpired(a.auth)) - Number(!b.response && !isExpired(b.auth)) || new Date(b.auth.criado_em).getTime() - new Date(a.auth.criado_em).getTime());
  return <Card title="Autorizações" icon={ClipboardCheck}>{!cards.length ? <Empty text="Nenhuma autorização disponível para seus filhos." /> : <div className="grid gap-4">{cards.map(({ recipient, auth, student, response }: any) => {
    const key = `${auth.id}:${recipient.aluno_id}`;
    const expired = isExpired(auth);
    const editing = editingResponse === key || !response;
    return <article key={key} className={`rounded-2xl border p-4 ${auth.prioridade === "urgente" ? "border-rose-200 bg-rose-50/50" : !response && !expired ? "border-amber-200 bg-amber-50/40" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#176b5b]">{student?.nome || recipient.aluno?.nome || "Aluno"}{recipient.aluno?.turma?.nome ? ` · ${recipient.aluno.turma.nome}` : ""}</p><h3 className="mt-1 text-lg font-black">{auth.titulo}</h3></div>{auth.prioridade === "urgente" ? <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700"><AlertTriangle size={13} /> Urgente</span> : null}</div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{auth.descricao}</p>
      <EventMeta auth={auth} />
      {response ? <div className={`mt-4 rounded-2xl p-3 ${response.decisao === "autorizada" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}><p className="flex items-center gap-2 font-black">{response.decisao === "autorizada" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{response.decisao === "autorizada" ? "Você autorizou" : "Você não autorizou"}</p><p className="mt-1 text-xs">Resposta atualizada em {formatDateTime(response.atualizado_em)}</p>{response.observacao ? <p className="mt-2 text-sm">Observação: {response.observacao}</p> : null}</div> : null}
      {expired || auth.status !== "publicada" ? <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-600">{response ? "Esta autorização está encerrada; a resposta permanece no histórico." : "O prazo de resposta desta autorização foi encerrado."}</p> : editing ? <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">{auth.permite_observacao ? <textarea className={area} placeholder="Observação opcional — ex.: pode participar, mas sairá às 20h" value={notes[key] ?? response?.observacao ?? ""} onChange={(e) => setNotes((current: Record<string,string>) => ({ ...current, [key]: e.target.value }))} /> : null}<div className="grid gap-2 sm:grid-cols-2"><button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white disabled:opacity-50" disabled={working} onClick={() => void respond(auth.id, recipient.aluno_id, "autorizada")} type="button"><CheckCircle2 size={18} /> AUTORIZAR</button><button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 font-black text-white disabled:opacity-50" disabled={working} onClick={() => void respond(auth.id, recipient.aluno_id, "recusada")} type="button"><XCircle size={18} /> NÃO AUTORIZAR</button></div>{response ? <button className={secondary} onClick={() => setEditingResponse("")} type="button">Cancelar alteração</button> : null}</div> : <button className={`${secondary} mt-4`} onClick={() => { setNotes((current: Record<string,string>) => ({ ...current, [key]: response?.observacao || "" })); setEditingResponse(key); }} type="button">Alterar resposta</button>}
    </article>;
  })}</div>}</Card>;
}

function EventMeta({ auth }: { auth: Authorization }) {
  return <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-slate-500">{auth.data_evento ? <span className="flex items-center gap-1"><CalendarDays size={14} /> {formatDateTime(auth.data_evento)}</span> : null}{auth.local ? <span className="flex items-center gap-1"><MapPin size={14} /> {auth.local}</span> : null}{auth.prazo_resposta ? <span className="flex items-center gap-1"><Clock3 size={14} /> Responder até {formatDateTime(auth.prazo_resposta)}</span> : null}</div>;
}

function MetricMini({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" | "amber" }) {
  const styles = tone === "emerald" ? "bg-emerald-50 text-emerald-800" : tone === "rose" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800";
  return <div className={`rounded-xl p-2 ${styles}`}><p className="text-xl font-black">{value}</p><p className="text-[11px] font-bold">{label}</p></div>;
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof ClipboardCheck; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Icon className="text-[#176b5b]" size={21} /><h3 className="font-black">{title}</h3></div>{children}</section>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">{text}</p>; }
function typeLabel(value: string) { return types.find(([key]) => key === value)?.[1] || "Autorização"; }
function destinationLabel(auth: Authorization) { if (auth.destino_tipo === "escola") return "Toda a escola"; if (auth.destino_tipo === "turma") return auth.turma?.nome || "Turma"; return "Alunos selecionados"; }
function isExpired(auth: Authorization) { return Boolean(auth.prazo_resposta && new Date(auth.prazo_resposta).getTime() < Date.now()); }
function formatDateTime(value: string | null) { if (!value) return "—"; return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
