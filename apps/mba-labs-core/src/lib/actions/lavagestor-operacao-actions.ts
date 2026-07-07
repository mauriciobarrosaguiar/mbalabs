"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messageParam, textValue } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

type SaidaTipo = "pago" | "convenio" | "fiado" | "faturar" | "cancelado" | "finalizado";
type Row = Record<string, unknown>;

export async function registrarSaidaOperacao(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/operacao/saida");
  const empresaId = current.empresaId;
  const returnTo = safeReturn(textValue(formData, "return_to") || "/lavagestor/operacao/fila");

  if (!empresaId) {
    redirect(`${returnTo}?error=${messageParam("Empresa nao encontrada.")}`);
  }

  const lavagemId = textValue(formData, "lavagem_id");
  const tipo = normalizeTipoSaida(textValue(formData, "tipo_saida"));
  const funcionarioIds = uniqueValues([
    ...formData.getAll("funcionario_ids").map(String),
    textValue(formData, "funcionario_id")
  ]).filter(Boolean);
  const convenioNome = textValue(formData, "convenio_nome");

  if (!lavagemId || !tipo) {
    redirect(`${returnTo}?error=${messageParam("Selecione a lavagem e o tipo de saida.")}`);
  }

  if (!["cancelado", "finalizado"].includes(tipo) && funcionarioIds.length === 0) {
    redirect(`${returnTo}?error=${messageParam("Selecione pelo menos um lavador.")}`);
  }

  const client = (await getSupabaseServer()) as any;

  const { data: lavagem, error: lavagemError } = await client
    .from("lava_lavagens")
    .select("id,servico_id,funcionario_id,valor,valor_final,valor_recebido,valor_pendente,status,status_pagamento,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo),lava_servicos(nome)")
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (lavagemError || !lavagem?.id) {
    redirect(`${returnTo}?error=${messageParam(lavagemError?.message ?? "Lavagem nao encontrada.")}`);
  }

  if (["entregue", "cancelado"].includes(String(lavagem.status ?? ""))) {
    redirect(`${returnTo}?error=${messageParam("Essa lavagem ja foi encerrada.")}`);
  }

  const valorFinal = Number(lavagem.valor_final ?? lavagem.valor ?? 0);
  const payload = buildPayload(tipo, valorFinal, funcionarioIds[0] || String(lavagem.funcionario_id ?? ""));

  if (tipo === "convenio" && convenioNome) {
    payload.observacoes = `Convenio: ${convenioNome}`;
  }

  const { error: updateError } = await client
    .from("lava_lavagens")
    .update(payload)
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId);

  if (updateError) {
    redirect(`${returnTo}?error=${messageParam(updateError.message)}`);
  }

  if (funcionarioIds.length > 0 && tipo !== "cancelado") {
    await registrarLavadoresEComissao(client, empresaId, lavagemId, funcionarioIds, valorFinal, String(lavagem.servico_id ?? ""));
  }

  await client.from("lava_historico").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao: tipo === "finalizado" ? "finalizar_lavagem_operacao" : "saida_lavagem_operacao",
    status_anterior: String(lavagem.status ?? ""),
    status_novo: String(payload.status ?? ""),
    observacao: `Saida rapida registrada como ${labelTipo(tipo)}${convenioNome ? ` - convenio ${convenioNome}` : ""}.`
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/operacao");
  revalidatePath("/lavagestor/operacao/fila");
  revalidatePath("/lavagestor/operacao/saida");

  if (tipo === "pago") {
    const reciboUrl = buildReceiptWhatsappUrl(lavagem as Row, valorFinal, lavagemId);
    if (reciboUrl) redirect(reciboUrl);
  }

  redirect(`${returnTo}?ok=${messageParam(labelSuccess(tipo))}`);
}

function buildPayload(tipo: SaidaTipo, valorFinal: number, funcionarioId: string): Row {
  const base = funcionarioId ? { funcionario_id: funcionarioId } : {};

  if (tipo === "finalizado") {
    return { status: "finalizado" };
  }

  if (tipo === "cancelado") {
    return {
      status: "cancelado",
      status_pagamento: "cancelado",
      forma_pagamento: "cancelado",
      valor_recebido: 0,
      valor_pendente: 0
    };
  }

  if (tipo === "pago") {
    return {
      ...base,
      status: "entregue",
      status_pagamento: "pago",
      forma_pagamento: "pago",
      valor_recebido: valorFinal,
      valor_pendente: 0
    };
  }

  if (tipo === "fiado") {
    return {
      ...base,
      status: "entregue",
      status_pagamento: "fiado",
      forma_pagamento: "fiado",
      valor_recebido: 0,
      valor_pendente: valorFinal
    };
  }

  if (tipo === "convenio") {
    return {
      ...base,
      status: "finalizado",
      status_pagamento: "aberto",
      forma_pagamento: "convenio",
      valor_recebido: 0,
      valor_pendente: valorFinal
    };
  }

  return {
    ...base,
    status: "entregue",
    status_pagamento: "aberto",
    forma_pagamento: "a_faturar",
    valor_recebido: 0,
    valor_pendente: valorFinal
  };
}

async function registrarLavadoresEComissao(client: any, empresaId: string | null, lavagemId: string, funcionarioIds: string[], valorFinal: number, servicoId: string) {
  const principal = funcionarioIds[0];

  await client
    .from("lava_lavagem_servicos")
    .update({ funcionario_id: principal })
    .eq("empresa_id", empresaId)
    .eq("lavagem_id", lavagemId);

  const { data: existente } = await client
    .from("lava_comissoes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("lavagem_id", lavagemId)
    .limit(1);

  if ((existente ?? []).length > 0) return;

  const [{ data: funcionario }, { data: servico }, { data: config }] = await Promise.all([
    client.from("lava_funcionarios").select("percentual_comissao").eq("empresa_id", empresaId).eq("id", principal).maybeSingle(),
    servicoId ? client.from("lava_servicos").select("percentual_comissao").eq("empresa_id", empresaId).eq("id", servicoId).maybeSingle() : Promise.resolve({ data: null }),
    client.from("lava_configuracoes").select("percentual_comissao_padrao").eq("empresa_id", empresaId).maybeSingle()
  ]);

  const percentual = Number(servico?.percentual_comissao ?? funcionario?.percentual_comissao ?? config?.percentual_comissao_padrao ?? 35);
  const total = Math.round(((valorFinal * percentual) / 100) * 100) / 100;
  const porLavador = funcionarioIds.length > 0 ? Math.round((total / funcionarioIds.length) * 100) / 100 : 0;

  if (porLavador <= 0) return;

  await client.from("lava_comissoes").insert(funcionarioIds.map((funcionarioId) => ({
    empresa_id: empresaId,
    funcionario_id: funcionarioId,
    lavagem_id: lavagemId,
    valor: porLavador,
    status: "pendente"
  })));
}

function buildReceiptWhatsappUrl(lavagem: Row, valorFinal: number, lavagemId: string) {
  const cliente = relation(lavagem.lava_clientes);
  const veiculo = relation(lavagem.lava_veiculos);
  const servico = relation(lavagem.lava_servicos);
  const phone = whatsappPhone(cliente.telefone);

  if (!phone) return "";

  const placa = String(veiculo.placa ?? "").trim();
  const modelo = [veiculo.marca, veiculo.modelo].filter(Boolean).join(" ").trim();
  const texto = [
    "Recibo LavaGestor",
    `Cliente: ${String(cliente.nome ?? "Cliente")}`,
    `Veiculo: ${[placa, modelo].filter(Boolean).join(" - ") || "Veiculo"}`,
    `Servico: ${String(servico.nome ?? "Lavagem")}`,
    `Valor pago: ${money(valorFinal)}`,
    `Ticket: ${lavagemId.slice(0, 8)}`,
    "Obrigado pela preferencia!"
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`;
}

function whatsappPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12) return digits;
  return "";
}

function relation(value: unknown): Row {
  return (Array.isArray(value) ? value[0] : value || {}) as Row;
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeTipoSaida(value: string): SaidaTipo | null {
  const normalized = value.trim().toLowerCase();
  if (["pago", "convenio", "fiado", "faturar", "cancelado", "finalizado"].includes(normalized)) return normalized as SaidaTipo;
  return null;
}

function labelTipo(tipo: SaidaTipo) {
  const labels: Record<SaidaTipo, string> = {
    pago: "Pago",
    convenio: "Convenio",
    fiado: "Fiado",
    faturar: "A faturar",
    cancelado: "Cancelado",
    finalizado: "Finalizado"
  };
  return labels[tipo];
}

function labelSuccess(tipo: SaidaTipo) {
  if (tipo === "finalizado") return "Lavagem finalizada e aguardando saida.";
  if (tipo === "cancelado") return "Lavagem cancelada.";
  if (tipo === "convenio") return "Convenio registrado. O veiculo continua aguardando pagamento.";
  return `Saida registrada como ${labelTipo(tipo)}.`;
}

function safeReturn(value: string) {
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : "/lavagestor/operacao/fila";
}
