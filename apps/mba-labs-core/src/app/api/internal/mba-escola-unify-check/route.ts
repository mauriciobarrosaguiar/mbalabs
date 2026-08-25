import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLES = [
  "escola_escolas",
  "escola_perfis",
  "escola_super_admins",
  "escola_turmas",
  "escola_alunos",
  "escola_aluno_responsaveis",
  "escola_disciplinas",
  "escola_professor_alocacoes",
  "escola_grade_horarios",
  "escola_atividades",
  "escola_atividade_entregas",
  "escola_comunicados",
  "escola_comunicado_leituras",
  "escola_reunioes",
  "escola_acompanhamentos",
  "escola_frequencias",
  "escola_justificativas_falta",
  "escola_justificativa_arquivos",
  "escola_autorizacao_respostas",
  "escola_ocorrencias",
  "escola_retiradas_aluno",
  "escola_aluno_retirada_autorizados"
];

export async function GET() {
  const admin = createSupabaseAdminClient();
  const result: Record<string, { exists: boolean; count?: number; code?: string }> = {};

  for (const table of TABLES) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    result[table] = error
      ? { exists: false, code: error.code ?? "QUERY_ERROR" }
      : { exists: true, count: count ?? 0 };
  }

  return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
}
