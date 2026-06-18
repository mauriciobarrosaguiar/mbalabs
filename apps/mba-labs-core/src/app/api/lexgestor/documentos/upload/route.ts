import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
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
    return NextResponse.json({ error: "Configure o escritorio antes de anexar documentos." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("arquivo");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 });
    }

    const providerValue = text(formData.get("provider")) || "google_drive";
    const provider = isStorageProvider(providerValue) ? providerValue : "google_drive";
    const clienteId = required(formData, "cliente_id");
    const casoId = required(formData, "caso_id");
    const categoria = required(formData, "categoria");
    const subcategoria = required(formData, "subcategoria");
    const tipoDocumento = required(formData, "tipo_documento");
    const origem = text(formData.get("origem")) || "Upload";
    const gerarPdf = text(formData.get("gerar_pdf")) === "sim";

    const [clienteResult, casoResult] = await Promise.all([
      client.from("lex_clientes").select("id,nome,cpf_cnpj").eq("id", clienteId).eq("escritorio_id", escritorioId).maybeSingle(),
      client.from("lex_casos").select("id,titulo").eq("id", casoId).eq("escritorio_id", escritorioId).maybeSingle(),
    ]);
    if (clienteResult.error) throw clienteResult.error;
    if (casoResult.error) throw casoResult.error;

    const cliente = (clienteResult.data ?? {}) as Record<string, unknown>;
    const caso = (casoResult.data ?? {}) as Record<string, unknown>;
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

    let status = "pendente";
    let uploadResult: Awaited<ReturnType<typeof uploadToConnectedStorage>> | null = null;
    let pdfResult: Awaited<ReturnType<typeof uploadToConnectedStorage>> | null = null;
    let message = "Documento cadastrado como pendente. Conecte o armazenamento para salvar o arquivo real.";

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
          { text: "PDF com marca d'agua", size: 16 },
          { text: `Documento: ${file.name}` },
          { text: `Cliente: ${text(cliente.nome)}` },
          { text: `Caso: ${text(caso.titulo)}` },
          { text: `Categoria: ${categoria} / ${subcategoria}` },
          { text: "Arquivo original preservado no armazenamento do escritorio." },
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
      status,
      criado_por: current.usuario.id,
    };

    const inserted = await client.from("lex_documentos").insert(metadata).select("id").single();
    if (inserted.error) throw inserted.error;

    return NextResponse.json({
      ok: status !== "erro_envio",
      id: inserted.data.id,
      status,
      message,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
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
