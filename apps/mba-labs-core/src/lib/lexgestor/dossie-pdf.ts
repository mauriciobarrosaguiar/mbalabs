import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { CurrentUserProfile } from "@/lib/core-data";
import type { LexCaso, LexDocumento } from "./data";
import type { PdfBrandingOptions } from "./simple-pdf";
import { downloadFromConnectedStorage } from "./storage-read";
import { isStorageProvider } from "./storage";
import { createWatermarkedPdf } from "./watermark-pdf";

type CreateCaseDossiePdfOptions = {
  current: CurrentUserProfile;
  caso: LexCaso;
  documentos: LexDocumento[];
  branding: PdfBrandingOptions;
  selectedDocumentIds?: string[];
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 54;

export async function createCaseDossiePdf({
  current,
  caso,
  documentos,
  branding,
  selectedDocumentIds = [],
}: CreateCaseDossiePdfOptions) {
  const selectedSet = new Set(selectedDocumentIds.filter(Boolean));
  const docs = orderDocuments(
    selectedSet.size > 0 ? documentos.filter((documento) => selectedSet.has(documento.id)) : documentos,
  );

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(pdfDoc, branding);

  addCoverPage(pdfDoc, { caso, docsCount: docs.length, font, bold, branding, logo });
  addRelatoPage(pdfDoc, { caso, font, bold, branding, logo });

  if (docs.length === 0) {
    addNotePage(pdfDoc, {
      title: "Documentos do caso",
      message: "Nenhum documento foi selecionado para este dossiê.",
      font,
      bold,
      branding,
      logo,
    });
  }

  for (const documento of docs) {
    await appendDocument(pdfDoc, { current, documento, branding, font, bold, logo });
  }

  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
}

export function orderDocuments(documentos: LexDocumento[]) {
  return [...documentos].sort((a, b) => documentOrderKey(a).localeCompare(documentOrderKey(b)));
}

function addCoverPage(
  pdfDoc: PDFDocument,
  params: {
    caso: LexCaso;
    docsCount: number;
    font: PDFFont;
    bold: PDFFont;
    branding: PdfBrandingOptions;
    logo: PDFImage | null;
  },
) {
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  drawWatermark(page, params.branding, params.logo, params.bold);
  drawHeaderLogo(page, params.logo);

  let y = params.logo ? pageHeight - 190 : pageHeight - 126;
  page.drawText("Dossiê do caso", { x: margin, y, size: 22, font: params.bold, color: rgb(0.08, 0.12, 0.2) });
  y -= 42;

  const lines = [
    `Cliente: ${params.caso.cliente}`,
    `Caso: ${params.caso.titulo}`,
    `Categoria: ${params.caso.categoria} / ${params.caso.subcategoria}`,
    `Processo: ${params.caso.numeroProcesso || "Não informado"}`,
    `Status: ${params.caso.status}`,
    `Próximo prazo: ${params.caso.proximoPrazo || "Sem prazo"}`,
    `Advogado responsável: ${params.caso.advogadoResponsavel || "Sem responsável"}`,
    `Documentos selecionados: ${params.docsCount}`,
  ];

  for (const line of lines) {
    y = drawWrappedText(page, line, { x: margin, y, maxWidth: pageWidth - margin * 2, font: params.font, size: 11 });
    y -= 8;
  }
}

function addRelatoPage(
  pdfDoc: PDFDocument,
  params: {
    caso: LexCaso;
    font: PDFFont;
    bold: PDFFont;
    branding: PdfBrandingOptions;
    logo: PDFImage | null;
  },
) {
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  drawWatermark(page, params.branding, params.logo, params.bold);
  drawHeaderLogo(page, params.logo);

  const titleY = params.logo ? pageHeight - 190 : pageHeight - 88;
  const relato = htmlToPlainText(params.caso.relatoInicial) || "Relato ainda não informado.";
  page.drawText("Relato do cliente", { x: margin, y: titleY, size: 18, font: params.bold, color: rgb(0.08, 0.12, 0.2) });
  drawWrappedText(page, relato, {
    x: margin,
    y: titleY - 38,
    maxWidth: pageWidth - margin * 2,
    font: params.font,
    size: 11,
    lineHeight: 17,
  });
}

async function appendDocument(
  target: PDFDocument,
  params: {
    current: CurrentUserProfile;
    documento: LexDocumento;
    branding: PdfBrandingOptions;
    font: PDFFont;
    bold: PDFFont;
    logo: PDFImage | null;
  },
) {
  if (!isStorageProvider(params.documento.provider) || (!params.documento.storagePath && !params.documento.storageFileId)) {
    addNotePage(target, {
      title: `${params.documento.tipo}: ${params.documento.nome}`,
      message: "Arquivo original não encontrado. Reenvie o arquivo para incluir o documento completo no dossiê.",
      font: params.font,
      bold: params.bold,
      branding: params.branding,
      logo: params.logo,
    });
    return;
  }

  const original = await downloadFromConnectedStorage({
    current: params.current,
    provider: params.documento.provider,
    path: params.documento.storagePath,
    fileId: params.documento.storageFileId,
  }).catch(() => null);

  if (!original) {
    addNotePage(target, {
      title: `${params.documento.tipo}: ${params.documento.nome}`,
      message: "Não foi possível baixar o arquivo no armazenamento do escritório.",
      font: params.font,
      bold: params.bold,
      branding: params.branding,
      logo: params.logo,
    });
    return;
  }

  try {
    const watermarked = await createWatermarkedPdf({
      originalBytes: original.bytes,
      originalMimeType: original.mimeType,
      originalName: original.fileName,
      branding: params.branding,
    });
    const source = await PDFDocument.load(watermarked, { ignoreEncryption: true });
    const pages = await target.copyPages(source, source.getPageIndices());
    pages.forEach((page) => target.addPage(page));
  } catch {
    addNotePage(target, {
      title: `${params.documento.tipo}: ${params.documento.nome}`,
      message: "Este arquivo não tem pré-visualização em PDF. Baixe o original pelo LexGestor para consultar o conteúdo.",
      font: params.font,
      bold: params.bold,
      branding: params.branding,
      logo: params.logo,
    });
  }
}

function addNotePage(
  pdfDoc: PDFDocument,
  params: {
    title: string;
    message: string;
    font: PDFFont;
    bold: PDFFont;
    branding: PdfBrandingOptions;
    logo: PDFImage | null;
  },
) {
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  drawWatermark(page, params.branding, params.logo, params.bold);
  drawHeaderLogo(page, params.logo);

  const titleY = params.logo ? pageHeight - 190 : pageHeight - 88;
  page.drawText(params.title.slice(0, 120), {
    x: margin,
    y: titleY,
    size: 16,
    font: params.bold,
    color: rgb(0.08, 0.12, 0.2),
  });
  drawWrappedText(page, params.message, {
    x: margin,
    y: titleY - 38,
    maxWidth: pageWidth - margin * 2,
    font: params.font,
    size: 11,
  });
}

function documentOrderKey(documento: LexDocumento) {
  return [documentGroup(documento), documento.categoria, documento.subcategoria, documento.tipo, documento.criadoEm, documento.nome]
    .map((item) => item || "")
    .join("|");
}

function documentGroup(documento: LexDocumento) {
  const value = `${documento.categoria} ${documento.subcategoria} ${documento.tipo} ${documento.nome}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const groups = [
    ["01", ["capa"]],
    ["02", ["relato"]],
    ["03", ["rg", "cpf", "cnh", "pessoal", "residencia", "cnis"]],
    ["04", ["procuracao", "contrato", "honorario"]],
    ["05", ["print", "whatsapp", "conversa", "foto", "screenshot"]],
    ["06", ["processo", "peticao", "decisao", "sentenca", "despacho", "cnj"]],
  ] as const;

  return groups.find(([, terms]) => terms.some((term) => value.includes(term)))?.[0] ?? "07";
}

async function embedLogo(pdfDoc: PDFDocument, branding: PdfBrandingOptions) {
  const logo = branding.logo;
  if (!logo?.bytes?.length) return null;

  const lowerMime = (logo.mimeType ?? "").toLowerCase();
  const lowerName = (logo.name ?? "").toLowerCase();

  try {
    if (lowerMime.includes("png") || lowerName.endsWith(".png")) {
      return await pdfDoc.embedPng(logo.bytes);
    }

    if (lowerMime.includes("jpeg") || lowerMime.includes("jpg") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
      return await pdfDoc.embedJpg(logo.bytes);
    }
  } catch {
    return null;
  }

  return null;
}

function drawWatermark(page: PDFPage, branding: PdfBrandingOptions, logo: PDFImage | null, font: PDFFont) {
  const { width, height } = page.getSize();
  const opacity = clampOpacity(branding.watermarkOpacity ?? 0.12);

  if (logo) {
    const box = fitInside(logo, width * 0.72, height * 0.54);
    page.drawImage(logo, {
      x: (width - box.width) / 2,
      y: (height - box.height) / 2 - 12,
      width: box.width,
      height: box.height,
      opacity,
    });
    return;
  }

  page.drawText((branding.watermarkText || branding.headerText || "LexGestor").slice(0, 80), {
    x: width * 0.12,
    y: height * 0.48,
    size: Math.min(52, Math.max(28, width / 11)),
    font,
    color: rgb(0.62, 0.65, 0.7),
    opacity,
  });
}

function drawHeaderLogo(page: PDFPage, logo: PDFImage | null) {
  if (!logo) return;
  const { width, height } = page.getSize();
  const box = fitInside(logo, 236, 156);
  page.drawImage(logo, {
    x: (width - box.width) / 2,
    y: height - 34 - box.height,
    width: box.width,
    height: box.height,
    opacity: 0.98,
  });
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    font: PDFFont;
    size: number;
    lineHeight?: number;
  },
) {
  const lineHeight = options.lineHeight ?? Math.max(16, options.size + 6);
  let y = options.y;
  for (const line of wrapText(text, options.font, options.size, options.maxWidth)) {
    if (y < margin) break;
    page.drawText(line, {
      x: options.x,
      y,
      size: options.size,
      font: options.font,
      color: rgb(0.12, 0.16, 0.24),
    });
    y -= lineHeight;
  }
  return y;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    if (words.length === 0) lines.push("");
  }

  return lines;
}

function htmlToPlainText(value: string) {
  return String(value ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h1|h2|h3|h4|li|blockquote)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fitInside(image: PDFImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return {
    width: Math.max(1, image.width * scale),
    height: Math.max(1, image.height * scale),
  };
}

function clampOpacity(value: number) {
  if (!Number.isFinite(value)) return 0.12;
  return Math.min(0.18, Math.max(0.1, value));
}
