import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { PdfBrandingOptions } from "./simple-pdf";

export type WatermarkPdfOptions = {
  originalBytes: Buffer;
  originalMimeType: string;
  originalName: string;
  branding: PdfBrandingOptions;
};

const a4Width = 595.28;
const a4Height = 841.89;
const pagePadding = 18;

export async function createWatermarkedPdf({
  originalBytes,
  originalMimeType,
  originalName,
  branding,
}: WatermarkPdfOptions) {
  const lowerMime = originalMimeType.toLowerCase();
  const lowerName = originalName.toLowerCase();

  if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf")) {
    const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const logo = await embedLogo(pdfDoc, branding);
    const fallbackFont = logo ? null : await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const page of pdfDoc.getPages()) {
      drawWatermarkLogo(page, logo);
      drawHeaderLogo(page, logo, fallbackFont, branding);
    }

    return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  }

  if (isSupportedImage(lowerMime, lowerName)) {
    const pdfDoc = await PDFDocument.create();
    const logo = await embedLogo(pdfDoc, branding);
    const fallbackFont = logo ? null : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const originalImage = await embedImage(pdfDoc, originalBytes, originalMimeType, originalName);
    if (!originalImage) {
      throw new Error("Formato de imagem não suportado para gerar PDF com marca d'água.");
    }

    const page = pdfDoc.addPage([a4Width, a4Height]);
    const headerHeight = logo ? Math.min(134, fitInside(logo, 195, 124).height + 30) : 0;
    const availableHeight = a4Height - pagePadding * 2 - headerHeight;
    const imageBox = fitInside(originalImage, a4Width - pagePadding * 2, availableHeight);

    page.drawImage(originalImage, {
      x: (a4Width - imageBox.width) / 2,
      y: pagePadding,
      width: imageBox.width,
      height: imageBox.height,
    });

    drawWatermarkLogo(page, logo);
    drawHeaderLogo(page, logo, fallbackFont, branding);

    return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  }

  throw new Error("Prévia indisponível para DOC/DOCX. Baixe o original ou reenvie em PDF/imagem para gerar marca d'água.");
}

function drawHeaderLogo(
  page: PDFPage,
  logo: PDFImage | null,
  font: PDFFont | null,
  branding: PdfBrandingOptions,
) {
  const { width, height } = page.getSize();

  if (logo) {
    const box = fitInside(logo, 195, 124);
    page.drawImage(logo, {
      x: (width - box.width) / 2,
      y: height - 18 - box.height,
      width: box.width,
      height: box.height,
      opacity: 0.98,
    });
    return;
  }

  if (!font) return;
  const text = branding.headerText || "LexGestor";
  page.drawText(text.slice(0, 80), {
    x: 42,
    y: height - 42,
    size: 15,
    font,
    color: rgb(0.08, 0.12, 0.2),
  });
}

function drawWatermarkLogo(page: PDFPage, logo: PDFImage | null) {
  if (!logo) return;
  const { width, height } = page.getSize();
  const box = fitInside(logo, width * 0.54, height * 0.34);
  page.drawImage(logo, {
    x: (width - box.width) / 2,
    y: (height - box.height) / 2 - 18,
    width: box.width,
    height: box.height,
    opacity: 0.075,
  });
}

async function embedLogo(pdfDoc: PDFDocument, branding: PdfBrandingOptions) {
  const logo = branding.logo;
  if (!logo?.bytes?.length) return null;
  return embedImage(pdfDoc, logo.bytes, logo.mimeType ?? "", logo.name ?? "logo").catch(() => null);
}

async function embedImage(pdfDoc: PDFDocument, bytes: Buffer, mimeType: string, fileName: string) {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (lowerMime.includes("png") || lowerName.endsWith(".png")) {
    return pdfDoc.embedPng(bytes);
  }

  if (
    lowerMime.includes("jpeg") ||
    lowerMime.includes("jpg") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg")
  ) {
    return pdfDoc.embedJpg(bytes);
  }

  return null;
}

function isSupportedImage(mimeType: string, fileName: string) {
  return mimeType.includes("png") ||
    mimeType.includes("jpeg") ||
    mimeType.includes("jpg") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg");
}

function fitInside(image: PDFImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return {
    width: Math.max(1, image.width * scale),
    height: Math.max(1, image.height * scale),
  };
}
