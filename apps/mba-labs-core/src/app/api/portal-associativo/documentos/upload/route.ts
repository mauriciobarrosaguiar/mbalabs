import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext, unitOptionLabel } from "@/lib/portal-associativo-data";
import {
  buildPortalStorageFolder,
  getPortalStorageConnection,
  isPortalStorageProvider,
  uploadToPortalStorage
} from "@/lib/portal-associativo-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxFileSize = 20 * 1024 * 1024;
const allowedExtensions = new Set(["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx", "xls", "xlsx", "csv", "txt"]);
const blockedExtensions = new Set(["exe", "bat", "cmd", "com", "scr", "ps1", "sh", "js", "mjs", "vbs", "jar", "msi", "dll"]);

export async function POST(request: Request) {
  const context = await getPortalContext("/portal-associativo/documentos");
  if (!canPortalAccess(context.perfil, "documentos")) {
    return redirectDocs(request, "Seu perfil nao permite enviar documentos.");
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("arquivo").filter((file): file is File => file instanceof File && file.size > 0);
    if (files.length === 0) return redirectDocs(request, "Selecione um arquivo.");

    const providerParam = text(formData.get("provedor"));
    const connection = await getPortalStorageConnection(context.current, isPortalStorageProvider(providerParam) ? providerParam : undefined);
    if (!connection) {
      return redirectDocs(request, "Conecte o Dropbox ou Google Drive da entidade antes de enviar documentos.");
    }

    const provider = text(connection.provedor);
    if (!isPortalStorageProvider(provider)) return redirectDocs(request, "Provedor de armazenamento invalido.");

    const links = await resolveLinks(context, formData);
    const categoria = text(formData.get("categoria")) || "Documentos";
    const folderPath = await resolveFolderPath(context, links, categoria, text(connection.root_folder_path) || "/Portal Associativo");
    const liberado = text(formData.get("liberado_associado")) === "true";
    let success = 0;

    for (const file of files) {
      validateFile(file);
      const bytes = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadToPortalStorage({
        current: context.current,
        provider,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes,
        folderPath
      });
      if (!uploaded) throw new Error("Armazenamento nao conectado.");

      const saved = await context.client.from("assoc_arquivos").insert({
        empresa_id: context.empresaId,
        pessoa_id: links.pessoaId || null,
        unidade_id: links.unidadeId || null,
        cobranca_id: links.cobrancaId || null,
        reuniao_id: links.reuniaoId || null,
        projeto_id: links.projetoId || null,
        provedor: provider,
        file_id: uploaded.fileId || null,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size: file.size,
        path: uploaded.path,
        shared_url: uploaded.url || null,
        visibility: liberado ? "liberado_associado" : "interno",
        liberado_associado: liberado,
        categoria,
        descricao: text(formData.get("descricao")) || null,
        criado_por: context.current.usuario.id,
        atualizado_por: context.current.usuario.id
      }).select("id").single();

      if (saved.error) throw saved.error;
      await insertArquivoVinculos(context, String(saved.data.id ?? ""), links);
      success += 1;
    }

    await context.client.from("assoc_auditoria_logs").insert({
      empresa_id: context.empresaId,
      usuario_id: context.current.usuario.id,
      acao: "enviar_documento",
      entidade: "assoc_arquivos",
      dados_novos: { quantidade: success, categoria, provedor: provider, liberado_associado: liberado }
    });

    return NextResponse.redirect(new URL(`/portal-associativo/documentos?ok=${encodeURIComponent(`${success} arquivo(s) enviado(s).`)}`, request.url), 303);
  } catch (error) {
    return redirectDocs(request, error instanceof Error ? error.message : "Erro ao enviar documento.");
  }
}

async function resolveLinks(context: Awaited<ReturnType<typeof getPortalContext>>, formData: FormData) {
  const links = {
    pessoaId: text(formData.get("pessoa_id")),
    unidadeId: text(formData.get("unidade_id")),
    cobrancaId: text(formData.get("cobranca_id")),
    reuniaoId: text(formData.get("reuniao_id")),
    projetoId: text(formData.get("projeto_id"))
  };

  await assertBelongs(context, "assoc_pessoas", links.pessoaId);
  await assertBelongs(context, "assoc_unidades", links.unidadeId);
  await assertBelongs(context, "assoc_cobrancas", links.cobrancaId);
  await assertBelongs(context, "assoc_reunioes", links.reuniaoId);
  await assertBelongs(context, "assoc_projetos", links.projetoId);
  return links;
}

async function resolveFolderPath(
  context: Awaited<ReturnType<typeof getPortalContext>>,
  links: Awaited<ReturnType<typeof resolveLinks>>,
  categoria: string,
  root: string
) {
  if (links.pessoaId) {
    const pessoa = await context.client.from("assoc_pessoas").select("nome_completo,cpf_cnpj").eq("id", links.pessoaId).eq("empresa_id", context.empresaId).maybeSingle();
    return buildPortalStorageFolder({
      root,
      area: "pessoa",
      pessoaNome: text(pessoa.data?.nome_completo) || "Pessoa",
      pessoaDocumento: text(pessoa.data?.cpf_cnpj) || "sem-documento",
      categoria
    });
  }

  if (links.unidadeId) {
    const unidade = await context.client.from("assoc_unidades").select("id,codigo_unidade,numero_unidade").eq("id", links.unidadeId).eq("empresa_id", context.empresaId).maybeSingle();
    return buildPortalStorageFolder({
      root,
      area: "unidade",
      unidadeCodigo: unitOptionLabel((unidade.data ?? {}) as Record<string, unknown>),
      categoria
    });
  }

  if (links.cobrancaId) {
    const cobranca = await context.client.from("assoc_cobrancas").select("ano_referencia,mes_referencia").eq("id", links.cobrancaId).eq("empresa_id", context.empresaId).maybeSingle();
    return buildPortalStorageFolder({
      root,
      area: "financeiro",
      cobrancaAno: Number(cobranca.data?.ano_referencia || new Date().getFullYear()),
      cobrancaMes: Number(cobranca.data?.mes_referencia || new Date().getMonth() + 1),
      categoria
    });
  }

  if (links.reuniaoId) {
    const reuniao = await context.client.from("assoc_reunioes").select("titulo,data_reuniao").eq("id", links.reuniaoId).eq("empresa_id", context.empresaId).maybeSingle();
    return buildPortalStorageFolder({
      root,
      area: "reuniao",
      reuniaoTitulo: text(reuniao.data?.titulo) || "Reuniao",
      reuniaoData: text(reuniao.data?.data_reuniao).slice(0, 10),
      categoria
    });
  }

  if (links.projetoId) {
    const projeto = await context.client.from("assoc_projetos").select("nome").eq("id", links.projetoId).eq("empresa_id", context.empresaId).maybeSingle();
    return buildPortalStorageFolder({
      root,
      area: "projeto",
      projetoNome: text(projeto.data?.nome) || "Projeto",
      categoria
    });
  }

  return buildPortalStorageFolder({ root, area: "relatorio", categoria });
}

async function insertArquivoVinculos(context: Awaited<ReturnType<typeof getPortalContext>>, arquivoId: string, links: Awaited<ReturnType<typeof resolveLinks>>) {
  const rows = [
    links.pessoaId ? { entidade: "pessoa", entidade_id: links.pessoaId } : null,
    links.unidadeId ? { entidade: "unidade", entidade_id: links.unidadeId } : null,
    links.cobrancaId ? { entidade: "cobranca", entidade_id: links.cobrancaId } : null,
    links.reuniaoId ? { entidade: "reuniao", entidade_id: links.reuniaoId } : null,
    links.projetoId ? { entidade: "projeto", entidade_id: links.projetoId } : null
  ].filter(Boolean);

  if (rows.length === 0) return;
  await context.client.from("assoc_arquivos_vinculos").insert(rows.map((row) => ({
    empresa_id: context.empresaId,
    arquivo_id: arquivoId,
    ...(row as Record<string, string>)
  })));
}

async function assertBelongs(context: Awaited<ReturnType<typeof getPortalContext>>, table: string, id: string) {
  if (!id) return;
  const { data, error } = await context.client.from(table).select("id").eq("id", id).eq("empresa_id", context.empresaId).maybeSingle();
  if (error || !data?.id) throw new Error("Um dos vinculos informados nao pertence a esta empresa.");
}

function validateFile(file: File) {
  if (file.size > maxFileSize) throw new Error("Arquivo acima do limite de 20 MB.");
  const extension = file.name.toLowerCase().split(".").pop() || "";
  if (blockedExtensions.has(extension) || !allowedExtensions.has(extension)) {
    throw new Error("Tipo de arquivo nao permitido.");
  }
}

function redirectDocs(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/portal-associativo/documentos?error=${encodeURIComponent(error)}`, request.url), 303);
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
