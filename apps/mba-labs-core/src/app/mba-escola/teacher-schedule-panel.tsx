"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BookOpenText, Clock3, LoaderCircle, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = { supabase: SupabaseClient; profile: { nome: string; papel: "professor"; escola_id: string } };
type Schedule = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string; sala: string | null; turma?: { nome: string } | null; disciplina?: { nome: string } | null };
const days = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

export default function TeacherSchedulePanel({ supabase }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState<Schedule[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError("Não foi possível identificar o professor.");
      setSchedule([]);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("escola_grade_horarios")
      .select("id,dia_semana,hora_inicio,hora_fim,sala,turma:escola_turmas(nome),disciplina:escola_disciplinas(nome)")
      .eq("ativo", true)
      .eq("professor_id", auth.user.id)
      .order("dia_semana")
      .order("hora_inicio");
    if (queryError) setError(queryError.message);
    setSchedule((data ?? []) as unknown as Schedule[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => days.slice(1).map((label, index) => ({ label, day: index + 1, items: schedule.filter(item => item.dia_semana === index + 1) })).filter(group => group.items.length), [schedule]);

  if (loading) return <section className="grid min-h-40 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={28}/></section>;

  return <section className="grid gap-5">
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Acadêmico</p>
      <h2 className="mt-1 text-2xl font-black">Minhas aulas</h2>
      <p className="mt-1 text-sm text-slate-500">Consulte seus horários, turmas e disciplinas. A escola organiza a grade; não é necessário registrar aula ou presença.</p>
    </div>
    {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}
    {!groups.length ? <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Nenhuma aula vinculada ao seu perfil.</p> : <div className="grid gap-4">{groups.map(group => <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={group.day}><h3 className="mb-4 text-lg font-black">{group.label}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{group.items.map(item => <article className="rounded-2xl border border-slate-200 p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{item.disciplina?.nome || "Disciplina"}</p><p className="mt-1 text-sm font-bold text-[#176b5b]">{item.turma?.nome || "Turma"}</p></div><BookOpenText className="shrink-0 text-[#176b5b]" size={18}/></div><p className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600"><Clock3 size={15}/>{short(item.hora_inicio)}–{short(item.hora_fim)}</p>{item.sala ? <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><MapPin size={15}/>{item.sala}</p> : null}</article>)}</div></section>)}</div>}
  </section>;
}

function short(value: string) { return value.slice(0, 5); }
