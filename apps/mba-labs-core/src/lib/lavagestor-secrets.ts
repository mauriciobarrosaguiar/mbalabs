import "server-only";

import crypto from "node:crypto";

type SecretPurpose = "ai" | "whatsapp";

const SECRET_ERROR = "Configure LAVAGESTOR_TOKEN_SECRET ou os secrets especificos na Vercel.";

export function encryptLavaSecret(value: string, purpose: SecretPurpose) {
  const plain = value.trim();
  if (!plain) return null;
  const key = secretKey(purpose);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptLavaSecret(value: string | null | undefined, purpose: SecretPurpose) {
  const encrypted = String(value ?? "").trim();
  if (!encrypted) return "";
  if (!encrypted.startsWith("v1:")) {
    throw new Error("Chave antiga ou invalida. Salve a chave novamente para criptografar.");
  }

  const [, ivValue, tagValue, encryptedValue] = encrypted.split(":");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Chave criptografada invalida. Salve a chave novamente.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(purpose), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function assertLavaSecretConfigured(purpose: SecretPurpose) {
  secretKey(purpose);
}

export function redactSensitiveText(value: unknown) {
  let text = String(value ?? "");
  for (const pattern of [
    /AIza[0-9A-Za-z_-]{20,}/g,
    /EAAG[0-9A-Za-z_-]{20,}/g,
    /Bearer\s+[0-9A-Za-z._-]+/gi,
    /apikey\s*[:=]\s*[0-9A-Za-z._-]+/gi,
    /access[_-]?token\s*[:=]\s*[0-9A-Za-z._-]+/gi
  ]) {
    text = text.replace(pattern, "[segredo oculto]");
  }
  return text.slice(0, 4000);
}

function secretKey(purpose: SecretPurpose) {
  const raw =
    purpose === "ai"
      ? process.env.LAVAGESTOR_AI_TOKEN_SECRET || process.env.LAVAGESTOR_TOKEN_SECRET
      : process.env.LAVAGESTOR_WHATSAPP_TOKEN_SECRET || process.env.LAVAGESTOR_TOKEN_SECRET;

  if (!raw || raw.trim().length < 16) {
    throw new Error(SECRET_ERROR);
  }

  return crypto.createHash("sha256").update(raw).digest();
}
