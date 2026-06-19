import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import type { PdfBrandingOptions } from "./simple-pdf";

export type WatermarkPdfOptions = {
  originalBytes: Buffer;
  originalMimeType: string;
  originalName: string;
  branding: PdfBrandingOptions;
};

const a4Width = 595.28;
const a4Height = 841.89;

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
    await drawBrandingOnEveryPage(pdfDoc, branding, logo);
    return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  }

  if (isSupportedImage(lowerMime, lowerName)) {
    const pdfDoc = await PDFDocument.create();
    const logo = await embedLogo(pdfDoc, branding);
    const originalImage = await embedImage(pdfDoc, originalBytes, originalMimeType, originalName);
    if (!originalImage) {
      throw new Error("Formato de imagem não suportado para gerar PDF com marca d'água.");
    }

    const page = pdfDoc.addPage([a4Width, a4Height]);

    const imageBox = fitInside(originalImage, a4Width - 72, a4Height - 150);
    page.drawImage(originalImage, {
      x: (a4Width - imageBox.width) / 2,
      y: 58,
      width: imageBox.width,
      height: imageBox.height,
    });
    drawLogoWatermark(page, branding, logo);

    return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  }

  throw new Error("Prévia indisponível para DOC/DOCX. Baixe o original ou reenvie em PDF/imagem para gerar marca d'água.");
}

async function drawBrandingOnEveryPage(
  pdfDoc: PDFDocument,
  branding: PdfBrandingOptions,
  logo: PDFImage | null,
) {
  const pages = pdfDoc.getPages();
  const font = logo ? null : await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pages) {
    drawLogoWatermark(page, branding, logo, font);
  }
}

function drawLogoWatermark(
  page: ReturnType<PDFDocument["addPage"]>,
  branding: PdfBrandingOptions,
  logo: PDFImage | null,
  font?: Awaited<ReturnType<PDFDocument["embedFont"]>> | null,
) {
  const { width, height } = page.getSize();
  const opacity = clampOpacity(branding.watermarkOpacity ?? 0.1);

  if (logo) {
    const box = fitInside(logo, width * 0.58, height * 0.44);
    page.drawImage(logo, {
      x: (width - box.width) / 2,
      y: (height - box.height) / 2 - 20,
      width: box.width,
      height: box.height,
      opacity,
    });
    return;
  }

  if (!font) return;
  const text = branding.watermarkText || branding.headerText || "LexGestor";
  page.drawText(text.slice(0, 80), {
    x: width * 0.14,
    y: height * 0.48,
    size: Math.min(54, Math.max(28, width / 11)),
    font,
    color: rgb(0.55, 0.58, 0.62),
    opacity,
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

function clampOpacity(value: number) {
  if (!Number.isFinite(value)) return 0.1;
  return Math.min(0.15, Math.max(0.08, value));
}
