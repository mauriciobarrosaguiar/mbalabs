import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { registrarAuditoriaLexGestor } from "@/lib/lexgestor/audit";
import { ensureLexEscritorio, getLexSupabaseClient } from "@/lib/lexgestor/data";

export const dynamic = "force-dynamic";

const allowedActions = new Set([
  "processo.abriu_tribunal",
  "processo.copiou_cnj",
  "processo.copiou_chave",
]);

export async function POST(request: Request) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/processos");
  const payload = await request.json().catch(() => ({}));
  const processoId = text(payload.processoId);
  const acao = text(payload.acao);

  if (!processoId || !allowedActions.has(acao)) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = text(escritorio?.id);
  if (!escritorioId) {
    return NextResponse.json({ error: "Configure o escritório antes de registrar ações." }, { status: 400 });
  }

  const processo = await client
    .from("lex_processos")
    .select("id")
    .eq("id", processoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (processo.error || !processo.data?.id) {
    return NextResponse.json({ error: "Processo indisponível para este escritório." }, { status: 404 });
  }

  await registrarAuditoriaLexGestor({
    current,
    acao,
    entidade: "lex_processos",
    entidadeId: processoId,
    detalhes: typeof payload.detalhes === "object" && payload.detalhes ? payload.detalhes : {},
  });

  return NextResponse.json({ ok: true });
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
