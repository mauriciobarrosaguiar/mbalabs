"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  FileUp,
  LoaderCircle,
  Paperclip,
  RefreshCw,
  Save,
  School,
  ShieldAlert,
  UsersRound,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type Props = {
  supabase: SupabaseClient;
  profile: { nome: string; papel: Role; escola_id: string };
};

type ClassRow = { id: string; nome: string; ano_letivo: number; turno: string | null };
type Teacher = { id: string; nome: string };
type Subject = { id: string; nome: string };
type Student = { id: string; nome: string; turma_id: string | null; turma?: { nome: string } | null };
type Schedule = {
  id: string;
  turma_id: string;
  professor_id: string;
  disciplina_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  sala: string | null;
  ano_letivo: number;
  turma?: { nome: string } | null;
  professor?: { nome: string } | null;
  disciplina?: { nome: string } | null;
};
type Attendance = {
  id: string;
  grade_id: string;
  turma_id: string;
  aluno_id: string;
  data_aula: string;
  status: "presente" | "falta" | "atrasado" | "saida_antecipada";
  observacao: string | null;
  aluno?: { nome: string } | null;
};
type Justification = {
  id: string;
  frequencia_id: string;
  aluno_id: string;
  responsavel_id: string;
  motivo: string;
  descricao: string | null;
  status: "pendente" | "aprovada" | "recusada" | "correcao_solicitada";
  observacao_analise: string | null;
  criado_em: string;
  aluno?: { nome: string } | null;
};
type JustFile = {
  id: string;
  justificativa_id: string;
  aluno_id: string;
  storage_path: string;
  nome_arquivo: string;
  mime_type: string | null;
};
type Incident = {
  id: string;
  grade_id: string | null;
  turma_id: string;
  tipo: string;
  data_evento: string;
  novo_horario_saida: string | null;
  motivo: string | null;
  criado_em: string;
};
type ImportRow = {
  professor: string;
  turma: string;
  disciplina: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  sala: string;
  sourceRow: number;
};
type MappingKey = "professor" | "turma" | "disciplina" | "dia" | "inicio" | "fim" | "sala";
type Mapping = Record<MappingKey, string>;

type Tab = "grade" | "frequencia" | "avisos" | "justificativas" | "faltas";

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50";

const dayNames = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function AcademicOperations({ supabase, profile }: Props) {
  const manager = ["admin_escola", "direcao", "coordenacao"].includes(profile.papel);
  const teacher = profile.papel === "professor";
  const guardian = profile.papel === "responsavel";
  const [tab, setTab] = useState<Tab>(guardian ? "faltas" : "grade");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [justFiles, setJustFiles] = useState<JustFile[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceGrade, setAttendanceGrade] = useState("");
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: Attendance["status"]; observacao: string }>>({});

  const [manual, setManual] = useState({ professor: "", turma: "", disciplina: "", dia: "1", inicio: "07:00", fim: "07:50", sala: "", ano: String(new Date().getFullYear()) });
  const [incident, setIncident] = useState({ grade_id: "", data: new Date().toISOString().slice(0, 10), tipo: "saida_antecipada", horario: "", motivo: "" });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ professor: "", turma: "", disciplina: "", dia: "", inicio: "", fim: "", sala: "" });
  const [importYear, setImportYear] = useState(String(new Date().getFullYear()));
  const [fileName, setFileName] = useState("");

  const [justifyAttendanceId, setJustifyAttendanceId] = useState("");
  const [justifyReason, setJustifyReason] = useState("Doença");
  const [justifyDescription, setJustifyDescription] = useState("");
  const [justifyFile, setJustifyFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || "";
    setUserId(uid);

    const requests = await Promise.all([
      supabase.from("escola_turmas").select("id,nome,ano_letivo,turno").eq("ativa", true).order("nome"),
      supabase.from("escola_perfis").select("id,nome").eq("papel", "professor").eq("ativo", true).order("nome"),
      supabase.from("escola_disciplinas").select("id,nome").eq("ativa", true).order("nome"),
      supabase.from("escola_alunos").select("id,nome,turma_id,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
      supabase.from("escola_grade_horarios").select("id,turma_id,professor_id,disciplina_id,dia_semana,hora_inicio,hora_fim,sala,ano_letivo,turma:escola_turmas(nome),professor:escola_perfis!escola_grade_horarios_professor_id_fkey(nome),disciplina:escola_disciplinas(nome)").eq("ativo", true).order("dia_semana").order("hora_inicio"),
      supabase.from("escola_frequencias").select("id,grade_id,turma_id,aluno_id,data_aula,status,observacao,aluno:escola_alunos(nome)").order("data_aula", { ascending: false }).limit(500),
      supabase.from("escola_justificativas_falta").select("id,frequencia_id,aluno_id,responsavel_id,motivo,descricao,status,observacao_analise,criado_em,aluno:escola_alunos(nome)").order("criado_em", { ascending: false }).limit(200),
      supabase.from("escola_justificativa_arquivos").select("id,justificativa_id,aluno_id,storage_path,nome_arquivo,mime_type").order("criado_em", { ascending: false }).limit(200),
      supabase.from("escola_intercorrencias_grade").select("id,grade_id,turma_id,tipo,data_evento,novo_horario_saida,motivo,criado_em").order("criado_em", { ascending: false }).limit(100)
    ]);

    const firstError = requests.find((item) => item.error)?.error;
    if (firstError) setError(firstError.message);

    setClasses((requests[0].data ?? []) as ClassRow[]);
    setTeachers((requests[1].data ?? []) as Teacher[]);
    setSubjects((requests[2].data ?? []) as Subject[]);
    setStudents((requests[3].data ?? []) as unknown as Student[]);
    setSchedule((requests[4].data ?? []) as unknown as Schedule[]);
    setAttendance((requests[5].data ?? []) as unknown as Attendance[]);
    setJustifications((requests[6].data ?? []) as unknown as Justification[]);
    setJustFiles((requests[7].data ?? []) as JustFile[]);
    setIncidents((requests[8].data ?? []) as Incident[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!attendanceGrade && schedule[0]) setAttendanceGrade(schedule[0].id);
    if (!incident.grade_id && schedule[0]) setIncident((v) => ({ ...v, grade_id: schedule[0].id }));
    if (!manual.professor && teachers[0]) setManual((v) => ({ ...v, professor: teachers[0].nome }));
    if (!manual.turma && classes[0]) setManual((v) => ({ ...v, turma: classes[0].nome, ano: String(classes[0].ano_letivo) }));
  }, [schedule, teachers, classes, attendanceGrade, incident.grade_id, manual.professor, manual.turma]);

  const activeSchedule = useMemo(() => schedule.find((item) => item.id === attendanceGrade), [schedule, attendanceGrade]);
  const attendanceStudents = useMemo(() => students.filter((student) => student.turma_id === activeSchedule?.turma_id), [students, activeSchedule]);

  useEffect(() => {
    if (!activeSchedule) return;
    const map: Record<string, { status: Attendance["status"]; observacao: string }> = {};
    for (const student of attendanceStudents) {
      const current = attendance.find((item) => item.grade_id === activeSchedule.id && item.aluno_id === student.id && item.data_aula === attendanceDate);
      map[student.id] = { status: current?.status || "presente", observacao: current?.observacao || "" };
    }
    setAttendanceMap(map);
  }, [activeSchedule, attendanceStudents, attendance, attendanceDate]);

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

  async function saveManualSchedule(event: React.FormEvent) {
    event.preventDefault();
    const row = [{ professor: manual.professor, turma: manual.turma, disciplina: manual.disciplina, dia_semana: Number(manual.dia), hora_inicio: manual.inicio, hora_fim: manual.fim, sala: manual.sala }];
    await mutate(() => supabase.rpc("escola_school_import_schedule", { p_rows: row, p_ano_letivo: Number(manual.ano) }), "Horário criado e professor vinculado à turma.");
    setManual((v) => ({ ...v, disciplina: "", sala: "" }));
  }

  async function saveAttendance() {
    if (!activeSchedule) return;
    const items = attendanceStudents.map((student) => ({ aluno_id: student.id, status: attendanceMap[student.id]?.status || "presente", observacao: attendanceMap[student.id]?.observacao || "" }));
    await mutate(() => supabase.rpc("escola_save_attendance", { p_grade_id: activeSchedule.id, p_data: attendanceDate, p_items: items }), "Chamada registrada com sucesso.");
  }

  async function publishPriorityNotice(event: React.FormEvent) {
    event.preventDefault();
    await mutate(() => supabase.rpc("escola_create_priority_schedule_notice", {
      p_grade_id: incident.grade_id,
      p_data: incident.data,
      p_tipo: incident.tipo,
      p_motivo: incident.motivo || null,
      p_novo_horario_saida: incident.horario || null,
      p_substituto_id: null
    }), "Aviso urgente publicado para os responsáveis da turma e marcado para confirmação de ciência.");
    setIncident((v) => ({ ...v, motivo: "", horario: "" }));
  }

  async function reviewJustification(id: string, status: "aprovada" | "recusada" | "correcao_solicitada") {
    await mutate(() => supabase.rpc("escola_review_absence_justification", { p_justificativa_id: id, p_status: status, p_observacao: reviewNotes[id] || null }), "Análise da justificativa atualizada.");
  }

  async function submitJustification(event: React.FormEvent) {
    event.preventDefault();
    const att = attendance.find((item) => item.id === justifyAttendanceId);
    if (!att) return;
    setWorking(true);
    setError("");
    setMessage("");

    const { data: justId, error: rpcError } = await supabase.rpc("escola_guardian_submit_absence_justification", {
      p_frequencia_id: att.id,
      p_motivo: justifyReason,
      p_descricao: justifyDescription || null
    });
    if (rpcError || !justId) {
      setError(rpcError?.message || "Não foi possível criar a justificativa.");
      setWorking(false);
      return;
    }

    if (justifyFile) {
      const safeName = justifyFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `${profile.escola_id}/${att.aluno_id}/${justId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("mba-escola-documentos").upload(storagePath, justifyFile, { upsert: false, contentType: justifyFile.type || undefined });
      if (uploadError) {
        setError(`Justificativa criada, mas o documento não foi anexado: ${uploadError.message}`);
        setWorking(false);
        await load();
        return;
      }
      const { error: metaError } = await supabase.from("escola_justificativa_arquivos").insert({
        justificativa_id: justId,
        escola_id: profile.escola_id,
        aluno_id: att.aluno_id,
        responsavel_id: userId,
        storage_path: storagePath,
        nome_arquivo: justifyFile.name,
        mime_type: justifyFile.type || null,
        tamanho: justifyFile.size
      });
      if (metaError) {
        await supabase.storage.from("mba-escola-documentos").remove([storagePath]);
        setError(`Justificativa criada, mas não foi possível registrar o anexo: ${metaError.message}`);
        setWorking(false);
        await load();
        return;
      }
    }

    setMessage("Justificativa enviada para análise da escola.");
    setJustifyAttendanceId("");
    setJustifyDescription("");
    setJustifyFile(null);
    await load();
    setWorking(false);
  }

  async function openFile(file: JustFile) {
    const { data, error: signedError } = await supabase.storage.from("mba-escola-documentos").createSignedUrl(file.storage_path, 120);
    if (signedError || !data?.signedUrl) {
      setError(signedError?.message || "Não foi possível abrir o documento.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function readExcel(file: File) {
    setError("");
    setMessage("");
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Use uma planilha no formato .xlsx. O mapeamento é feito antes da importação.");
      return;
    }
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer as never);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("A planilha não possui abas.");
      const detectedHeaders: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
        const text = String(cell.text || cell.value || "").trim();
        if (text) detectedHeaders.push(text);
      });
      if (!detectedHeaders.length) throw new Error("Não encontrei cabeçalhos na primeira linha.");

      const rows: Record<string, string>[] = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const item: Record<string, string> = { __row: String(rowNumber) };
        let hasValue = false;
        detectedHeaders.forEach((header, index) => {
          const value = String(row.getCell(index + 1).text || "").trim();
          item[header] = value;
          if (value) hasValue = true;
        });
        if (hasValue) rows.push(item);
      }
      setHeaders(detectedHeaders);
      setRawRows(rows);
      setMapping(autoMap(detectedHeaders));
      setMessage(`${rows.length} linhas encontradas. Confira o mapeamento antes de importar.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler a planilha.");
    }
  }

  const importPreview = useMemo(() => buildImportPreview(rawRows, mapping, teachers, classes), [rawRows, mapping, teachers, classes]);

  async function importSchedule() {
    if (importPreview.errors.length || !importPreview.rows.length) return;
    await mutate(() => supabase.rpc("escola_school_import_schedule", {
      p_rows: importPreview.rows.map(({ sourceRow: _sourceRow, ...row }) => row),
      p_ano_letivo: Number(importYear)
    }), `${importPreview.rows.length} horários importados. Disciplinas e vínculos foram criados automaticamente quando necessário.`);
    setHeaders([]);
    setRawRows([]);
    setFileName("");
  }

  const tabs = guardian
    ? [{ id: "faltas" as const, label: "Faltas e justificativas" }]
    : teacher
      ? [{ id: "grade" as const, label: "Minha grade" }, { id: "frequencia" as const, label: "Chamada" }]
      : [
          { id: "grade" as const, label: "Grade e professores" },
          { id: "frequencia" as const, label: "Frequência" },
          { id: "avisos" as const, label: "Avisos prioritários" },
          { id: "justificativas" as const, label: "Justificativas" }
        ];

  if (loading) return <section className="grid min-h-52 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={32} /></section>;

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Rotina escolar</p>
            <h2 className="mt-1 text-2xl font-black">Grade, frequência e ocorrências do dia</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Estrutura funcional; o redesign geral ficará para a etapa de interface.</p>
          </div>
          <button className={secondary} onClick={() => void load()} disabled={working} type="button"><RefreshCw size={16} /> Atualizar</button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {tabs.map((item) => <button key={item.id} className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab === item.id ? "bg-[#176b5b] text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}
      </nav>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}

      {tab === "grade" ? <GradeTab manager={manager} schedule={schedule} teachers={teachers} classes={classes} subjects={subjects} manual={manual} setManual={setManual} saveManualSchedule={saveManualSchedule} working={working} headers={headers} mapping={mapping} setMapping={setMapping} fileName={fileName} readExcel={readExcel} importYear={importYear} setImportYear={setImportYear} preview={importPreview} importSchedule={importSchedule} /> : null}
      {tab === "frequencia" ? <AttendanceTab schedule={schedule} gradeId={attendanceGrade} setGradeId={setAttendanceGrade} date={attendanceDate} setDate={setAttendanceDate} students={attendanceStudents} attendanceMap={attendanceMap} setAttendanceMap={setAttendanceMap} save={saveAttendance} working={working} /> : null}
      {tab === "avisos" && manager ? <PriorityTab schedule={schedule} incident={incident} setIncident={setIncident} save={publishPriorityNotice} working={working} incidents={incidents} /> : null}
      {tab === "justificativas" && manager ? <JustificationReview justifications={justifications} files={justFiles} notes={reviewNotes} setNotes={setReviewNotes} review={reviewJustification} openFile={openFile} working={working} attendance={attendance} /> : null}
      {tab === "faltas" && guardian ? <GuardianAbsences attendance={attendance} justifications={justifications} files={justFiles} activeId={justifyAttendanceId} setActiveId={setJustifyAttendanceId} reason={justifyReason} setReason={setJustifyReason} description={justifyDescription} setDescription={setJustifyDescription} file={justifyFile} setFile={setJustifyFile} submit={submitJustification} openFile={openFile} working={working} /> : null}
    </section>
  );
}

function GradeTab({ manager, schedule, teachers, classes, subjects, manual, setManual, saveManualSchedule, working, headers, mapping, setMapping, fileName, readExcel, importYear, setImportYear, preview, importSchedule }: any) {
  return <div className="grid gap-5">
    {manager ? <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Importar grade do Excel" icon={FileSpreadsheet}>
        <div className="grid gap-4">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <label className="flex cursor-pointer items-center justify-center gap-2 font-black text-[#176b5b]"><FileUp size={20} /> Selecionar planilha .xlsx<input className="hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readExcel(file); }} /></label>
            {fileName ? <p className="mt-2 text-center text-xs font-bold text-slate-500">{fileName}</p> : null}
          </div>
          {headers.length ? <>
            <p className="text-sm font-bold text-slate-600">Confirme quais colunas correspondem aos campos do MBA Escola. Professor, turma, disciplina, dia e horários são obrigatórios.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <MapSelect label="Professor" value={mapping.professor} headers={headers} set={(v: string) => setMapping((x: Mapping) => ({ ...x, professor: v }))} />
              <MapSelect label="Turma" value={mapping.turma} headers={headers} set={(v: string) => setMapping((x: Mapping) => ({ ...x, turma: v }))} />
              <MapSelect label="Disciplina" value={mapping.disciplina} headers={headers} set={(v: string) => setMapping((x: Mapping) => ({ ...x, disciplina: v }))} />
              <MapSelect label="Dia da semana" value={mapping.dia} headers={headers} set={(v: string) => setMapping((x: Mapping) => ({ ...x, dia: v }))} />
              <MapSelect label="Início" value={mapping.inicio} headers={headers} set={(v: string) => setMapping((x: Mapping) => ({ ...x, inicio: v }))} />
              <MapSelect label="Fim" value={mapping.fim} headers={headers} set={(v: string) => setMapping((x: Mapping) => ({ ...x, fim: v }))} />
              <MapSelect label="Sala (opcional)" value={mapping.sala} headers={headers} optional set={(v: string) => setMapping((x: Mapping) => ({ ...x, sala: v }))} />
              <label className="grid gap-1 text-sm font-bold text-slate-600">Ano letivo<input className={field} type="number" min="2020" max="2100" value={importYear} onChange={(e) => setImportYear(e.target.value)} /></label>
            </div>
            <div className={`rounded-2xl border p-4 ${preview.errors.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <p className="font-black">Pré-validação: {preview.rows.length} linhas prontas</p>
              {preview.errors.length ? <div className="mt-2 grid gap-1 text-sm text-amber-900">{preview.errors.slice(0, 8).map((item: string) => <p key={item}>• {item}</p>)}{preview.errors.length > 8 ? <p>• + {preview.errors.length - 8} outros problemas</p> : null}</div> : <p className="mt-1 text-sm text-emerald-800">Professores e turmas foram reconhecidos. Disciplinas novas serão criadas automaticamente.</p>}
            </div>
            {preview.rows.length ? <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-2">Professor</th><th className="p-2">Turma</th><th className="p-2">Disciplina</th><th className="p-2">Dia</th><th className="p-2">Horário</th></tr></thead><tbody>{preview.rows.slice(0, 8).map((row: ImportRow) => <tr className="border-t border-slate-100" key={row.sourceRow}><td className="p-2">{row.professor}</td><td className="p-2">{row.turma}</td><td className="p-2">{row.disciplina}</td><td className="p-2">{dayNames[row.dia_semana]}</td><td className="p-2">{row.hora_inicio}–{row.hora_fim}</td></tr>)}</tbody></table></div> : null}
            <button className={primary} disabled={working || !!preview.errors.length || !preview.rows.length} onClick={() => void importSchedule()} type="button"><FileSpreadsheet size={17} /> Importar grade organizada</button>
          </> : null}
        </div>
      </Card>

      <Card title="Adicionar horário pelo sistema" icon={CalendarClock}>
        <form className="grid gap-3" onSubmit={saveManualSchedule}>
          <select className={field} value={manual.professor} onChange={(e) => setManual((x: any) => ({ ...x, professor: e.target.value }))} required>{teachers.map((item: Teacher) => <option key={item.id} value={item.nome}>{item.nome}</option>)}</select>
          <select className={field} value={manual.turma} onChange={(e) => { const c = classes.find((item: ClassRow) => item.nome === e.target.value); setManual((x: any) => ({ ...x, turma: e.target.value, ano: c ? String(c.ano_letivo) : x.ano })); }} required>{classes.map((item: ClassRow) => <option key={item.id} value={item.nome}>{item.nome}</option>)}</select>
          <input className={field} list="mba-escola-subjects" placeholder="Disciplina" value={manual.disciplina} onChange={(e) => setManual((x: any) => ({ ...x, disciplina: e.target.value }))} required />
          <datalist id="mba-escola-subjects">{subjects.map((item: Subject) => <option key={item.id} value={item.nome} />)}</datalist>
          <div className="grid gap-3 sm:grid-cols-2"><select className={field} value={manual.dia} onChange={(e) => setManual((x: any) => ({ ...x, dia: e.target.value }))}>{dayNames.slice(1).map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select><input className={field} type="number" min="2020" max="2100" value={manual.ano} onChange={(e) => setManual((x: any) => ({ ...x, ano: e.target.value }))} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-500">Início<input className={field} type="time" value={manual.inicio} onChange={(e) => setManual((x: any) => ({ ...x, inicio: e.target.value }))} required /></label><label className="grid gap-1 text-xs font-bold text-slate-500">Fim<input className={field} type="time" value={manual.fim} onChange={(e) => setManual((x: any) => ({ ...x, fim: e.target.value }))} required /></label></div>
          <input className={field} placeholder="Sala (opcional)" value={manual.sala} onChange={(e) => setManual((x: any) => ({ ...x, sala: e.target.value }))} />
          <button className={primary} disabled={working}><Save size={17} /> Salvar horário e liberar acesso</button>
        </form>
      </Card>
    </div> : null}

    <Card title={manager ? "Grade atual" : "Minha grade"} icon={School}>
      {!schedule.length ? <Empty text={manager ? "Nenhum horário cadastrado ainda." : "Você ainda não possui horários vinculados."} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{schedule.map((item: Schedule) => <article className="rounded-2xl border border-slate-200 p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{item.disciplina?.nome || "Disciplina"}</p><p className="text-sm font-bold text-[#176b5b]">{item.turma?.nome || "Turma"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black">{dayNames[item.dia_semana]}</span></div><p className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600"><Clock3 size={15} /> {shortTime(item.hora_inicio)}–{shortTime(item.hora_fim)}</p><p className="mt-1 text-sm text-slate-500">{item.professor?.nome || "Professor"}{item.sala ? ` · ${item.sala}` : ""}</p></article>)}</div>}
    </Card>
  </div>;
}

function AttendanceTab({ schedule, gradeId, setGradeId, date, setDate, students, attendanceMap, setAttendanceMap, save, working }: any) {
  const selected = schedule.find((item: Schedule) => item.id === gradeId);
  return <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
    <Card title="Selecionar aula" icon={CalendarClock}><div className="grid gap-3"><select className={field} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>{schedule.map((item: Schedule) => <option key={item.id} value={item.id}>{dayNames[item.dia_semana]} · {shortTime(item.hora_inicio)} · {item.turma?.nome} · {item.disciplina?.nome}</option>)}</select><input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />{selected ? <div className="rounded-2xl bg-slate-50 p-4 text-sm"><p className="font-black">{selected.turma?.nome}</p><p className="mt-1 text-slate-600">{selected.disciplina?.nome} · {selected.professor?.nome}</p></div> : null}</div></Card>
    <Card title="Chamada" icon={UsersRound}>{!selected ? <Empty text="Cadastre a grade antes de fazer a chamada." /> : !students.length ? <Empty text="Nenhum aluno ativo nessa turma." /> : <div className="grid gap-3">{students.map((student: Student) => { const current = attendanceMap[student.id] || { status: "presente", observacao: "" }; return <article className="rounded-2xl border border-slate-200 p-3" key={student.id}><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><p className="font-black">{student.nome}</p><select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold" value={current.status} onChange={(e) => setAttendanceMap((map: any) => ({ ...map, [student.id]: { ...current, status: e.target.value } }))}><option value="presente">Presente</option><option value="falta">Faltou</option><option value="atrasado">Atrasado</option><option value="saida_antecipada">Saiu antecipadamente</option></select></div><input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Observação opcional" value={current.observacao} onChange={(e) => setAttendanceMap((map: any) => ({ ...map, [student.id]: { ...current, observacao: e.target.value } }))} /></article>; })}<button className={primary} onClick={() => void save()} disabled={working}><Save size={17} /> Salvar chamada</button></div>}</Card>
  </div>;
}

function PriorityTab({ schedule, incident, setIncident, save, working, incidents }: any) {
  return <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
    <Card title="Enviar aviso prioritário" icon={ShieldAlert}><form className="grid gap-3" onSubmit={save}><select className={field} value={incident.grade_id} onChange={(e) => setIncident((x: any) => ({ ...x, grade_id: e.target.value }))}>{schedule.map((item: Schedule) => <option key={item.id} value={item.id}>{item.turma?.nome} · {item.disciplina?.nome} · {dayNames[item.dia_semana]} {shortTime(item.hora_inicio)}</option>)}</select><select className={field} value={incident.tipo} onChange={(e) => setIncident((x: any) => ({ ...x, tipo: e.target.value }))}><option value="saida_antecipada">Saída antecipada</option><option value="professor_ausente">Professor ausente</option><option value="aula_cancelada">Aula cancelada</option><option value="substituicao">Professor substituto</option></select><input className={field} type="date" value={incident.data} onChange={(e) => setIncident((x: any) => ({ ...x, data: e.target.value }))} required /><label className="grid gap-1 text-sm font-bold text-slate-600">Novo horário de saída, quando houver<input className={field} type="time" value={incident.horario} onChange={(e) => setIncident((x: any) => ({ ...x, horario: e.target.value }))} /></label><textarea className={area} placeholder="Motivo / orientação aos responsáveis" value={incident.motivo} onChange={(e) => setIncident((x: any) => ({ ...x, motivo: e.target.value }))} /><div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"><BellRing className="mr-2 inline" size={17} />O comunicado será publicado como URGENTE e exigirá “Li e estou ciente”.</div><button className={primary} disabled={working || !incident.grade_id}><BellRing size={17} /> Publicar aviso prioritário</button></form></Card>
    <Card title="Ocorrências recentes da grade" icon={AlertTriangle}>{!incidents.length ? <Empty text="Nenhuma intercorrência de horário registrada." /> : <div className="grid gap-3">{incidents.map((item: Incident) => <article className="rounded-2xl border border-slate-200 p-4" key={item.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-black">{incidentLabel(item.tipo)}</p><span className="text-xs font-bold text-slate-500">{formatDate(item.data_evento)}</span></div>{item.novo_horario_saida ? <p className="mt-2 text-sm font-bold text-rose-700">Saída: {shortTime(item.novo_horario_saida)}</p> : null}{item.motivo ? <p className="mt-2 text-sm text-slate-600">{item.motivo}</p> : null}</article>)}</div>}</Card>
  </div>;
}

function JustificationReview({ justifications, files, notes, setNotes, review, openFile, working, attendance }: any) {
  return <Card title="Justificativas de ausência" icon={CheckCircle2}>{!justifications.length ? <Empty text="Nenhuma justificativa enviada." /> : <div className="grid gap-4">{justifications.map((item: Justification) => { const att = attendance.find((a: Attendance) => a.id === item.frequencia_id); const docs = files.filter((f: JustFile) => f.justificativa_id === item.id); return <article className="rounded-2xl border border-slate-200 p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{item.aluno?.nome || "Aluno"}</p><p className="mt-1 text-sm text-slate-500">Falta em {formatDate(att?.data_aula)} · Motivo: {item.motivo}</p></div><StatusBadge status={item.status} /></div>{item.descricao ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.descricao}</p> : null}{docs.length ? <div className="mt-3 flex flex-wrap gap-2">{docs.map((file: JustFile) => <button className={secondary} key={file.id} onClick={() => void openFile(file)} type="button"><Paperclip size={15} /> {file.nome_arquivo}</button>)}</div> : null}{item.observacao_analise ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><b>Análise anterior:</b> {item.observacao_analise}</p> : null}{["pendente","correcao_solicitada"].includes(item.status) ? <div className="mt-4 grid gap-3"><input className={field} placeholder="Observação da escola (opcional)" value={notes[item.id] || ""} onChange={(e) => setNotes((x: any) => ({ ...x, [item.id]: e.target.value }))} /><div className="flex flex-wrap gap-2"><button className={secondary} disabled={working} onClick={() => void review(item.id, "aprovada")} type="button"><CheckCircle2 size={16} /> Aprovar</button><button className={secondary} disabled={working} onClick={() => void review(item.id, "correcao_solicitada")} type="button"><AlertTriangle size={16} /> Pedir correção</button><button className={secondary} disabled={working} onClick={() => void review(item.id, "recusada")} type="button"><XCircle size={16} /> Recusar</button></div></div> : null}</article>; })}</div>}</Card>;
}

function GuardianAbsences({ attendance, justifications, files, activeId, setActiveId, reason, setReason, description, setDescription, file, setFile, submit, openFile, working }: any) {
  const absences = attendance.filter((item: Attendance) => item.status === "falta");
  return <Card title="Faltas e justificativas" icon={AlertTriangle}>{!absences.length ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800"><CheckCircle2 className="mb-2" size={24} /><p className="font-black">Nenhuma falta registrada para seus filhos.</p></div> : <div className="grid gap-4">{absences.map((att: Attendance) => { const just = justifications.find((item: Justification) => item.frequencia_id === att.id); const docs = just ? files.filter((f: JustFile) => f.justificativa_id === just.id) : []; const canSubmit = !just || ["recusada","correcao_solicitada"].includes(just.status); return <article className="rounded-2xl border border-slate-200 p-4" key={att.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{att.aluno?.nome || "Aluno"}</p><p className="mt-1 text-sm text-slate-500">Ausência em {formatDate(att.data_aula)}</p></div>{just ? <StatusBadge status={just.status} /> : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Aguardando justificativa</span>}</div>{just ? <div className="mt-3 text-sm text-slate-600"><p><b>Motivo:</b> {just.motivo}</p>{just.descricao ? <p className="mt-1">{just.descricao}</p> : null}{just.observacao_analise ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-900"><b>Retorno da escola:</b> {just.observacao_analise}</p> : null}{docs.length ? <div className="mt-3 flex flex-wrap gap-2">{docs.map((doc: JustFile) => <button className={secondary} key={doc.id} onClick={() => void openFile(doc)} type="button"><Paperclip size={15} /> {doc.nome_arquivo}</button>)}</div> : null}</div> : null}{canSubmit ? activeId === att.id ? <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4" onSubmit={submit}><select className={field} value={reason} onChange={(e) => setReason(e.target.value)}><option>Doença</option><option>Consulta médica</option><option>Problema familiar</option><option>Transporte</option><option>Viagem</option><option>Outro</option></select><textarea className={area} placeholder="Explique a ausência (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} /><label className="grid gap-2 rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-bold text-slate-700"><span className="flex items-center gap-2"><Paperclip size={17} /> Atestado ou comprovante (PDF/JPG/PNG, até 10 MB)</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />{file ? <span className="text-xs text-slate-500">{file.name}</span> : null}</label><div className="flex flex-wrap gap-2"><button className={primary} disabled={working}><Save size={17} /> Enviar justificativa</button><button className={secondary} onClick={() => setActiveId("")} type="button">Cancelar</button></div></form> : <button className={`${primary} mt-4`} onClick={() => setActiveId(att.id)} type="button">Justificar ausência</button> : null}</article>; })}</div>}</Card>;
}

function MapSelect({ label, value, headers, set, optional = false }: any) {
  return <label className="grid gap-1 text-sm font-bold text-slate-600">{label}<select className={field} value={value} onChange={(e) => set(e.target.value)}><option value="">{optional ? "Não usar" : "Selecione a coluna"}</option>{headers.map((header: string) => <option key={header} value={header}>{header}</option>)}</select></label>;
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof School; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 flex items-center gap-2 text-lg font-black"><Icon className="text-[#176b5b]" size={21} /> {title}</h3>{children}</section>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">{text}</p>;
}

function StatusBadge({ status }: { status: Justification["status"] }) {
  const labels = { pendente: "Em análise", aprovada: "Justificada", recusada: "Recusada", correcao_solicitada: "Correção solicitada" };
  const tone = status === "aprovada" ? "bg-emerald-100 text-emerald-800" : status === "recusada" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>{labels[status]}</span>;
}

function autoMap(headers: string[]): Mapping {
  const find = (terms: string[]) => headers.find((header) => terms.some((term) => normalize(header) === normalize(term) || normalize(header).includes(normalize(term)))) || "";
  const horario = find(["horario", "horário"]);
  return {
    professor: find(["professor", "docente", "prof"]),
    turma: find(["turma", "classe", "série", "serie"]),
    disciplina: find(["disciplina", "matéria", "materia", "componente curricular", "componente"]),
    dia: find(["dia da semana", "dia_semana", "dia", "semana"]),
    inicio: find(["hora inicio", "hora início", "inicio", "início", "horario inicio", "horário inicial"]) || horario,
    fim: find(["hora fim", "fim", "horario fim", "horário final"]) || horario,
    sala: find(["sala", "local"])
  };
}

function buildImportPreview(rawRows: Record<string, string>[], mapping: Mapping, teachers: Teacher[], classes: ClassRow[]) {
  const errors: string[] = [];
  const required: Array<[MappingKey, string]> = [["professor","Professor"],["turma","Turma"],["disciplina","Disciplina"],["dia","Dia da semana"],["inicio","Horário inicial"],["fim","Horário final"]];
  for (const [key, label] of required) if (!mapping[key]) errors.push(`Mapeie a coluna “${label}”.`);
  if (errors.length) return { rows: [] as ImportRow[], errors };

  const teacherNames = new Set(teachers.map((item) => normalize(item.nome)));
  const classNames = new Set(classes.map((item) => normalize(item.nome)));
  const rows: ImportRow[] = [];
  for (const raw of rawRows) {
    const professor = raw[mapping.professor]?.trim();
    const turma = raw[mapping.turma]?.trim();
    const disciplina = raw[mapping.disciplina]?.trim();
    const dia = parseDay(raw[mapping.dia]);
    const startRaw = raw[mapping.inicio]?.trim();
    const endRaw = raw[mapping.fim]?.trim();
    let hora_inicio = parseTime(startRaw);
    let hora_fim = parseTime(endRaw);
    if (mapping.inicio === mapping.fim) {
      const range = parseTimeRange(startRaw);
      hora_inicio = range[0];
      hora_fim = range[1];
    }
    const sourceRow = Number(raw.__row || 0);
    if (!professor && !turma && !disciplina) continue;
    if (!professor || !turma || !disciplina || !dia || !hora_inicio || !hora_fim) {
      errors.push(`Linha ${sourceRow}: faltam professor, turma, disciplina, dia ou horário válido.`);
      continue;
    }
    if (!teacherNames.has(normalize(professor))) errors.push(`Linha ${sourceRow}: professor “${professor}” não está cadastrado/ativo.`);
    if (!classNames.has(normalize(turma))) errors.push(`Linha ${sourceRow}: turma “${turma}” não foi encontrada.`);
    if (hora_fim <= hora_inicio) errors.push(`Linha ${sourceRow}: horário final deve ser depois do inicial.`);
    rows.push({ professor, turma, disciplina, dia_semana: dia, hora_inicio, hora_fim, sala: mapping.sala ? raw[mapping.sala]?.trim() || "" : "", sourceRow });
  }

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i]; const b = rows[j];
      if (a.dia_semana !== b.dia_semana || !overlap(a.hora_inicio, a.hora_fim, b.hora_inicio, b.hora_fim)) continue;
      if (normalize(a.professor) === normalize(b.professor)) errors.push(`Conflito na planilha: ${a.professor} aparece em dois horários sobrepostos (${dayNames[a.dia_semana]}).`);
      if (normalize(a.turma) === normalize(b.turma)) errors.push(`Conflito na planilha: ${a.turma} possui duas aulas sobrepostas (${dayNames[a.dia_semana]}).`);
    }
  }
  return { rows, errors: Array.from(new Set(errors)) };
}

function normalize(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseDay(value: string) {
  const n = normalize(value);
  if (/^[1-7]$/.test(n)) return Number(n);
  if (n.startsWith("seg")) return 1;
  if (n.startsWith("ter")) return 2;
  if (n.startsWith("qua")) return 3;
  if (n.startsWith("qui")) return 4;
  if (n.startsWith("sex")) return 5;
  if (n.startsWith("sab")) return 6;
  if (n.startsWith("dom")) return 7;
  return 0;
}

function parseTime(value: string) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,2})[:hH](\d{2})/);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  const compact = text.match(/^(\d{1,2})(\d{2})$/);
  if (compact) return `${compact[1].padStart(2, "0")}:${compact[2]}`;
  return "";
}

function parseTimeRange(value: string): [string, string] {
  const pieces = String(value || "").split(/\s*(?:-|–|—|a|às)\s*/i).map(parseTime).filter(Boolean);
  return [pieces[0] || "", pieces[1] || ""];
}

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

function shortTime(value?: string | null) {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parts = value.slice(0, 10).split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function incidentLabel(type: string) {
  return ({ professor_ausente: "Professor ausente", saida_antecipada: "Saída antecipada", aula_cancelada: "Aula cancelada", substituicao: "Professor substituto" } as Record<string,string>)[type] || type;
}
