"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, History, MapPin, Plus, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string } };
type Student = { id: string; nome: string; turma_id: string | null; turma?: { nome: string } | null };
type ClassRow = { id: string; nome: string };
type AgendaItem = { evento_id: string; fonte: string; titulo: string; descricao: string | null; inicio: string; fim: string | null; local: string | null; prioridade: string; aluno_id: string | null; turma_id: string | null; status: string };
type TimelineItem = { item_id: string; tipo: string; titulo: string; descricao: string | null; momento: string; status: string; prioridade: string };
type Tab = "agenda" | "timeline";

const TZ = "America/Araguaina";
const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50";

export default function AgendaTimeline({ supabase, profile }: Props) {
  const manager = ["admin_escola", "direcao", "coordenacao"].includes(profile.papel);
  const guardian = profile.papel === "responsavel";
  const [tab, setTab] = useState<Tab>("agenda");
  const [month, setMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [form, setForm] = useState({ scope: "escola", turma_id: "", aluno_id: "", tipo: "evento", titulo: "", descricao: "", inicio: "", fim: "", local: "", prioridade: "normal", visivel: true });

  const range = useMemo(() => monthRange(month), [month]);

  const loadBase = useCallback(async () => {
    const [{ data: studentData, error: studentError }, { data: classData, error: classError }] = await Promise.all([
      supabase.from("escola_alunos").select("id,nome,turma_id,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
      supabase.from("escola_turmas").select("id,nome").eq("ativa", true).order("nome")
    ]);
    if (studentError || classError) throw new Error(studentError?.message || classError?.message);
    const list = (studentData ?? []) as unknown as Student[];
    setStudents(list);
    setClasses((classData ?? []) as ClassRow[]);
    setSelectedStudent((current) => current || (guardian ? list[0]?.id || "" : ""));
  }, [guardian, supabase]);

  const loadAgenda = useCallback(async () => {
    if (guardian && !selectedStudent) { setAgenda([]); return; }
    const { data, error: agendaError } = await supabase.rpc("escola_agenda_feed", {
      p_inicio: range.start,
      p_fim: range.end,
      p_aluno_id: selectedStudent || null
    });
    if (agendaError) throw new Error(agendaError.message);
    setAgenda((data ?? []) as AgendaItem[]);
  }, [guardian, range.end, range.start, selectedStudent, supabase]);

  const loadTimeline = useCallback(async () => {
    if (!selectedStudent) { setTimeline([]); return; }
    const { data, error: timelineError } = await supabase.rpc("escola_student_timeline", { p_aluno_id: selectedStudent, p_limit: 150 });
    if (timelineError) throw new Error(timelineError.message);
    setTimeline((data ?? []) as TimelineItem[]);
  }, [selectedStudent, supabase]);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      await loadBase();
    } catch (err) { setError(errorMessage(err)); }
    setLoading(false);
  }, [loadBase]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (!loading) void loadAgenda().catch((err) => setError(errorMessage(err))); }, [loading, loadAgenda]);
  useEffect(() => { if (!loading && selectedStudent) void loadTimeline().catch((err) => setError(errorMessage(err))); }, [loading, loadTimeline, selectedStudent]);

  async function mutate(action: () => PromiseLike<{ error?: { message: string } | null }>, success: string) {
    setWorking(true); setError(""); setMessage("");
    const result = await action();
    if (result.error) setError(result.error.message);
    else { setMessage(success); await loadAgenda(); if (selectedStudent) await loadTimeline(); }
    setWorking(false);
  }

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    const turma = form.scope === "turma" ? form.turma_id : form.scope === "aluno" ? students.find((s) => s.id === form.aluno_id)?.turma_id || null : null;
    await mutate(() => supabase.rpc("escola_create_agenda_event", {
      p_tipo: form.tipo,
      p_titulo: form.titulo,
      p_descricao: form.descricao || null,
      p_inicio: new Date(form.inicio).toISOString(),
      p_fim: form.fim ? new Date(form.fim).toISOString() : null,
      p_local: form.local || null,
      p_prioridade: form.prioridade,
      p_turma_id: turma,
      p_aluno_id: form.scope === "aluno" ? form.aluno_id : null,
      p_visivel_responsavel: form.visivel
    }), "Evento incluído na agenda escolar.");
    setForm((v) => ({ ...v, titulo: "", descricao: "", inicio: "", fim: "", local: "" }));
  }

  async function setStatus(id: string, status: "cancelado" | "concluido") {
    await mutate(() => supabase.rpc("escola_set_agenda_event_status", { p_evento_id: id, p_status: status }), status === "cancelado" ? "Evento cancelado." : "Evento concluído.");
  }

  const days = useMemo(() => calendarDays(month), [month]);
  const byDay = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    agenda.forEach((item) => { const key = localKey(item.inicio); (map[key] ||= []).push(item); });
    return map;
  }, [agenda]);
  const selected = students.find((s) => s.id === selectedStudent);

  if (loading) return <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando agenda...</section>;

  return <section className="grid gap-5">
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Agenda e histórico</p><h2 className="mt-1 text-2xl font-black">Calendário escolar e linha do tempo do aluno</h2><p className="mt-1 text-sm leading-6 text-slate-500">Compromissos futuros ficam na agenda; registros já ocorridos ficam no histórico do aluno.</p></div>
        <button className={secondary} onClick={() => void refresh()} disabled={working} type="button"><RefreshCw size={16}/> Atualizar</button>
      </div>
    </div>

    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
      <button className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab === "agenda" ? "bg-[#176b5b] text-white" : "text-slate-600"}`} onClick={() => setTab("agenda")} type="button">Agenda</button>
      <button className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab === "timeline" ? "bg-[#176b5b] text-white" : "text-slate-600"}`} onClick={() => setTab("timeline")} type="button">Linha do tempo</button>
      <div className="ml-auto min-w-56">
        <select className={field} value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
          {!guardian ? <option value="">Todos / sem filtro de aluno</option> : null}
          {students.map((s) => <option value={s.id} key={s.id}>{s.nome}{s.turma?.nome ? ` · ${s.turma.nome}` : ""}</option>)}
        </select>
      </div>
    </nav>

    {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}

    {tab === "agenda" ? <>
      {manager ? <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card title="Novo compromisso" icon={<Plus size={20}/>}><form className="grid gap-3" onSubmit={createEvent}>
          <select className={field} value={form.scope} onChange={(e) => setForm((v) => ({ ...v, scope: e.target.value }))}><option value="escola">Toda a escola</option><option value="turma">Turma específica</option><option value="aluno">Aluno específico</option></select>
          {form.scope === "turma" ? <select className={field} required value={form.turma_id} onChange={(e) => setForm((v) => ({ ...v, turma_id: e.target.value }))}><option value="">Selecione a turma</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select> : null}
          {form.scope === "aluno" ? <select className={field} required value={form.aluno_id} onChange={(e) => setForm((v) => ({ ...v, aluno_id: e.target.value }))}><option value="">Selecione o aluno</option>{students.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select> : null}
          <div className="grid gap-3 sm:grid-cols-2"><select className={field} value={form.tipo} onChange={(e) => setForm((v) => ({ ...v, tipo: e.target.value }))}><option value="evento">Evento</option><option value="prova">Prova</option><option value="feriado">Feriado</option><option value="reuniao">Reunião</option><option value="lembrete">Lembrete</option><option value="atividade_especial">Atividade especial</option><option value="outro">Outro</option></select><select className={field} value={form.prioridade} onChange={(e) => setForm((v) => ({ ...v, prioridade: e.target.value }))}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select></div>
          <input className={field} placeholder="Título" required value={form.titulo} onChange={(e) => setForm((v) => ({ ...v, titulo: e.target.value }))}/><textarea className={area} placeholder="Descrição" value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))}/>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold text-slate-600">Início<input className={field} required type="datetime-local" value={form.inicio} onChange={(e) => setForm((v) => ({ ...v, inicio: e.target.value }))}/></label><label className="grid gap-1 text-sm font-bold text-slate-600">Término<input className={field} type="datetime-local" value={form.fim} onChange={(e) => setForm((v) => ({ ...v, fim: e.target.value }))}/></label></div>
          <input className={field} placeholder="Local (opcional)" value={form.local} onChange={(e) => setForm((v) => ({ ...v, local: e.target.value }))}/><label className="flex items-center gap-2 text-sm font-bold"><input checked={form.visivel} onChange={(e) => setForm((v) => ({ ...v, visivel: e.target.checked }))} type="checkbox"/> Visível aos responsáveis</label><button className={primary} disabled={working}><Save size={17}/> Salvar na agenda</button>
        </form></Card>
        <CalendarPanel month={month} setMonth={setMonth} days={days} byDay={byDay}/>
      </div> : <CalendarPanel month={month} setMonth={setMonth} days={days} byDay={byDay}/>} 
      <Card title="Próximos compromissos" icon={<CalendarDays size={20}/>}><div className="grid gap-3">{agenda.length ? [...agenda].sort((a,b) => +new Date(a.inicio)-+new Date(b.inicio)).map((item) => <AgendaCard key={`${item.fonte}-${item.evento_id}-${item.aluno_id || ""}`} item={item} manager={manager} setStatus={setStatus}/>) : <Empty text="Nenhum compromisso neste período."/>}</div></Card>
    </> : <Card title={selected ? `Linha do tempo · ${selected.nome}` : "Linha do tempo do aluno"} icon={<History size={20}/>}>
      {!selectedStudent ? <Empty text="Selecione um aluno para consultar o histórico."/> : timeline.length ? <div className="relative grid gap-0 pl-5">{timeline.map((item, i) => <div key={`${item.tipo}-${item.item_id}-${i}`} className="relative border-l border-slate-200 pb-5 pl-6 last:pb-0"><span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ${item.prioridade === "urgente" ? "bg-rose-500" : item.prioridade === "importante" ? "bg-amber-500" : "bg-[#176b5b]"}`}/><div className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-[#176b5b]">{typeLabel(item.tipo)}</p><p className="mt-1 font-black">{item.titulo}</p></div><span className="text-xs font-bold text-slate-500">{dateTime(item.momento)}</span></div>{item.descricao ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.descricao}</p> : null}<span className="mt-3 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{statusLabel(item.status)}</span></div></div>)}</div> : <Empty text="Ainda não há registros na linha do tempo deste aluno."/>}
    </Card>}
  </section>;
}

function CalendarPanel({ month, setMonth, days, byDay }: { month: Date; setMonth: (d: Date) => void; days: Date[]; byDay: Record<string, AgendaItem[]> }) {
  const label = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: TZ });
  return <Card title="Calendário" icon={<CalendarDays size={20}/>}><div className="flex items-center justify-between"><button className={secondary} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1,1))} type="button"><ChevronLeft size={17}/></button><p className="font-black capitalize">{label}</p><button className={secondary} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1,1))} type="button"><ChevronRight size={17}/></button></div><div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-slate-400">{["D","S","T","Q","Q","S","S"].map((d,i)=><span key={`${d}-${i}`}>{d}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-1">{days.map((day,i) => { const key = dateKey(day); const items = byDay[key] || []; const inside = day.getMonth() === month.getMonth(); return <div key={`${key}-${i}`} className={`min-h-20 rounded-xl border p-1.5 ${inside ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 text-slate-300"}`}><p className="text-xs font-black">{day.getDate()}</p><div className="mt-1 grid gap-1">{items.slice(0,3).map((x,j)=><span key={`${x.evento_id}-${j}`} title={x.titulo} className={`truncate rounded px-1 py-0.5 text-[9px] font-bold ${x.prioridade === "urgente" ? "bg-rose-100 text-rose-800" : x.prioridade === "importante" ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{x.titulo}</span>)}{items.length>3?<span className="text-[9px] font-bold text-slate-500">+{items.length-3}</span>:null}</div></div>; })}</div></Card>;
}

function AgendaCard({ item, manager, setStatus }: { item: AgendaItem; manager: boolean; setStatus: (id:string,status:"cancelado"|"concluido")=>void }) {
  return <article className={`rounded-2xl border p-4 ${item.prioridade === "urgente" ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#176b5b]">{typeLabel(item.fonte)}</p><p className="mt-1 font-black">{item.titulo}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{statusLabel(item.status)}</span></div><div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600"><span className="flex items-center gap-1"><Clock3 size={15}/>{dateTime(item.inicio)}</span>{item.local ? <span className="flex items-center gap-1"><MapPin size={15}/>{item.local}</span> : null}</div>{item.descricao ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.descricao}</p> : null}{manager && item.fonte === "evento" && item.status === "ativo" ? <div className="mt-3 flex gap-2"><button className={secondary} onClick={() => void setStatus(item.evento_id,"concluido")} type="button">Concluir</button><button className={secondary} onClick={() => void setStatus(item.evento_id,"cancelado")} type="button">Cancelar</button></div> : null}</article>;
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2 text-[#176b5b]">{icon}<h3 className="font-black text-slate-900">{title}</h3></div>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">{text}</p>; }
function monthRange(date: Date) { const start = new Date(date.getFullYear(),date.getMonth(),1); const end = new Date(date.getFullYear(),date.getMonth()+1,0); return { start: dateKey(start), end: dateKey(end) }; }
function calendarDays(date: Date) { const first = new Date(date.getFullYear(),date.getMonth(),1); const start = new Date(first); start.setDate(first.getDate()-first.getDay()); return Array.from({length:42},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; }); }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function localKey(value: string) { return new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value)); }
function dateTime(value: string) { return new Date(value).toLocaleString("pt-BR",{timeZone:TZ,dateStyle:"short",timeStyle:"short"}); }
function errorMessage(err: unknown) { return err instanceof Error ? err.message : "Não foi possível carregar as informações."; }
function statusLabel(value: string) { const map: Record<string,string> = { ativo:"Ativo",cancelado:"Cancelado",concluido:"Concluído",publicada:"Publicada",encerrada:"Encerrada",agendada:"Agendada",realizada:"Realizada",pendente:"Pendente",aprovada:"Aprovada",recusada:"Recusada",correcao_solicitada:"Correção solicitada",falta:"Falta",atrasado:"Atrasado",saida_antecipada:"Saída antecipada",presente:"Presente",autorizada:"Autorizada",nao_autorizada:"Não autorizada",publicado:"Publicado",aberto:"Aberto",em_acompanhamento:"Em acompanhamento",registrada:"Registrada" }; return map[value] || value.replaceAll("_"," "); }
function typeLabel(value: string) { const map: Record<string,string> = { evento:"Evento escolar",atividade:"Atividade",reuniao:"Reunião",autorizacao:"Autorização",resposta_autorizacao:"Resposta de autorização",aula:"Aula",frequencia:"Frequência",justificativa:"Justificativa",acompanhamento:"Acompanhamento",comunicado:"Comunicado",agenda:"Agenda" }; return map[value] || value.replaceAll("_"," "); }
