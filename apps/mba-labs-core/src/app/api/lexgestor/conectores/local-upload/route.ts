import { NextResponse } from "next/server";
import { POST as uploadDocumentos } from "@/app/api/lexgestor/documentos/upload/route";
import { requireAppAccess } from "@/lib/core-data";
import { obterUsuarioLexGestorAtual } from "@/lib/lexgestor/auth";
import { ensureLexEscritorio, getLexSupabaseClient } from "@/lib/lexgestor/data";
import { possuiPermissao } from "@/lib/lexgestor/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/conectores");
  const usuarioLex = await obterUsuarioLexGestorAtual("/lexgestor/conectores");
  if (!possuiPermissao(usuarioLex, "lex:documentos:upload")) {
    return NextResponse.json({ error: "Seu perfil não permite anexar documentos." }, { status: 403 });
  }

  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = text(escritorio?.id);
  if (!escritorioId) {
    return NextResponse.json({ error: "Configure o escritório antes de receber arquivos do conector." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("arquivo");
  const processoId = text(formData.get("processo_id"));
  const movimentacaoId = text(formData.get("movimentacao_id"));
  const clienteId = text(formData.get("cliente_id"));
  const casoId = text(formData.get("caso_id"));

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Envie o PDF baixado do tribunal." }, { status: 400 });
  }

  if (!processoId || !movimentacaoId || !clienteId || !casoId) {
    return NextResponse.json({ error: "Informe cliente, caso, processo e evento antes de enviar o arquivo." }, { status: 400 });
  }

  const processo = await client
    .from("lex_processos")
    .select("id,cliente_id,caso_id")
    .eq("id", processoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (processo.error || !processo.data?.id || text(processo.data.cliente_id) !== clienteId || text(processo.data.caso_id) !== casoId) {
    return NextResponse.json({ error: "Processo indisponível para este cliente/caso." }, { status: 403 });
  }

  const upstream = new FormData();
  upstream.append("arquivo", file);
  upstream.set("cliente_id", clienteId);
  upstream.set("caso_id", casoId);
  upstream.set("processo_id", processoId);
  upstream.set("movimentacao_id", movimentacaoId);
  upstream.set("categoria", text(formData.get("categoria")) || "Processo judicial");
  upstream.set("subcategoria", text(formData.get("subcategoria")) || "Documento do processo");
  upstream.set("tipo_documento", text(formData.get("tipo_documento")) || "Documento do processo");
  upstream.set("origem", text(formData.get("origem")) || "Tribunal/eproc");
  upstream.set("origem_sistema", text(formData.get("origem_sistema")) || "conector_local");
  upstream.set("observacoes", text(formData.get("observacoes")) || "Arquivo recebido por fluxo assistido do tribunal.");
  upstream.set("provider", text(formData.get("provider")) || "dropbox");
  if (text(formData.get("gerar_pdf")) === "sim") upstream.set("gerar_pdf", "sim");

  const uploadRequest = new Request(request.url.replace("/conectores/local-upload", "/documentos/upload"), {
    method: "POST",
    body: upstream,
  });

  return uploadDocumentos(uploadRequest);
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
