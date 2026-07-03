"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/core-data";
import { messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { normalizePlate } from "@/lib/lavagestor-placa";
import {
  buildAgendamentoConfirmacaoMessage,
  getWhatsappIntegration,
  normalizePhoneBR,
  sendWhatsappMessage
} from "@/lib/lavagestor-whatsapp";
import { getSupabaseServer } from "@/lib/supabase";
import { converterAgendamentoEmLavagem } from "./lavagestor-phase3-actions";

type Row = Record<string, unknown>;
type Current = { empresaId: string; usuario: { id: string } };

export { converterAgendamentoEmLavagem };

export async function saveLavaAgendamento(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
  ensureEmpresa(current);

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
    ? await client
        .from("lava_agendamentos")
        .update(payload)
        .eq("id", id)
        .eq("empresa_id", current.empresaId)
        .select("id")
        .single()
    : await client
        .from("lava_agendamentos")
        .insert(payload)
        .select("id")
        .single();

  if (result.error) {
    redirect(`/lavagestor/agendamentos?error=${messageParam(result.error.message)}`);
  }

  const confirmation = result.data?.id
    ? await sendAgendamentoConfirmation(client, current, String(result.data.id))
    : { message: "Confirmação não preparada." };

  await logAction({
    appSlug: "lavagestor",
    acao: id ? "editar agendamento" : "criar agendamento",
    detalhes: { id, data, hora }
  });

  revalidateLavaAgendamentos();
  redirect(`/lavagestor/agendamentos?ok=${messageParam(`Agendamento salvo. ${confirmation.message}`)}`);
}

export async function updateLavaAgendamentoStatus(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
  ensureEmpresa(current);

  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");
  const allowed = new Set(["confirmado", "compareceu", "nao_compareceu", "cancelado", "agendado"]);

  if (!id || !allowed.has(status)) {
    redirect(`/lavagestor/agendamentos?error=${messageParam("Ação inválida para o agendamento.")}`);
  }

  const { error } = await client
    .from("lava_agendamentos")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/agendamentos?error=${messageParam(error.message)}`);
  }

  await logAction({
    appSlug: "lavagestor",
    acao: "status agendamento",
    detalhes: { id, status }
  });

  revalidateLavaAgendamentos();

  const label =
    status === "cancelado"
      ? "Agendamento cancelado."
      : status === "confirmado"
        ? "Agendamento confirmado."
        : "Agendamento atualizado.";

  redirect(`/lavagestor/agendamentos?ok=${messageParam(label)}`);
}

export async function sendLavaAgendamentoConfirmation(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
  ensureEmpresa(current);

  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");

  if (!id) {
    redirect(`/lavagestor/agendamentos?error=${messageParam("Agendamento não informado.")}`);
  }

  const result = await sendAgendamentoConfirmation(client, current, id);
  revalidateLavaAgendamentos();

  if (result.status === "enviado") {
    redirect(`/lavagestor/agendamentos?ok=${messageParam("Confirmação enviada ao cliente.")}`);
  }

  redirect(`/lavagestor/agendamentos?error=${messageParam(result.message)}`);
}

async function sendAgendamentoConfirmation(client: any, current: Current, agendamentoId: string) {
  const { data: agendamento, error } = await client
    .from("lava_agendamentos")
    .select("id,cliente_id,servico_id,data_inicio,lava_clientes(nome,telefone),lava_servicos(nome)")
    .eq("id", agendamentoId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !agendamento) {
    return { status: "erro", message: "Não foi possível preparar a confirmação." };
  }

  const cliente = relationObject(agendamento.lava_clientes);
  const servico = relationObject(agendamento.lava_servicos);
  const telefone = normalizePhoneBR(cliente?.telefone);

  if (!telefone) {
    await updateConfirmation(client, current.empresaId, agendamentoId, "erro", "Cliente sem WhatsApp válido.");
    return { status: "erro", message: "Cliente sem WhatsApp válido." };
  }

  const configResult = await client
    .from("lava_configuracoes")
    .select("nome_exibicao,mensagem_confirmacao_agendamento")
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  const config = (configResult.data ?? {}) as Row;

  const mensagem =
    applyTemplate(String(config.mensagem_confirmacao_agendamento || ""), {
      cliente: String(cliente?.nome ?? "cliente"),
      empresa: String(config.nome_exibicao ?? "empresa"),
      servico: String(servico?.nome ?? "lavagem"),
      data: formatDateShort(agendamento.data_inicio),
      horario: formatTimeShort(agendamento.data_inicio)
    }) ||
    buildAgendamentoConfirmacaoMessage({
      cliente: cliente?.nome,
      empresa: config.nome_exibicao,
      servico: servico?.nome,
      quando: `${formatDateShort(agendamento.data_inicio)} ${formatTimeShort(agendamento.data_inicio)}`.trim()
    });

  const integration = await getWhatsappIntegration(current);

  if (integration.provider === "manual" || integration.status !== "conectado") {
    await updateConfirmation(client, current.empresaId, agendamentoId, "pronto", null);
    return { status: "pronto", message: "Confirmação preparada. Clique em Enviar confirmação." };
  }

  if (integration.eventFlags.confirmacao_agendamento !== true) {
    await updateConfirmation(client, current.empresaId, agendamentoId, "pronto", "Confirmação automática desativada.");
    return { status: "pronto", message: "Confirmação preparada, mas o envio automático está desativado." };
  }

  const envioId = await upsertWhatsappEnvio(client, current, {
    agendamentoId,
    clienteId: String(agendamento.cliente_id ?? "") || null,
    telefone,
    mensagem,
    provider: integration.provider
  });

  const sent = await sendWhatsappMessage(current, envioId);

  if (!sent.ok || sent.manual) {
    const erro = String((sent as Row).error || "Falha ao enviar WhatsApp automático.");
    await updateConfirmation(client, current.empresaId, agendamentoId, "erro", erro);
    return { status: "erro", message: `Confirmação automática falhou: ${erro}` };
  }

  const now = new Date().toISOString();

  await client
    .from("lava_agendamentos")
    .update({
      confirmacao_status: "enviado",
      confirmacao_enviada_em: now,
      confirmacao_erro: null
    })
    .eq("id", agendamentoId)
    .eq("empresa_id", current.empresaId);

  await client
    .from("lava_automacao_fila")
    .update({
      status: "enviado_manual",
      enviado_em: now,
      erro: null
    })
    .eq("empresa_id", current.empresaId)
    .eq("agendamento_id", agendamentoId)
    .eq("tipo", "confirmacao_agendamento");

  return { status: "enviado", message: "Confirmação enviada automaticamente ao cliente." };
}

async function upsertWhatsappEnvio(
  client: any,
  current: Current,
  input: {
    agendamentoId: string;
    clienteId: string | null;
    telefone: string;
    mensagem: string;
    provider: string;
  }
) {
  const existing = await client
    .from("lava_whatsapp_envios")
    .select("id,status")
    .eq("empresa_id", current.empresaId)
    .eq("agendamento_id", input.agendamentoId)
    .eq("evento", "confirmacao_agendamento")
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    if (String(existing.data.status) === "enviado") {
      return String(existing.data.id);
    }

    const { error } = await client
      .from("lava_whatsapp_envios")
      .update({
        telefone: input.telefone,
        mensagem: input.mensagem,
        provider: input.provider,
        status: "aprovado",
        precisa_aprovacao: false,
        aprovado_por: current.usuario.id,
        aprovado_em: new Date().toISOString(),
        erro: null
      })
      .eq("id", existing.data.id)
      .eq("empresa_id", current.empresaId);

    if (error) {
      throw new Error(error.message);
    }

    return String(existing.data.id);
  }

  const inserted = await client
    .from("lava_whatsapp_envios")
    .insert({
      empresa_id: current.empresaId,
      usuario_id: current.usuario.id,
      cliente_id: input.clienteId,
      agendamento_id: input.agendamentoId,
      evento: "confirmacao_agendamento",
      telefone: input.telefone,
      mensagem: input.mensagem,
      mensagem_gerada_por: "modelo",
      provider: input.provider,
      status: "aprovado",
      precisa_aprovacao: false,
      aprovado_por: current.usuario.id,
      aprovado_em: new Date().toISOString()
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data?.id) {
    throw new Error(inserted.error?.message ?? "Não foi possível preparar o envio.");
  }

  return String(inserted.data.id);
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

async function updateConfirmation(client: any, empresaId: string, agendamentoId: string, status: string, erro: string | null) {
  await client
    .from("lava_agendamentos")
    .update({
      confirmacao_status: status,
      confirmacao_erro: erro
    })
    .eq("id", agendamentoId)
    .eq("empresa_id", empresaId);
}

function revalidateLavaAgendamentos() {
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/agendamentos");
  revalidatePath("/lavagestor/automacoes");
  revalidatePath("/lavagestor/whatsapp");
}

function ensureEmpresa(current: { empresaId: string | null; usuario: { id: string } }): asserts current is Current {
  if (!current.empresaId) {
    redirect(`/lavagestor/agendamentos?error=${messageParam("Selecione uma empresa para usar este módulo.")}`);
  }
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Row) : null;
}

function applyTemplate(template: string, variables: Record<string, string>) {
  if (!template.trim()) {
    return "";
  }

  return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function formatDateShort(value: unknown) {
  if (!value) {
    return "";
  }

  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "";
}

function formatTimeShort(value: unknown) {
  if (!value) {
    return "";
  }

  const date = new Date(String(value));
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";
}
