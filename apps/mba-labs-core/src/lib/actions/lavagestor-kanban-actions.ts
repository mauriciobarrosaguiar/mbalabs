"use server";

import { revalidatePath } from "next/cache";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { normalizeLavaStatus } from "@/lib/lavagestor-data";
import { enqueueWhatsappMessage } from "@/lib/lavagestor-whatsapp";
import { getSupabaseServer } from "@/lib/supabase";

const TARGETS = ["na_fila", "em_lavagem", "finalizado", "cliente_avisado"] as const;
type KanbanTarget = (typeof TARGETS)[number];
type Row = Record<string, unknown>;

const LABELS: Record<KanbanTarget, string> = {
  na_fila: "Na fila",
  em_lavagem: "Em lavagem",
  finalizado: "Finalizado",
  cliente_avisado: "Cliente avisado"
};

const PAYMENT_LABELS: Record<string, string> = {
  aberto: "em aberto",
  parcial: "parcialmente pago",
  pago: "pago",
  fiado: "fiado",
  cancelado: "cancelado"
};

export async function moveLavagemKanban(id: string, targetStatus: string) {
  const target = normalizeTarget(targetStatus);
  if (!id || !target) {
    return { ok: false, error: "Movimento inválido." };
  }

  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const { data: lavagem, error } = await client
    .from("lava_lavagens")
    .select("id,status,status_pagamento")
    .eq("id", id)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !lavagem) {
    return { ok: false, error: error?.message ?? "Lavagem não encontrada." };
  }

  const statusAnterior = normalizeLavaStatus(lavagem.status);
  const normalizedPayment = String(lavagem.status_pagamento ?? "aberto");

  if (["cancelado", "entregue"].includes(statusAnterior)) {
    return { ok: false, error: "Esta lavagem não pode ser movida no Kanban." };
  }

  if (belongsToTarget(statusAnterior, target)) {
    return { ok: true, status: statusAnterior, message: "Lavagem já está nesta etapa." };
  }

  const validation = validateMove(statusAnterior, target, normalizedPayment);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { status: validation.statusNovo };

  if (validation.statusNovo === "em_lavagem") {
    payload.data_inicio = now;
  }

  if (validation.statusNovo === "finalizado") {
    payload.data_finalizacao = now;
  }

  if (validation.statusNovo === "cliente_avisado" || validation.statusNovo === "pago") {
    payload.data_cliente_avisado = now;
  }

  const { error: updateError } = await client
    .from("lava_lavagens")
    .update(payload)
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  let whatsappMessage = "";
  if (validation.statusNovo === "cliente_avisado" || validation.statusNovo === "pago") {
    const whatsapp = await enqueueRetiradaWhatsapp(client, current, id).catch(async (whatsappError) => {
      await client.from("lava_historico").insert({
        empresa_id: current.empresaId,
        lavagem_id: id,
        usuario_id: current.usuario.id,
        acao: "whatsapp_erro_veiculo_pronto",
        status_anterior: statusAnterior,
        status_novo: validation.statusNovo,
        observacao: whatsappError instanceof Error ? whatsappError.message : "Falha ao enviar WhatsApp de veículo pronto."
      });
      return { ok: false, error: "WhatsApp não enviado." };
    });
    whatsappMessage = whatsapp.ok ? " Cliente avisado automaticamente no WhatsApp." : " WhatsApp não enviado; confira a fila de WhatsApp.";
  }

  await client.from("lava_historico").insert({
    empresa_id: current.empresaId,
    lavagem_id: id,
    usuario_id: current.usuario.id,
    acao: "mover_kanban",
    status_anterior: statusAnterior,
    status_novo: validation.statusNovo,
    observacao: `Movido no Kanban para ${LABELS[target]}`
  });

  await logAction({
    appSlug: "lavagestor",
    acao: "mover lavagem no kanban",
    detalhes: { id, statusAnterior, statusNovo: validation.statusNovo }
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/lavagens");
  revalidatePath("/lavagestor/relatorios");
  revalidatePath("/lavagestor/whatsapp");

  return { ok: true, status: validation.statusNovo, message: `Movido para ${LABELS[target]}.${whatsappMessage}` };
}

async function enqueueRetiradaWhatsapp(client: any, current: { empresaId: string | null; usuario: { id: string } }, lavagemId: string) {
  const { data } = await client
    .from("lava_lavagens")
    .select("id,cliente_id,status_pagamento,valor_final,valor,valor_recebido,valor_pendente,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor),lava_servicos(nome)")
    .eq("id", lavagemId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (!data) return { ok: false, error: "Lavagem não encontrada para WhatsApp." };

  const cliente = relationObject(data.lava_clientes);
  const veiculo = relationObject(data.lava_veiculos);
  const servico = relationObject(data.lava_servicos);
  const total = money(data.valor_final ?? data.valor ?? 0);
  const pendente = money(data.valor_pendente ?? 0);
  const statusPagamento = String(data.status_pagamento ?? "aberto");
  const statusPagamentoLabel = PAYMENT_LABELS[statusPagamento] ?? statusPagamento;

  const mensagem = [
    `Ola, ${String(cliente?.nome ?? "cliente")}!`,
    `Seu veiculo ${vehicleLabel(veiculo)} esta pronto para retirada na LavaGestor.`,
    `Servico: ${String(servico?.nome ?? "lavagem")}.`,
    `Valor total: ${total}.`,
    `Status do pagamento: ${statusPagamentoLabel}.`,
    statusPagamento === "pago" ? "Pagamento confirmado." : `Valor pendente: ${pendente}.`,
    "Obrigado pela preferencia!"
  ].join("\n");

  return enqueueWhatsappMessage(current, {
    evento: "veiculo_pronto",
    clienteId: String(data.cliente_id ?? "") || null,
    lavagemId,
    telefone: String(cliente?.telefone ?? ""),
    mensagem,
    data: {
      cliente: String(cliente?.nome ?? "cliente"),
      veiculo: vehicleLabel(veiculo),
      placa: String(veiculo?.placa ?? ""),
      servico: String(servico?.nome ?? "lavagem"),
      total,
      valor: total,
      valor_pendente: pendente,
      status_pagamento: statusPagamentoLabel,
      empresa: "LavaGestor"
    }
  });
}

function normalizeTarget(value: string): KanbanTarget | null {
  return TARGETS.includes(value as KanbanTarget) ? (value as KanbanTarget) : null;
}

function belongsToTarget(status: string, target: KanbanTarget) {
  if (target === "finalizado") return ["aguardando_finalizacao", "finalizado"].includes(status);
  if (target === "cliente_avisado") return ["cliente_avisado", "pago"].includes(status);
  return status === target;
}

function validateMove(statusAnterior: string, target: KanbanTarget, paymentStatus: string): { ok: true; statusNovo: string } | { ok: false; error: string } {
  if (target === "na_fila") {
    if (!["em_lavagem"].includes(statusAnterior)) {
      return { ok: false, error: "Só é possível voltar para a fila uma lavagem que está em lavagem." };
    }
    return { ok: true, statusNovo: "na_fila" };
  }

  if (target === "em_lavagem") {
    if (!["na_fila"].includes(statusAnterior)) {
      return { ok: false, error: "Para ir para Em lavagem, o veículo precisa estar Na fila." };
    }
    return { ok: true, statusNovo: "em_lavagem" };
  }

  if (target === "finalizado") {
    if (!["em_lavagem", "aguardando_finalizacao"].includes(statusAnterior)) {
      return { ok: false, error: "Para finalizar, primeiro coloque a lavagem em andamento." };
    }
    return { ok: true, statusNovo: "finalizado" };
  }

  if (target === "cliente_avisado") {
    if (!["finalizado"].includes(statusAnterior)) {
      return { ok: false, error: "Para ir para Retirada, primeiro finalize a lavagem." };
    }
    if (paymentStatus === "pago") {
      return { ok: true, statusNovo: "pago" };
    }
    return { ok: true, statusNovo: "cliente_avisado" };
  }

  return { ok: false, error: "Movimento inválido." };
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Row) : null;
}

function vehicleLabel(value: unknown) {
  const relation = relationObject(value);
  if (!relation) return "veiculo";
  const model = [relation.marca, relation.modelo].filter(Boolean).join(" ");
  return [relation.placa, model, relation.cor].filter(Boolean).join(" - ") || "veiculo";
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
}
