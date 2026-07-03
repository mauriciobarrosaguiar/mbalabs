import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { decryptLavaSecret, redactSensitiveText } from "@/lib/lavagestor-secrets";

type Row = Record<string, unknown>;

type RouteProps = {
  params: Promise<{ provider: string }>;
};

const PROVIDERS = new Set(["evolution", "whatsapp_cloud_api"]);

export async function POST(request: Request, { params }: RouteProps) {
  const { provider } = await params;
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ ok: false, error: "Provider invalido." }, { status: 400 });
  }

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  try {
    const externalId = extractExternalId(payload);
    if (!externalId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "external_id ausente" });
    }

    const admin = getSupabaseAdmin() as any;
    const { data: envio, error: envioError } = await admin
      .from("lava_whatsapp_envios")
      .select("id,empresa_id,status")
      .eq("provider", provider)
      .eq("external_id", externalId)
      .maybeSingle();

    if (envioError) {
      return NextResponse.json({ ok: false, error: envioError.message }, { status: 500 });
    }
    if (!envio) {
      return NextResponse.json({ ok: true, ignored: true, reason: "envio nao encontrado" });
    }

    const integration = await getIntegration(admin, String((envio as Row).empresa_id ?? ""), provider);
    const secretCheck = validateWebhookSecret(request, integration);
    if (!secretCheck.ok) {
      return NextResponse.json({ ok: false, error: secretCheck.error }, { status: 401 });
    }

    const normalized = normalizeStatus(payload);
    const update: Row = {
      resposta_provider: sanitizePayload(payload),
      updated_at: new Date().toISOString()
    };

    if (normalized.status === "enviado") {
      update.status = "enviado";
      update.erro = null;
      update.enviado_em = new Date().toISOString();
    } else if (normalized.status === "erro") {
      update.status = "erro";
      update.erro = normalized.error;
    }

    const { error: updateError } = await admin
      .from("lava_whatsapp_envios")
      .update(update)
      .eq("id", (envio as Row).id)
      .eq("empresa_id", (envio as Row).empresa_id);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, external_id: externalId, status: update.status ?? "registrado" });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: redactSensitiveText(error instanceof Error ? error.message : "Falha no webhook do WhatsApp.") },
      { status: 500 }
    );
  }
}

async function getIntegration(admin: any, empresaId: string, provider: string): Promise<Row | null> {
  if (!empresaId) return null;
  const { data } = await admin
    .from("lava_whatsapp_integracoes")
    .select("webhook_secret_encrypted")
    .eq("empresa_id", empresaId)
    .eq("provider", provider)
    .maybeSingle();
  return (data ?? null) as Row | null;
}

function validateWebhookSecret(request: Request, integration: Row | null) {
  const encrypted = String(integration?.webhook_secret_encrypted ?? "").trim();
  if (!encrypted) return { ok: true };

  let expected = "";
  try {
    expected = decryptLavaSecret(encrypted, "whatsapp");
  } catch (error) {
    return { ok: false, error: redactSensitiveText(error instanceof Error ? error.message : "Webhook secret invalido.") };
  }

  const received =
    request.headers.get("x-lavagestor-webhook-secret") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!received || received !== expected) {
    return { ok: false, error: "Webhook secret invalido." };
  }
  return { ok: true };
}

function extractExternalId(payload: unknown): string {
  const candidates = [
    valueAt(payload, ["messageId"]),
    valueAt(payload, ["message_id"]),
    valueAt(payload, ["external_id"]),
    valueAt(payload, ["data", "key", "id"]),
    valueAt(payload, ["data", "message", "key", "id"]),
    valueAt(payload, ["data", "messageId"]),
    valueAt(payload, ["entry", 0, "changes", 0, "value", "statuses", 0, "id"]),
    valueAt(payload, ["messages", 0, "id"]),
    valueAt(payload, ["statuses", 0, "id"])
  ];
  return String(candidates.find((item) => item) ?? "").trim();
}

function normalizeStatus(payload: unknown) {
  const raw = String(
    valueAt(payload, ["status"]) ||
      valueAt(payload, ["data", "status"]) ||
      valueAt(payload, ["entry", 0, "changes", 0, "value", "statuses", 0, "status"]) ||
      valueAt(payload, ["statuses", 0, "status"]) ||
      ""
  ).toLowerCase();

  if (["sent", "delivered", "read", "server_ack", "delivery_ack", "played", "enviado"].includes(raw)) {
    return { status: "enviado" };
  }
  if (["failed", "error", "erro"].includes(raw)) {
    const detail = String(
      valueAt(payload, ["error"]) ||
        valueAt(payload, ["errors", 0, "message"]) ||
        valueAt(payload, ["entry", 0, "changes", 0, "value", "statuses", 0, "errors", 0, "message"]) ||
        "Provider retornou erro no webhook."
    );
    return { status: "erro", error: redactSensitiveText(detail) };
  }
  return { status: "registrado" };
}

function sanitizePayload(payload: unknown) {
  const redacted = redactSensitiveText(JSON.stringify(payload ?? {}));
  try {
    return JSON.parse(redacted);
  } catch {
    return { raw: redacted };
  }
}

function valueAt(source: unknown, path: Array<string | number>): unknown {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key as string];
  }
  return current;
}
