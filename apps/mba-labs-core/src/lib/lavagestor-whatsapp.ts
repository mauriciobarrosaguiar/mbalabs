type DbClient = any;

type QueueInput = {
  empresaId: string;
  clienteId?: string | null;
  lavagemId?: string | null;
  agendamentoId?: string | null;
  automacaoId?: string | null;
  automacaoFilaId?: string | null;
  telefone?: string | null;
  mensagem: string;
  tipo?: string;
  agendadoPara?: string | null;
};

export function buildWhatsappUrl(phone: unknown, message: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildAgendamentoConfirmacaoMessage({
  cliente,
  empresa,
  servico,
  quando
}: {
  cliente?: unknown;
  empresa?: unknown;
  servico?: unknown;
  quando?: unknown;
}) {
  return `Olá, ${String(cliente || "cliente")}! Confirmando seu agendamento na ${String(empresa || "empresa")} para ${String(quando || "o horário combinado")}, serviço: ${String(servico || "lavagem")}. Podemos confirmar?`;
}

export async function enqueueWhatsappMessage(client: DbClient, input: QueueInput) {
  if (!input.empresaId || !input.mensagem.trim()) return { ok: false, error: "Mensagem sem empresa ou conteudo." };

  const payload = {
    empresa_id: input.empresaId,
    cliente_id: input.clienteId || null,
    lavagem_id: input.lavagemId || null,
    agendamento_id: input.agendamentoId || null,
    automacao_id: input.automacaoId || null,
    automacao_fila_id: input.automacaoFilaId || null,
    telefone: input.telefone || null,
    mensagem: input.mensagem,
    provider: "manual",
    status: "pronto"
  };

  const { data, error } = await client.from("lava_whatsapp_envios").insert(payload).select("id,status").single();
  if (!error) return { ok: true, id: data?.id ? String(data.id) : null };

  if (input.agendamentoId) {
    const existing = await client
      .from("lava_whatsapp_envios")
      .select("id,status")
      .eq("empresa_id", input.empresaId)
      .eq("agendamento_id", input.agendamentoId)
      .neq("status", "cancelado")
      .maybeSingle();
    if (existing.data?.id) return { ok: true, id: String(existing.data.id), reused: true };
  }

  return { ok: false, error: String(error.message ?? "Não foi possível gerar fila de WhatsApp.") };
}

export async function enqueueAutomationQueue(client: DbClient, input: QueueInput) {
  if (!input.empresaId || !input.mensagem.trim()) return { ok: false, error: "Mensagem sem empresa ou conteudo." };

  if (input.agendamentoId) {
    const existing = await client
      .from("lava_automacao_fila")
      .select("id,status")
      .eq("empresa_id", input.empresaId)
      .eq("agendamento_id", input.agendamentoId)
      .eq("tipo", input.tipo || "confirmacao_agendamento")
      .neq("status", "cancelado")
      .maybeSingle();
    if (existing.data?.id) return { ok: true, id: String(existing.data.id), reused: true };
  }

  const { data, error } = await client
    .from("lava_automacao_fila")
    .insert({
      empresa_id: input.empresaId,
      automacao_id: input.automacaoId || null,
      cliente_id: input.clienteId || null,
      lavagem_id: input.lavagemId || null,
      agendamento_id: input.agendamentoId || null,
      canal: "whatsapp",
      tipo: input.tipo || "manual",
      mensagem: input.mensagem,
      status: "pronto",
      agendado_para: input.agendadoPara || new Date().toISOString()
    })
    .select("id,status")
    .single();

  if (error) return { ok: false, error: String(error.message ?? "Não foi possível gerar fila de automação.") };
  return { ok: true, id: data?.id ? String(data.id) : null };
}

export async function markWhatsappAsSent(client: DbClient, empresaId: string, id: string, source: "fila" | "envio" = "fila") {
  const table = source === "envio" ? "lava_whatsapp_envios" : "lava_automacao_fila";
  const { error } = await client
    .from(table)
    .update({ status: "enviado_manual", enviado_em: new Date().toISOString(), erro: null })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  return error ? { ok: false, error: String(error.message ?? "Não foi possível marcar como enviado.") } : { ok: true };
}

export async function sendWhatsappMessageIfConfigured(client: DbClient, input: QueueInput) {
  const queued = await enqueueWhatsappMessage(client, input);
  return {
    ...queued,
    provider: "manual",
    url: buildWhatsappUrl(input.telefone, input.mensagem)
  };
}
