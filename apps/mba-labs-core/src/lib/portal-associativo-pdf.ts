import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type ReceiptPdfParams = {
  entidade: string;
  logoUrl?: string;
  assinatura?: string;
  associado: string;
  unidade: string;
  descricao: string;
  valorOriginal: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  valorPago: number;
  vencimento?: string;
  pagamento?: string;
  formaPagamento?: string;
  cobrancaId: string;
};

type ReportPdfParams = {
  entidade: string;
  titulo: string;
  filtros?: string[];
  resumo?: Array<[string, string]>;
  headers: string[];
  rows: string[][];
};

type MeetingPdfParams = {
  entidade: string;
  titulo: string;
  dataHora?: string;
  local?: string;
  pauta?: string;
  ata?: string;
  presentes?: string[];
  decisoes?: string;
  assinatura?: string;
};

const page = { width: 595.28, height: 841.89 };
const margin = 42;

export async function createPortalReceiptPdf(params: ReceiptPdfParams) {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);
  const current = doc.addPage([page.width, page.height]);
  let y = page.height - margin;

  y = await drawHeader(doc, current, fonts, y, params.entidade, "Recibo de pagamento", params.logoUrl);
  y -= 14;
  y = drawTextBlock(current, fonts, y, [
    `Recebemos de ${params.associado || "associado/responsavel"} o valor de ${formatMoney(params.valorPago)} referente a ${params.descricao || "cobranca"} da unidade ${params.unidade || "-"}.`,
    "Este recibo confirma a baixa da cobranca no Portal Associativo."
  ]);

  y -= 16;
  y = drawInfoGrid(current, fonts, y, [
    ["Entidade", params.entidade],
    ["Associado/responsavel", params.associado],
    ["Unidade", params.unidade],
    ["Descricao", params.descricao],
    ["Valor original", formatMoney(params.valorOriginal)],
    ["Juros", formatMoney(params.juros ?? 0)],
    ["Multa", formatMoney(params.multa ?? 0)],
    ["Desconto", formatMoney(params.desconto ?? 0)],
    ["Valor pago", formatMoney(params.valorPago)],
    ["Vencimento", formatDate(params.vencimento)],
    ["Pagamento", formatDateTime(params.pagamento)],
    ["Forma de pagamento", params.formaPagamento || "-"],
    ["Identificacao", params.cobrancaId],
    ["Emissao", formatDateTime(new Date().toISOString())]
  ]);

  y -= 34;
  current.drawLine({
    start: { x: margin, y },
    end: { x: page.width - margin, y },
    thickness: 0.8,
    color: rgb(0.78, 0.82, 0.88)
  });
  y -= 18;
  current.drawText(params.assinatura || params.entidade, {
    x: margin,
    y,
    size: 10,
    font: fonts.bold,
    color: rgb(0.09, 0.13, 0.2)
  });

  return Buffer.from(await doc.save());
}

export async function createPortalReportPdf(params: ReportPdfParams) {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);
  const current = doc.addPage([page.width, page.height]);
  let y = page.height - margin;

  y = await drawHeader(doc, current, fonts, y, params.entidade, params.titulo);
  y = drawTextBlock(current, fonts, y - 8, [`Emitido em ${formatDateTime(new Date().toISOString())}`]);

  if (params.filtros?.length) {
    y = drawSectionTitle(current, fonts, y - 14, "Filtros");
    y = drawBullets(current, fonts, y, params.filtros);
  }

  if (params.resumo?.length) {
    y = drawSectionTitle(current, fonts, y - 14, "Resumo");
    y = drawInfoGrid(current, fonts, y, params.resumo);
  }

  y = drawSectionTitle(current, fonts, y - 16, "Tabela");
  paginateTable(doc, current, fonts, y, params.headers, params.rows);

  return Buffer.from(await doc.save());
}

export async function createPortalMeetingMinutesPdf(params: MeetingPdfParams) {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);
  const current = doc.addPage([page.width, page.height]);
  let y = page.height - margin;

  y = await drawHeader(doc, current, fonts, y, params.entidade, "Ata de reuniao");
  y = drawInfoGrid(current, fonts, y - 8, [
    ["Titulo", params.titulo],
    ["Data/hora", formatDateTime(params.dataHora)],
    ["Local", params.local || "-"],
    ["Pauta", params.pauta || "-"]
  ]);
  y = drawSectionTitle(current, fonts, y - 16, "Ata");
  y = drawWrapped(current, fonts.regular, params.ata || "Ata nao informada.", margin, y, page.width - margin * 2, 10, 15);

  if (params.presentes?.length) {
    y = drawSectionTitle(current, fonts, y - 16, "Presentes");
    y = drawBullets(current, fonts, y, params.presentes);
  }

  if (params.decisoes) {
    y = drawSectionTitle(current, fonts, y - 16, "Decisoes");
    y = drawWrapped(current, fonts.regular, params.decisoes, margin, y, page.width - margin * 2, 10, 15);
  }

  y -= 34;
  current.drawLine({
    start: { x: margin, y },
    end: { x: page.width - margin, y },
    thickness: 0.8,
    color: rgb(0.78, 0.82, 0.88)
  });
  current.drawText(params.assinatura || params.entidade, {
    x: margin,
    y: y - 18,
    size: 10,
    font: fonts.bold,
    color: rgb(0.09, 0.13, 0.2)
  });

  return Buffer.from(await doc.save());
}

async function loadFonts(doc: PDFDocument) {
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold)
  };
}

async function drawHeader(
  doc: PDFDocument,
  pdfPage: ReturnType<PDFDocument["addPage"]>,
  fonts: Awaited<ReturnType<typeof loadFonts>>,
  y: number,
  entidade: string,
  titulo: string,
  logoUrl?: string
) {
  const logo = logoUrl ? await fetchLogo(doc, logoUrl) : null;
  if (logo) {
    const height = 46;
    const width = Math.min(120, height * (logo.width / logo.height));
    pdfPage.drawImage(logo.image, { x: margin, y: y - height, width, height });
  }

  pdfPage.drawText(safePdfText(entidade || "Portal Associativo"), {
    x: logo ? margin + 136 : margin,
    y: y - 18,
    size: 11,
    font: fonts.bold,
    color: rgb(0.11, 0.18, 0.31)
  });
  pdfPage.drawText(safePdfText(titulo), {
    x: logo ? margin + 136 : margin,
    y: y - 42,
    size: 21,
    font: fonts.bold,
    color: rgb(0.07, 0.1, 0.16)
  });
  pdfPage.drawLine({
    start: { x: margin, y: y - 62 },
    end: { x: page.width - margin, y: y - 62 },
    thickness: 1,
    color: rgb(0.83, 0.87, 0.92)
  });
  return y - 82;
}

async function fetchLogo(doc: PDFDocument, logoUrl: string) {
  try {
    const response = await fetch(logoUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    const bytes = Buffer.from(await response.arrayBuffer());
    const image = contentType.includes("png") || logoUrl.toLowerCase().endsWith(".png")
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
    return { image, width: image.width, height: image.height };
  } catch {
    return null;
  }
}

function drawTextBlock(pdfPage: ReturnType<PDFDocument["addPage"]>, fonts: Awaited<ReturnType<typeof loadFonts>>, y: number, lines: string[]) {
  let currentY = y;
  for (const line of lines) {
    currentY = drawWrapped(pdfPage, fonts.regular, line, margin, currentY, page.width - margin * 2, 10.5, 16);
    currentY -= 4;
  }
  return currentY;
}

function drawSectionTitle(pdfPage: ReturnType<PDFDocument["addPage"]>, fonts: Awaited<ReturnType<typeof loadFonts>>, y: number, title: string) {
  pdfPage.drawText(safePdfText(title), {
    x: margin,
    y,
    size: 12,
    font: fonts.bold,
    color: rgb(0.11, 0.18, 0.31)
  });
  return y - 20;
}

function drawInfoGrid(pdfPage: ReturnType<PDFDocument["addPage"]>, fonts: Awaited<ReturnType<typeof loadFonts>>, y: number, rows: Array<[string, string]>) {
  let currentY = y;
  for (const [label, value] of rows) {
    pdfPage.drawText(safePdfText(label), {
      x: margin,
      y: currentY,
      size: 8,
      font: fonts.bold,
      color: rgb(0.36, 0.42, 0.52)
    });
    currentY = drawWrapped(pdfPage, fonts.regular, value || "-", margin + 138, currentY, page.width - margin * 2 - 138, 9.5, 13);
    currentY -= 8;
  }
  return currentY;
}

function drawBullets(pdfPage: ReturnType<PDFDocument["addPage"]>, fonts: Awaited<ReturnType<typeof loadFonts>>, y: number, rows: string[]) {
  let currentY = y;
  for (const row of rows) {
    currentY = drawWrapped(pdfPage, fonts.regular, `- ${row}`, margin, currentY, page.width - margin * 2, 10, 14);
  }
  return currentY;
}

function paginateTable(
  doc: PDFDocument,
  pdfPage: ReturnType<PDFDocument["addPage"]>,
  fonts: Awaited<ReturnType<typeof loadFonts>>,
  startY: number,
  headers: string[],
  rows: string[][]
) {
  let currentPage = pdfPage;
  let y = startY;
  const colWidth = (page.width - margin * 2) / Math.max(headers.length, 1);

  const drawHeaderRow = () => {
    currentPage.drawRectangle({
      x: margin,
      y: y - 5,
      width: page.width - margin * 2,
      height: 20,
      color: rgb(0.92, 0.95, 0.99)
    });
    headers.forEach((header, index) => {
      currentPage.drawText(safePdfText(header).slice(0, 22), {
        x: margin + index * colWidth + 4,
        y,
        size: 8,
        font: fonts.bold,
        color: rgb(0.16, 0.22, 0.34)
      });
    });
    y -= 24;
  };

  drawHeaderRow();
  for (const row of rows.slice(0, 300)) {
    if (y < 72) {
      currentPage = doc.addPage([page.width, page.height]);
      y = page.height - margin;
      drawHeaderRow();
    }
    row.forEach((cell, index) => {
      currentPage.drawText(safePdfText(cell).slice(0, 32), {
        x: margin + index * colWidth + 4,
        y,
        size: 7.5,
        font: fonts.regular,
        color: rgb(0.09, 0.13, 0.2)
      });
    });
    y -= 18;
  }

  return { page: currentPage, y };
}

function drawWrapped(
  pdfPage: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<typeof loadFonts>>["regular"],
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  lineHeight: number
) {
  const words = safePdfText(text).split(/\s+/);
  let current = "";
  let currentY = y;

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && current) {
      pdfPage.drawText(current, { x, y: currentY, size, font, color: rgb(0.09, 0.13, 0.2) });
      current = word;
      currentY -= lineHeight;
    } else {
      current = next;
    }
  }

  if (current) {
    pdfPage.drawText(current, { x, y: currentY, size, font, color: rgb(0.09, 0.13, 0.2) });
    currentY -= lineHeight;
  }
  return currentY;
}

function safePdfText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, "?");
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}
