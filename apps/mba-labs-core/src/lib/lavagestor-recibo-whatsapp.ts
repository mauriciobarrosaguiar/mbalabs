import "server-only";

import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import { requireAppAccess } from "./core-data";
import { getLavaRecibo } from "./lavagestor-recibo-data";
import { decryptLavaSecret, redactSensitiveText } from "./lavagestor-secrets";
import { normalizePhoneBR } from "./lavagestor-whatsapp";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export async function sendLavagemReceiptWhatsapp(lavagemId: string, origem = "manual") {
  const current = await requireAppAccess("lavagestor");

  if (!current.empresaId) {
    return { ok: false, error: "Empresa não identificada." };
  }

  const { recibo, error } = await getLavaRecibo(lavagemId);

  if (!recibo) {
    return { ok: false, error: error ?? "Recibo não encontrado." };
  }

  if (recibo.status_pagamento !== "pago") {
    return { ok: false, error: "Recibo só pode ser enviado após pagamento confirmado." };
  }

  const phone = normalizePhoneBR(recibo.whatsapp);

  if (!phone) {
    return { ok: false, error: "Cliente sem WhatsApp válido para envio do recibo." };
  }

  const client = (await getSupabaseServer()) as any;
  const empresaId = String(current.empresaId);
  const integration = await getEvolutionIntegration(client, empresaId);

  if (!integration) {
    return { ok: false, error: "WhatsApp Evolution não conectado para envio do recibo em imagem." };
  }

  const png = await renderReceiptPng(recibo);
  const caption = receiptCaption(recibo);
  const fileName = `recibo-${recibo.numero}.png`;

  const insert = await client
    .from("lava_whatsapp_envios")
    .insert({
      empresa_id: empresaId,
      cliente_id: null,
      lavagem_id: recibo.id,
      evento: "recibo_pagamento",
      telefone: phone,
      mensagem: caption,
      mensagem_gerada_por: "modelo",
      provider: "evolution",
      status: "enviando",
      precisa_aprovacao: false,
      aprovado_por: current.usuario?.id ?? null,
      aprovado_em: new Date().toISOString(),
      erro: null
    })
    .select("id")
    .single();

  const envioId = insert.data?.id ? String(insert.data.id) : "";

  try {
    const sendResult = await sendReceiptImageViaEvolution({
      integration,
      phone,
      png,
      caption,
      fileName
    });

    if (envioId) {
      await client
        .from("lava_whatsapp_envios")
        .update({
          status: "enviado",
          external_id: sendResult.externalId ?? null,
          resposta_provider: sendResult.response ?? {},
          enviado_em: new Date().toISOString(),
          erro: null
        })
        .eq("id", envioId)
        .eq("empresa_id", empresaId);
    }

    await client.from("lava_historico").insert({
      empresa_id: empresaId,
      lavagem_id: recibo.id,
      usuario_id: current.usuario?.id ?? null,
      acao: "recibo_whatsapp_enviado",
      status_anterior: recibo.status,
      status_novo: recibo.status,
      observacao: `Recibo enviado por WhatsApp em imagem. Origem: ${origem}.`
    });

    return { ok: true, message: "Recibo enviado ao cliente pelo WhatsApp." };
  } catch (err) {
    const errorText = redactSensitiveText(err instanceof Error ? err.message : "Falha ao enviar recibo pelo WhatsApp.");

    if (envioId) {
      await client
        .from("lava_whatsapp_envios")
        .update({ status: "erro", erro: errorText })
        .eq("id", envioId)
        .eq("empresa_id", empresaId);
    }

    await client.from("lava_historico").insert({
      empresa_id: empresaId,
      lavagem_id: recibo.id,
      usuario_id: current.usuario?.id ?? null,
      acao: "recibo_whatsapp_erro",
      status_anterior: recibo.status,
      status_novo: recibo.status,
      observacao: errorText
    });

    return { ok: false, error: errorText };
  }
}

async function getEvolutionIntegration(client: any, empresaId: string) {
  const { data, error } = await client
    .from("lava_whatsapp_integracoes")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];

  return (
    rows.find((row) => row.provider === "evolution" && row.status === "conectado") ??
    rows.find((row) => row.provider === "evolution") ??
    null
  );
}

async function sendReceiptImageViaEvolution(params: {
  integration: Row;
  phone: string;
  png: Buffer;
  caption: string;
  fileName: string;
}) {
  const apiUrl = trimUrl(params.integration.api_url);
  const instance = String(params.integration.instancia_id ?? "").trim();

  if (!apiUrl || !instance) {
    throw new Error("Configure URL e instância da Evolution API.");
  }

  const apiKey = decryptLavaSecret(String(params.integration.api_key_encrypted ?? ""), "whatsapp");

  const response = await fetch(`${apiUrl}/message/sendMedia/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      number: params.phone,
      mediatype: "image",
      mimetype: "image/png",
      caption: params.caption,
      media: params.png.toString("base64"),
      fileName: params.fileName
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const json = await response.json().catch(() => ({}));

  return { ok: true, externalId: extractExternalId(json), response: json as Row };
}

async function renderReceiptPng(recibo: any) {
  const response = new ImageResponse(receiptElement(recibo), {
    width: 1080,
    height: 1500
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function receiptElement(recibo: any) {
  const primary = String(recibo.empresa?.cor_principal || "#059669");
  const servicos = Array.isArray(recibo.servicos) && recibo.servicos.length ? recibo.servicos : [];
  const servicoTexto = servicos.map((s: any) => `${String(s.descricao || "Serviço")} - ${formatMoney(s.valor)}`).join(" | ") || "Serviço";
  const pagamentoTexto = ["Pago", recibo.forma_pagamento].filter(Boolean).join(" - ");

  return h(
    "div",
    {
      style: {
        width: "1080px",
        height: "1500px",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial",
        color: "#10201a",
        padding: "64px",
        borderTop: `32px solid ${primary}`
      }
    },
    h("div", { style: { fontSize: 30, fontWeight: 900, color: primary, marginBottom: 24 } }, "RECIBO DE PAGAMENTO"),
    h("div", { style: { fontSize: 58, fontWeight: 900, marginBottom: 10 } }, String(recibo.empresa?.nome || "LavaGestor")),
    h(
      "div",
      { style: { fontSize: 24, fontWeight: 700, color: "#64748b", marginBottom: 42 } },
      [recibo.empresa?.cnpj, recibo.empresa?.telefone, recibo.empresa?.cidade_uf].filter(Boolean).join(" - ")
    ),

    h(
      "div",
      {
        style: {
          background: "#ecfdf5",
          border: "2px solid #dbe4de",
          borderRadius: 24,
          padding: 28,
          marginBottom: 40,
          display: "flex",
          flexDirection: "column"
        }
      },
      h("div", { style: { fontSize: 22, fontWeight: 900, color: primary } }, "Nº DO RECIBO"),
      h("div", { style: { fontSize: 48, fontWeight: 900, marginTop: 12 } }, String(recibo.numero || recibo.id || "-"))
    ),

    h(
      "div",
      { style: { display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 34 } },
      infoBox("CLIENTE", recibo.cliente),
      infoBox("WHATSAPP", recibo.whatsapp || "Não informado"),
      infoBox("VEÍCULO", recibo.veiculo),
      infoBox("LAVADOR", recibo.funcionario || "-"),
      infoBox("SERVIÇO", servicoTexto),
      infoBox("PAGAMENTO", pagamentoTexto),
      infoBox("DATA", formatDate(recibo.data_pagamento || recibo.data_entrada)),
      infoBox("STATUS", String(recibo.status_pagamento || "pago").toUpperCase())
    ),

    h(
      "div",
      {
        style: {
          background: "#f8fafc",
          borderRadius: 24,
          padding: 36,
          display: "flex",
          flexDirection: "column",
          gap: 26,
          marginTop: 10
        }
      },
      moneyLine("Total final", formatMoney(recibo.valor_final)),
      moneyLine("Valor recebido", formatMoney(recibo.valor_recebido)),
      moneyLine("Valor pendente", formatMoney(recibo.valor_pendente))
    ),

    h("div", { style: { flex: 1 } }),
    h("div", { style: { borderTop: "2px solid #dbe4de", paddingTop: 44, textAlign: "center", color: "#64748b", fontSize: 26, fontWeight: 800 } }, "Obrigado pela preferência."),
    h("div", { style: { textAlign: "center", color: "#64748b", fontSize: 22, fontWeight: 700, marginTop: 18 } }, "Recibo gerado pelo LavaGestor · MBA Labs")
  );
}

function infoBox(label: string, value: unknown) {
  return h(
    "div",
    {
      style: {
        width: "464px",
        minHeight: "104px",
        borderRadius: 18,
        background: "#f8fafc",
        padding: "20px",
        display: "flex",
        flexDirection: "column"
      }
    },
    h("div", { style: { fontSize: 20, fontWeight: 900, color: "#64748b", marginBottom: 12 } }, label),
    h("div", { style: { fontSize: 24, fontWeight: 800 } }, shortText(value, 38))
  );
}

function moneyLine(label: string, value: string) {
  return h(
    "div",
    { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
    h("div", { style: { fontSize: 28, fontWeight: 800, color: "#475569" } }, label),
    h("div", { style: { fontSize: 34, fontWeight: 900 } }, value)
  );
}

function receiptCaption(recibo: any) {
  return [
    `Olá, ${String(recibo.cliente || "cliente")}!`,
    `Segue o recibo de pagamento da lavagem ${String(recibo.numero || "")}.`,
    `Veículo: ${String(recibo.veiculo || "-")}.`,
    `Total pago: ${formatMoney(recibo.valor_recebido || recibo.valor_final)}.`,
    "Obrigado pela preferência!"
  ].join("\n");
}

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
}

function shortText(value: unknown, max: number) {
  const text = String(value ?? "-");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function trimUrl(value: unknown) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

async function responseErrorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  let detail = text;

  try {
    const json = JSON.parse(text);
    detail = json.error_description || json.error?.message || json.error?.error_user_msg || json.error || text;
  } catch {}

  return redactSensitiveText(`Evolution API erro ${response.status}: ${detail || response.statusText}`);
}

function extractExternalId(json: unknown) {
  const row = json as Row;
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const firstMessage = messages[0] as Row | undefined;

  return String(row.keyId ?? row.id ?? firstMessage?.id ?? row.messageId ?? "");
}
