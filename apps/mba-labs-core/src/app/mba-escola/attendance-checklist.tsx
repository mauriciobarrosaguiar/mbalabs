"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Check, CheckCircle2, Clock3, LoaderCircle, Save, UserCheck, UserX, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string } };
type Status = "presente" | "falta" | "atrasado" | "saida_antecipada";
type Schedule = {
  id: string;
  turma_id: string;
  professor_id: string;
  disciplina_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  sala: string | null;
  turma?: { nome: string } | null;
  professor?: { nome: string } | null;
  disciplina?: { nome: string } | null;
};
type Student = { id: string; nome: string; turma_id: string | null };
type Attendance = { grade_id: string; aluno_id: string; data_aula: string; status: Status; observacao: string | null };
type Call = {
  id: string;
  grade_id: string;
  data_aula: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_alunos: number;
  presentes: number;
  faltas: number;
  atrasados: number;
  saidas_antecipadas: number;
  salvo_em: string;
};
type Mark = { status: Status | ""; observacao: string };

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-40";

export default function AttendanceChecklist({ supabase, profile }: Props) {
  const today = useMemo(() => todayInAraguaina(), []);
  const todayWeekday = useMemo(() => isoWeekday(today), [today]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [gradeId, setGradeId] = useState("");
  const [marks, setMarks] = useState<Record<string, Mark>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [gradeRes, studentRes, callsRes, attendanceRes] = await Promise.all([
      supabase.from("escola_grade_horarios").select("id,turma_id,professor_id,disciplina_id,dia_semana,hora_inicio,hora_fim,sala,turma:escola_turmas(nome),professor:escola_perfis!escola_grade_horarios_professor_id_fkey(nome),disciplina:escola_disciplinas(nome)").eq("ativo", true).eq("dia_semana", todayWeekday).order("hora_inicio"),
      supabase.from("escola_alunos").select("id,nome,turma_id").eq("ativo", true).order("nome"),
      supabase.from("escola_chamadas").select("id,grade_id,data_aula,periodo_inicio,periodo_fim,total_alunos,presentes,faltas,atrasados,saidas_antecipadas,salvo_em").eq("data_aula", today).order("salvo_em", { ascending: false }),
      supabase.from("escola_frequencias").select("grade_id,aluno_id,data_aula,status,observacao").eq("data_aula", today)
    ]);

    const firstError = [gradeRes, studentRes, callsRes, attendanceRes].find((item) => item.error)?.error;
    if (firstError) setError(firstError.message);
    const nextSchedule = (gradeRes.data ?? []) as unknown as Schedule[];
    setSchedule(nextSchedule);
    setStudents((studentRes.data ?? []) as Student[]);
    setCalls((callsRes.data ?? []) as Call[]);
    setAttendance((attendanceRes.data ?? []) as Attendance[]);
    setGradeId((current) => nextSchedule.some((item) => item.id === current) ? current : nextSchedule[0]?.id || "");
    setLoading(false);
  }, [supabase, today, todayWeekday]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => schedule.find((item) => item.id === gradeId), [schedule, gradeId]);
  const classStudents = useMemo(() => students.filter((item) => item.turma_id === selected?.turma_id), [students, selected]);
  const savedCall = useMemo(() => calls.find((item) => item.grade_id === gradeId && item.data_aula === today), [calls, gradeId, today]);

  useEffect(() => {
    const next: Record<string, Mark> = {};
    for (const student of classStudents) {
      const previous = savedCall ? attendance.find((item) => item.grade_id === gradeId && item.aluno_id === student.id && item.data_aula === today) : undefined;
      next[student.id] = { status: previous?.status || "", observacao: previous?.observacao || "" };
    }
    setMarks(next);
    setMessage("");
    setError("");
  }, [classStudents, savedCall, attendance, gradeId, today]);

  const markedCount = useMemo(() => classStudents.filter((student) => !!marks[student.id]?.status).length, [classStudents, marks]);
  const allMarked = classStudents.length > 0 && markedCount === classStudents.length;

  function choose(studentId: string, status: Status) {
    if (savedCall) return;
    setMarks((current) => ({ ...current, [studentId]: { ...(current[studentId] || { observacao: "" }), status } }));
  }

  async function save() {
    if (!selected || !allMarked || savedCall) return;
    setSaving(true);
    setMessage("");
    setError("");
    const items = classStudents.map((student) => ({ aluno_id: student.id, status: marks[student.id].status, observacao: marks[student.id].observacao || "" }));
    const { error: rpcError } = await supabase.rpc("escola_save_attendance", { p_grade_id: selected.id, p_data: today, p_items: items });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage("Chamada salva com sucesso. Esta aula ficou fechada e não pode ser salva novamente.");
      await load();
    }
    setSaving(false);
  }

  if (loading) return <section className="grid min-h-52 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={30}/></section>;

  return <section className="grid gap-5 rounded-3xl border-2 border-emerald-200 bg-emerald-50/30 p-4 sm:p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Chamada do dia</p><h2 className="mt-1 text-2xl font-black">Presença da turma</h2><p className="mt-1 text-sm text-slate-500">A chamada só pode ser feita no próprio dia e precisa ter todos os alunos marcados.</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center"><p className="text-xs font-bold uppercase text-slate-400">Data</p><p className="font-black">{formatDate(today)}</p></div>
    </div>

    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div> : null}
    {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 className="mr-2 inline" size={17}/>{message}</div> : null}

    {!schedule.length ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center"><p className="font-black">Nenhuma aula programada para hoje.</p><p className="mt-1 text-sm text-slate-500">A chamada aparece conforme a grade de horários cadastrada.</p></div> : <>
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-black text-slate-600">Aula de hoje
          <select className={field} value={gradeId} onChange={(event) => setGradeId(event.target.value)}>{schedule.map((item) => { const done = calls.some((call) => call.grade_id === item.id && call.data_aula === today); return <option key={item.id} value={item.id}>{done ? "✓ " : ""}{shortTime(item.hora_inicio)}–{shortTime(item.hora_fim)} · {item.turma?.nome} · {item.disciplina?.nome}</option>; })}</select>
        </label>
        {selected ? <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm"><p className="flex items-center gap-2 font-black"><Clock3 size={16}/> Período: {shortTime(selected.hora_inicio)} às {shortTime(selected.hora_fim)}</p><p className="mt-1 text-slate-500">{selected.professor?.nome}{selected.sala ? ` · ${selected.sala}` : ""}</p></div> : null}
      </div>

      {savedCall ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
        <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check size={24}/></div><div><p className="text-lg font-black text-emerald-900">Chamada salva</p><p className="mt-1 text-sm text-emerald-800">Período {shortTime(savedCall.periodo_inicio)}–{shortTime(savedCall.periodo_fim)} · salva em {formatDateTime(savedCall.salvo_em)}.</p></div></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Summary label="Presentes" value={savedCall.presentes}/><Summary label="Faltas" value={savedCall.faltas}/><Summary label="Atrasados" value={savedCall.atrasados}/><Summary label="Saída antecipada" value={savedCall.saidas_antecipadas}/></div>
        <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm font-bold text-emerald-900">Esta chamada está fechada. O botão de salvar não é exibido novamente para esta aula e data.</p>
      </div> : null}

      {!savedCall && selected ? <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4"><p className="font-black">Conferência: {markedCount} de {classStudents.length} alunos marcados</p><span className={`rounded-full px-3 py-1 text-xs font-black ${allMarked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{allMarked ? "Todos conferidos" : "Faltam marcações"}</span></div>
        {!classStudents.length ? <div className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-slate-500">Nenhum aluno ativo nesta turma.</div> : classStudents.map((student) => { const current = marks[student.id] || { status: "", observacao: "" }; return <article className={`rounded-2xl border bg-white p-4 ${current.status ? "border-emerald-200" : "border-slate-200"}`} key={student.id}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-full ${current.status ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{current.status ? <Check size={18}/> : <span className="text-sm font-black">?</span>}</div><p className="font-black">{student.nome}</p></div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Choice active={current.status === "presente"} label="Presente" icon={<UserCheck size={16}/>} onClick={() => choose(student.id, "presente")} tone="green"/>
              <Choice active={current.status === "falta"} label="Faltou" icon={<UserX size={16}/>} onClick={() => choose(student.id, "falta")} tone="red"/>
              <Choice active={current.status === "atrasado"} label="Atrasado" icon={<Clock3 size={16}/>} onClick={() => choose(student.id, "atrasado")} tone="amber"/>
              <Choice active={current.status === "saida_antecipada"} label="Saiu antes" icon={<Clock3 size={16}/>} onClick={() => choose(student.id, "saida_antecipada")} tone="amber"/>
            </div>
          </div>
          <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600" placeholder="Observação opcional" value={current.observacao} onChange={(event) => setMarks((map) => ({ ...map, [student.id]: { ...current, observacao: event.target.value } }))}/>
        </article>; })}
        {classStudents.length ? <div className="sticky bottom-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur"><button className={`${primary} w-full`} disabled={saving || !allMarked} onClick={() => void save()} type="button">{saving ? <LoaderCircle className="animate-spin" size={18}/> : <Save size={18}/>} {allMarked ? "Salvar chamada e fechar" : `Marque os ${classStudents.length - markedCount} aluno(s) restante(s)`}</button><p className="mt-2 text-center text-xs font-semibold text-slate-500">Depois de salva, esta chamada não poderá ser enviada novamente para o mesmo período e data.</p></div> : null}
      </div> : null}
    </>}
  </section>;
}

function Choice({ active, label, icon, onClick, tone }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void; tone: "green" | "red" | "amber" }) {
  const activeTone = tone === "green" ? "border-emerald-600 bg-emerald-600 text-white" : tone === "red" ? "border-rose-600 bg-rose-600 text-white" : "border-amber-500 bg-amber-500 text-white";
  return <button className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition ${active ? activeTone : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} onClick={onClick} type="button">{active ? <Check size={16}/> : icon}{label}</button>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-white p-3 text-center"><p className="text-xl font-black">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div>;
}

function todayInAraguaina() {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Araguaina", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isoWeekday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function shortTime(value?: string | null) { return value ? value.slice(0, 5) : "--:--"; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Araguaina", dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
