export type SimplePdfLine = {
  text: string;
  size?: number;
  x?: number;
  y?: number;
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

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "utf8"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, "utf8");
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
