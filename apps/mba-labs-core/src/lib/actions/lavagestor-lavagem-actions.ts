"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function createLavagemMelhorada(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;

  const clienteId = await resolveCliente(client, empresaId, formData);
  const veiculoId = await resolveVeiculo(client, empresaId, clienteId, formData);
  const servicoPrincipalId = textValue(formData, "servico_id");
  const adicionalIds = uniqueValues(formData.getAll("servico_adicional_ids").map(String)).filter((id) => id !== servicoPrincipalId);
  const funcionarioIds = uniqueValues(formData.getAll("funcionario_ids").map(String)).filter(Boolean);

  if (!clienteId || !veiculoId || !servicoPrincipalId || funcionarioIds.length === 0) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Informe cliente, veículo/item, serviço e pelo menos um lavador.")}`);
  }

  const allServicoIds = uniqueValues([servicoPrincipalId, ...adicionalIds]);

  const [funcionariosResult, servicosResult] = await Promise.all([
    client
      .from("lava_funcionarios")
      .select("id,nome,percentual_comissao")
      .eq("empresa_id", empresaId)
      .in("id", funcionarioIds),
    client
      .from("lava_servicos")
      .select("id,nome,preco,percentual_comissao")
      .eq("empresa_id", empresaId)
      .in("id", allServicoIds)
  ]);

  if (funcionariosResult.error || (funcionariosResult.data ?? []).length !== funcionarioIds.length) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Um ou mais lavadores não foram encontrados.")}`);
  }

  if (servicosResult.error || (servicosResult.data ?? []).length !== allServicoIds.length) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Um ou mais serviços não foram encontrados.")}`);
  }

  const funcionarios = (funcionariosResult.data ?? []) as Array<Record<string, unknown>>;
  const servicos = (servicosResult.data ?? []) as Array<Record<string, unknown>>;
  const servicoPrincipal = servicos.find((row) => String(row.id) === servicoPrincipalId);

  if (!servicoPrincipal) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Serviço principal não encontrado.")}`);
  }

  const funcionarioPrincipal = funcionarios.find((row) => String(row.id) === funcionarioIds[0]) ?? funcionarios[0];
  const funcionarioPercentualPadrao = Number(funcionarioPrincipal?.percentual_comissao ?? 0);
  const desconto = numberValue(formData, "valor_desconto");
  const observacoes = nullableTextValue(formData, "observacoes");
  const now = new Date().toISOString();

  const itensServico = allServicoIds.map((id) => {
    const servico = servicos.find((row) => String(row.id) === id)!;
    const valor = Number(servico.preco ?? 0);
    const percentualConfigurado = servico.percentual_comissao;
    const percentual = percentualConfigurado === null || percentualConfigurado === undefined ? funcionarioPercentualPadrao : Number(percentualConfigurado);
    const comissao = roundMoney((valor * percentual) / 100);

    return {
      id,
      nome: String(servico.nome ?? "Serviço"),
      valor,
      percentual,
      comissao,
      principal: id === servicoPrincipalId
    };
  });

  const totalBruto = roundMoney(itensServico.reduce((total, item) => total + item.valor, 0));
  const valorFinal = roundMoney(Math.max(totalBruto - desconto, 0));
  const comissaoTotal = roundMoney(itensServico.reduce((total, item) => total + item.comissao, 0));
  const comissaoPorLavador = funcionarioIds.length > 0 ? roundMoney(comissaoTotal / funcionarioIds.length) : 0;

  const { data: lavagem, error } = await client
    .from("lava_lavagens")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      funcionario_id: funcionarioIds[0],
      servico_id: servicoPrincipalId,
      descricao_extra: nullableTextValue(formData, "descricao_extra"),
      valor: valorFinal,
      valor_total: totalBruto,
      valor_desconto: desconto,
      valor_final: valorFinal,
      valor_recebido: 0,
      valor_pendente: valorFinal,
      status_pagamento: "aberto",
      forma_pagamento: null,
      comissao: comissaoTotal,
      status: "na_fila",
      data_entrada: now,
      data_lavagem: now,
      observacoes
    })
    .select("id")
    .single();

  if (error || !lavagem?.id) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível salvar a lavagem.")}`);
  }

  const serviceRows = itensServico.map((item) => ({
    empresa_id: empresaId,
    lavagem_id: lavagem.id,
    servico_id: item.id,
    funcionario_id: funcionarioIds[0],
    descricao: item.nome,
    valor: item.valor,
    tipo_comissao: item.percentual > 0 ? "percentual" : "sem_comissao",
    percentual_comissao: item.percentual,
    valor_comissao: item.comissao
  }));

  if (serviceRows.length > 0) {
    const { error: serviceError } = await client.from("lava_lavagem_servicos").insert(serviceRows);
    if (serviceError) {
      redirect(`/lavagestor/nova-lavagem?error=${messageParam(serviceError.message)}`);
    }
  }

  if (comissaoPorLavador > 0) {
    const comissaoRows = funcionarioIds.map((funcionarioId) => ({
      empresa_id: empresaId,
      funcionario_id: funcionarioId,
      lavagem_id: lavagem.id,
      valor: comissaoPorLavador,
      status: "pendente"
    }));

    const { error: comissaoError } = await client.from("lava_comissoes").insert(comissaoRows);
    if (comissaoError) {
      redirect(`/lavagestor/nova-lavagem?error=${messageParam(comissaoError.message)}`);
    }
  }

  await client.from("lava_historico").insert({
    empresa_id: empresaId,
    lavagem_id: lavagem.id,
    usuario_id: current.usuario.id,
    acao: "entrada_lavagem",
    status_anterior: null,
    status_novo: "na_fila",
    observacao: `Lavagem criada com ${funcionarioIds.length} lavador(es). Comissão total: ${comissaoTotal}.`
  });

  await logAction({
    appSlug: "lavagestor",
    acao: "criar lavagem",
    detalhes: {
      lavagem_id: lavagem.id,
      valor: valorFinal,
      comissao_total: comissaoTotal,
      lavadores: funcionarioIds.length,
      servicos: allServicoIds.length
    }
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/comissoes");
  redirect(`/lavagestor/fila?ok=${messageParam("Lavagem registrada na fila.")}`);
}

async function resolveCliente(client: any, empresaId: string | null, formData: FormData) {
  const selectedClienteId = textValue(formData, "cliente_id");
  if (selectedClienteId) {
    return selectedClienteId;
  }

  const nome = textValue(formData, "cliente_nome");
  const telefone = textValue(formData, "cliente_whatsapp");

  if (!nome || !telefone) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Selecione um cliente ou informe nome e WhatsApp.")}`);
  }

  const { data, error } = await client
    .from("lava_clientes")
    .insert({
      empresa_id: empresaId,
      nome,
      telefone,
      observacao: nullableTextValue(formData, "cliente_observacao")
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível cadastrar o cliente.")}`);
  }

  return String(data.id);
}

async function resolveVeiculo(client: any, empresaId: string | null, clienteId: string, formData: FormData) {
  const selectedVeiculoId = textValue(formData, "veiculo_id");
  if (selectedVeiculoId) {
    return selectedVeiculoId;
  }

  const tipo = textValue(formData, "veiculo_tipo") || "carro";
  const placa = nullableTextValue(formData, "veiculo_placa");
  const marca = nullableTextValue(formData, "veiculo_marca");
  const modelo = nullableTextValue(formData, "veiculo_modelo") || defaultModeloByTipo(tipo);

  if (!tipo || (!placa && !marca && !modelo)) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Selecione um veículo ou cadastre um veículo/item no fluxo.")}`);
  }

  const { data, error } = await client
    .from("lava_veiculos")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      tipo,
      placa,
      marca,
      modelo,
      cor: nullableTextValue(formData, "veiculo_cor"),
      observacao: nullableTextValue(formData, "veiculo_observacao")
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível cadastrar o veículo/item.")}`);
  }

  return String(data.id);
}

function defaultModeloByTipo(tipo: string) {
  const labels: Record<string, string> = {
    sofa: "Sofá",
    tapete: "Tapete",
    maquina: "Máquina",
    outro: "Item avulso"
  };

  return labels[tipo] ?? null;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
