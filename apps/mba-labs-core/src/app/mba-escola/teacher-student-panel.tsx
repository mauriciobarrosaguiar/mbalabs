"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, LoaderCircle, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Props = { supabase: SupabaseClient; profile: { nome: string; papel: "professor"; escola_id: string } };
type Student = { id: string; nome: string; turma_id: string | null; turma?: { nome: string } | null };
type Occurrence = { id: string; aluno_id: string; categoria: string; prioridade: string; titulo: string; descricao: string; acao_tomada: string | null; visivel_responsavel: boolean; exige_ciencia: boolean; status: string; criado_em: string; aluno?: { nome: string } | null };

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";

export default function TeacherStudentPanel({ supabase }: Props) {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [form, setForm] = useState({ aluno_id: "", categoria: "geral", prioridade: "normal", titulo: "", descricao: "", acao: "", visivel: true, ciencia: false });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [studentResult, occurrenceResult] = await Promise.all([
      supabase.from("escola_alunos").select("id,nome,turma_id,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
      supabase.from("escola_ocorrencias_aluno").select("id,aluno_id,categoria,prioridade,titulo,descricao,acao_tomada,visivel_responsavel,exige_ciencia,status,criado_em,aluno:escola_alunos(nome)").order("criado_em", { ascending: false }).limit(100)
    ]);
    const firstError = studentResult.error || occurrenceResult.error;
    if (firstError) setError(firstError.message);
    setStudents((studentResult.data ?? []) as unknown as Student[]);
    setOccurrences((occurrenceResult.data ?? []) as unknown as Occurrence[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!form.aluno_id && students[0]) setForm(current => ({ ...current, aluno_id: students[0].id })); }, [students, form.aluno_id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.aluno_id) return;
    setWorking(true); setError(""); setMessage("");
    const { error: rpcError } = await supabase.rpc("escola_create_student_occurrence", {
      p_aluno_id: form.aluno_id,
      p_categoria: form.categoria,
      p_prioridade: form.prioridade,
      p_titulo: form.titulo,
      p_descricao: form.descricao,
      p_acao_tomada: form.acao || null,
      p_visivel_responsavel: form.visivel,
      p_exige_ciencia: form.ciencia
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(form.ciencia ? "Ocorrência registrada e enviada ao responsável para ciência." : "Ocorrência registrada.");
      setForm(current => ({ ...current, titulo: "", descricao: "", acao: "" }));
      await load();
    }
    setWorking(false);
  }

  if (loading) return <section className="grid min-h-44 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={28}/></section>;

  return <section className="grid gap-5">
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Alunos</p>
      <h2 className="mt-1 text-2xl font-black">Ocorrências da minha rotina</h2>
      <p className="mt-2 text-sm text-slate-500">O professor registra apenas ocorrências dos alunos que pode acompanhar. Documentos, retiradas e pessoas autorizadas ficam restritos à gestão e aos responsáveis.</p>
    </div>
    {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}

    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-black"><AlertTriangle className="text-[#176b5b]" size={20}/> Registrar ocorrência</h3>
        {!students.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum aluno disponível para este professor.</p> : <form className="grid gap-3" onSubmit={submit}>
          <select className={field} value={form.aluno_id} onChange={event => setForm(current => ({ ...current, aluno_id: event.target.value }))}>{students.map(student => <option key={student.id} value={student.id}>{student.nome}{student.turma?.nome ? ` · ${student.turma.nome}` : ""}</option>)}</select>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className={field} value={form.categoria} onChange={event => setForm(current => ({ ...current, categoria: event.target.value }))}><option value="geral">Geral</option><option value="comportamento">Comportamento</option><option value="acidente">Acidente</option><option value="conflito">Conflito</option><option value="disciplinar">Disciplinar</option><option value="outro">Outro</option></select>
            <select className={field} value={form.prioridade} onChange={event => setForm(current => ({ ...current, prioridade: event.target.value }))}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select>
          </div>
          <input className={field} placeholder="Título" required value={form.titulo} onChange={event => setForm(current => ({ ...current, titulo: event.target.value }))}/>
          <textarea className={area} placeholder="O que aconteceu?" required value={form.descricao} onChange={event => setForm(current => ({ ...current, descricao: event.target.value }))}/>
          <textarea className={area} placeholder="Ação tomada (opcional)" value={form.acao} onChange={event => setForm(current => ({ ...current, acao: event.target.value }))}/>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.visivel} onChange={event => setForm(current => ({ ...current, visivel: event.target.checked, ciencia: event.target.checked ? current.ciencia : false }))}/> Mostrar ao responsável</label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" disabled={!form.visivel} checked={form.ciencia} onChange={event => setForm(current => ({ ...current, ciencia: event.target.checked }))}/> Exigir ciência do responsável</label>
          <button className={primary} disabled={working}><Save size={17}/> Registrar</button>
        </form>}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black">Ocorrências recentes</h3>
        <div className="mt-4 grid gap-3">{occurrences.length ? occurrences.map(item => <article className="rounded-2xl border border-slate-200 p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black">{item.aluno?.nome || "Aluno"}</p><p className="mt-1 text-sm font-bold text-slate-700">{item.titulo}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black">{priorityLabel(item.prioridade)}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.descricao}</p><p className="mt-2 text-xs text-slate-400">{dateTime(item.criado_em)}{item.visivel_responsavel ? " · Visível ao responsável" : ""}{item.exige_ciencia ? " · Exige ciência" : ""}</p></article>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma ocorrência registrada.</p>}</div>
      </section>
    </div>
  </section>;
}

function priorityLabel(value: string) { return value === "urgente" ? "Urgente" : value === "importante" ? "Importante" : "Normal"; }
function dateTime(value: string) { try { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Araguaina", dateStyle: "short", timeStyle: "short" }).format(new Date(value)); } catch { return "—"; } }
