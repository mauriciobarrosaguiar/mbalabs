import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";
import { createPortalMeetingMinutesPdf } from "@/lib/portal-associativo-pdf";
import { buildPortalStorageFolder, getPortalStorageConnection, uploadToPortalStorage } from "@/lib/portal-associativo-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await getPortalContext("/portal-associativo/reunioes");
  if (!canPortalAccess(context.perfil, "reunioes") && context.perfil !== "associado") {
    return NextResponse.json({ error: "Seu perfil nao permite acessar esta ata." }, { status: 403 });
  }

  const reuniao = await context.client
    .from("assoc_reunioes")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", context.empresaId)
    .maybeSingle();
  if (reuniao.error || !reuniao.data?.id) {
    return NextResponse.json({ error: "Reuniao nao encontrada." }, { status: 404 });
  }
  if (context.perfil === "associado" && reuniao.data.liberado_associado !== true) {
    return NextResponse.json({ error: "Ata ainda nao liberada ao associado." }, { status: 403 });
  }

  const config = await context.client
    .from("assoc_configuracoes")
    .select("nome_publico_entidade,assinatura_entidade")
    .eq("empresa_id", context.empresaId)
    .maybeSingle();
  const entityName = text(config.data?.nome_publico_entidade) || context.companyName;
  const presentes = Array.isArray(reuniao.data.presencas)
    ? reuniao.data.presencas.map((item: unknown) => typeof item === "string" ? item : text((item as Record<string, unknown>)?.nome)).filter(Boolean)
    : [];
  const pdf = await createPortalMeetingMinutesPdf({
    entidade: entityName,
    titulo: text(reuniao.data.titulo),
    dataHora: text(reuniao.data.data_reuniao),
    local: text(reuniao.data.local),
    pauta: text(reuniao.data.pauta),
    ata: text(reuniao.data.ata) || text(reuniao.data.descricao),
    presentes,
    decisoes: text(reuniao.data.decisoes),
    assinatura: text(config.data?.assinatura_entidade)
  });

  if (!reuniao.data.ata_file_id && canPortalAccess(context.perfil, "reunioes")) {
    await trySaveAta(context, reuniao.data as Record<string, unknown>, pdf);
  }

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ata-${id}.pdf"`
    }
  });
}

async function trySaveAta(context: Awaited<ReturnType<typeof getPortalContext>>, reuniao: Record<string, unknown>, pdf: Buffer) {
  try {
    const connection = await getPortalStorageConnection(context.current);
    if (!connection) return;
    const folderPath = buildPortalStorageFolder({
      root: text(connection.root_folder_path) || "/Portal Associativo",
      area: "reuniao",
      reuniaoTitulo: text(reuniao.titulo),
      reuniaoData: text(reuniao.data_reuniao).slice(0, 10),
      categoria: "Ata"
    });
    const fileName = `Ata - ${safeName(text(reuniao.titulo))}.pdf`;
    const uploaded = await uploadToPortalStorage({
      current: context.current,
      fileName,
      mimeType: "application/pdf",
      bytes: pdf,
      folderPath
    });
    if (!uploaded) return;
    const file = await context.client.from("assoc_arquivos").insert({
      empresa_id: context.empresaId,
      reuniao_id: reuniao.id,
      provedor: String(connection.provedor ?? "manual"),
      file_id: uploaded.fileId || null,
      file_name: fileName,
      mime_type: "application/pdf",
      size: pdf.length,
      path: uploaded.path,
      shared_url: uploaded.url || null,
      visibility: reuniao.liberado_associado === true ? "liberado_associado" : "interno",
      liberado_associado: reuniao.liberado_associado === true,
      categoria: "ata",
      descricao: "Ata gerada pelo Portal Associativo",
      criado_por: context.current.usuario.id,
      atualizado_por: context.current.usuario.id
    }).select("id").single();

    await context.client
      .from("assoc_reunioes")
      .update({
        ata_url: uploaded.url || uploaded.path,
        ata_file_id: uploaded.fileId || String(file.data?.id ?? ""),
        ata_emitida_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .eq("id", reuniao.id)
      .eq("empresa_id", context.empresaId);
    await context.client.from("assoc_auditoria_logs").insert({
      empresa_id: context.empresaId,
      usuario_id: context.current.usuario.id,
      acao: "gerar_ata",
      entidade: "assoc_reunioes",
      entidade_id: reuniao.id,
      dados_novos: { path: uploaded.path }
    });
  } catch {
    // Keep PDF generation available even if storage fails.
  }
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "reuniao";
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
