import { NextResponse } from "next/server";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";
import { createImagePdfWithWatermark, createSimplePdf } from "@/lib/lexgestor/simple-pdf";
import { downloadFromConnectedStorage } from "@/lib/lexgestor/storage-read";
import { isStorageProvider } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentoId = url.searchParams.get("documento") || "";
  const data = await getLexWorkspaceData("/lexgestor/documentos");
  const documento = data.documentos.find((item) => item.id === documentoId);

  if (!documento) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const watermark = String(data.escritorio?.watermark_text ?? data.escritorio?.nome ?? "LexGestor");
  const categoria = formatarRotuloLex(documento.categoria);
  const subcategoria = formatarRotuloLex(documento.subcategoria);
  const pdfLines = [
    { text: "PDF com marca d'água", size: 16 },
    { text: `Documento: ${documento.nome}` },
    { text: `Cliente: ${documento.cliente}` },
    { text: `Caso: ${formatarRotuloLex(documento.caso)}` },
    { text: `Categoria: ${categoria} / ${subcategoria}` },
    { text: `Status: ${formatarRotuloLex(documento.status)}` },
    { text: documento.storagePath ? "Arquivo original preservado no armazenamento do escritório." : "Arquivo original pendente de reenvio." },
  ];

  const original = await baixarOriginalSePossivel(data.current, documento).catch(() => null);
  const pdf = original?.mimeType.startsWith("image/")
    ? createImagePdfWithWatermark({
        lines: pdfLines,
        watermark,
        imageBytes: original.bytes,
        imageMimeType: original.mimeType,
        imageName: original.fileName,
      })
    : createSimplePdf(
        [
          ...pdfLines,
          { text: original ? "Formato original não incorporado automaticamente neste PDF." : "Original indisponível para pré-visualização." },
        ],
        watermark,
      );

  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="lexgestor-${documento.id}.pdf"`,
    },
  });
}

async function baixarOriginalSePossivel(current: Awaited<ReturnType<typeof getLexWorkspaceData>>["current"], documento: Awaited<ReturnType<typeof getLexWorkspaceData>>["documentos"][number]) {
  if (!isStorageProvider(documento.provider) || !documento.storagePath) return null;
  return downloadFromConnectedStorage({
    current,
    provider: documento.provider,
    path: documento.storagePath,
    fileId: documento.storageFileId,
  });
}

function formatarRotuloLex(valor: string) {
  return valor
    .replace(/\bFamilia\b/gi, "Família")
    .replace(/\bPensao\b/gi, "Pensão")
    .replace(/\balimenticia\b/gi, "alimentícia")
    .replace(/\bPrevidenciario\b/gi, "Previdenciário")
    .replace(/\bTributario\b/gi, "Tributário")
    .replace(/\bConfiguracoes\b/gi, "Configurações")
    .replace(/\bAcoes\b/gi, "Ações")
    .replace(/\bRelatorios\b/gi, "Relatórios");
}
