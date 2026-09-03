import "server-only";

// qrcode não possui tipos no projeto; o require mantém a dependência apenas no servidor.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qrcode") as {
  toDataURL: (text: string, options?: Record<string, unknown>) => Promise<string>;
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

function parseTlv(value: string) {
  const fields: Array<{ id: string; value: string }> = [];
  let offset = 0;

  while (offset < value.length) {
    if (offset + 4 > value.length) throw new Error("PIX Copia e Cola inválido.");

    const id = value.slice(offset, offset + 2);
    const lengthText = value.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(lengthText)) throw new Error("PIX Copia e Cola inválido.");

    const length = Number(lengthText);
    const content = value.slice(offset + 4, offset + 4 + length);
    if (content.length !== length) throw new Error("PIX Copia e Cola inválido.");

    fields.push({ id, value: content });
    offset += 4 + length;
  }

  return fields;
}

function extractPixKeyFromPayload(payload: string) {
  for (const field of parseTlv(payload)) {
    const numericId = Number(field.id);
    if (!Number.isInteger(numericId) || numericId < 26 || numericId > 51) continue;

    try {
      const nested = parseTlv(field.value);
      const gui = nested.find((item) => item.id === "00")?.value?.toUpperCase();
      if (gui !== "BR.GOV.BCB.PIX") continue;

      const key = nested.find((item) => item.id === "01")?.value?.trim();
      if (key) return key;
    } catch {
      // Não é um bloco PIX.
    }
  }

  return "";
}

export function normalizeManualPixInput(input: string) {
  const raw = input.trim();
  if (!raw) throw new Error("Informe a chave PIX ou o PIX Copia e Cola.");

  const isCopyPaste =
    raw.startsWith("000201") &&
    raw.toUpperCase().includes("BR.GOV.BCB.PIX");

  if (!isCopyPaste) {
    if (Buffer.byteLength(raw, "utf8") > 77) {
      throw new Error("A chave PIX informada é maior que o limite permitido.");
    }

    return {
      key: raw,
      payload: null as string | null,
      inputType: "key" as const
    };
  }

  const match = raw.match(/6304([0-9A-F]{4})$/i);
  if (!match) throw new Error("PIX Copia e Cola inválido.");

  const expected = crc16Ccitt(raw.slice(0, -4));
  if (expected !== match[1].toUpperCase()) {
    throw new Error("PIX Copia e Cola inválido.");
  }

  const key = extractPixKeyFromPayload(raw);
  if (!key) {
    throw new Error("Não foi possível localizar a chave PIX dentro do código Copia e Cola.");
  }

  return {
    key,
    payload: raw,
    inputType: "copy_paste" as const
  };
}

export function normalizePixCopyPaste(value: string) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

export function isPixCopyPaste(value: string) {
  const normalized = normalizePixCopyPaste(value);
  if (normalized.length < 80) return false;

  const upper = normalized.toUpperCase();
  return (
    normalized.startsWith("000201") &&
    (upper.includes("BR.GOV.BCB.PIX") || upper.includes("BR.GOV.BCB.PIX"))
  );
}

function parseEmvFields(value: string) {
  const fields = new Map<string, string>();
  let offset = 0;

  while (offset + 4 <= value.length) {
    const id = value.slice(offset, offset + 2);
    const lengthText = value.slice(offset + 2, offset + 4);
    const length = Number(lengthText);

    if (!/^\d{2}$/.test(id) || !Number.isInteger(length) || length < 0) break;

    const start = offset + 4;
    const end = start + length;
    if (end > value.length) break;

    fields.set(id, value.slice(start, end));
    offset = end;
  }

  return fields;
}

export function extractPixKeyFromPayload(value: string) {
  const normalized = normalizePixCopyPaste(value);
  const top = parseEmvFields(normalized);

  for (const id of ["26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51"]) {
    const account = top.get(id);
    if (!account) continue;

    const nested = parseEmvFields(account);
    if (String(nested.get("00") ?? "").toUpperCase() !== "BR.GOV.BCB.PIX") continue;

    const key = String(nested.get("01") ?? "").trim();
    if (key) return key;
  }

  return null;
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
