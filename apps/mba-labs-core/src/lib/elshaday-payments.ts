import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ElshadayPixEnvironment = "sandbox" | "production";

export type ElshadayContributionType =
  | "dizimo"
  | "oferta"
  | "oferta_especial"
  | "campanha"
  | "outro";

type ElshadayMemberForPayment = {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
};

type ElshadayPixConfigRow = {
  igreja_id: string;
  provider: string;
  ambiente: ElshadayPixEnvironment;
  ativo: boolean;
  pix_address_key: string | null;
  static_qr_id: string | null;
  static_qr_payload: string | null;
  static_qr_image: string | null;
  static_qr_provider_payload: Record<string, unknown> | null;
};

type AsaasPayment = {
  id?: string;
  value?: number;
  netValue?: number;
  status?: string;
  billingType?: string;
  externalReference?: string;
  pixQrCodeId?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  confirmedDate?: string;
  description?: string;
  customer?: string;
  [key: string]: unknown;
};

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  authToken?: string;
  payment?: AsaasPayment;
  [key: string]: unknown;
};

const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_URL = "https://api.asaas.com/v3";
const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const REFUND_EVENTS = new Set([
  "PAYMENT_REFUNDED",
  "PAYMENT_DELETED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE"
]);
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export async function getElshadayPixStatus(igrejaId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("igreja_pix_configuracoes")
    .select("igreja_id,provider,ambiente,ativo,pix_address_key,static_qr_id,static_qr_payload,static_qr_image,static_qr_provider_payload")
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const config = (data ?? null) as ElshadayPixConfigRow | null;
  const environment = normalizeEnvironment(
    process.env.ELSHADAY_ASAAS_ENVIRONMENT ?? config?.ambiente ?? "sandbox"
  );
  const apiKey = String(process.env.ELSHADAY_ASAAS_API_KEY ?? "").trim();
  const webhookToken = String(process.env.ELSHADAY_ASAAS_WEBHOOK_TOKEN ?? "").trim();
  const addressKey = String(process.env.ELSHADAY_PIX_ADDRESS_KEY ?? config?.pix_address_key ?? "").trim();

  return {
    provider: "asaas" as const,
    environment,
    apiUrl: environment === "production" ? PRODUCTION_URL : SANDBOX_URL,
    active: Boolean(config?.ativo),
    apiKeyConfigured: Boolean(apiKey),
    webhookTokenConfigured: Boolean(webhookToken),
    addressKeyConfigured: Boolean(addressKey),
    ready: Boolean(config?.ativo && apiKey && webhookToken && addressKey),
    webhookUrl: buildWebhookUrl(),
    staticQrId: config?.static_qr_id ?? null,
    staticQrPayload: config?.static_qr_payload ?? null,
    staticQrImage: config?.static_qr_image ?? null
  };
}

export async function saveElshadayPixConfiguration(input: {
  igrejaId: string;
  environment: ElshadayPixEnvironment;
  active: boolean;
  addressKey: string;
  updatedBy: string;
}) {
  const admin = getSupabaseAdmin() as any;
  const { data: current, error: currentError } = await admin
    .from("igreja_pix_configuracoes")
    .select("ambiente,pix_address_key")
    .eq("igreja_id", input.igrejaId)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);

  const nextAddressKey = input.addressKey.trim() || null;
  const changed =
    Boolean(current) &&
    (String(current?.ambiente ?? "sandbox") !== input.environment ||
      String(current?.pix_address_key ?? "") !== String(nextAddressKey ?? ""));

  const payload = {
    igreja_id: input.igrejaId,
    provider: "asaas",
    ambiente: input.environment,
    ativo: input.active,
    pix_address_key: nextAddressKey,
    ...(changed
      ? {
          static_qr_id: null,
          static_qr_payload: null,
          static_qr_image: null,
          static_qr_provider_payload: null
        }
      : {}),
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString()
  };

  const { error } = await admin
    .from("igreja_pix_configuracoes")
    .upsert(payload, { onConflict: "igreja_id" });

  if (error) throw new Error(error.message);
}

export async function createElshadayStaticPixQrCode(igrejaId: string, updatedBy: string) {
  const settings = await requireOperationalSettings(igrejaId);
  const admin = getSupabaseAdmin() as any;

  const response = await asaasRequest<Record<string, unknown>>(settings, "/pix/qrCodes/static", {
    method: "POST",
    body: {
      addressKey: settings.addressKey,
      description: "Contribuições - Assembleia de Deus Elshaday Palmas",
      format: "ALL",
      allowsMultiplePayments: true,
      externalReference: `elshaday_static:${igrejaId}`
    }
  });

  const qrId = stringValue(response.id);
  const qrPayload = stringValue(response.payload);
  const qrImage =
    stringValue(response.encodedImage) ||
    stringValue(response.image) ||
    stringValue(response.qrCode);

  if (!qrId || !qrPayload) {
    throw new Error("O Asaas não retornou o ID e o código PIX esperados.");
  }

  const { error } = await admin
    .from("igreja_pix_configuracoes")
    .upsert(
      {
        igreja_id: igrejaId,
        provider: "asaas",
        ambiente: settings.environment,
        ativo: true,
        pix_address_key: settings.addressKey,
        static_qr_id: qrId,
        static_qr_payload: qrPayload,
        static_qr_image: qrImage || null,
        static_qr_provider_payload: response,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      },
      { onConflict: "igreja_id" }
    );

  if (error) throw new Error(error.message);

  return {
    id: qrId,
    payload: qrPayload,
    image: qrImage || null
  };
}

export async function createElshadayIdentifiedPixCharge(input: {
  igrejaId: string;
  member: ElshadayMemberForPayment;
  type: ElshadayContributionType;
  value: number;
  description?: string | null;
  createdBy: string;
}) {
  const settings = await requireOperationalSettings(input.igrejaId);
  const admin = getSupabaseAdmin() as any;

  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  if (value > 1000000) {
    throw new Error("O valor informado ultrapassa o limite permitido para esta contribuição.");
  }

  const cpf = onlyDigits(input.member.cpf);
  if (!isValidCpf(cpf)) {
    throw new Error("O cadastro do membro precisa ter um CPF válido para gerar PIX identificado.");
  }

  const allowedTypes: ElshadayContributionType[] = [
    "dizimo",
    "oferta",
    "oferta_especial",
    "campanha",
    "outro"
  ];
  if (!allowedTypes.includes(input.type)) {
    throw new Error("Tipo de contribuição inválido.");
  }

  const externalReference = `elshaday_identificado:${crypto.randomUUID()}`;
  const dueDate = addDaysIso(todayIsoDate(), 3);

  const { data: charge, error: chargeError } = await admin
    .from("igreja_pix_cobrancas")
    .insert({
      igreja_id: input.igrejaId,
      membro_id: input.member.id,
      tipo: input.type,
      descricao: input.description?.trim() || null,
      valor: Number(value.toFixed(2)),
      provider: "asaas",
      external_reference: externalReference,
      status: "criando",
      due_date: dueDate,
      created_by: input.createdBy
    })
    .select("id")
    .single();

  if (chargeError || !charge?.id) {
    throw new Error(chargeError?.message ?? "Não foi possível preparar a cobrança PIX.");
  }

  try {
    const customer = await getOrCreateAsaasCustomer({
      settings,
      igrejaId: input.igrejaId,
      member: input.member,
      cpf
    });

    const payment = await asaasRequest<AsaasPayment>(settings, "/payments", {
      method: "POST",
      body: {
        customer: customer.id,
        billingType: "PIX",
        value: Number(value.toFixed(2)),
        dueDate,
        description:
          input.description?.trim() ||
          `${contributionTypeLabel(input.type)} - Igreja Elshaday`,
        externalReference: externalReference
      }
    });

    const paymentId = stringValue(payment.id);
    if (!paymentId) {
      throw new Error("O Asaas não retornou o identificador da cobrança.");
    }

    const qr = await asaasRequest<Record<string, unknown>>(
      settings,
      `/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
      { method: "GET" }
    );

    const qrPayload = stringValue(qr.payload);
    const qrImage = stringValue(qr.encodedImage);
    const expirationDate = stringValue(qr.expirationDate);

    if (!qrPayload) {
      throw new Error("O Asaas não retornou o PIX Copia e Cola da cobrança.");
    }

    const { error: updateError } = await admin
      .from("igreja_pix_cobrancas")
      .update({
        provider_customer_id: customer.id,
        provider_payment_id: paymentId,
        status: "aguardando_pagamento",
        qr_payload: qrPayload,
        qr_image: qrImage || null,
        qr_expiration_at: normalizeTimestamp(expirationDate),
        provider_payload: {
          payment,
          qr
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", charge.id)
      .eq("igreja_id", input.igrejaId);

    if (updateError) throw new Error(updateError.message);

    return {
      id: String(charge.id),
      paymentId,
      qrPayload,
      qrImage: qrImage || null,
      dueDate,
      expirationDate: expirationDate || null
    };
  } catch (error) {
    await admin
      .from("igreja_pix_cobrancas")
      .update({
        status: "erro",
        provider_payload: {
          error: error instanceof Error ? error.message : "Erro ao gerar PIX identificado."
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", charge.id)
      .eq("igreja_id", input.igrejaId);

    throw error;
  }
}

export async function syncElshadayStaticPixReceipts(igrejaId: string) {
  const settings = await requireOperationalSettings(igrejaId);
  const admin = getSupabaseAdmin() as any;
  const { data: config, error: configError } = await admin
    .from("igreja_pix_configuracoes")
    .select("static_qr_id")
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (configError) throw new Error(configError.message);

  let imported = 0;
  let seen = 0;
  const qrId = stringValue(config?.static_qr_id);

  if (qrId) {
    let offset = 0;

    for (let page = 0; page < 20; page += 1) {
      const query = new URLSearchParams({
        pixQrCodeId: qrId,
        billingType: "PIX",
        limit: "100",
        offset: String(offset)
      });
      const response = await asaasRequest<{
        data?: AsaasPayment[];
        hasMore?: boolean;
        totalCount?: number;
      }>(settings, `/payments?${query.toString()}`, { method: "GET" });

      const payments = Array.isArray(response.data) ? response.data : [];
      seen += payments.length;

      for (const payment of payments) {
        if (!PAID_STATUSES.has(String(payment.status ?? "").toUpperCase())) continue;
        const result = await upsertAutomaticFinanceEntry({
          igrejaId,
          payment,
          eventId: null,
          origin: "sincronizacao_pix"
        });
        if (result.created) imported += 1;
      }

      if (!response.hasMore || payments.length === 0) break;
      offset += payments.length;
    }
  }

  const { data: pendingCharges, error: pendingError } = await admin
    .from("igreja_pix_cobrancas")
    .select("id,provider_payment_id,status")
    .eq("igreja_id", igrejaId)
    .eq("provider", "asaas")
    .in("status", ["aguardando_pagamento", "criando"])
    .not("provider_payment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (pendingError) throw new Error(pendingError.message);

  for (const charge of pendingCharges ?? []) {
    const paymentId = stringValue(charge.provider_payment_id);
    if (!paymentId) continue;

    const payment = await asaasRequest<AsaasPayment>(
      settings,
      `/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET" }
    );
    seen += 1;

    if (PAID_STATUSES.has(String(payment.status ?? "").toUpperCase())) {
      const result = await upsertAutomaticFinanceEntry({
        igrejaId,
        payment,
        eventId: null,
        origin: "sincronizacao_pix"
      });
      if (result.created) imported += 1;
    }
  }

  return { imported, seen };
}

export async function processElshadayAsaasWebhook(
  payload: AsaasWebhookPayload,
  receivedToken?: string | null
) {
  const expectedToken = String(process.env.ELSHADAY_ASAAS_WEBHOOK_TOKEN ?? "").trim();
  if (!expectedToken) {
    throw new Error("Webhook PIX do Elshaday ainda não possui token configurado.");
  }

  const payloadToken = String(payload.authToken ?? "").trim();
  const token = String(receivedToken ?? payloadToken ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token || token !== expectedToken) {
    throw new Error("Webhook PIX com token inválido.");
  }

  const eventType = String(payload.event ?? "").trim();
  const payment = payload.payment ?? {};
  const paymentId = stringValue(payment.id);
  const pixQrCodeId = stringValue(payment.pixQrCodeId);
  const externalReference = stringValue(payment.externalReference);
  const eventId = String(
    payload.id ?? `${eventType}:${paymentId || pixQrCodeId || externalReference || crypto.randomUUID()}`
  ).trim();

  const admin = getSupabaseAdmin() as any;
  let igrejaId = "";

  if (pixQrCodeId) {
    const { data: config, error } = await admin
      .from("igreja_pix_configuracoes")
      .select("igreja_id")
      .eq("provider", "asaas")
      .eq("static_qr_id", pixQrCodeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    igrejaId = stringValue(config?.igreja_id);
  }

  if (!igrejaId && externalReference.startsWith("elshaday_static:")) {
    igrejaId = externalReference.replace("elshaday_static:", "").trim();
  }

  if (!igrejaId && paymentId) {
    const { data: dynamicCharge, error: dynamicChargeError } = await admin
      .from("igreja_pix_cobrancas")
      .select("igreja_id")
      .eq("provider", "asaas")
      .eq("provider_payment_id", paymentId)
      .maybeSingle();

    if (dynamicChargeError) throw new Error(dynamicChargeError.message);
    igrejaId = stringValue(dynamicCharge?.igreja_id);
  }

  if (!igrejaId && externalReference.startsWith("elshaday_identificado:")) {
    const { data: dynamicCharge, error: dynamicChargeError } = await admin
      .from("igreja_pix_cobrancas")
      .select("igreja_id")
      .eq("provider", "asaas")
      .eq("external_reference", externalReference)
      .maybeSingle();

    if (dynamicChargeError) throw new Error(dynamicChargeError.message);
    igrejaId = stringValue(dynamicCharge?.igreja_id);
  }

  if (!igrejaId) {
    return { ok: true, ignored: true, reason: "evento não pertence ao PIX do Elshaday" };
  }

  const eventRow = await registerPixEvent({
    igrejaId,
    eventId,
    eventType,
    paymentId: paymentId || null,
    pixQrCodeId: pixQrCodeId || null,
    externalReference: externalReference || null,
    payload
  });

  if (eventRow.processed) {
    return { ok: true, duplicate: true };
  }

  try {
    if (PAID_EVENTS.has(eventType) && String(payment.billingType ?? "").toUpperCase() === "PIX") {
      await upsertAutomaticFinanceEntry({
        igrejaId,
        payment,
        eventId,
        origin: "automatico_pix"
      });
    }

    if (REFUND_EVENTS.has(eventType) && paymentId) {
      const { error } = await admin
        .from("igreja_financeiro_entradas")
        .update({
          status: "estornado",
          provider_event_id: eventId,
          provider_payload: payment
        })
        .eq("igreja_id", igrejaId)
        .eq("provider", "asaas")
        .eq("provider_payment_id", paymentId);

      if (error) throw new Error(error.message);

      const { error: chargeError } = await admin
        .from("igreja_pix_cobrancas")
        .update({
          status: "estornado",
          updated_at: new Date().toISOString()
        })
        .eq("igreja_id", igrejaId)
        .eq("provider", "asaas")
        .eq("provider_payment_id", paymentId);

      if (chargeError) throw new Error(chargeError.message);
    }

    await markEventProcessed(eventRow.id, null);
    return { ok: true, duplicate: false };
  } catch (error) {
    await markEventProcessed(
      eventRow.id,
      error instanceof Error ? error.message : "Erro ao processar evento PIX."
    );
    throw error;
  }
}

async function upsertAutomaticFinanceEntry(input: {
  igrejaId: string;
  payment: AsaasPayment;
  eventId: string | null;
  origin: "automatico_pix" | "sincronizacao_pix";
}) {
  const admin = getSupabaseAdmin() as any;
  const paymentId = stringValue(input.payment.id);
  if (!paymentId) throw new Error("Pagamento PIX sem identificador do provedor.");

  const [{ data: existing, error: findError }, { data: charge, error: chargeError }] =
    await Promise.all([
      admin
        .from("igreja_financeiro_entradas")
        .select("id,status")
        .eq("igreja_id", input.igrejaId)
        .eq("provider", "asaas")
        .eq("provider_payment_id", paymentId)
        .maybeSingle(),
      admin
        .from("igreja_pix_cobrancas")
        .select("id,membro_id,tipo,descricao,valor,status")
        .eq("igreja_id", input.igrejaId)
        .eq("provider", "asaas")
        .eq("provider_payment_id", paymentId)
        .maybeSingle()
    ]);

  if (findError) throw new Error(findError.message);
  if (chargeError) throw new Error(chargeError.message);

  const providerValue = Number(input.payment.value ?? 0);
  const configuredValue = Number(charge?.valor ?? 0);
  const value = configuredValue > 0 ? configuredValue : providerValue;

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Pagamento PIX sem valor válido.");
  }

  if (charge && providerValue > 0 && Math.abs(providerValue - configuredValue) > 0.009) {
    throw new Error("Valor confirmado pelo Asaas diverge da cobrança PIX identificada.");
  }

  const paidDate =
    normalizeDate(input.payment.clientPaymentDate) ??
    normalizeDate(input.payment.paymentDate) ??
    normalizeDate(input.payment.confirmedDate) ??
    todayIsoDate();

  const identified = Boolean(charge?.id);
  const receivedAt = toReceivedAt(
    input.payment.confirmedDate ??
    input.payment.clientPaymentDate ??
    input.payment.paymentDate ??
    paidDate
  );

  const data = {
    igreja_id: input.igrejaId,
    membro_id: identified ? charge.membro_id : null,
    tipo: identified ? charge.tipo : "oferta",
    descricao: identified
      ? charge.descricao || `PIX identificado - ${contributionTypeLabel(charge.tipo)}`
      : "PIX recebido automaticamente",
    valor: Number(value.toFixed(2)),
    forma_pagamento: "pix",
    data_entrada: paidDate,
    anonimo: !identified,
    observacoes: identified
      ? "Contribuição identificada e conciliada automaticamente pelo Asaas."
      : "Recebimento importado automaticamente pelo Asaas.",
    origem: input.origin,
    provider: "asaas",
    provider_payment_id: paymentId,
    provider_event_id: input.eventId,
    provider_payload: input.payment,
    pix_cobranca_id: identified ? charge.id : null,
    recebido_em: receivedAt,
    status: "confirmado"
  };

  let financeEntryId = existing?.id ?? null;

  if (existing?.id) {
    const { error } = await admin
      .from("igreja_financeiro_entradas")
      .update(data)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { data: inserted, error } = await admin
      .from("igreja_financeiro_entradas")
      .insert(data)
      .select("id")
      .single();

    if (error) {
      if (!isUniqueViolation(error)) throw new Error(error.message);
    } else {
      financeEntryId = inserted.id;
    }
  }

  if (identified) {
    const { error } = await admin
      .from("igreja_pix_cobrancas")
      .update({
        status: "pago",
        paid_at: receivedAt,
        provider_payload: {
          payment: input.payment
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", charge.id)
      .eq("igreja_id", input.igrejaId);

    if (error) throw new Error(error.message);
  }

  return { created: !existing?.id && Boolean(financeEntryId), id: financeEntryId };
}

async function registerPixEvent(input: {
  igrejaId: string;
  eventId: string;
  eventType: string;
  paymentId: string | null;
  pixQrCodeId: string | null;
  externalReference: string | null;
  payload: AsaasWebhookPayload;
}) {
  const admin = getSupabaseAdmin() as any;
  const { data: existing, error: findError } = await admin
    .from("igreja_pix_eventos")
    .select("id,processed")
    .eq("provider", "asaas")
    .eq("event_id", input.eventId)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing?.id) return existing as { id: string; processed: boolean };

  const { data, error } = await admin
    .from("igreja_pix_eventos")
    .insert({
      igreja_id: input.igrejaId,
      provider: "asaas",
      event_id: input.eventId,
      event_type: input.eventType || null,
      provider_payment_id: input.paymentId,
      pix_qr_code_id: input.pixQrCodeId,
      external_reference: input.externalReference,
      payload: input.payload
    })
    .select("id,processed")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: duplicated, error: duplicateError } = await admin
        .from("igreja_pix_eventos")
        .select("id,processed")
        .eq("provider", "asaas")
        .eq("event_id", input.eventId)
        .maybeSingle();
      if (duplicateError || !duplicated) {
        throw new Error(duplicateError?.message ?? "Falha ao recuperar evento PIX duplicado.");
      }
      return duplicated as { id: string; processed: boolean };
    }
    throw new Error(error.message);
  }

  return data as { id: string; processed: boolean };
}

async function markEventProcessed(eventId: string, processingError: string | null) {
  const admin = getSupabaseAdmin() as any;
  const { error } = await admin
    .from("igreja_pix_eventos")
    .update({
      processed: !processingError,
      processed_at: processingError ? null : new Date().toISOString(),
      processing_error: processingError
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);
}

async function getOrCreateAsaasCustomer(input: {
  settings: { apiUrl: string; apiKey: string };
  igrejaId: string;
  member: ElshadayMemberForPayment;
  cpf: string;
}) {
  const admin = getSupabaseAdmin() as any;
  const { data: existing, error: findError } = await admin
    .from("igreja_pix_pagadores")
    .select("provider_customer_id")
    .eq("igreja_id", input.igrejaId)
    .eq("membro_id", input.member.id)
    .eq("provider", "asaas")
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  const existingId = stringValue(existing?.provider_customer_id);
  if (existingId) return { id: existingId, created: false };

  const externalReference = `elshaday_membro:${input.member.id}`;
  const customerQuery = new URLSearchParams({
    externalReference,
    limit: "1",
    offset: "0"
  });
  const customerSearch = await asaasRequest<{ data?: Array<Record<string, unknown>> }>(
    input.settings,
    `/customers?${customerQuery.toString()}`,
    { method: "GET" }
  );

  let customer = Array.isArray(customerSearch.data) ? customerSearch.data[0] : null;

  if (!customer) {
    customer = await asaasRequest<Record<string, unknown>>(
      input.settings,
      "/customers",
      {
        method: "POST",
        body: {
          name: input.member.nome.trim(),
          cpfCnpj: input.cpf,
          email: input.member.email?.trim() || undefined,
          mobilePhone: onlyDigits(input.member.whatsapp || input.member.telefone).slice(-11) || undefined,
          externalReference,
          notificationDisabled: true
        }
      }
    );
  }

  const customerId = stringValue(customer?.id);
  if (!customerId) {
    throw new Error("O Asaas não retornou o identificador do pagador.");
  }

  const { error: saveError } = await admin
    .from("igreja_pix_pagadores")
    .upsert(
      {
        igreja_id: input.igrejaId,
        membro_id: input.member.id,
        provider: "asaas",
        provider_customer_id: customerId,
        provider_payload: customer,
        updated_at: new Date().toISOString()
      },
      { onConflict: "igreja_id,membro_id,provider" }
    );

  if (saveError) throw new Error(saveError.message);

  return { id: customerId, created: true };
}

function contributionTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    dizimo: "Dízimo",
    oferta: "Oferta",
    oferta_especial: "Oferta especial",
    campanha: "Campanha",
    outro: "Contribuição"
  };
  return labels[String(value ?? "")] ?? "Contribuição";
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (base: string, factor: number) => {
    let sum = 0;
    for (const digit of base) {
      sum += Number(digit) * factor;
      factor -= 1;
    }
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const first = calculateDigit(cpf.slice(0, 9), 10);
  const second = calculateDigit(cpf.slice(0, 9) + String(first), 11);
  return cpf.endsWith(`${first}${second}`);
}

function addDaysIso(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00-03:00`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(parsed);
}

function normalizeTimestamp(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function requireOperationalSettings(igrejaId: string) {
  const status = await getElshadayPixStatus(igrejaId);
  const apiKey = String(process.env.ELSHADAY_ASAAS_API_KEY ?? "").trim();

  const admin = getSupabaseAdmin() as any;
  const { data: config, error } = await admin
    .from("igreja_pix_configuracoes")
    .select("pix_address_key,ativo,ambiente")
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const finalAddressKey = String(
    process.env.ELSHADAY_PIX_ADDRESS_KEY ?? config?.pix_address_key ?? ""
  ).trim();

  if (!config?.ativo) throw new Error("Ative a integração PIX do Elshaday.");
  if (!apiKey) throw new Error("A API Key da conta Asaas da igreja ainda não está configurada.");
  if (!finalAddressKey) throw new Error("Informe a chave PIX da igreja.");

  const environment = normalizeEnvironment(
    process.env.ELSHADAY_ASAAS_ENVIRONMENT ?? config?.ambiente ?? status.environment
  );

  return {
    environment,
    apiUrl: environment === "production" ? PRODUCTION_URL : SANDBOX_URL,
    apiKey,
    addressKey: finalAddressKey
  };
}

async function asaasRequest<T>(
  settings: { apiUrl: string; apiKey: string },
  path: string,
  options: { method: string; body?: unknown }
): Promise<T> {
  const response = await fetch(`${settings.apiUrl}${path}`, {
    method: options.method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: settings.apiKey
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(resolveAsaasError(json) || `Erro Asaas ${response.status}.`);
  }

  return json as T;
}

function buildWebhookUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    "https://www.mbalabs.com.br";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return `${base.replace(/\/+$/, "")}/api/elshaday/webhooks/asaas`;
}

function resolveAsaasError(json: unknown) {
  const data = json as {
    errors?: Array<{ description?: string; message?: string }>;
    message?: string;
  } | null;
  return data?.errors?.[0]?.description ?? data?.errors?.[0]?.message ?? data?.message ?? "";
}

function normalizeEnvironment(value: unknown): ElshadayPixEnvironment {
  return String(value ?? "").toLowerCase() === "production" ? "production" : "sandbox";
}

function normalizeDate(value: unknown) {
  const date = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function todayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function toReceivedAt(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00-03:00`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function isUniqueViolation(error: unknown) {
  const code =
    typeof error === "object" && error !== null
      ? String((error as Record<string, unknown>).code ?? "")
      : "";
  const message =
    typeof error === "object" && error !== null
      ? String((error as Record<string, unknown>).message ?? "")
      : "";
  return code === "23505" || message.toLowerCase().includes("duplicate key");
}
