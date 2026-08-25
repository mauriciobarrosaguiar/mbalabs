import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const rpcTests: Array<[string, Record<string, unknown>]> = [
  ["escola_is_super_admin", {}],
  ["escola_school_dashboard", {}],
  ["escola_school_list_classes", {}],
  ["escola_school_list_profiles", {}],
  ["escola_school_list_students", {}],
  ["escola_school_list_guardians", {}],
  ["escola_school_list_invites", {}],
  ["escola_school_bulk_import", { p_tipo: "alunos", p_rows: [] }],
  ["escola_school_import_schedule", { p_rows: [], p_ano_letivo: 2026 }],
  ["escola_mark_communication", { p_comunicado_id: "00000000-0000-0000-0000-000000000000", p_confirmar: false }],
  ["escola_register_absence", { p_aluno_id: "00000000-0000-0000-0000-000000000000", p_data_aula: "2026-08-25", p_observacao: null }],
  ["escola_guardian_submit_absence_justification", { p_frequencia_id: "00000000-0000-0000-0000-000000000000", p_motivo: "teste", p_descricao: null }],
  ["escola_review_absence_justification", { p_justificativa_id: "00000000-0000-0000-0000-000000000000", p_status: "aprovada", p_observacao: null }],
  ["escola_create_priority_schedule_notice", { p_grade_id: "00000000-0000-0000-0000-000000000000", p_data: "2026-08-25", p_tipo: "aula_cancelada", p_motivo: null, p_novo_horario_saida: null, p_substituto_id: null }],
  ["escola_create_authorization", { p_destino_tipo: "alunos", p_turma_id: null, p_aluno_ids: [], p_tipo: "evento", p_titulo: "teste", p_descricao: "teste", p_local: null, p_data_evento: null, p_prazo_resposta: null, p_prioridade: "normal", p_permite_observacao: true }],
  ["escola_respond_authorization", { p_autorizacao_id: "00000000-0000-0000-0000-000000000000", p_aluno_id: "00000000-0000-0000-0000-000000000000", p_decisao: "recusada", p_observacao: null }],
  ["escola_close_authorization", { p_autorizacao_id: "00000000-0000-0000-0000-000000000000" }],
  ["escola_create_student_occurrence", { p_aluno_id: "00000000-0000-0000-0000-000000000000", p_categoria: "geral", p_prioridade: "normal", p_titulo: "teste", p_descricao: "teste", p_acao_tomada: null, p_visivel_responsavel: false, p_exige_ciencia: false }],
  ["escola_ack_student_occurrence", { p_ocorrencia_id: "00000000-0000-0000-0000-000000000000" }],
  ["escola_student_pickup_options", { p_aluno_id: "00000000-0000-0000-0000-000000000000" }],
  ["escola_register_student_pickup", { p_aluno_id: "00000000-0000-0000-0000-000000000000", p_tipo_saida: "antecipada", p_tipo_pessoa: "responsavel", p_pessoa_id: "00000000-0000-0000-0000-000000000000", p_motivo: null, p_observacao: null }],
  ["escola_create_agenda_event", { p_tipo: "evento", p_titulo: "teste", p_descricao: null, p_inicio: "2026-08-25T12:00:00Z", p_fim: null, p_local: null, p_prioridade: "normal", p_turma_id: null, p_aluno_id: null, p_visivel_responsavel: false }],
  ["escola_set_agenda_event_status", { p_evento_id: "00000000-0000-0000-0000-000000000000", p_status: "cancelado" }],
  ["escola_agenda_feed", { p_inicio: "2026-08-01T00:00:00Z", p_fim: "2026-09-01T00:00:00Z", p_aluno_id: null }],
  ["escola_student_timeline", { p_aluno_id: "00000000-0000-0000-0000-000000000000", p_limit: 1 }]
];

const columnTests: Record<string, string> = {
  escola_escolas: "id,nome,slug,status,criado_em,atualizado_em",
  escola_perfis: "id,escola_id,nome,email,telefone,papel,ativo,is_teste,criado_em,atualizado_em",
  escola_turmas: "id,escola_id,nome,ano_letivo,turno,professor_responsavel_id,ativa",
  escola_alunos: "id,escola_id,turma_id,nome,data_nascimento,ativo",
  escola_convites: "id,escola_id,nome,email,papel,aluno_id,status,expira_em,aceito_em,criado_em",
  escola_grade_horarios: "id,escola_id,turma_id,professor_id,disciplina_id,dia_semana,hora_inicio,hora_fim,sala,ano_letivo,ativo",
  escola_atividades: "id,escola_id,turma_id,professor_id,titulo,descricao,data_entrega,status,criado_em",
  escola_frequencias: "id,escola_id,grade_id,turma_id,aluno_id,data_aula,status,observacao,registrado_por",
  escola_autorizacoes: "id,escola_id,turma_id,destino_tipo,tipo,titulo,descricao,status,criado_em",
  escola_ocorrencias_aluno: "id,escola_id,aluno_id,autor_id,categoria,prioridade,titulo,descricao,visivel_responsavel,exige_ciencia,status,criado_em",
  escola_pessoas_autorizadas: "id,escola_id,aluno_id,nome,parentesco,telefone,documento,ativo",
  escola_agenda_eventos: "id,escola_id,turma_id,aluno_id,tipo,titulo,inicio,status"
};

export async function GET() {
  const admin = createSupabaseAdminClient() as any;
  const rpcs: Record<string, { exists: boolean; code: string | null }> = {};
  for (const [name, args] of rpcTests) {
    const { error } = await admin.rpc(name, args);
    rpcs[name] = { exists: error?.code !== "PGRST202", code: error?.code ?? null };
  }

  const columns: Record<string, { ok: boolean; code: string | null }> = {};
  for (const [table, select] of Object.entries(columnTests)) {
    const { error } = await admin.from(table).select(select, { head: true }).limit(1);
    columns[table] = { ok: !error, code: error?.code ?? null };
  }

  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  const bucket = !bucketError && (buckets ?? []).some((item: { name: string }) => item.name === "mba-escola-documentos");

  const executors: Record<string, { exists: boolean; code: string | null }> = {};
  for (const candidate of ["exec_sql", "execute_sql", "run_sql", "admin_exec_sql", "sql_query"]) {
    const { error } = await admin.rpc(candidate, {});
    executors[candidate] = { exists: error?.code !== "PGRST202", code: error?.code ?? null };
  }

  return NextResponse.json({ rpcs, columns, bucket, executors }, { headers: { "Cache-Control": "no-store" } });
}
