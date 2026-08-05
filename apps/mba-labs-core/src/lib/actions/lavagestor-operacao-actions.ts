"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messageParam, textValue } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

type SaidaTipo = "pago" | "convenio" | "fiado" | "faturar" | "cancelado" | "finalizado";
type Row = Record<string, unknown>;

type ConvenioRow = {
  id?: unknown;
  nome?: unknown;
  percentual_desconto?: unknown;
  nao_paga?: unknown;
};

const formasPagamentoPermitidas = ["pix", "cartao_credito", "cartao_debito"];

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
  const convenioId = textValue(formData, "convenio_id");
  const formaPagamento = normalizeFormaPagamento(textValue(formData, "forma_pagamento"));

  if (!lavagemId || !tipo) {
    redirect(`${returnTo}?error=${messageParam("Selecione a lavagem e o tipo de saida.")}`);
  }

  if (tipo === "pago" && !formaPagamento) {
    redirect(`${returnTo}?error=${messageParam("Selecione a forma de pagamento: Pix, cartao credito ou cartao debito.")}`);
  }

  if (tipo === "convenio" && !convenioId) {
    redirect(`${returnTo}?error=${messageParam("Selecione o convenio antes de finalizar como convenio.")}`);
  }

  if (!["cancelado", "finalizado"].includes(tipo) && funcionarioIds.length === 0) {
    redirect(`${returnTo}?error=${messageParam("Selecione pelo menos um lavador.")}`);
  }

  const client = (await getSupabaseServer()) as any;

  const { data: lavagem, error: lavagemError } = await client
    .from("lava_lavagens")
    .select("id,servico_id,funcionario_id,valor,valor_total,valor_desconto,valor_final,valor_recebido,valor_pendente,status,status_pagamento,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo),lava_servicos(nome)")
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (lavagemError || !lavagem?.id) {
    redirect(`${returnTo}?error=${messageParam(lavagemError?.message ?? "Lavagem nao encontrada.")}`);
  }

  if (["entregue", "cancelado"].includes(String(lavagem.status ?? ""))) {
    redirect(`${returnTo}?error=${messageParam("Essa lavagem ja foi encerrada.")}`);
  }

  const valorBase = money(lavagem.valor_total ?? lavagem.valor ?? lavagem.valor_final ?? 0);
  const descontoAtual = money(lavagem.valor_desconto ?? Math.max(valorBase - money(lavagem.valor_final ?? valorBase), 0));
  let convenio: ConvenioRow | null = null;

  if (convenioId) {
    const { data: convenioData, error: convenioError } = await client
      .from("lava_convenios")
      .select("id,nome,percentual_desconto,nao_paga,ativo")
      .eq("id", convenioId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (convenioError || !convenioData?.id || convenioData.ativo === false) {
      redirect(`${returnTo}?error=${messageParam(convenioError?.message ?? "Convenio nao encontrado ou inativo.")}`);
    }

    convenio = convenioData;
  }

  const ajuste = calcularValoresComConvenio(valorBase, descontoAtual, convenio);
  const payload = buildPayload(tipo, ajuste.valorFinal, funcionarioIds[0] || String(lavagem.funcionario_id ?? ""), formaPagamento);

  if (convenio) {
    payload.convenio_id = String(convenio.id ?? "");
    payload.convenio_nome = String(convenio.nome ?? "");
    payload.convenio_desconto_percentual = ajuste.percentualConvenio;
    payload.convenio_nao_paga = convenio.nao_paga === true;
    payload.valor_total = valorBase;
    payload.valor_desconto = ajuste.descontoTotal;
    payload.valor_final = ajuste.valorFinal;
    payload.observacoes = `Convenio: ${String(convenio.nome ?? "")} - desconto ${ajuste.percentualConvenio}%.`;
  }

  const { error: updateError } = await client
    .from("lava_lavagens")
    .update(payload)
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId);

  if (updateError) {
    redirect(`${returnTo}?error=${messageParam(updateError.message)}`);
  }

  if (tipo === "pago") {
    const pagamentoError = await registrarPagamento(client, empresaId, lavagemId, ajuste.valorFinal, formaPagamento, "Pagamento registrado na saida rapida.");
    if (pagamentoError) {
      redirect(`${returnTo}?error=${messageParam(pagamentoError)}`);
    }

    await criarEnvioReciboPendente(client, empresaId, lavagemId, current.usuario.id, "Recibo de pagamento pendente de envio automatico.");
  }

  if (tipo === "convenio") {
    const convenioNome = String(convenio?.nome ?? "Convenio");
    const pagamentoError = await registrarPagamento(client, empresaId, lavagemId, 0, "convenio", `Saida registrada em convenio: ${convenioNome}. Valor do cliente zerado no recibo.`);
    if (pagamentoError) {
      redirect(`${returnTo}?error=${messageParam(pagamentoError)}`);
    }

    await criarEnvioReciboPendente(client, empresaId, lavagemId, current.usuario.id, `Recibo de convenio pendente de envio automatico. Convenio: ${convenioNome}. Valor do cliente: R$ 0,00.`);
  }

  if (funcionarioIds.length > 0 && tipo !== "cancelado") {
    await registrarLavadoresEComissao(client, empresaId, lavagemId, funcionarioIds, ajuste.valorFinal, String(lavagem.servico_id ?? ""));
  }

  await client.from("lava_historico").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao: tipo === "finalizado" ? "finalizar_lavagem_operacao" : "saida_lavagem_operacao",
    status_anterior: String(lavagem.status ?? ""),
    status_novo: String(payload.status ?? ""),
    observacao: `Saida rapida registrada como ${labelTipo(tipo)}${tipo === "pago" && formaPagamento ? ` - ${labelFormaPagamento(formaPagamento)}` : ""}${convenio ? ` - convenio ${String(convenio.nome ?? "")}, desconto ${ajuste.percentualConvenio}%` : ""}.`
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/operacao");
  revalidatePath("/lavagestor/operacao/fila");
  revalidatePath("/lavagestor/operacao/saida");
  revalidatePath("/lavagestor/convenios");
  revalidatePath(`/lavagestor/recibos/${lavagemId}`);

  redirect(`${returnTo}?ok=${messageParam(tipo === "pago" || tipo === "convenio" ? "Saida finalizada. Recibo ficou na fila de envio automatico." : labelSuccess(tipo))}`);
}

function buildPayload(tipo: SaidaTipo, valorFinal: number, funcionarioId: string, formaPagamento: string): Row {
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
      forma_pagamento: formaPagamento,
      valor_recebido: valorFinal,
      valor_pendente: 0,
      data_pagamento: new Date().toISOString(),
      data_finalizacao: new Date().toISOString(),
      data_entrega: new Date().toISOString()
    };
  }

  if (tipo === "fiado") {
    return {
      ...base,
      status: "entregue",
      status_pagamento: "fiado",
      forma_pagamento: "fiado",
      valor_recebido: 0,
      valor_pendente: valorFinal,
      data_finalizacao: new Date().toISOString(),
      data_entrega: new Date().toISOString()
    };
  }

  if (tipo === "convenio") {
    return {
      ...base,
      status: "entregue",
      status_pagamento: "convenio",
      forma_pagamento: "convenio",
      valor_recebido: 0,
      valor_pendente: 0,
      data_pagamento: new Date().toISOString(),
      data_finalizacao: new Date().toISOString(),
      data_entrega: new Date().toISOString()
    };
  }

  return {
    ...base,
    status: "entregue",
    status_pagamento: "aberto",
    forma_pagamento: "a_faturar",
    valor_recebido: 0,
    valor_pendente: valorFinal,
    data_finalizacao: new Date().toISOString(),
    data_entrega: new Date().toISOString()
  };
}

async function registrarPagamento(client: any, empresaId: string | null, lavagemId: string, valorFinal: number, formaPagamento: string, observacoes = "Pagamento registrado na saida rapida.") {
  const { error } = await client.from("lava_pagamentos").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    valor: valorFinal,
    forma_pagamento: formaPagamento,
    data_pagamento: new Date().toISOString(),
    observacoes
  });

  return error?.message ?? "";
}

async function criarEnvioReciboPendente(client: any, empresaId: string | null, lavagemId: string, usuarioId: string, mensagem = "Recibo pendente de envio automatico.") {
  if (!empresaId) return;

  const { data: existente } = await client
    .from("lava_whatsapp_envios")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("lavagem_id", lavagemId)
    .eq("evento", "recibo_pagamento")
    .in("status", ["pendente", "enviando", "enviado"])
    .limit(1);

  if ((existente ?? []).length > 0) return;

  await client.from("lava_whatsapp_envios").insert({
    empresa_id: empresaId,
    cliente_id: null,
    lavagem_id: lavagemId,
    evento: "recibo_pagamento",
    telefone: null,
    mensagem,
    mensagem_gerada_por: "modelo",
    provider: "evolution",
    status: "pendente",
    precisa_aprovacao: false,
    aprovado_por: usuarioId,
    aprovado_em: new Date().toISOString(),
    erro: null
  });
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

function calcularValoresComConvenio(valorBase: number, descontoAtual: number, convenio: ConvenioRow | null) {
  const percentualConvenio = convenio
    ? convenio.nao_paga === true
      ? 100
      : clampPercent(convenio.percentual_desconto)
    : 0;
  const descontoConvenio = roundMoney(valorBase * percentualConvenio / 100);
  const descontoTotal = roundMoney(Math.min(valorBase, Math.max(0, descontoAtual + descontoConvenio)));
  return {
    percentualConvenio,
    descontoTotal,
    valorFinal: roundMoney(Math.max(valorBase - descontoTotal, 0))
  };
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeTipoSaida(value: string): SaidaTipo | null {
  const normalized = value.trim().toLowerCase();
  if (["pago", "convenio", "fiado", "faturar", "cancelado", "finalizado"].includes(normalized)) return normalized as SaidaTipo;
  return null;
}

function normalizeFormaPagamento(value: string) {
  const normalized = value.trim().toLowerCase();
  return formasPagamentoPermitidas.includes(normalized) ? normalized : "";
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

function labelFormaPagamento(value: string) {
  const labels: Record<string, string> = {
    pix: "Pix",
    cartao_credito: "Cartao credito",
    cartao_debito: "Cartao debito"
  };
  return labels[value] ?? value;
}

function labelSuccess(tipo: SaidaTipo) {
  if (tipo === "finalizado") return "Lavagem finalizada e aguardando saida.";
  if (tipo === "cancelado") return "Lavagem cancelada.";
  if (tipo === "convenio") return "Saida registrada no convenio. Recibo ficou na fila de envio automatico.";
  return `Saida registrada como ${labelTipo(tipo)}.`;
}

function safeReturn(value: string) {
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : "/lavagestor/operacao/fila";
}

function money(value: unknown) {
  const normalized = String(value ?? "0").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function clampPercent(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), 100);
}
