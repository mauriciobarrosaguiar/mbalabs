import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getEncryptionKey() {
  const secret = process.env.GOOGLE_BUSINESS_TOKEN_SECRET ?? process.env.LEXGESTOR_TOKEN_SECRET;

  if (!secret) {
    throw new Error("Configure GOOGLE_BUSINESS_TOKEN_SECRET na Vercel.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptGoogleToken(value: string | null | undefined) {
  if (!value) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleToken(value: string | null | undefined) {
  if (!value) return null;

  const [ivValue, tagValue, encryptedValue] = value.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Token Google armazenado em formato inválido.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
