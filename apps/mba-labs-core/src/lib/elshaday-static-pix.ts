import "server-only";

// qrcode não possui tipos no projeto; o require mantém a dependência apenas no servidor.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qrcode") as {
  toDataURL: (
    text: string,
    options?: Record<string, unknown>
  ) => Promise<string>;
};

function emvField(id: string, value: string) {
  const length = Buffer.byteLength(value, "utf8");
  return id + String(length).padStart(2, "0") + value;
}

function normalizeMerchantText(value: string, maxLength: number, fallback: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return normalized || fallback;
}

function crc16Ccitt(payload: string) {
  const bytes = Buffer.from(payload, "utf8");
  let crc = 0xffff;

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ 0x1021) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildStaticPixPayload(input: {
  key: string;
  merchantName: string;
  merchantCity: string;
}) {
  const key = input.key.trim();
  if (!key) throw new Error("Informe a chave PIX.");

  if (Buffer.byteLength(key, "utf8") > 77) {
    throw new Error("A chave PIX informada é maior que o limite permitido.");
  }

  const merchantName = normalizeMerchantText(input.merchantName, 25, "ELSHADAY");
  const merchantCity = normalizeMerchantText(input.merchantCity, 15, "PALMAS");

  const merchantAccount =
    emvField("00", "BR.GOV.BCB.PIX") +
    emvField("01", key);

  const additionalData = emvField("05", "***");

  const withoutCrc =
    emvField("00", "01") +
    emvField("26", merchantAccount) +
    emvField("52", "0000") +
    emvField("53", "986") +
    emvField("58", "BR") +
    emvField("59", merchantName) +
    emvField("60", merchantCity) +
    emvField("62", additionalData) +
    "6304";

  return withoutCrc + crc16Ccitt(withoutCrc);
}

export async function createStaticPixQrDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 720,
    type: "image/png"
  });
}
