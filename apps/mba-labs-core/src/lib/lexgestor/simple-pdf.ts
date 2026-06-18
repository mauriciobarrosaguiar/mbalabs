import { deflateSync, inflateSync } from "node:zlib";

export type SimplePdfLine = {
  text: string;
  size?: number;
  x?: number;
  y?: number;
};

export type EmbeddedImagePdfOptions = {
  lines: SimplePdfLine[];
  watermark?: string;
  imageBytes: Buffer;
  imageMimeType?: string;
  imageName?: string;
};

type PdfImage = {
  width: number;
  height: number;
  data: Buffer;
  filter: "/DCTDecode" | "/FlateDecode";
};

export function createSimplePdf(lines: SimplePdfLine[], watermark = "LexGestor") {
  const pageWidth = 595;
  const pageHeight = 842;
  const contentLines = lines.map((line, index) => ({
    ...line,
    x: line.x ?? 48,
    y: line.y ?? pageHeight - 64 - index * 18,
    size: line.size ?? 11,
  }));

  const stream = [
    "q",
    "0.88 0.93 1 rg",
    "BT /F1 42 Tf 90 360 Td 0.7 0.7 0.7 rg",
    `${toPdfWinAnsiText(watermark)} Tj`,
    "ET",
    "Q",
    "BT",
    "/F1 18 Tf",
    "0.05 0.13 0.27 rg",
    `48 ${pageHeight - 40} Td ${toPdfWinAnsiText("LexGestor")} Tj`,
    "ET",
    ...contentLines.flatMap((line) => [
      "BT",
      `/F1 ${line.size} Tf`,
      "0.09 0.12 0.18 rg",
      `${line.x} ${line.y} Td ${toPdfWinAnsiText(line.text)} Tj`,
      "ET",
    ]),
  ].join("\n");

  return buildPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    createStreamObject(stream),
  ]);
}

export function createImagePdfWithWatermark({
  lines,
  watermark = "LexGestor",
  imageBytes,
  imageMimeType = "",
  imageName = "documento",
}: EmbeddedImagePdfOptions) {
  const image = parseImageForPdf(imageBytes, imageMimeType, imageName);

  if (!image) {
    return createSimplePdf(
      [
        ...lines,
        { text: "Imagem original não pode ser incorporada automaticamente. O arquivo original foi preservado no armazenamento." },
      ],
      watermark,
    );
  }

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 48;
  const topY = pageHeight - 44;
  const infoLines = lines.slice(0, 7).map((line, index) => ({
    ...line,
    x: line.x ?? marginX,
    y: line.y ?? pageHeight - 74 - index * 17,
    size: line.size ?? 10,
  }));

  const maxImageWidth = pageWidth - marginX * 2;
  const maxImageHeight = 560;
  const scale = Math.min(maxImageWidth / image.width, maxImageHeight / image.height);
  const drawWidth = Math.max(1, image.width * scale);
  const drawHeight = Math.max(1, image.height * scale);
  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = 86;

  const contentStream = [
    "BT",
    "/F1 18 Tf",
    "0.05 0.13 0.27 rg",
    `48 ${topY} Td ${toPdfWinAnsiText("LexGestor") } Tj`,
    "ET",
    ...infoLines.flatMap((line) => [
      "BT",
      `/F1 ${line.size} Tf`,
      "0.09 0.12 0.18 rg",
      `${line.x} ${line.y} Td ${toPdfWinAnsiText(line.text)} Tj`,
      "ET",
    ]),
    "q",
    `${formatNumber(drawWidth)} 0 0 ${formatNumber(drawHeight)} ${formatNumber(drawX)} ${formatNumber(drawY)} cm`,
    "/Im1 Do",
    "Q",
    "BT",
    "/F1 46 Tf",
    "0.70 0.70 0.70 rg",
    `105 390 Td ${toPdfWinAnsiText(watermark)} Tj`,
    "ET",
  ].join("\n");

  return buildPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    createImageObject(image),
    createStreamObject(contentStream),
  ]);
}

function createStreamObject(stream: string) {
  const bytes = Buffer.from(stream, "utf8");
  return Buffer.concat([
    Buffer.from(`<< /Length ${bytes.length} >>\nstream\n`, "utf8"),
    bytes,
    Buffer.from("\nendstream", "utf8"),
  ]);
}

function createImageObject(image: PdfImage) {
  return Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${image.filter} /Length ${image.data.length} >>\nstream\n`,
      "utf8",
    ),
    image.data,
    Buffer.from("\nendstream", "utf8"),
  ]);
}

function buildPdf(objects: Array<string | Buffer>) {
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(totalLength(chunks));
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`, "utf8"));
    chunks.push(Buffer.isBuffer(object) ? object : Buffer.from(object, "utf8"));
    chunks.push(Buffer.from("\nendobj\n", "utf8"));
  });

  const xrefOffset = totalLength(chunks);
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n`, "utf8"));
  chunks.push(Buffer.from("0000000000 65535 f \n", "utf8"));

  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(Buffer.from(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`, "utf8"));
  }

  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`, "utf8"));
  return Buffer.concat(chunks);
}

function totalLength(chunks: Buffer[]) {
  return chunks.reduce((total, chunk) => total + chunk.length, 0);
}

function parseImageForPdf(bytes: Buffer, mimeType: string, fileName: string): PdfImage | null {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (lowerMime.includes("jpeg") || lowerMime.includes("jpg") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    const size = readJpegSize(bytes);
    if (!size) return null;
    return { ...size, data: bytes, filter: "/DCTDecode" };
  }

  if (lowerMime.includes("png") || lowerName.endsWith(".png")) {
    return readPngAsRgb(bytes);
  }

  return null;
}

function readJpegSize(bytes: Buffer) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);

    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }

    offset += Math.max(length + 2, 2);
  }

  return null;
}

function readPngAsRgb(bytes: Buffer): PdfImage | null {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 32 || !bytes.subarray(0, 8).equals(pngHeader)) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];
  let palette: Buffer | null = null;

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) return null;
    const chunk = bytes.subarray(start, end);

    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
    } else if (type === "PLTE") {
      palette = Buffer.from(chunk);
    } else if (type === "IDAT") {
      idatChunks.push(Buffer.from(chunk));
    } else if (type === "IEND") {
      break;
    }

    offset = end + 4;
  }

  if (!width || !height || bitDepth !== 8 || idatChunks.length === 0) return null;

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 3 ? 1 : 0;
  if (!channels) return null;
  if (colorType === 3 && !palette) return null;

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const scanlineLength = width * channels;
  const raw = unfilterPng(inflated, width, height, channels, scanlineLength);
  if (!raw) return null;

  const rgb = Buffer.alloc(width * height * 3);
  let sourceIndex = 0;
  let targetIndex = 0;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (colorType === 6) {
      rgb[targetIndex++] = raw[sourceIndex++];
      rgb[targetIndex++] = raw[sourceIndex++];
      rgb[targetIndex++] = raw[sourceIndex++];
      sourceIndex += 1;
    } else if (colorType === 2) {
      rgb[targetIndex++] = raw[sourceIndex++];
      rgb[targetIndex++] = raw[sourceIndex++];
      rgb[targetIndex++] = raw[sourceIndex++];
    } else if (colorType === 0) {
      const gray = raw[sourceIndex++];
      rgb[targetIndex++] = gray;
      rgb[targetIndex++] = gray;
      rgb[targetIndex++] = gray;
    } else if (colorType === 3 && palette) {
      const paletteIndex = raw[sourceIndex++] * 3;
      rgb[targetIndex++] = palette[paletteIndex] ?? 0;
      rgb[targetIndex++] = palette[paletteIndex + 1] ?? 0;
      rgb[targetIndex++] = palette[paletteIndex + 2] ?? 0;
    }
  }

  return {
    width,
    height,
    data: deflateSync(rgb),
    filter: "/FlateDecode",
  };
}

function unfilterPng(data: Buffer, width: number, height: number, channels: number, scanlineLength: number) {
  const result = Buffer.alloc(width * height * channels);
  let inputOffset = 0;
  let outputOffset = 0;
  let previous = Buffer.alloc(scanlineLength);

  for (let y = 0; y < height; y += 1) {
    if (inputOffset >= data.length) return null;
    const filter = data[inputOffset++];
    if (inputOffset + scanlineLength > data.length) return null;
    const scanline = Buffer.from(data.subarray(inputOffset, inputOffset + scanlineLength));
    inputOffset += scanlineLength;

    for (let x = 0; x < scanlineLength; x += 1) {
      const left = x >= channels ? scanline[x - channels] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? previous[x - channels] ?? 0 : 0;
      const current = scanline[x];

      if (filter === 1) scanline[x] = (current + left) & 0xff;
      else if (filter === 2) scanline[x] = (current + up) & 0xff;
      else if (filter === 3) scanline[x] = (current + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) scanline[x] = (current + paeth(left, up, upLeft)) & 0xff;
      else if (filter !== 0) return null;
    }

    scanline.copy(result, outputOffset);
    outputOffset += scanlineLength;
    previous = scanline;
  }

  return result;
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function formatNumber(value: number) {
  return value.toFixed(2).replace(/\.00$/, "");
}

function toPdfWinAnsiText(value: string) {
  return `<${toWinAnsiHex(value.slice(0, 180))}>`;
}

function toWinAnsiHex(value: string) {
  const bytes: number[] = [];

  for (const char of value) {
    const code = char.codePointAt(0) ?? 63;

    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) {
      bytes.push(code);
      continue;
    }

    const mapped = winAnsiExtraChars[code];
    bytes.push(mapped ?? 63);
  }

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const winAnsiExtraChars: Record<number, number> = {
  0x20ac: 0x80, // €
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x2122: 0x99, // ™
};
