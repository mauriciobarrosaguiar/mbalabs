import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";
import {
  createDropboxTemporaryLink,
  getPortalStorageAccessToken,
  isPortalStorageProvider
} from "@/lib/portal-associativo-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const context = await getPortalContext("/portal-associativo/painel-associado");
  const arquivo = await context.client
    .from("assoc_arquivos")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", context.empresaId)
    .maybeSingle();

  if (arquivo.error || !arquivo.data?.id) {
    return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 });
  }

  const isFinancialProof = String(arquivo.data.categoria ?? "") === "comprovante" && canPortalAccess(context.perfil, "financeiro");
  if (!canPortalAccess(context.perfil, "documentos") && !isFinancialProof && !(await canCurrentUserReadFile(context, arquivo.data as Record<string, unknown>))) {
    return NextResponse.json({ error: "Seu perfil nao permite acessar este arquivo." }, { status: 403 });
  }

  const provider = text(arquivo.data.provedor);
  if (!isPortalStorageProvider(provider)) {
    if (arquivo.data.shared_url) return NextResponse.redirect(String(arquivo.data.shared_url));
    return NextResponse.json({ error: "Arquivo sem provedor conectado." }, { status: 400 });
  }

  if (provider === "dropbox") {
    const link = await createDropboxTemporaryLink(context.current, text(arquivo.data.path));
    return NextResponse.redirect(link);
  }

  if (!download && arquivo.data.shared_url) {
    return NextResponse.redirect(String(arquivo.data.shared_url));
  }

  const token = await getPortalStorageAccessToken(context.current, "google_drive");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(text(arquivo.data.file_id))}?alt=media`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    return NextResponse.json({ error: "Nao foi possivel baixar o arquivo no Google Drive." }, { status: response.status });
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "Content-Type": text(arquivo.data.mime_type) || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName(text(arquivo.data.file_name))}"`
    }
  });
}

async function canCurrentUserReadFile(context: Awaited<ReturnType<typeof getPortalContext>>, arquivo: Record<string, unknown>) {
  if (arquivo.liberado_associado !== true) return false;
  const pessoaId = context.pessoaId || await resolvePessoaIdByUsuario(context);
  if (!pessoaId) return false;
  if (String(arquivo.pessoa_id ?? "") === pessoaId) return true;

  if (arquivo.unidade_id) {
    const { data } = await context.client
      .from("assoc_vinculos_unidade_pessoa")
      .select("id")
      .eq("empresa_id", context.empresaId)
      .eq("pessoa_id", pessoaId)
      .eq("unidade_id", arquivo.unidade_id)
      .eq("status_vinculo", "ativo")
      .is("data_fim", null)
      .limit(1);
    if (Array.isArray(data) && data.length > 0) return true;
  }

  if (arquivo.cobranca_id) {
    const { data } = await context.client
      .from("assoc_cobrancas")
      .select("id,unidade_id,pessoa_responsavel_id")
      .eq("id", arquivo.cobranca_id)
      .eq("empresa_id", context.empresaId)
      .maybeSingle();
    if (String(data?.pessoa_responsavel_id ?? "") === pessoaId) return true;
    if (data?.unidade_id) {
      const vinculo = await context.client
        .from("assoc_vinculos_unidade_pessoa")
        .select("id")
        .eq("empresa_id", context.empresaId)
        .eq("pessoa_id", pessoaId)
        .eq("unidade_id", data.unidade_id)
        .eq("status_vinculo", "ativo")
        .is("data_fim", null)
        .limit(1);
      if (Array.isArray(vinculo.data) && vinculo.data.length > 0) return true;
    }
  }

  return false;
}

async function resolvePessoaIdByUsuario(context: Awaited<ReturnType<typeof getPortalContext>>) {
  const { data } = await context.client
    .from("assoc_pessoas")
    .select("id")
    .eq("empresa_id", context.empresaId)
    .eq("core_usuario_id", context.current.usuario.id)
    .maybeSingle();
  return text(data?.id);
}

function safeName(value: string) {
  return value.replace(/"/g, "").replace(/[\\/:*?<>|]+/g, "-").trim() || "arquivo";
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
