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
  const entregaTipoRaw = textValue(formData, "entrega_tipo") || "retirar";
  const entregaTipo = entregaTipoRaw === "levar" ? "levar" : "retirar";
  const enderecoEntrega = entregaTipo === "levar" ? nullableTextValue(formData, "endereco_entrega") : null;

  if (!clienteId || !veiculoId || !servicoPrincipalId || funcionarioIds.length === 0) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Informe cliente, veículo/item, serviço e pelo menos um lavador.")}`);
  }

  const allServicoIds = uniqueValues([servicoPrincipalId, ...adicionalIds]);
  const [funcionariosResult, servicosResult, configResult] = await Promise.all([
    client.from("lava_funcionarios").select("id,nome,percentual_comissao").eq("empresa_id", empresaId).in("id", funcionarioIds),
    client.from("lava_servicos").select("id,nome,preco,percentual_comissao").eq("empresa_id", empresaId).in("id", allServicoIds),
    empresaId ? client.from("lava_configuracoes").select("percentual_comissao_padrao,permitir_desconto").eq("empresa_id", empresaId).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);

  if (funcionariosResult.error || (funcionariosResult.data ?? []).length !== funcionarioIds.length) redirect(`/lavagestor/nova-lavagem?error=${messageParam("Um ou mais lavadores não foram encontrados.")}`);
  if (servicosResult.error || (servicosResult.data ?? []).length !== allServicoIds.length) redirect(`/lavagestor/nova-lavagem?error=${messageParam("Um ou mais serviços não foram encontrados.")}`);

  const funcionarios = (funcionariosResult.data ?? []) as Array<Record<string, unknown>>;
  const servicos = (servicosResult.data ?? []) as Array<Record<string, unknown>>;
  const config = (configResult.data ?? {}) as Record<string, unknown>;
  const percentualComissaoPadrao = Number(config.percentual_comissao_padrao ?? 35);
  const permitirDesconto = config.permitir_desconto === false ? false : true;
  const servicoPrincipal = servicos.find((row) => String(row.id) === servicoPrincipalId);

  if (!servicoPrincipal) redirect(`/lavagestor/nova-lavagem?error=${messageParam("Serviço principal não encontrado.")}`);

  const funcionarioPrincipal = funcionarios.find((row) => String(row.id) === funcionarioIds[0]) ?? funcionarios[0];
  const funcionarioPercentualPadrao = Number(funcionarioPrincipal?.percentual_comissao ?? percentualComissaoPadrao);
  const desconto = permitirDesconto ? numberValue(formData, "valor_desconto") : 0;
  const observacoes = nullableTextValue(formData, "observacoes");
  const now = new Date().toISOString();

  const itensServico = allServicoIds.map((id) => {
    const servico = servicos.find((row) => String(row.id) === id)!;
    const valor = Number(servico.preco ?? 0);
    const percentualConfigurado = servico.percentual_comissao;
    const percentual = percentualConfigurado === null || percentualConfigurado === undefined ? funcionarioPercentualPadrao : Number(percentualConfigurado);
    const comissao = roundMoney((valor * percentual) / 100);
    return { id, nome: String(servico.nome ?? "Serviço"), valor, percentual, comissao, principal: id === servicoPrincipalId };
  });

  const totalBruto = roundMoney(itensServico.reduce((total, item) => total + item.valor, 0));
  const valorFinal = roundMoney(Math.max(totalBruto - desconto, 0));
  const comissaoTotal = roundMoney(itensServico.reduce((total, item) => total + item.comissao, 0));
  const comissaoPorLavador = funcionarioIds.length > 0 ? roundMoney(comissaoTotal / funcionarioIds.length) : 0;

  const { data: lavagem, error } = await client.from("lava_lavagens").insert({
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
    entrega_tipo: entregaTipo,
    endereco_entrega: enderecoEntrega,
    observacoes
  }).select("id").single();

  if (error || !lavagem?.id) redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível salvar a lavagem.")}`);

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
    if (serviceError) redirect(`/lavagestor/nova-lavagem?error=${messageParam(serviceError.message)}`);
  }

  if (comissaoPorLavador > 0) {
    const comissaoRows = funcionarioIds.map((funcionarioId) => ({ empresa_id: empresaId, funcionario_id: funcionarioId, lavagem_id: lavagem.id, valor: comissaoPorLavador, status: "pendente" }));
    const { error: comissaoError } = await client.from("lava_comissoes").insert(comissaoRows);
    if (comissaoError) redirect(`/lavagestor/nova-lavagem?error=${messageParam(comissaoError.message)}`);
  }

  await client.from("lava_historico").insert({
    empresa_id: empresaId,
    lavagem_id: lavagem.id,
    usuario_id: current.usuario.id,
    acao: "entrada_lavagem",
    status_anterior: null,
    status_novo: "na_fila",
    observacao: `Lavagem criada com ${funcionarioIds.length} lavador(es). Comissão total: ${comissaoTotal}. Entrega: ${entregaTipo}.`
  });

  await logAction({ appSlug: "lavagestor", acao: "criar lavagem", detalhes: { lavagem_id: lavagem.id, valor: valorFinal, comissao_total: comissaoTotal, lavadores: funcionarioIds.length, servicos: allServicoIds.length, entrega_tipo: entregaTipo } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/comissoes");
  redirect(`/lavagestor/checklists/${lavagem.id}?ok=${messageParam("Lavagem registrada na fila. Complete o checklist de entrada.")}`);
}

async function resolveCliente(client: any, empresaId: string | null, formData: FormData) {
  const modo = textValue(formData, "cliente_modo") || "existente";
  const selectedClienteId = textValue(formData, "cliente_id");
  const nome = textValue(formData, "cliente_nome");
  const telefone = textValue(formData, "cliente_whatsapp");
  const observacao = nullableTextValue(formData, "cliente_observacao");
  if (modo === "existente") {
    if (!selectedClienteId) redirect(`/lavagestor/nova-lavagem?error=${messageParam("Selecione o cliente existente.")}`);
    const updatePayload: Record<string, unknown> = {};
    if (nome) updatePayload.nome = nome;
    if (telefone) updatePayload.telefone = telefone;
    updatePayload.observacao = observacao;
    if (Object.keys(updatePayload).length > 0) {
      const { error } = await client.from("lava_clientes").update(updatePayload).eq("id", selectedClienteId).eq("empresa_id", empresaId);
      if (error) redirect(`/lavagestor/nova-lavagem?error=${messageParam(error.message)}`);
    }
    return selectedClienteId;
  }

  if (!nome || !telefone) redirect(`/lavagestor/nova-lavagem?error=${messageParam("Informe nome e WhatsApp do novo cliente.")}`);

  const clienteExistente = await findExistingCliente(client, empresaId, nome, telefone);
  if (clienteExistente?.id) {
    const updatePayload = { nome, telefone, observacao };
    const { error } = await client.from("lava_clientes").update(updatePayload).eq("id", clienteExistente.id).eq("empresa_id", empresaId);
    if (error) redirect(`/lavagestor/nova-lavagem?error=${messageParam(error.message)}`);
    return String(clienteExistente.id);
  }

  const { data, error } = await client.from("lava_clientes").insert({ empresa_id: empresaId, nome, telefone, observacao }).select("id").single();
  if (error || !data?.id) redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível cadastrar o cliente.")}`);
  return String(data.id);
}

async function findExistingCliente(client: any, empresaId: string | null, nome: string, telefone: string) {
  const { data } = await client.from("lava_clientes").select("id,nome,telefone").eq("empresa_id", empresaId);
  const nomeAlvo = normalizeComparable(nome);
  const telefoneAlvo = onlyDigits(telefone);
  return (data ?? []).find((row: Record<string, unknown>) => {
    const mesmoNome = normalizeComparable(row.nome) === nomeAlvo;
    const mesmoTelefone = telefoneAlvo.length >= 8 && onlyDigits(row.telefone) === telefoneAlvo;
    return mesmoNome || mesmoTelefone;
  });
}

async function resolveVeiculo(client: any, empresaId: string | null, clienteId: string, formData: FormData) {
  const modo = textValue(formData, "veiculo_modo") || "existente";
  const selectedVeiculoId = textValue(formData, "veiculo_id");
  const tipo = textValue(formData, "veiculo_tipo") || "carro";
  const placa = nullableTextValue(formData, "veiculo_placa");
  const marca = nullableTextValue(formData, "veiculo_marca");
  const modelo = nullableTextValue(formData, "veiculo_modelo") || defaultModeloByTipo(tipo);
  const cor = nullableTextValue(formData, "veiculo_cor");
  const observacao = nullableTextValue(formData, "veiculo_observacao");
  if (modo === "existente") {
    if (!selectedVeiculoId) redirect(`/lavagestor/nova-lavagem?error=${messageParam("Selecione o veículo/item existente.")}`);
    const updatePayload = { cliente_id: clienteId, tipo, placa, marca, modelo, cor, observacao };
    const { error } = await client.from("lava_veiculos").update(updatePayload).eq("id", selectedVeiculoId).eq("empresa_id", empresaId);
    if (error) redirect(`/lavagestor/nova-lavagem?error=${messageParam(error.message)}`);
    return selectedVeiculoId;
  }
  if (!tipo || (!placa && !marca && !modelo)) redirect(`/lavagestor/nova-lavagem?error=${messageParam("Informe os dados do novo veículo/item.")}`);
  const { data, error } = await client.from("lava_veiculos").insert({ empresa_id: empresaId, cliente_id: clienteId, tipo, placa, marca, modelo, cor, observacao }).select("id").single();
  if (error || !data?.id) redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível cadastrar o veículo/item.")}`);
  return String(data.id);
}

function defaultModeloByTipo(tipo: string) { const labels: Record<string, string> = { sofa: "Sofá", tapete: "Tapete", maquina: "Máquina", outro: "Item avulso" }; return labels[tipo] ?? null; }
function uniqueValues(values: string[]) { return Array.from(new Set(values.filter(Boolean))); }
function roundMoney(value: number) { return Math.round(value * 100) / 100; }
function onlyDigits(value: unknown) { return String(value ?? "").replace(/\D/g, ""); }
function normalizeComparable(value: unknown) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/ç/g, "c").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " "); }
