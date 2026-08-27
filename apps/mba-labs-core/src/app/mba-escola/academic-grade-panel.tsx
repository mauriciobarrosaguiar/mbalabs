"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Clock3, FileSpreadsheet, FileUp, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string } };
type ClassRow = { id: string; nome: string; ano_letivo: number; turno: string | null };
type Teacher = { id: string; nome: string };
type Subject = { id: string; nome: string };
type Schedule = { id: string; turma_id: string; professor_id: string; disciplina_id: string; dia_semana: number; hora_inicio: string; hora_fim: string; sala: string | null; ano_letivo: number; turma?: { nome: string } | null; professor?: { nome: string } | null; disciplina?: { nome: string } | null };
type ImportRow = { professor: string; turma: string; disciplina: string; dia_semana: number; hora_inicio: string; hora_fim: string; sala: string; sourceRow: number };
type MappingKey = "professor" | "turma" | "disciplina" | "dia" | "inicio" | "fim" | "sala";
type Mapping = Record<MappingKey, string>;

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const days = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function AcademicGradePanel({ supabase, profile }: Props) {
  const manager = ["admin_escola", "direcao", "coordenacao"].includes(profile.papel);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [manual, setManual] = useState({ professor: "", turma: "", disciplina: "", dia: "1", inicio: "07:00", fim: "07:50", sala: "", ano: String(new Date().getFullYear()) });
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ professor: "", turma: "", disciplina: "", dia: "", inicio: "", fim: "", sala: "" });
  const [fileName, setFileName] = useState("");
  const [importYear, setImportYear] = useState(String(new Date().getFullYear()));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const req = await Promise.all([
      supabase.from("escola_turmas").select("id,nome,ano_letivo,turno").eq("ativa", true).order("nome"),
      supabase.from("escola_perfis").select("id,nome").eq("papel", "professor").eq("ativo", true).order("nome"),
      supabase.from("escola_disciplinas").select("id,nome").eq("ativa", true).order("nome"),
      supabase.from("escola_grade_horarios").select("id,turma_id,professor_id,disciplina_id,dia_semana,hora_inicio,hora_fim,sala,ano_letivo,turma:escola_turmas(nome),disciplina:escola_disciplinas(nome)").eq("ativo", true).order("dia_semana").order("hora_inicio")
    ]);
    const firstError = req.find(item => item.error)?.error;
    if (firstError) setError(firstError.message);
    setClasses((req[0].data ?? []) as ClassRow[]);
    const teacherRows = (req[1].data ?? []) as Teacher[];
    const teacherById = new globalThis.Map<string, string>(teacherRows.map(item => [item.id, item.nome]));
    setTeachers(teacherRows);
    setSubjects((req[2].data ?? []) as Subject[]);
    setSchedule(((req[3].data ?? []) as unknown as Schedule[]).map(item => ({
      ...item,
      professor: teacherById.has(item.professor_id) ? { nome: teacherById.get(item.professor_id)! } : null
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!manual.professor && teachers[0]) setManual(value => ({ ...value, professor: teachers[0].nome }));
    if (!manual.turma && classes[0]) setManual(value => ({ ...value, turma: classes[0].nome, ano: String(classes[0].ano_letivo) }));
  }, [teachers, classes, manual.professor, manual.turma]);

  async function mutate(action: () => PromiseLike<{ error?: { message: string } | null }>, success: string) {
    setWorking(true); setError(""); setMessage("");
    const result = await action();
    if (result.error) setError(result.error.message);
    else { setMessage(success); await load(); }
    setWorking(false);
  }

  async function saveManual(event: React.FormEvent) {
    event.preventDefault();
    await mutate(() => supabase.rpc("escola_school_import_schedule", {
      p_rows: [{ professor: manual.professor, turma: manual.turma, disciplina: manual.disciplina, dia_semana: Number(manual.dia), hora_inicio: manual.inicio, hora_fim: manual.fim, sala: manual.sala }],
      p_ano_letivo: Number(manual.ano)
    }), "Horário salvo e vínculo professor × turma × disciplina atualizado.");
    setManual(value => ({ ...value, disciplina: "", sala: "" }));
  }

  async function readExcel(file: File) {
    setError(""); setMessage(""); setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setError("Use planilha .xlsx."); return; }
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer() as never);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("Planilha sem abas.");
      const detectedHeaders: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: false }, cell => { const text = String(cell.text || cell.value || "").trim(); if (text) detectedHeaders.push(text); });
      const rows: Record<string, string>[] = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const item: Record<string, string> = { __row: String(rowNumber) };
        let hasValue = false;
        detectedHeaders.forEach((header, index) => { const value = String(row.getCell(index + 1).text || "").trim(); item[header] = value; if (value) hasValue = true; });
        if (hasValue) rows.push(item);
      }
      setHeaders(detectedHeaders); setRawRows(rows); setMapping(autoMap(detectedHeaders)); setMessage(`${rows.length} linha(s) encontradas. Confira o mapeamento.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler a planilha.");
    }
  }

  const preview = useMemo(() => buildPreview(rawRows, mapping, teachers, classes), [rawRows, mapping, teachers, classes]);

  async function importSchedule() {
    if (preview.errors.length || !preview.rows.length) return;
    await mutate(() => supabase.rpc("escola_school_import_schedule", { p_rows: preview.rows.map(({ sourceRow: _sourceRow, ...row }) => row), p_ano_letivo: Number(importYear) }), `${preview.rows.length} horário(s) importados.`);
    setHeaders([]); setRawRows([]); setFileName("");
  }

  if (loading) return <Card title="Grade"><p className="text-sm text-slate-500">Carregando grade...</p></Card>;

  return <section className="grid gap-5">
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Acadêmico</p>
      <h2 className="mt-1 text-2xl font-black">Grade de horários</h2>
      <p className="mt-1 text-sm text-slate-500">A rotina do professor fica focada em aulas e atividades. Não há chamada de presença no MBA Escola.</p>
    </div>
    {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p> : null}
    {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}

    {manager ? <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Importar grade do Excel">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 p-5 font-black text-[#176b5b]"><FileUp size={20}/> Selecionar .xlsx<input className="hidden" type="file" accept=".xlsx" onChange={event => { const file = event.target.files?.[0]; if (file) void readExcel(file); }}/></label>
        {fileName ? <p className="mt-2 text-xs text-slate-500">{fileName}</p> : null}
        {headers.length ? <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Map label="Professor" value={mapping.professor} headers={headers} set={value => setMapping(current => ({ ...current, professor: value }))}/>
            <Map label="Turma" value={mapping.turma} headers={headers} set={value => setMapping(current => ({ ...current, turma: value }))}/>
            <Map label="Disciplina" value={mapping.disciplina} headers={headers} set={value => setMapping(current => ({ ...current, disciplina: value }))}/>
            <Map label="Dia" value={mapping.dia} headers={headers} set={value => setMapping(current => ({ ...current, dia: value }))}/>
            <Map label="Início" value={mapping.inicio} headers={headers} set={value => setMapping(current => ({ ...current, inicio: value }))}/>
            <Map label="Fim" value={mapping.fim} headers={headers} set={value => setMapping(current => ({ ...current, fim: value }))}/>
            <Map label="Sala" value={mapping.sala} headers={headers} set={value => setMapping(current => ({ ...current, sala: value }))} optional/>
            <input className={field} type="number" value={importYear} onChange={event => setImportYear(event.target.value)}/>
          </div>
          <div className={`rounded-xl p-3 text-sm ${preview.errors.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}><b>{preview.rows.length} linha(s) pronta(s).</b>{preview.errors.slice(0, 6).map(item => <p key={item}>• {item}</p>)}</div>
          <button className={primary} disabled={working || !!preview.errors.length || !preview.rows.length} onClick={() => void importSchedule()} type="button"><FileSpreadsheet size={17}/> Importar</button>
        </div> : null}
      </Card>

      <Card title="Adicionar horário">
        <form className="grid gap-3" onSubmit={saveManual}>
          <select className={field} value={manual.professor} onChange={event => setManual(current => ({ ...current, professor: event.target.value }))}>{teachers.map(item => <option key={item.id}>{item.nome}</option>)}</select>
          <select className={field} value={manual.turma} onChange={event => setManual(current => ({ ...current, turma: event.target.value }))}>{classes.map(item => <option key={item.id}>{item.nome}</option>)}</select>
          <input className={field} list="mba-escola-subjects" placeholder="Disciplina" required value={manual.disciplina} onChange={event => setManual(current => ({ ...current, disciplina: event.target.value }))}/>
          <datalist id="mba-escola-subjects">{subjects.map(item => <option key={item.id} value={item.nome}/>)}</datalist>
          <div className="grid grid-cols-2 gap-3">
            <select className={field} value={manual.dia} onChange={event => setManual(current => ({ ...current, dia: event.target.value }))}>{days.slice(1).map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select>
            <input className={field} type="number" value={manual.ano} onChange={event => setManual(current => ({ ...current, ano: event.target.value }))}/>
            <input className={field} type="time" value={manual.inicio} onChange={event => setManual(current => ({ ...current, inicio: event.target.value }))}/>
            <input className={field} type="time" value={manual.fim} onChange={event => setManual(current => ({ ...current, fim: event.target.value }))}/>
          </div>
          <input className={field} placeholder="Sala (opcional)" value={manual.sala} onChange={event => setManual(current => ({ ...current, sala: event.target.value }))}/>
          <button className={primary} disabled={working}><Save size={17}/> Salvar horário</button>
        </form>
      </Card>
    </div> : null}

    <Card title={manager ? "Grade atual" : "Minha grade"}>
      {!schedule.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum horário cadastrado.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{schedule.map(item => <article className="rounded-2xl border border-slate-200 p-4" key={item.id}><p className="font-black">{item.disciplina?.nome || "Disciplina"}</p><p className="text-sm font-bold text-[#176b5b]">{item.turma?.nome}</p><p className="mt-2 flex items-center gap-2 text-sm"><Clock3 size={15}/>{days[item.dia_semana]} · {short(item.hora_inicio)}–{short(item.hora_fim)}</p><p className="text-sm text-slate-500">{item.professor?.nome}{item.sala ? ` · ${item.sala}` : ""}</p></article>)}</div>}
    </Card>
  </section>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-black">{title}</h3>{children}</section>; }
function Map({ label, value, headers, set, optional = false }: { label: string; value: string; headers: string[]; set: (value: string) => void; optional?: boolean }) { return <label className="grid gap-1 text-sm font-bold">{label}<select className={field} value={value} onChange={event => set(event.target.value)}><option value="">{optional ? "Não usar" : "Selecione"}</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>; }
function short(value?: string | null) { return value ? value.slice(0, 5) : "--:--"; }
function autoMap(headers: string[]): Mapping { const find = (terms: string[]) => headers.find(header => terms.some(term => norm(header) === norm(term) || norm(header).includes(norm(term)))) || ""; const horario = find(["horario", "horário"]); return { professor: find(["professor", "docente", "prof"]), turma: find(["turma", "classe", "série", "serie"]), disciplina: find(["disciplina", "matéria", "materia", "componente"]), dia: find(["dia da semana", "dia_semana", "dia", "semana"]), inicio: find(["hora inicio", "hora início", "inicio", "início", "horario inicio"]) || horario, fim: find(["hora fim", "fim", "horario fim"]) || horario, sala: find(["sala", "local"]) }; }
function buildPreview(raw: Record<string, string>[], mapping: Mapping, teachers: Teacher[], classes: ClassRow[]) { const errors: string[] = []; for (const [key, label] of [["professor", "Professor"], ["turma", "Turma"], ["disciplina", "Disciplina"], ["dia", "Dia"], ["inicio", "Início"], ["fim", "Fim"]] as Array<[MappingKey, string]>) if (!mapping[key]) errors.push(`Mapeie ${label}.`); if (errors.length) return { rows: [] as ImportRow[], errors }; const teacherNames = new Set(teachers.map(item => norm(item.nome))); const classNames = new Set(classes.map(item => norm(item.nome))); const rows: ImportRow[] = []; for (const rawRow of raw) { const professor = rawRow[mapping.professor]?.trim(), turma = rawRow[mapping.turma]?.trim(), disciplina = rawRow[mapping.disciplina]?.trim(), dia = parseDay(rawRow[mapping.dia]), sourceRow = Number(rawRow.__row || 0); let inicio = parseTime(rawRow[mapping.inicio]), fim = parseTime(rawRow[mapping.fim]); if (mapping.inicio === mapping.fim) [inicio, fim] = parseRange(rawRow[mapping.inicio]); if (!professor || !turma || !disciplina || !dia || !inicio || !fim) { errors.push(`Linha ${sourceRow}: dados obrigatórios inválidos.`); continue; } if (!teacherNames.has(norm(professor))) errors.push(`Linha ${sourceRow}: professor “${professor}” não cadastrado.`); if (!classNames.has(norm(turma))) errors.push(`Linha ${sourceRow}: turma “${turma}” não encontrada.`); if (fim <= inicio) errors.push(`Linha ${sourceRow}: horário final inválido.`); rows.push({ professor, turma, disciplina, dia_semana: dia, hora_inicio: inicio, hora_fim: fim, sala: mapping.sala ? rawRow[mapping.sala]?.trim() || "" : "", sourceRow }); } for (let i = 0; i < rows.length; i += 1) for (let j = i + 1; j < rows.length; j += 1) { const first = rows[i], second = rows[j]; if (first.dia_semana === second.dia_semana && first.hora_inicio < second.hora_fim && first.hora_fim > second.hora_inicio) { if (norm(first.professor) === norm(second.professor)) errors.push(`Conflito: ${first.professor} em horários sobrepostos.`); if (norm(first.turma) === norm(second.turma)) errors.push(`Conflito: ${first.turma} em horários sobrepostos.`); } } return { rows, errors: Array.from(new Set(errors)) }; }
function norm(value: string) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function parseDay(value: string) { const normalized = norm(value); if (/^[1-7]$/.test(normalized)) return Number(normalized); if (normalized.startsWith("seg")) return 1; if (normalized.startsWith("ter")) return 2; if (normalized.startsWith("qua")) return 3; if (normalized.startsWith("qui")) return 4; if (normalized.startsWith("sex")) return 5; if (normalized.startsWith("sab")) return 6; if (normalized.startsWith("dom")) return 7; return 0; }
function parseTime(value: string) { const text = String(value || "").trim(); const match = text.match(/(\d{1,2})[:hH](\d{2})/); if (match) return `${match[1].padStart(2, "0")}:${match[2]}`; const compact = text.match(/^(\d{1,2})(\d{2})$/); return compact ? `${compact[1].padStart(2, "0")}:${compact[2]}` : ""; }
function parseRange(value: string): [string, string] { const parts = String(value || "").split(/\s*(?:-|–|—|a|às)\s*/i).map(parseTime).filter(Boolean); return [parts[0] || "", parts[1] || ""]; }
