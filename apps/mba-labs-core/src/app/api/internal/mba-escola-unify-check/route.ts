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
  const admin = createSupabaseAdminClient() as any;
  const result: Record<string, { exists: boolean; count?: number; code?: string }> = {};

  for (const table of TABLES) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    result[table] = error
      ? { exists: false, code: error.code ?? "QUERY_ERROR" }
      : { exists: true, count: count ?? 0 };
  }

  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  const bucket = bucketError
    ? { exists: false, code: bucketError.name ?? "BUCKET_QUERY_ERROR" }
    : { exists: (buckets ?? []).some((item: { name: string }) => item.name === "mba-escola-documentos") };

  const helper = await admin.rpc("escola_is_super_admin");
  const helperExists = !helper.error || helper.error.code !== "PGRST202";

  return NextResponse.json(
    {
      result,
      bucket,
      helper: { exists: helperExists, code: helper.error?.code ?? null },
      environment: {
        databaseUrl: Boolean(process.env.DATABASE_URL),
        postgresUrl: Boolean(process.env.POSTGRES_URL),
        postgresPrismaUrl: Boolean(process.env.POSTGRES_PRISMA_URL),
        supabaseDbPassword: Boolean(process.env.SUPABASE_DB_PASSWORD),
        supabaseAccessToken: Boolean(process.env.SUPABASE_ACCESS_TOKEN)
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
