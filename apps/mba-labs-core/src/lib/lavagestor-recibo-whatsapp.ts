import "server-only";

import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import { requireAppAccess } from "./core-data";
import { getLavaRecibo } from "./lavagestor-recibo-data";
import { decryptLavaSecret, redactSensitiveText } from "./lavagestor-secrets";
import { normalizePhoneBR } from "./lavagestor-whatsapp";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export async function sendLavagemReceiptWhatsapp(lavagemId: string, origem = "automatico") {
  const current = await requireAppAccess("lavagestor");
  const { recibo, error } = await getLavaRecibo(lavagemId);

  if (!recibo) return { ok: false, error: error ?? "Recibo não encontrado." };
  if (recibo.status === "cancelado" || recibo.status_pagamento === "cancelado") return { ok: false, error: "Lavagem cancelada não envia recibo financeiro." };
  if (recibo.status_pagamento !== "pago") return { ok: false, error: "Recibo só pode ser enviado após pagamento confirmado." };

  const empresaId = String(recibo.empresaId ?? recibo.empresa?.id ?? current.empresaId ?? "");
  if (!empresaId) return { ok: false, error: "Empresa do recibo não identificada." };

  const phone = normalizePhoneBR(recibo.whatsapp);
  if (!phone) return { ok: false, error: "Cliente sem WhatsApp válido para envio do recibo." };

  const client = (await getSupabaseServer()) as any;
  let envioId = "";

  try {
    const integration = await getEvolutionIntegration(client, empresaId);
    if (!integration) return { ok: false, error: "WhatsApp Evolution não conectado para esta empresa." };

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

    envioId = insert.data?.id ? String(insert.data.id) : "";

    const sendResult = await sendReceiptImageViaEvolution({ integration, phone, png, caption, fileName });
    if (envioId) {
      await client
        .from("lava_whatsapp_envios")
        .update({ status: "enviado", external_id: sendResult.externalId ?? null, resposta_provider: sendResult.response ?? {}, enviado_em: new Date().toISOString(), erro: null })
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
      observacao: `Recibo enviado automaticamente pelo WhatsApp em imagem. Origem: ${origem}.`
    });

    return { ok: true, message: "Recibo enviado automaticamente ao cliente pelo WhatsApp." };
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
    .eq("provider", "evolution")
    .eq("status", "conectado")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as Row | null;
}

async function sendReceiptImageViaEvolution(params: { integration: Row; phone: string; png: Buffer; caption: string; fileName: string }) {
  const apiUrl = trimUrl(params.integration.api_url);
  const instance = String(params.integration.instancia_id ?? "").trim();
  if (!apiUrl || !instance) throw new Error("Configure URL e instância da Evolution API.");

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

  if (!response.ok) throw new Error(await responseErrorMessage(response));
  const json = await response.json().catch(() => ({}));
  return { ok: true, externalId: extractExternalId(json), response: json as Row };
}

async function renderReceiptPng(recibo: any) {
  const response = new ImageResponse(receiptElement(recibo), { width: 1080, height: 1450 });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function receiptElement(recibo: any) {
  const primary = String(recibo.empresa?.cor_principal || "#047857");
  const services = Array.isArray(recibo.servicos) && recibo.servicos.length ? recibo.servicos : [];
  const payments = Array.isArray(recibo.pagamentos) ? recibo.pagamentos : [];
  const companyInfo = [recibo.empresa?.telefone, recibo.empresa?.cidade_uf].filter(Boolean).join(" - ");

  return h("div", { style: { width: 1080, height: 1450, background: "white", color: "#0f1f1a", fontFamily: "Arial", display: "flex", flexDirection: "column", padding: 50, borderBottom: `42px solid ${primary}` } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 26, borderBottom: "1px solid #dbe7df" } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontSize: 48, fontWeight: 900, color: primary } }, String(recibo.empresa?.nome || "LavaGestor")),
        h("div", { style: { fontSize: 20, fontWeight: 700, color: "#64748b", marginTop: 4 } }, "Powered by LavaGestor"),
        h("div", { style: { fontSize: 18, fontWeight: 700, color: "#64748b", marginTop: 6 } }, companyInfo)
      ),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
        h("div", { style: { fontSize: 35, fontWeight: 900, color: primary } }, "RECIBO DE SERVICO"),
        h("div", { style: { fontSize: 27, fontWeight: 900, marginTop: 12 } }, `N ${recibo.numero}`),
        h("div", { style: { fontSize: 20, color: "#64748b", fontWeight: 700, marginTop: 8 } }, formatDateTime(receiptDate(recibo)))
      )
    ),
    h("div", { style: { display: "flex", flexWrap: "wrap", border: "1px solid #dbe7df", borderRadius: 22, marginTop: 28, padding: 18 } },
      infoBlock("CLIENTE", recibo.cliente, "50%"),
      infoBlock("WHATSAPP", recibo.whatsapp || "Não informado", "50%"),
      infoBlock("VEICULO / ITEM", recibo.veiculo, "50%"),
      infoBlock("LAVADOR", recibo.funcionario || "-", "50%"),
      infoBlock("ENTRADA", formatDateTime(recibo.data_entrada), "50%"),
      infoBlock("FINALIZACAO", formatDateTime(recibo.data_finalizacao), "50%"),
      infoBlock("PAGAMENTO", ["Pago", recibo.forma_pagamento].filter(Boolean).join(" - "), "50%"),
      infoBlock("ENTREGA", deliveryLabel(recibo), "50%")
    ),
    sectionTitle("SERVICOS"),
    h("div", { style: { display: "flex", flexDirection: "column", border: "1px solid #dbe7df", borderRadius: 16, overflow: "hidden" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", background: "#ecfdf5", padding: "14px 18px", fontSize: 18, fontWeight: 900, color: primary } }, h("span", null, "DESCRICAO"), h("span", null, "VALOR")),
      ...(services.length ? services.map((s: any) => serviceRow(String(s.id ?? s.descricao), String(s.descricao || "Servico"), s.valor)) : [h("div", { key: "none", style: { display: "flex", padding: 16, fontSize: 20 } }, "Servico")])
    ),
    h("div", { style: { display: "flex", gap: 28, marginTop: 34, alignItems: "flex-start" } },
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", border: "1px solid #dbe7df", borderRadius: 18, padding: 22, minHeight: 300 } },
        sectionTitle("CHECKLIST E FOTOS"),
        h("div", { style: { marginTop: 16, fontSize: 19, fontWeight: 800, color: "#334155" } }, checklistSummary(recibo))
      ),
      h("div", { style: { width: 450, display: "flex", flexDirection: "column", border: "1px solid #dbe7df", borderRadius: 18, overflow: "hidden" } },
        h("div", { style: { background: primary, padding: 20, color: "white", fontSize: 24, fontWeight: 900 } }, "RESUMO FINANCEIRO"),
        h("div", { style: { padding: 24, display: "flex", flexDirection: "column", gap: 16 } },
          moneyLine("Total bruto", recibo.valor_total),
          moneyLine("Desconto", recibo.valor_desconto),
          h("div", { style: { borderTop: "1px dashed #cbd5e1", margin: "4px 0" } }),
          moneyLine("TOTAL FINAL", recibo.valor_final, true),
          moneyLine("Valor recebido", recibo.valor_recebido, false, primary),
          moneyLine("Valor pendente", recibo.valor_pendente, false, Number(recibo.valor_pendente) > 0 ? "#dc2626" : primary),
          h("div", { style: { background: "#ecfdf5", borderRadius: 14, padding: 14, color: primary, fontSize: 18, fontWeight: 900 } }, "Valor recebido integralmente.")
        )
      )
    ),
    payments.length ? h("div", { style: { display: "flex", flexDirection: "column", marginTop: 28 } },
      sectionTitle("PAGAMENTOS"),
      h("div", { style: { marginTop: 12, border: "1px solid #dbe7df", borderRadius: 16, padding: 16, fontSize: 20, fontWeight: 800 } }, payments.map((p: any) => `${formatMoney(p.valor)} ${p.forma_pagamento || ""} - ${formatDateTime(p.data_pagamento)}`).join(" | "))
    ) : null,
    h("div", { style: { marginTop: "auto", borderTop: `3px solid ${primary}`, paddingTop: 18, textAlign: "center", fontSize: 20, fontWeight: 900, color: primary } }, "Obrigado pela preferencia.")
  );
}

function infoBlock(label: string, value: unknown, width: string) {
  return h("div", { style: { width, padding: "12px 18px", display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb" } },
    h("div", { style: { fontSize: 16, fontWeight: 900, color: "#047857", letterSpacing: 1.4 } }, label),
    h("div", { style: { marginTop: 8, fontSize: 22, fontWeight: 900, lineHeight: 1.2 } }, String(value || "-"))
  );
}

function sectionTitle(title: string) {
  return h("div", { style: { display: "flex", marginTop: 28, marginBottom: 14, fontSize: 23, fontWeight: 900, color: "#047857" } }, title);
}

function serviceRow(key: string, description: string, value: unknown) {
  return h("div", { key, style: { display: "flex", justifyContent: "space-between", padding: "15px 18px", borderTop: "1px solid #e5e7eb", fontSize: 20, fontWeight: 800 } },
    h("span", null, description),
    h("span", null, formatMoney(value))
  );
}

function moneyLine(label: string, value: unknown, strong = false, color = "#0f1f1a") {
  return h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: strong ? 25 : 20, fontWeight: 900, color } },
    h("span", { style: { color: strong ? color : "#475569" } }, label),
    h("span", null, formatMoney(value))
  );
}

function receiptCaption(recibo: any) {
  return `Olá, ${String(recibo.cliente || "cliente")}! Segue seu recibo da lavagem ${String(recibo.numero || "")}. Veículo/item: ${String(recibo.veiculo || "-")}. Total pago: ${formatMoney(recibo.valor_recebido || recibo.valor_final)}. Obrigado pela preferência!`;
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

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
}

function formatDateTime(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR");
}

function receiptDate(recibo: any) {
  return recibo.data_pagamento || recibo.data_finalizacao || recibo.data_entrada;
}

function deliveryLabel(recibo: any) {
  return recibo.entrega_tipo === "levar" ? (recibo.endereco_entrega ? `Levar ao cliente: ${recibo.endereco_entrega}` : "Levar ao cliente") : "Cliente retira";
}

function checklistSummary(recibo: any) {
  if (!recibo.checklist) return "Lavagem sem checklist registrado.";
  const avarias = Array.isArray(recibo.checklist_avarias) && recibo.checklist_avarias.length ? recibo.checklist_avarias.join(" - ") : "Sem avarias marcadas.";
  const antes = Array.isArray(recibo.checklist_fotos_entrada) ? recibo.checklist_fotos_entrada.length : 0;
  const depois = Array.isArray(recibo.checklist_fotos_checkout) ? recibo.checklist_fotos_checkout.length : 0;
  return `${avarias} Fotos antes: ${antes}. Fotos depois: ${depois}.`;
}

function trimUrl(value: unknown) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function extractExternalId(json: unknown) {
  const row = json as Row;
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const firstMessage = messages[0] as Row | undefined;
  return String(row.keyId ?? row.id ?? firstMessage?.id ?? row.messageId ?? "");
}
