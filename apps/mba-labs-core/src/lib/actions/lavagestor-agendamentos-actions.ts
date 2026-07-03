"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/core-data";
import { messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { normalizePlate } from "@/lib/lavagestor-placa";
import {
  buildAgendamentoConfirmacaoMessage,
  canSendAutomaticMessage,
  enqueueAutomationQueue,
  enqueueWhatsappMessage,
  getWhatsappIntegration,
  normalizePhoneBR,
  sendWhatsappMessage
} from "@/lib/lavagestor-whatsapp";
import { getSupabaseServer } from "@/lib/supabase";
import { converterAgendamentoEmLavagem } from "./lavagestor-phase3-actions";

export { converterAgendamentoEmLavagem };

type Row = Record<string, unknown>;
type Current = { empresaId: string | null; usuario: { id: string }; isAdminMaster?: boolean };

export async function saveLavaAgendamento(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
  ensureEmpresa(current, "/lavagestor/agendamentos");
  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");
  const data = textValue(formData, "data");
  const hora = textValue(formData, "hora_manual") || textValue(formData, "hora");
  const duracao = numberValue(formData, "duracao_min", 60) || 60;
  const clienteId = nullableTextValue(formData, "cliente_id");
  let veiculoId = nullableTextValue(formData, "veiculo_id");

  if (!data || !hora || hora === "__manual__" || !/^\d{2}:\d{2}$/.test(hora)) {
    redirect(`/lavagestor/agendamentos?error=${messageParam("Informe data e hora do agendamento.")}`);
  }
  if (!clienteId) {
    redirect(`/lavagestor/agendamentos?error=${messageParam("Selecione o cliente do agendamento.")}`);
  }

  if (veiculoId === "__novo__") {
    const placa = normalizePlate(textValue(formData, "novo_veiculo_placa"));
    const marca = textValue(formData, "novo_veiculo_marca");
    const modelo = textValue(formData, "novo_veiculo_modelo");
    if (!placa && !marca && !modelo) {
      redirect(`/lavagestor/agendamentos?error=${messageParam("Informe placa, marca ou modelo do novo veículo.")}`);
    }
    const inserted = await client
      .from("lava_veiculos")
      .insert({
        empresa_id: current.empresaId,
        cliente_id: clienteId,
        placa: placa || null,
        marca: marca || null,
        modelo: modelo || null,
        cor: nullableTextValue(formData, "novo_veiculo_cor"),
        tipo: textValue(formData, "novo_veiculo_tipo") || "carro",
        ativo: true
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data?.id) {
      redirect(`/lavagestor/agendamentos?error=${messageParam(inserted.error?.message ?? "Não foi possível cadastrar o veículo.")}`);
    }
    veiculoId = String(inserted.data.id);
  }

  const start = new Date(`${data}T${hora}:00`);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + duracao);
  const servicoId = nullableTextValue(formData, "servico_id");
  const tituloManual = nullableTextValue(formData, "titulo");
  const serviceName = servicoId ? await getServiceName(client, current.empresaId, servicoId) : "";
  const payload = {
    empresa_id: current.empresaId,
    cliente_id: clienteId,
    veiculo_id: veiculoId,
    servico_id: servicoId,
    funcionario_id: nullableTextValue(formData, "funcionario_id"),
    usuario_id: current.usuario.id,
    titulo: tituloManual || serviceName || "Agendamento",
    data_inicio: start.toISOString(),
    data_fim: end.toISOString(),
    duracao_min: duracao,
    status: textValue(formData, "status") || "agendado",
    observacao: nullableTextValue(formData, "observacao"),
    adicional_texto: nullableTextValue(formData, "adicional_texto"),
    origem: "manual"
  };

  const result = id
    ? await client.from("lava_agendamentos").update(payload).eq("id", id).eq("empresa_id", current.empresaId).select("id").single()
    : await client.from("lava_agendamentos").insert(payload).select("id").single();

  if (result.error) redirect(`/lavagestor/agendamentos?error=${messageParam(result.error.message)}`);

  let confirmationMessage = "Confirmação preparada.";
  if (result.data?.id) {
    const confirmation = await prepareAndMaybeSendAgendamentoConfirmation(client, current, String(result.data.id));
    confirmationMessage = confirmation.message;
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar agendamento" : "criar agendamento", detalhes: { id, data, hora } });
  revalidateAgendamentos();
  redirect(`/lavagestor/agendamentos?ok=${messageParam(`Agendamento salvo. ${confirmationMessage}`)}`);
}

export async function updateLavaAgendamentoStatus(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
  ensureEmpresa(current, "/lavagestor/agendamentos");
  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");
  const returnTo = safeReturn(formData, "/lavagestor/agendamentos");
  const allowed = new Set(["agendado", "confirmado", "compareceu", "nao_compareceu", "cancelado"]);

  if (!id || !allowed.has(status)) {
    redirect(`${returnTo}?error=${messageParam("Ação inválida para o agendamento.")}`);
  }

  const updatePayload: Row = { status, updated_at: new Date().toISOString() };
  if (status === "cancelado") {
    updatePayload.confirmacao_status = "cancelado";
    updatePayload.confirmacao_erro = null;
  }

  const { error } = await client
    .from("lava_agendamentos")
    .update(updatePayload)
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) redirect(`${returnTo}?error=${messageParam(error.message)}`);

  let okMessage = "Agendamento atualizado.";
  if (status === "cancelado") {
    await cancelAgendamentoConfirmation(client, current.empresaId, id);
    okMessage = "Agendamento cancelado. Confirmações pendentes foram canceladas.";
  }
  if (status === "confirmado") {
    const confirmation = await prepareAndMaybeSendAgendamentoConfirmation(client, current, id);
    okMessage = confirmation.message;
  }

  await logAction({ appSlug: "lavagestor", acao: "status agendamento", detalhes: { id, status } });
  revalidateAgendamentos();
  redirect(`${returnTo}?ok=${messageParam(okMessage)}`);
}

async function prepareAndMaybeSendAgendamentoConfirmation(client: any, current: Current & { empresaId: string }, agendamentoId: string) {
  const { data: agendamento, error } = await client
    .from("lava_agendamentos")
    .select("id,cliente_id,servico_id,data_inicio,status,lava_clientes(nome,telefone),lava_servicos(nome)")
    .eq("id", agendamentoId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !agendamento) return { status: "erro", message: "Não foi possível preparar a confirmação." };
  if (String(agendamento.status) === "cancelado") {
    await cancelAgendamentoConfirmation(client, current.empresaId, agendamentoId);
    return { status: "cancelado", message: "Agendamento cancelado. Nenhuma confirmação será enviada." };
  }

  const configResult = await client
    .from("lava_configuracoes")
    .select("nome_exibicao,mensagem_confirmacao_agendamento")
    .eq("empresa_id", current.empresaId)
    .maybeSingle();
  const config = (configResult.data ?? {}) as Row;
  const cliente = relationObject(agendamento.lava_clientes);
  const servico = relationObject(agendamento.lava_servicos);
  const telefone = normalizePhoneBR(cliente?.telefone);

  if (!telefone) {
    await updateConfirmation(client, current.empresaId, agendamentoId, "erro", "Cliente sem WhatsApp válido.");
    return { status: "erro", message: "Cliente sem WhatsApp válido." };
  }

  const mensagem = applyTemplate(
    String(config.mensagem_confirmacao_agendamento || ""),
    {
      cliente: String(cliente?.nome ?? "cliente"),
      empresa: String(config.nome_exibicao ?? "empresa"),
      servico: String(servico?.nome ?? "lavagem"),
      data: formatDateShort(agendamento.data_inicio),
      horario: formatTimeShort(agendamento.data_inicio)
    }
  ) || buildAgendamentoConfirmacaoMessage({
    cliente: cliente?.nome,
    empresa: config.nome_exibicao,
    servico: servico?.nome,
    quando: `${formatDateShort(agendamento.data_inicio)} ${formatTimeShort(agendamento.data_inicio)}`.trim()
  });

  const integration = await getWhatsappIntegration(current);
  const automaticTotal = integration.provider !== "manual" && integration.status === "conectado" && integration.modoEnvio === "automatico_total";
  const autoAllowed = automaticTotal
    ? await canSendAutomaticMessage(current, "confirmacao_agendamento", String(agendamento.cliente_id ?? "") || null)
    : { ok: false };

  const queue = automaticTotal
    ? { ok: true, skipped: true }
    : await enqueueAutomationQueue(client, {
        empresaId: current.empresaId,
        clienteId: String(agendamento.cliente_id ?? "") || null,
        agendamentoId,
        telefone,
        mensagem,
        tipo: "confirmacao_agendamento",
        agendadoPara: String(agendamento.data_inicio ?? "")
      });

  const envio = await enqueueWhatsappMessage(current, {
    evento: "confirmacao_agendamento",
    clienteId: String(agendamento.cliente_id ?? "") || null,
    agendamentoId,
    telefone,
    mensagem,
    data: {
      cliente: String(cliente?.nome ?? "cliente"),
      empresa: String(config.nome_exibicao ?? "empresa"),
      servico: String(servico?.nome ?? "lavagem"),
      data: formatDateShort(agendamento.data_inicio),
      hora: formatTimeShort(agendamento.data_inicio),
      horario: formatTimeShort(agendamento.data_inicio)
    }
  });

  const envioId = String((envio as Row).id ?? "");
  const queueError = queue.ok ? "" : String((queue as Row).error ?? "");

  if (!envio.ok) {
    const erro = [queueError, String((envio as Row).error ?? "")].filter(Boolean).join(" | ");
    await updateConfirmation(client, current.empresaId, agendamentoId, "erro", erro || "Falha ao preparar WhatsApp.");
    return { status: "erro", message: erro || "Falha ao preparar WhatsApp." };
  }

  if (automaticTotal) {
    if (!autoAllowed.ok) {
      const erro = String((autoAllowed as Row).error ?? "Envio automático não permitido pela configuração atual.");
      await updateConfirmation(client, current.empresaId, agendamentoId, "erro", erro);
      return { status: "erro", message: erro };
    }

    if (!envioId) {
      await updateConfirmation(client, current.empresaId, agendamentoId, "erro", "Mensagem automática não foi criada.");
      return { status: "erro", message: "Mensagem automática não foi criada." };
    }

    const approvedAt = new Date().toISOString();
    await client
      .from("lava_whatsapp_envios")
      .update({
        status: "pendente",
        precisa_aprovacao: false,
        aprovado_por: current.usuario.id,
        aprovado_em: approvedAt,
        erro: null
      })
      .eq("id", envioId)
      .eq("empresa_id", current.empresaId);

    const sent = await sendWhatsappMessage(current, envioId);
    if (sent.ok) {
      const now = new Date().toISOString();
      await updateConfirmation(client, current.empresaId, agendamentoId, "enviado", null, now);
      await client
        .from("lava_automacao_fila")
        .update({ status: "cancelado", erro: null, updated_at: now })
        .eq("empresa_id", current.empresaId)
        .eq("agendamento_id", agendamentoId)
        .eq("tipo", "confirmacao_agendamento")
        .neq("status", "enviado_manual");
      return { status: "enviado", message: "Confirmação enviada automaticamente pelo WhatsApp." };
    }

    const erro = String((sent as Row).error ?? "WhatsApp automático não enviado.");
    await updateConfirmation(client, current.empresaId, agendamentoId, "erro", erro);
    return { status: "erro", message: erro };
  }

  if (integration.provider !== "manual" && integration.status === "conectado" && integration.modoEnvio === "automatico_com_aprovacao") {
    await updateConfirmation(client, current.empresaId, agendamentoId, "aguardando_aprovacao", null);
    return { status: "aguardando_aprovacao", message: "Confirmação aguardando aprovação na fila de WhatsApp." };
  }

  const erro = [queueError, String((envio as Row).error ?? "")].filter(Boolean).join(" | ");
  await updateConfirmation(client, current.empresaId, agendamentoId, erro ? "erro" : String((envio as Row).status ?? "pronto"), erro || null);
  return { status: erro ? "erro" : String((envio as Row).status ?? "pronto"), message: erro || "Confirmação preparada para envio manual." };
}

async function cancelAgendamentoConfirmation(client: any, empresaId: string, agendamentoId: string) {
  const now = new Date().toISOString();
  await client
    .from("lava_whatsapp_envios")
    .update({ status: "cancelado", erro: null, updated_at: now })
    .eq("empresa_id", empresaId)
    .eq("agendamento_id", agendamentoId)
    .neq("status", "enviado");
  await client
    .from("lava_automacao_fila")
    .update({ status: "cancelado", erro: null, updated_at: now })
    .eq("empresa_id", empresaId)
    .eq("agendamento_id", agendamentoId)
    .neq("status", "enviado_manual");
  await updateConfirmation(client, empresaId, agendamentoId, "cancelado", null);
}

async function getServiceName(client: any, empresaId: string, servicoId: string) {
  const { data } = await client
    .from("lava_servicos")
    .select("nome")
    .eq("id", servicoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return String(data?.nome ?? "");
}

async function updateConfirmation(client: any, empresaId: string, agendamentoId: string, status: string, erro: string | null, enviadoEm?: string | null) {
  const payload: Row = { confirmacao_status: status, confirmacao_erro: erro };
  if (enviadoEm !== undefined) payload.confirmacao_enviada_em = enviadoEm;
  await client
    .from("lava_agendamentos")
    .update(payload)
    .eq("id", agendamentoId)
    .eq("empresa_id", empresaId);
}

function revalidateAgendamentos() {
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/agendamentos");
  revalidatePath("/lavagestor/automacoes");
  revalidatePath("/lavagestor/whatsapp");
}

function ensureEmpresa(current: Current, path: string): asserts current is Current & { empresaId: string } {
  if (!current.empresaId) redirect(`${path}?error=${messageParam("Selecione uma empresa para usar este modulo.")}`);
}

function safeReturn(formData: FormData, fallback: string) {
  const value = textValue(formData, "return_to");
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : fallback;
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Row) : null;
}

function applyTemplate(template: string, variables: Record<string, string>) {
  if (!template.trim()) return "";
  return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function formatDateShort(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "";
}

function formatTimeShort(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
}
