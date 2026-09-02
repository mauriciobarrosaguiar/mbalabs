import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ElshadayPixProvider } from "@/lib/elshaday-payment-providers";

type ProviderSecrets = Record<string, string>;

function encryptionKey() {
  const source = String(
    process.env.ELSHADAY_CREDENTIALS_ENCRYPTION_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  ).trim();

  if (!source) {
    throw new Error("Chave server-side para proteger credenciais PIX não configurada.");
  }

  return createHash("sha256").update("elshaday-pix-secrets:v1:" + source).digest();
}

function encryptJson(value: ProviderSecrets) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

function decryptJson(payload: string | null | undefined): ProviderSecrets {
  const raw = String(payload ?? "").trim();
  if (!raw) return {};

  const [version, ivText, tagText, cipherText] = raw.split(".");
  if (version !== "v1" || !ivText || !tagText || !cipherText) return {};

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivText, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherText, "base64url")),
      decipher.final()
    ]).toString("utf8");
    const parsed = JSON.parse(decrypted);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getElshadayProviderSecrets(
  igrejaId: string,
  provider: ElshadayPixProvider
): Promise<ProviderSecrets> {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("igreja_pix_configuracoes")
    .select("credenciais_criptografadas")
    .eq("igreja_id", igrejaId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return decryptJson(data?.credenciais_criptografadas);
}

export async function saveElshadayProviderSecrets(input: {
  igrejaId: string;
  provider: ElshadayPixProvider;
  patch: ProviderSecrets;
  updatedBy: string;
}) {
  const admin = getSupabaseAdmin() as any;
  const current = await getElshadayProviderSecrets(input.igrejaId, input.provider);
  const next: ProviderSecrets = { ...current };

  for (const [key, value] of Object.entries(input.patch)) {
    const normalized = String(value ?? "").trim();
    if (normalized) next[key] = normalized;
  }

  const encrypted = encryptJson(next);

  const { error } = await admin
    .from("igreja_pix_configuracoes")
    .upsert(
      {
        igreja_id: input.igrejaId,
        provider: input.provider,
        credenciais_criptografadas: encrypted,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString()
      },
      { onConflict: "igreja_id,provider" }
    );

  if (error) throw new Error(error.message);
}

export function secretConfigured(value: unknown) {
  return Boolean(String(value ?? "").trim());
}
