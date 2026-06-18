import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { registrarAuditoriaLexGestor } from "@/lib/lexgestor/audit";
import { ensureLexEscritorio, getLexSupabaseClient } from "@/lib/lexgestor/data";
import { slugSeguro } from "@/lib/lexgestor/formatters";
import { createImagePdfWithWatermark, createSimplePdf } from "@/lib/lexgestor/simple-pdf";
import { isStorageProvider, montarPastaRaizEscritorio, uploadToConnectedStorage } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/documentos");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    return NextResponse.json({ error: "Configure o escritório antes de anexar documentos." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("arquivo");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 });
    }

    const providerValue = text(formData.get("provider")) || "dropbox";
    const provider = isStorageProvider(providerValue) ? providerValue : "dropbox";
    const clienteId = required(formData, "cliente_id");
    const casoId = required(formData, "caso_id");
    const categoria = required(formData, "categoria");
    const subcategoria = required(formData, "subcategoria");
    const tipoDocumento = required(formData, "tipo_documento");
    const origem = text(formData.get("origem")) || "Upload";
    const gerarPdf = text(formData.get("gerar_pdf")) === "sim";
    const documentoId = text(formData.get("documento_id"));
    const checklistMeta = {
      area: text(formData.get("checklist_area")),
      subarea: text(formData.get("checklist_subarea")),
      ordem: Number(text(formData.get("checklist_ordem")) || 0),
      titulo: text(formData.get("checklist_titulo")),
    };

    const [clienteResult, casoResult] = await Promise.all([
      client.from("lex_clientes").select("id,nome,cpf_cnpj").eq("id", clienteId).eq("escritorio_id", escritorioId).maybeSingle(),
      client.from("lex_casos").select("id,titulo,cliente_id").eq("id", casoId).eq("escritorio_id", escritorioId).maybeSingle(),
    ]);
    if (clienteResult.error) throw clienteResult.error;
    if (casoResult.error) throw casoResult.error;

    const cliente = (clienteResult.data ?? {}) as Record<string, unknown>;
    const caso = (casoResult.data ?? {}) as Record<string, unknown>;
    if (!cliente.id || !caso.id || text(caso.cliente_id) !== clienteId) {
      return NextResponse.json({ error: "Cliente ou caso não pertence a este escritório." }, { status: 403 });
    }
    const checklistTemplateId = await resolveChecklistTemplateId(client, checklistMeta);
    const pastaRaizEscritorio = montarPastaRaizEscritorio(text(escritorio?.nome) || "Escritorio");
    const folderBase = [
      pastaRaizEscritorio,
      "Clientes",
      `${slugSeguro(text(cliente.nome) || "Cliente")} - ${slugSeguro(text(cliente.cpf_cnpj) || "sem-documento")}`,
      "Casos",
      slugSeguro(text(caso.titulo) || "Caso"),
    ].join("/");
    const originalFolder = `${folderBase}/01 - Originais`;
    const pdfFolder = `${folderBase}/02 - PDF com Marca d'agua`;
    const bytes = Buffer.from(await file.arrayBuffer());

    let status = "precisa_reenviar";
    let uploadResult: Awaited<ReturnType<typeof uploadToConnectedStorage>> | null = null;
    let pdfResult: Awaited<ReturnType<typeof uploadToConnectedStorage>> | null = null;
    let message = "Documento salvo como pendente. Para concluir, conecte o armazenamento ou reenvie o arquivo.";

    try {
      uploadResult = await uploadToConnectedStorage({
        current,
        provider,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes,
        folderPath: originalFolder,
      });

      if (uploadResult) {
        status = "enviado";
        message = provider === "google_drive" ? "Documento enviado ao Drive." : "Documento enviado ao Dropbox.";
      }

      if (uploadResult && gerarPdf) {
        const pdfLines = [
          { text: "PDF com marca d'água", size: 16 },
          { text: `Documento: ${file.name}` },
          { text: `Cliente: ${text(cliente.nome)}` },
          { text: `Caso: ${text(caso.titulo)}` },
          { text: `Categoria: ${categoria} / ${subcategoria}` },
          { text: "Arquivo original preservado no armazenamento do escritório." },
        ];
        const watermark = text(escritorio?.watermark_text) || text(escritorio?.nome) || "LexGestor";
        const pdf = file.type.startsWith("image/")
          ? createImagePdfWithWatermark({
              lines: pdfLines,
              watermark,
              imageBytes: bytes,
              imageMimeType: file.type,
              imageName: file.name,
            })
          : createSimplePdf(pdfLines, watermark);

        pdfResult = await uploadToConnectedStorage({
          current,
          provider,
          fileName: `${file.name.replace(/\.[^.]+$/, "") || "documento"}-marca-dagua.pdf`,
          mimeType: "application/pdf",
          bytes: pdf,
          folderPath: pdfFolder,
        });
        if (pdfResult) status = "pdf_gerado";
      }
    } catch (error) {
      status = "erro_envio";
      message = errorMessage(error);
    }

    const metadata = {
      escritorio_id: escritorioId,
      cliente_id: clienteId,
      caso_id: casoId,
      nome_original: file.name,
      nome_arquivo_sistema: file.name,
      tipo_documento: tipoDocumento,
      mime_type: file.type || "application/octet-stream",
      tamanho_bytes: file.size,
      categoria_nome: categoria,
      subcategoria_nome: subcategoria,
      origem,
      observacoes: text(formData.get("observacoes")) || null,
      storage_provider: uploadResult ? provider : null,
      storage_file_id: uploadResult?.fileId ?? null,
      storage_folder_id: uploadResult?.folderId ?? null,
      storage_path: uploadResult?.path ?? null,
      storage_url: uploadResult?.url ?? null,
      pdf_storage_file_id: pdfResult?.fileId ?? null,
      pdf_storage_path: pdfResult?.path ?? null,
      pdf_storage_url: pdfResult?.url ?? null,
      possui_marca_dagua: Boolean(pdfResult),
      checklist_item_id: checklistTemplateId || null,
      status,
      criado_por: current.usuario.id,
      updated_at: new Date().toISOString(),
    };

    const saved = documentoId
      ? await client
          .from("lex_documentos")
          .update(metadata)
          .eq("id", documentoId)
          .eq("escritorio_id", escritorioId)
          .select("id")
          .single()
      : await client.from("lex_documentos").insert(metadata).select("id").single();

    if (saved.error) throw saved.error;
    const savedId = String(saved.data.id ?? "");

    if (checklistTemplateId && savedId) {
      await marcarChecklistRecebido({
        client,
        escritorioId,
        casoId,
        checklistTemplateId,
        documentoId: savedId,
        observacao: text(formData.get("observacoes")) || checklistMeta.titulo,
        recebido: Boolean(uploadResult),
      });
    }

    await registrarAuditoriaLexGestor({
      current,
      acao: documentoId ? "documento.reenviado" : "documento.upload",
      entidade: "lex_documentos",
      entidadeId: savedId,
      detalhes: { status, provider: uploadResult ? provider : null, nome: file.name },
    });

    return NextResponse.json({
      ok: status !== "erro_envio",
      id: savedId,
      status,
      message: documentoId && status !== "erro_envio" ? "Documento reenviado e registro atualizado." : message,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

async function resolveChecklistTemplateId(
  client: any,
  meta: { area: string; subarea: string; ordem: number; titulo: string },
) {
  if (!meta.area || !meta.subarea) return "";

  let query = client
    .from("lex_checklist_templates")
    .select("id")
    .eq("area", meta.area)
    .eq("subarea", meta.subarea)
    .eq("ativo", true)
    .limit(1);

  if (Number.isFinite(meta.ordem) && meta.ordem > 0) {
    query = query.eq("ordem", meta.ordem);
  } else if (meta.titulo) {
    query = query.eq("titulo", meta.titulo);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return "";
  return String(data.id ?? "");
}

async function marcarChecklistRecebido({
  client,
  escritorioId,
  casoId,
  checklistTemplateId,
  documentoId,
  observacao,
  recebido,
}: {
  client: any;
  escritorioId: string;
  casoId: string;
  checklistTemplateId: string;
  documentoId: string;
  observacao: string;
  recebido: boolean;
}) {
  const existing = await client
    .from("lex_checklist_respostas")
    .select("id")
    .eq("escritorio_id", escritorioId)
    .eq("caso_id", casoId)
    .eq("checklist_template_id", checklistTemplateId)
    .maybeSingle();

  const payload = {
    escritorio_id: escritorioId,
    caso_id: casoId,
    checklist_template_id: checklistTemplateId,
    status: recebido ? "recebido" : "pendente",
    observacao: observacao || null,
    documento_id: documentoId,
    atualizado_em: new Date().toISOString(),
  };

  if (existing.data?.id) {
    await client.from("lex_checklist_respostas").update(payload).eq("id", existing.data.id);
    return;
  }

  await client.from("lex_checklist_respostas").insert(payload);
}

function required(formData: FormData, key: string) {
  const value = text(formData.get(key));
  if (!value) throw new Error(`Campo obrigatorio: ${key}`);
  return value;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao enviar documento.";
}
