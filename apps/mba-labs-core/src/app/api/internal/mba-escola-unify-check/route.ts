import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLES = ["escola_escolas","escola_perfis","escola_super_admins","escola_turmas","escola_alunos","escola_aluno_responsaveis","escola_disciplinas","escola_professor_alocacoes","escola_grade_horarios","escola_atividades","escola_atividade_entregas","escola_comunicados","escola_comunicado_leituras","escola_reunioes","escola_acompanhamentos","escola_frequencias","escola_justificativas_falta","escola_justificativa_arquivos","escola_autorizacao_respostas","escola_ocorrencias","escola_retiradas_aluno","escola_aluno_retirada_autorizados"];

export async function GET() {
  const admin = createSupabaseAdminClient() as any;
  const result: Record<string, { exists: boolean; count?: number; code?: string }> = {};
  for (const table of TABLES) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    result[table] = error ? { exists: false, code: error.code ?? "QUERY_ERROR" } : { exists: true, count: count ?? 0 };
  }
  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  const bucket = bucketError ? { exists: false, code: bucketError.name ?? "BUCKET_QUERY_ERROR" } : { exists: (buckets ?? []).some((item: { name: string }) => item.name === "mba-escola-documentos") };
  const helper = await admin.rpc("escola_is_super_admin");
  const helperExists = !helper.error || helper.error.code !== "PGRST202";

  let openApi: Record<string, unknown> = {};
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceRole && supabaseUrl) {
    try {
      const apiResponse = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, Accept: "application/openapi+json" }, cache: "no-store" });
      const spec = (await apiResponse.json()) as { definitions?: Record<string, unknown>; paths?: Record<string, unknown> };
      const definitions = spec.definitions ?? {};
      openApi = {
        status: apiResponse.status,
        definitionKeys: Object.keys(definitions).filter((key) => key.toLowerCase().includes("escola")),
        pathKeys: Object.keys(spec.paths ?? {}).filter((key) => key.toLowerCase().includes("escola"))
      };
    } catch (error) {
      openApi = { error: error instanceof Error ? error.message : String(error) };
    }
  }
  return NextResponse.json({ result, bucket, helper: { exists: helperExists, code: helper.error?.code ?? null }, openApi }, { headers: { "Cache-Control": "no-store" } });
}
