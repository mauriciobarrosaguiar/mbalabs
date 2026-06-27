"use server";

import { revalidatePath } from "next/cache";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { normalizeLavaStatus } from "@/lib/lavagestor-data";
import { getSupabaseServer } from "@/lib/supabase";

const TARGETS = ["na_fila", "em_lavagem", "finalizado", "cliente_avisado"] as const;
type KanbanTarget = (typeof TARGETS)[number];

const LABELS: Record<KanbanTarget, string> = {
  na_fila: "Na fila",
  em_lavagem: "Em lavagem",
  finalizado: "Finalizado",
  cliente_avisado: "Cliente avisado"
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

  if (validation.statusNovo === "cliente_avisado") {
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

  return { ok: true, status: validation.statusNovo, message: `Movido para ${LABELS[target]}.` };
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
