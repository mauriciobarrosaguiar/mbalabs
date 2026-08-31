import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ElshadayPixProvider =
  | "asaas"
  | "mercado_pago"
  | "pagbank"
  | "efi"
  | "inter";

export type ElshadayProviderDefinition = {
  id: ElshadayPixProvider;
  name: string;
  category: "gateway" | "banco";
  authMode: "api_key" | "access_token" | "oauth_certificate";
  adapterStatus: "operational" | "prepared";
  supportsIdentifiedPix: boolean;
  supportsStaticPix: boolean;
  requiresPixKey: boolean;
  environmentVariableNames: string[];
  optionalEnvironmentVariableNames?: string[];
  notes: string;
};

export const ELSHADAY_PIX_PROVIDERS: ElshadayProviderDefinition[] = [
  {
    id: "asaas",
    name: "Asaas",
    category: "gateway",
    authMode: "api_key",
    adapterStatus: "operational",
    supportsIdentifiedPix: true,
    supportsStaticPix: true,
    requiresPixKey: true,
    environmentVariableNames: [
      "ELSHADAY_ASAAS_API_KEY",
      "ELSHADAY_ASAAS_WEBHOOK_TOKEN"
    ],
    optionalEnvironmentVariableNames: ["ELSHADAY_PIX_ADDRESS_KEY"],
    notes: "Conector atual do Elshaday. PIX identificado, QR reutilizável, webhook e sincronização."
  },
  {
    id: "mercado_pago",
    name: "Mercado Pago",
    category: "gateway",
    authMode: "access_token",
    adapterStatus: "prepared",
    supportsIdentifiedPix: true,
    supportsStaticPix: false,
    requiresPixKey: false,
    environmentVariableNames: [
      "ELSHADAY_MERCADOPAGO_ACCESS_TOKEN",
      "ELSHADAY_MERCADOPAGO_WEBHOOK_SECRET"
    ],
    notes: "Estrutura preparada para PIX dinâmico com Access Token, idempotência e webhook assinado."
  },
  {
    id: "pagbank",
    name: "PagBank",
    category: "gateway",
    authMode: "access_token",
    adapterStatus: "operational",
    supportsIdentifiedPix: true,
    supportsStaticPix: false,
    requiresPixKey: false,
    environmentVariableNames: ["ELSHADAY_PAGBANK_TOKEN"],
    notes: "Conector operacional para PIX identificado via API Order, QR Code, idempotência, webhook e validação server-to-server."
  },
  {
    id: "efi",
    name: "Efí Bank",
    category: "banco",
    authMode: "oauth_certificate",
    adapterStatus: "prepared",
    supportsIdentifiedPix: true,
    supportsStaticPix: true,
    requiresPixKey: true,
    environmentVariableNames: [
      "ELSHADAY_EFI_CLIENT_ID",
      "ELSHADAY_EFI_CLIENT_SECRET",
      "ELSHADAY_EFI_CERTIFICATE_BASE64"
    ],
    optionalEnvironmentVariableNames: ["ELSHADAY_EFI_PIX_KEY"],
    notes: "Conector preparado para API Pix com OAuth, certificado, txid e webhook."
  },
  {
    id: "inter",
    name: "Banco Inter",
    category: "banco",
    authMode: "oauth_certificate",
    adapterStatus: "prepared",
    supportsIdentifiedPix: true,
    supportsStaticPix: true,
    requiresPixKey: true,
    environmentVariableNames: [
      "ELSHADAY_INTER_CLIENT_ID",
      "ELSHADAY_INTER_CLIENT_SECRET",
      "ELSHADAY_INTER_CERTIFICATE_BASE64",
      "ELSHADAY_INTER_PRIVATE_KEY_BASE64"
    ],
    optionalEnvironmentVariableNames: ["ELSHADAY_INTER_PIX_KEY", "ELSHADAY_INTER_ACCOUNT"],
    notes: "Conector preparado para API Pix PJ com OAuth, certificado e webhook."
  }
];

type ProviderConfigRow = {
  igreja_id: string;
  provider: ElshadayPixProvider;
  ambiente: "sandbox" | "production";
  ativo: boolean;
  principal: boolean;
  apelido: string | null;
  pix_address_key: string | null;
  config_publica: Record<string, unknown> | null;
  ultimo_teste_em: string | null;
  ultimo_teste_status: "ok" | "erro" | "pendente" | null;
  ultimo_teste_mensagem: string | null;
};

export async function listElshadayPixProviderStatus(igrejaId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("igreja_pix_configuracoes")
    .select("igreja_id,provider,ambiente,ativo,principal,apelido,pix_address_key,config_publica,ultimo_teste_em,ultimo_teste_status,ultimo_teste_mensagem")
    .eq("igreja_id", igrejaId);

  if (error) throw new Error(error.message);

  const configByProvider = new Map<ElshadayPixProvider, ProviderConfigRow>(
    (data ?? []).map((row: ProviderConfigRow) => [row.provider, row])
  );

  return ELSHADAY_PIX_PROVIDERS.map((definition) => {
    const config = configByProvider.get(definition.id) ?? null;
    const requiredEnvironment = definition.environmentVariableNames.map((name) => ({
      name,
      configured: Boolean(String(process.env[name] ?? "").trim())
    }));
    const optionalEnvironment = (definition.optionalEnvironmentVariableNames ?? []).map((name) => ({
      name,
      configured: Boolean(String(process.env[name] ?? "").trim())
    }));
    const credentialsConfigured = requiredEnvironment.every((item) => item.configured);
    const environmentPixKey =
      definition.id === "asaas"
        ? process.env.ELSHADAY_PIX_ADDRESS_KEY
        : definition.id === "efi"
          ? process.env.ELSHADAY_EFI_PIX_KEY
          : definition.id === "inter"
            ? process.env.ELSHADAY_INTER_PIX_KEY
            : "";
    const pixKeyConfigured = !definition.requiresPixKey || Boolean(
      String(config?.pix_address_key ?? environmentPixKey ?? "").trim()
    );
    const ready =
      definition.adapterStatus === "operational" &&
      Boolean(config?.ativo) &&
      credentialsConfigured &&
      pixKeyConfigured;

    return {
      ...definition,
      config,
      requiredEnvironment,
      optionalEnvironment,
      credentialsConfigured,
      pixKeyConfigured,
      ready,
      webhookUrl: buildProviderWebhookUrl(definition.id)
    };
  });
}

export async function saveElshadayPixProviderConfig(input: {
  igrejaId: string;
  provider: ElshadayPixProvider;
  environment: "sandbox" | "production";
  active: boolean;
  principal: boolean;
  apelido?: string | null;
  pixAddressKey?: string | null;
  updatedBy: string;
}) {
  const admin = getSupabaseAdmin() as any;
  const definition = getElshadayPixProviderDefinition(input.provider);

  if (input.principal && definition.adapterStatus !== "operational") {
    throw new Error(
      `${definition.name} já está preparado na arquitetura, mas o adaptador transacional ainda não foi ativado.`
    );
  }

  const { data: current, error: currentError } = await admin
    .from("igreja_pix_configuracoes")
    .select("ambiente,pix_address_key")
    .eq("igreja_id", input.igrejaId)
    .eq("provider", input.provider)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);

  if (input.principal) {
    const { error: clearError } = await admin
      .from("igreja_pix_configuracoes")
      .update({ principal: false, updated_at: new Date().toISOString() })
      .eq("igreja_id", input.igrejaId)
      .neq("provider", input.provider);

    if (clearError) throw new Error(clearError.message);
  }

  const nextPixKey = input.pixAddressKey?.trim() || null;
  const asaasQrChanged =
    input.provider === "asaas" &&
    Boolean(current) &&
    (
      String(current?.ambiente ?? "sandbox") !== input.environment ||
      String(current?.pix_address_key ?? "") !== String(nextPixKey ?? "")
    );

  const { error } = await admin
    .from("igreja_pix_configuracoes")
    .upsert(
      {
        igreja_id: input.igrejaId,
        provider: input.provider,
        ambiente: input.environment,
        ativo: input.active,
        principal: input.principal,
        apelido: input.apelido?.trim() || null,
        pix_address_key: nextPixKey,
        config_publica: {},
        ...(asaasQrChanged
          ? {
              static_qr_id: null,
              static_qr_payload: null,
              static_qr_image: null,
              static_qr_provider_payload: null
            }
          : {}),
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString()
      },
      { onConflict: "igreja_id,provider" }
    );

  if (error) throw new Error(error.message);
}

export async function getElshadayIdentifiedPixStatus(igrejaId: string) {
  const statuses = await listElshadayPixProviderStatus(igrejaId);
  const primary = statuses.find((item) => item.config?.principal) ?? null;

  if (primary) return primary;

  const asaas = statuses.find((item) => item.id === "asaas");
  if (asaas?.ready) return asaas;

  const firstReady = statuses.find((item) => item.ready);
  return firstReady ?? asaas ?? statuses[0];
}

export async function getElshadayPrimaryPixProvider(igrejaId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data: primary, error: primaryError } = await admin
    .from("igreja_pix_configuracoes")
    .select("provider,ativo,principal")
    .eq("igreja_id", igrejaId)
    .eq("principal", true)
    .maybeSingle();

  if (primaryError) throw new Error(primaryError.message);

  if (primary?.provider) {
    return primary.provider as ElshadayPixProvider;
  }

  const { data: asaas, error: asaasError } = await admin
    .from("igreja_pix_configuracoes")
    .select("provider")
    .eq("igreja_id", igrejaId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (asaasError) throw new Error(asaasError.message);
  return (asaas?.provider as ElshadayPixProvider | undefined) ?? "asaas";
}

export function getElshadayPixProviderDefinition(provider: string) {
  const definition = ELSHADAY_PIX_PROVIDERS.find((item) => item.id === provider);
  if (!definition) throw new Error("Provedor PIX inválido.");
  return definition;
}

export function parseElshadayPixProvider(value: string): ElshadayPixProvider {
  return getElshadayPixProviderDefinition(value).id;
}

function buildProviderWebhookUrl(provider: ElshadayPixProvider) {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    "https://www.mbalabs.com.br";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return `${base.replace(/\/+$/, "")}/api/elshaday/webhooks/${provider}`;
}
