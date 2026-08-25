"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BarChart3, CheckCircle2, FileUp, LoaderCircle, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao";
type Props = { supabase: SupabaseClient; profile: { papel: Role; escola_id: string } };
type ClassRow = { id: string; nome: string };
type Student = { id: string; nome: string };
type Tab = "reports" | "imports";
type ImportType = "alunos" | "equipe" | "responsaveis";
type NormalizedImportRow = {
  nome: string;
  turma: string;
  data_nascimento: string;
  email: string;
  perfil: string;
  aluno: string;
  parentesco: string;
} & Record<string, string>;

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const active = "rounded-xl bg-[#176b5b] px-4 py-2.5 text-sm font-black text-white";
const inactive = "rounded-xl px-4 py-2.5 text-sm font-black text-slate-600";

export default function ManagementTools({ supabase, profile }: Props) {
  const [tab, setTab] = useState<Tab>("reports");
  return <section className="grid gap-5">
    <nav className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2">
      <button className={tab === "reports" ? active : inactive} onClick={() => setTab("reports")} type="button">Relatórios</button>
      {profile.papel !== "coordenacao" ? <button className={tab === "imports" ? active : inactive} onClick={() => setTab("imports")} type="button">Importações</button> : null}
    </nav>
    {tab === "reports" ? <Reports supabase={supabase}/> : null}
    {tab === "imports" && profile.papel !== "coordenacao" ? <Imports supabase={supabase}/> : null}
  </section>;
}

function Reports({ supabase }: { supabase: SupabaseClient }) {
  const now = new Date();
  const [start, setStart] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [end, setEnd] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(now));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ alunos: 0, turmas: 0, faltas: 0, justificadas: 0, comunicados: 0, autorizacoes: 0, respostas: 0, ocorrencias: 0, atividades: 0, entregas: 0 });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const req = await Promise.all([
      supabase.from("escola_alunos").select("id", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("escola_turmas").select("id", { count: "exact", head: true }).eq("ativa", true),
      supabase.from("escola_frequencias").select("id", { count: "exact", head: true }).eq("status", "falta").gte("data_aula", start).lte("data_aula", end),
      supabase.from("escola_justificativas_falta").select("id", { count: "exact", head: true }).eq("status", "aprovada").gte("criado_em", `${start}T00:00:00`).lte("criado_em", `${end}T23:59:59`),
      supabase.from("escola_comunicados").select("id", { count: "exact", head: true }).gte("publicado_em", `${start}T00:00:00`).lte("publicado_em", `${end}T23:59:59`),
      supabase.from("escola_autorizacoes").select("id", { count: "exact", head: true }).gte("criado_em", `${start}T00:00:00`).lte("criado_em", `${end}T23:59:59`),
      supabase.from("escola_autorizacao_respostas").select("id", { count: "exact", head: true }).gte("respondido_em", `${start}T00:00:00`).lte("respondido_em", `${end}T23:59:59`),
      supabase.from("escola_ocorrencias_aluno").select("id", { count: "exact", head: true }).gte("criado_em", `${start}T00:00:00`).lte("criado_em", `${end}T23:59:59`),
      supabase.from("escola_atividades").select("id", { count: "exact", head: true }).gte("criado_em", `${start}T00:00:00`).lte("criado_em", `${end}T23:59:59`),
      supabase.from("escola_atividade_entregas").select("id", { count: "exact", head: true }).eq("situacao", "entregue").gte("entregue_em", `${start}T00:00:00`).lte("entregue_em", `${end}T23:59:59`)
    ]);
    const firstError = req.find(item => item.error)?.error;
    if (firstError) setError(firstError.message);
    setStats({
      alunos: req[0].count ?? 0,
      turmas: req[1].count ?? 0,
      faltas: req[2].count ?? 0,
      justificadas: req[3].count ?? 0,
      comunicados: req[4].count ?? 0,
      autorizacoes: req[5].count ?? 0,
      respostas: req[6].count ?? 0,
      ocorrencias: req[7].count ?? 0,
      atividades: req[8].count ?? 0,
      entregas: req[9].count ?? 0
    });
    setLoading(false);
  }, [supabase, start, end]);
  useEffect(() => { void load(); }, [load]);

  return <section className="grid gap-5">
    <div className="flex flex-col justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 md:flex-row md:items-end">
      <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Relatórios</p><h2 className="mt-1 text-2xl font-black">Indicadores da escola</h2><p className="mt-1 text-sm text-slate-500">Indicadores de operação e comunicação, sem exigir controle diário de presença.</p></div>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-slate-500">De<input className={field} type="date" value={start} onChange={event => setStart(event.target.value)}/></label><label className="text-xs font-bold text-slate-500">Até<input className={field} type="date" value={end} onChange={event => setEnd(event.target.value)}/></label></div>
    </div>
    {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
    {loading ? <div className="grid place-items-center p-10"><LoaderCircle className="animate-spin"/></div> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Alunos ativos" value={stats.alunos}/><Metric label="Turmas ativas" value={stats.turmas}/><Metric label="Faltas registradas" value={stats.faltas}/><Metric label="Faltas justificadas" value={stats.justificadas}/><Metric label="Comunicados" value={stats.comunicados}/><Metric label="Autorizações" value={stats.autorizacoes}/><Metric label="Respostas" value={stats.respostas}/><Metric label="Ocorrências" value={stats.ocorrencias}/><Metric label="Atividades" value={stats.atividades}/><Metric label="Entregas" value={stats.entregas}/>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-lg font-black"><BarChart3 size={20}/> Leitura rápida</h3><p className="mt-3 text-sm leading-6 text-slate-600">No período constam <b>{stats.faltas}</b> falta(s) registrada(s), sendo <b>{stats.justificadas}</b> justificativa(s) aprovada(s). A escola publicou <b>{stats.comunicados}</b> comunicado(s), abriu <b>{stats.autorizacoes}</b> autorização(ões), recebeu <b>{stats.respostas}</b> resposta(s) e registrou <b>{stats.ocorrencias}</b> ocorrência(s).</p></div>
    </>}
  </section>;
}

function Imports({ supabase }: { supabase: SupabaseClient }) {
  const [type, setType] = useState<ImportType>("alunos");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    void Promise.all([
      supabase.from("escola_turmas").select("id,nome").eq("ativa", true),
      supabase.from("escola_alunos").select("id,nome").eq("ativo", true)
    ]).then(([classResult, studentResult]) => {
      setClasses((classResult.data ?? []) as ClassRow[]);
      setStudents((studentResult.data ?? []) as Student[]);
    });
  }, [supabase]);

  async function read(file: File) {
    setError(""); setMessage(""); setFileName(file.name);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer() as never);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("Planilha sem abas.");
      const detectedHeaders: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: false }, cell => { const text = String(cell.text || cell.value || "").trim(); if (text) detectedHeaders.push(text); });
      const list: Record<string, string>[] = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const item: Record<string, string> = {};
        let hasValue = false;
        detectedHeaders.forEach((header, index) => { const value = String(row.getCell(index + 1).text || "").trim(); item[header] = value; if (value) hasValue = true; });
        if (hasValue) list.push(item);
      }
      setHeaders(detectedHeaders); setRows(list); setMessage(`${list.length} linha(s) carregadas.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler a planilha.");
    }
  }

  const mapped = useMemo<NormalizedImportRow[]>(() => rows.map(row => mapRow(type, row, headers)), [rows, headers, type]);
  const errors = useMemo(() => mapped.flatMap((row, index) => validate(type, row, classes, students).map(item => `Linha ${index + 2}: ${item}`)), [mapped, type, classes, students]);

  async function execute() {
    if (errors.length || !mapped.length) return;
    setWorking(true); setError("");
    let imported = 0;
    for (const row of mapped) {
      let actionError: { message: string } | null = null;
      if (type === "alunos") {
        const classItem = classes.find(item => norm(item.nome) === norm(row.turma));
        const result = await supabase.rpc("escola_school_upsert_student", { p_id: null, p_nome: row.nome, p_data_nascimento: row.data_nascimento || null, p_turma_id: classItem?.id || null, p_ativo: true });
        actionError = result.error;
      } else {
        const student = type === "responsaveis" ? students.find(item => norm(item.nome) === norm(row.aluno)) : undefined;
        const role = type === "responsaveis" ? "responsavel" : normalizeRole(row.perfil);
        const result = await supabase.rpc("escola_school_create_invite", { p_nome: row.nome, p_email: row.email.toLowerCase(), p_papel: role, p_aluno_id: student?.id || null });
        actionError = result.error;
      }
      if (actionError) {
        setError(`Importação interrompida após ${imported} registro(s): ${actionError.message}`);
        setWorking(false);
        return;
      }
      imported += 1;
    }
    setMessage(`${imported} registro(s) importados com sucesso.`);
    setRows([]); setHeaders([]); setFileName(""); setWorking(false);
  }

  return <section className="grid gap-5">
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Importação em massa</p><h2 className="mt-1 text-2xl font-black">Alunos, equipe e responsáveis</h2><p className="mt-1 text-sm text-slate-500">A primeira linha deve conter cabeçalhos. O sistema reconhece nomes comuns das colunas.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><button type="button" className={type === "alunos" ? active : inactive} onClick={() => reset("alunos", setType, setRows, setHeaders)}>Alunos</button><button type="button" className={type === "equipe" ? active : inactive} onClick={() => reset("equipe", setType, setRows, setHeaders)}>Equipe</button><button type="button" className={type === "responsaveis" ? active : inactive} onClick={() => reset("responsaveis", setType, setRows, setHeaders)}>Responsáveis</button></div>
    </div>
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="mb-3 text-sm font-bold text-slate-600">{instructions(type)}</p>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 p-6 font-black text-[#176b5b]"><FileUp size={20}/> Selecionar planilha .xlsx<input className="hidden" type="file" accept=".xlsx" onChange={event => { const file = event.target.files?.[0]; if (file) void read(file); }}/></label>
      {fileName ? <p className="mt-2 text-xs text-slate-500">{fileName}</p> : null}
      {message ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
      {rows.length ? <>
        <div className={`mt-4 rounded-xl p-3 text-sm ${errors.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}><b>{rows.length} linha(s).</b>{errors.slice(0, 8).map(item => <p key={item}>• {item}</p>)}</div>
        <div className="mt-4 overflow-x-auto rounded-xl border"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50"><tr>{Object.keys(mapped[0] || {}).map(key => <th className="p-2" key={key}>{key}</th>)}</tr></thead><tbody>{mapped.slice(0, 8).map((row, index) => <tr className="border-t" key={index}>{Object.values(row).map((value, cellIndex) => <td className="p-2" key={cellIndex}>{value}</td>)}</tr>)}</tbody></table></div>
        <button type="button" className={`${primary} mt-4`} disabled={working || !!errors.length} onClick={() => void execute()}>{working ? <LoaderCircle className="animate-spin" size={17}/> : <Upload size={17}/>} Importar registros</button>
      </> : null}
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><CheckCircle2 className="text-[#176b5b]" size={20}/><p className="mt-3 text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></article>;
}

function mapRow(type: ImportType, row: Record<string, string>, headers: string[]): NormalizedImportRow {
  const get = (terms: string[]) => {
    const header = headers.find(item => terms.some(term => norm(item) === norm(term) || norm(item).includes(norm(term))));
    return header ? row[header]?.trim() || "" : "";
  };
  const base: NormalizedImportRow = { nome: "", turma: "", data_nascimento: "", email: "", perfil: "", aluno: "", parentesco: "" };
  base.nome = get(type === "alunos" ? ["nome", "aluno", "nome completo"] : type === "responsaveis" ? ["nome", "responsavel", "responsável", "nome completo"] : ["nome", "nome completo"]);
  if (type === "alunos") {
    base.turma = get(["turma", "classe", "serie", "série"]);
    base.data_nascimento = get(["data nascimento", "nascimento", "data_nascimento"]);
  } else {
    base.email = get(["email", "e-mail"]);
    if (type === "equipe") base.perfil = get(["perfil", "papel", "cargo", "função", "funcao"]);
    else {
      base.aluno = get(["aluno", "filho", "estudante"]);
      base.parentesco = get(["parentesco", "vinculo", "vínculo"]);
    }
  }
  return base;
}

function validate(type: ImportType, row: NormalizedImportRow, classes: ClassRow[], students: Student[]) {
  const errors: string[] = [];
  if (!row.nome) errors.push("nome obrigatório");
  if (type === "alunos") {
    if (row.turma && !classes.some(item => norm(item.nome) === norm(row.turma))) errors.push(`turma “${row.turma}” não encontrada`);
  } else {
    if (!row.email || !row.email.includes("@")) errors.push("e-mail inválido");
    if (type === "equipe" && !normalizeRole(row.perfil)) errors.push("perfil deve ser Professor ou Coordenação");
    if (type === "responsaveis" && row.aluno && !students.some(item => norm(item.nome) === norm(row.aluno))) errors.push(`aluno “${row.aluno}” não encontrado`);
  }
  return errors;
}

function normalizeRole(value: string) { const normalized = norm(value); if (normalized.includes("prof")) return "professor"; if (normalized.includes("coord")) return "coordenacao"; return ""; }
function norm(value: string) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function instructions(type: ImportType) { if (type === "alunos") return "Colunas recomendadas: NOME, TURMA, DATA_NASCIMENTO (opcional)."; if (type === "equipe") return "Colunas recomendadas: NOME, EMAIL, PERFIL (Professor ou Coordenação)."; return "Colunas recomendadas: NOME, EMAIL, ALUNO e PARENTESCO. Se ALUNO for informado, o convite fica associado a ele."; }
function reset(type: ImportType, setType: (value: ImportType) => void, setRows: (value: Record<string, string>[]) => void, setHeaders: (value: string[]) => void) { setType(type); setRows([]); setHeaders([]); }
