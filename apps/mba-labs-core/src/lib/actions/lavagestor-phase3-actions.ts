"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/core-data";
import { dateValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { LAVA_CHECKLIST_BUCKET } from "@/lib/lavagestor-checklists-data";
import { getLavaAiMode, recognizePlateWithGemini } from "@/lib/lavagestor-ai";
import {
  assertLavaEmpresaAccess,
  requireLavaGestorAccess,
  requireLavaGestorCounterAccess,
  requireLavaGestorFinanceAccess,
  resolveLavaEmpresaIdFromLavagem
} from "@/lib/lavagestor-permissions";
import { normalizePlate } from "@/lib/lavagestor-placa";
import { baseUnitFor, convertToBaseQuantity, normalizeStockUnit, roundStock } from "@/lib/lavagestor-stock";
import { buildAgendamentoConfirmacaoMessage, enqueueAutomationQueue, enqueueWhatsappMessage } from "@/lib/lavagestor-whatsapp";
import { getSupabaseServer } from "@/lib/supabase";

type Row = Record<string, unknown>;
type Current = { empresaId: string | null; usuario: { id: string }; isAdminMaster?: boolean };

const MAX_PLATE_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_PRODUCTS = [
  { nome: "Shampoo automotivo", categoria: "Químicos", unidade: "l" },
  { nome: "Cera", categoria: "Acabamento", unidade: "l" },
  { nome: "Pretinho", categoria: "Acabamento", unidade: "l" },
  { nome: "Limpa vidro", categoria: "Limpeza interna", unidade: "l" },
  { nome: "Multiuso", categoria: "Químicos", unidade: "l" },
  { nome: "Pano microfibra", categoria: "Panos e acessórios", unidade: "un" },
  { nome: "Produto de higienizacao", categoria: "Limpeza interna", unidade: "l" },
  { nome: "Aromatizante", categoria: "Acabamento", unidade: "un" },
  { nome: "Limpa pneu", categoria: "Acabamento", unidade: "l" },
  { nome: "Solupan", categoria: "Químicos", unidade: "l" }
];

export async function registrarIAmobLog(formData: FormData) {
  const { current } = await requireLavaGestorCounterAccess("/lavagestor/iamob");
  ensureEmpresa(current, "/lavagestor/iamob");
  const client = (await getSupabaseServer()) as any;
  const tipo = textValue(formData, "tipo") || "analise_manual";
  const saida = nullableTextValue(formData, "saida");

  const { error } = await client.from("lava_iamob_logs").insert({
    empresa_id: current.empresaId,
    usuario_id: current.usuario.id,
    lavagem_id: nullableTextValue(formData, "lavagem_id"),
    cliente_id: nullableTextValue(formData, "cliente_id"),
    veiculo_id: nullableTextValue(formData, "veiculo_id"),
    tipo,
    entrada: {
      observacao: nullableTextValue(formData, "entrada"),
      modo: "regras"
    },
    saida,
    provider: "regras",
    status: "concluido"
  });

  if (error) redirect(`/lavagestor/iamob?error=${messageParam(error.message)}`);
  await logAction({ appSlug: "lavagestor", acao: "iamob regras", detalhes: { tipo } });
  revalidatePath("/lavagestor/iamob");
  redirect(`/lavagestor/iamob?ok=${messageParam("IAMob registrou a analise em modo regras.")}`);
}

export async function saveLavaAgendamento(formData: FormData) {
  const { current } = await requireLavaGestorCounterAccess("/lavagestor/agendamentos");
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
  if (result.data?.id) {
    await ensureAgendamentoConfirmationQueue(client, current, String(result.data.id));
  }
  await logAction({ appSlug: "lavagestor", acao: id ? "editar agendamento" : "criar agendamento", detalhes: { id, data, hora } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/agendamentos");
  revalidatePath("/lavagestor/automacoes");
  revalidatePath("/lavagestor/whatsapp");
  redirect(`/lavagestor/agendamentos?ok=${messageParam("Agendamento salvo. Confirmação adicionada na fila de WhatsApp manual.")}`);
}

export async function updateLavaAgendamentoStatus(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
  ensureEmpresa(current, "/lavagestor/agendamentos");
  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");
  const returnTo = safeReturn(formData, "/lavagestor/agendamentos");

  const { error } = await client
    .from("lava_agendamentos")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) redirect(`${returnTo}?error=${messageParam(error.message)}`);
  if (status === "confirmado") {
    await ensureAgendamentoConfirmationQueue(client, current, id);
  }
  await logAction({ appSlug: "lavagestor", acao: "status agendamento", detalhes: { id, status } });
  revalidatePath("/lavagestor/agendamentos");
  redirect(`${returnTo}?ok=${messageParam("Agendamento atualizado.")}`);
}

export async function converterAgendamentoEmLavagem(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
  ensureEmpresa(current, "/lavagestor/agendamentos");
  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");

  const { data: agendamento, error } = await client
    .from("lava_agendamentos")
    .select("id,cliente_id,veiculo_id,servico_id,funcionario_id,observacao,titulo,lavagem_id")
    .eq("id", id)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !agendamento) redirect(`/lavagestor/agendamentos?error=${messageParam(error?.message ?? "Agendamento não encontrado.")}`);
  if (agendamento.lavagem_id) redirect(`/lavagestor/fila?ok=${messageParam("Agendamento ja estava convertido.")}`);
  if (!agendamento.cliente_id || !agendamento.veiculo_id || !agendamento.servico_id || !agendamento.funcionario_id) {
    redirect(`/lavagestor/agendamentos?error=${messageParam("Agendamento precisa de cliente, veículo, serviço e funcionário para converter.")}`);
  }

  const [servicoResult, funcionarioResult] = await Promise.all([
    client.from("lava_servicos").select("id,nome,preco,percentual_comissao").eq("id", agendamento.servico_id).eq("empresa_id", current.empresaId).maybeSingle(),
    client.from("lava_funcionarios").select("id,nome,percentual_comissao").eq("id", agendamento.funcionario_id).eq("empresa_id", current.empresaId).maybeSingle()
  ]);
  const servico = servicoResult.data as Row | null;
  const funcionario = funcionarioResult.data as Row | null;
  if (!servico || !funcionario) redirect(`/lavagestor/agendamentos?error=${messageParam("Serviço ou funcionário não encontrado.")}`);

  const valor = moneyNumber(servico.preco);
  const percentual = servico.percentual_comissao === null || servico.percentual_comissao === undefined ? moneyNumber(funcionario.percentual_comissao) : moneyNumber(servico.percentual_comissao);
  const comissao = roundMoney((valor * percentual) / 100);
  const now = new Date().toISOString();
  const { data: lavagem, error: insertError } = await client
    .from("lava_lavagens")
    .insert({
      empresa_id: current.empresaId,
      cliente_id: agendamento.cliente_id,
      veiculo_id: agendamento.veiculo_id,
      funcionario_id: agendamento.funcionario_id,
      servico_id: agendamento.servico_id,
      descricao_extra: null,
      valor,
      valor_total: valor,
      valor_desconto: 0,
      valor_final: valor,
      valor_recebido: 0,
      valor_pendente: valor,
      status_pagamento: "aberto",
      forma_pagamento: null,
      comissao,
      status: "na_fila",
      data_entrada: now,
      data_lavagem: now,
      observacoes: agendamento.observacao ?? agendamento.titulo ?? "Convertido de agendamento."
    })
    .select("id")
    .single();

  if (insertError || !lavagem?.id) redirect(`/lavagestor/agendamentos?error=${messageParam(insertError?.message ?? "Não foi possível criar a lavagem.")}`);

  await client.from("lava_lavagem_servicos").insert({
    empresa_id: current.empresaId,
    lavagem_id: lavagem.id,
    servico_id: agendamento.servico_id,
    funcionario_id: agendamento.funcionario_id,
    descricao: servico.nome ?? "Serviço",
    valor,
    tipo_comissao: percentual > 0 ? "percentual" : "sem_comissao",
    percentual_comissao: percentual,
    valor_comissao: comissao
  });
  if (comissao > 0) {
    await client.from("lava_comissoes").insert({
      empresa_id: current.empresaId,
      funcionario_id: agendamento.funcionario_id,
      lavagem_id: lavagem.id,
      valor: comissao,
      status: "pendente"
    });
  }
  await client.from("lava_agendamentos").update({ status: "convertido", lavagem_id: lavagem.id }).eq("id", id).eq("empresa_id", current.empresaId);
  await client.from("lava_historico").insert({
    empresa_id: current.empresaId,
    lavagem_id: lavagem.id,
    usuario_id: current.usuario.id,
    acao: "agendamento_convertido",
    status_anterior: null,
    status_novo: "na_fila",
    observacao: "Lavagem criada a partir de agendamento."
  });

  await logAction({ appSlug: "lavagestor", acao: "converter agendamento", detalhes: { agendamento_id: id, lavagem_id: lavagem.id } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/agendamentos");
  redirect(`/lavagestor/fila?ok=${messageParam("Agendamento convertido em lavagem.")}`);
}

export async function saveLavaEstoqueProduto(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/estoque");
  ensureEmpresa(current, "/lavagestor/estoque");
  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");
  if (!nome) redirect(`/lavagestor/estoque?error=${messageParam("Informe o nome do produto.")}`);
  const unidadeBase = normalizeStockUnit(textValue(formData, "unidade_base") || textValue(formData, "unidade") || "un");

  const payload = {
    empresa_id: current.empresaId,
    nome,
    categoria: nullableTextValue(formData, "categoria"),
    unidade: unidadeBase,
    unidade_base: unidadeBase,
    estoque_atual: numberValue(formData, "estoque_atual"),
    estoque_minimo: numberValue(formData, "estoque_minimo"),
    custo_unitario: numberValue(formData, "custo_unitario"),
    ativo: formData.get("ativo") !== "false"
  };
  const result = id
    ? await client.from("lava_estoque_produtos").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await client.from("lava_estoque_produtos").insert(payload);
  if (result.error) redirect(`/lavagestor/estoque?error=${messageParam(result.error.message)}`);
  await logAction({ appSlug: "lavagestor", acao: id ? "editar estoque produto" : "criar estoque produto", detalhes: { nome } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/estoque");
  redirect(`/lavagestor/estoque?ok=${messageParam("Produto salvo.")}`);
}

export async function createLavaEstoqueMovimento(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/estoque");
  ensureEmpresa(current, "/lavagestor/estoque");
  const client = (await getSupabaseServer()) as any;
  const produtoId = textValue(formData, "produto_id");
  const tipo = textValue(formData, "tipo");
  const quantidade = numberValue(formData, "quantidade");
  if (!produtoId || !tipo || quantidade === 0) redirect(`/lavagestor/estoque?error=${messageParam("Informe produto, tipo e quantidade.")}`);

  const { data: produto, error: productError } = await client
    .from("lava_estoque_produtos")
    .select("id,estoque_atual,custo_unitario,unidade,unidade_base")
    .eq("id", produtoId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();
  if (productError || !produto) redirect(`/lavagestor/estoque?error=${messageParam(productError?.message ?? "Produto não encontrado.")}`);

  const unidadeMovimento = normalizeStockUnit(textValue(formData, "unidade_movimento") || produto.unidade_base || produto.unidade || "un");
  const unidadeBase = normalizeStockUnit(produto.unidade_base || produto.unidade || baseUnitFor(unidadeMovimento));
  const quantidadeBase = convertToBaseQuantity(quantidade, unidadeMovimento, unidadeBase);
  const delta = movementDelta(tipo, quantidadeBase);
  const nextStock = roundStock(moneyNumber(produto.estoque_atual) + delta);
  const custoTotalInput = numberValue(formData, "custo_total");
  const custoUnitario = custoTotalInput > 0 && Math.abs(quantidadeBase) > 0
    ? roundMoney(custoTotalInput / Math.abs(quantidadeBase))
    : numberValue(formData, "custo_unitario", moneyNumber(produto.custo_unitario));
  const custoTotal = custoTotalInput > 0 ? custoTotalInput : roundMoney(Math.abs(quantidadeBase) * custoUnitario);
  const { error } = await client.from("lava_estoque_movimentos").insert({
    empresa_id: current.empresaId,
    produto_id: produtoId,
    usuario_id: current.usuario.id,
    tipo,
    quantidade: Math.abs(quantidadeBase),
    unidade_movimento: unidadeBase,
    custo_unitario: custoUnitario,
    custo_total: custoTotal,
    observacao: nullableTextValue(formData, "observacao")
  });
  if (error) redirect(`/lavagestor/estoque?error=${messageParam(error.message)}`);

  const productUpdate: Record<string, unknown> = { estoque_atual: nextStock };
  if (tipo === "entrada" && custoUnitario > 0) productUpdate.custo_unitario = custoUnitario;
  await client.from("lava_estoque_produtos").update(productUpdate).eq("id", produtoId).eq("empresa_id", current.empresaId);
  await logAction({ appSlug: "lavagestor", acao: "movimento estoque", detalhes: { produto_id: produtoId, tipo, quantidade } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/estoque");
  redirect(`/lavagestor/estoque?ok=${messageParam("Movimento de estoque registrado.")}`);
}

export async function saveLavaServicoInsumo(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/estoque");
  ensureEmpresa(current, "/lavagestor/estoque");
  const client = (await getSupabaseServer()) as any;
  const servicoId = textValue(formData, "servico_id");
  const produtoId = textValue(formData, "produto_id");
  const quantidade = numberValue(formData, "quantidade_por_servico");
  if (!servicoId || !produtoId || quantidade <= 0) redirect(`/lavagestor/estoque?error=${messageParam("Informe serviço, produto e quantidade.")}`);
  const { data: produto } = await client
    .from("lava_estoque_produtos")
    .select("id,unidade,unidade_base")
    .eq("id", produtoId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();
  const unidadeMovimento = normalizeStockUnit(textValue(formData, "unidade") || produto?.unidade_base || produto?.unidade || "un");
  const unidadeBase = normalizeStockUnit(produto?.unidade_base || produto?.unidade || baseUnitFor(unidadeMovimento));
  const quantidadeBase = convertToBaseQuantity(quantidade, unidadeMovimento, unidadeBase);

  const { error } = await client.from("lava_servico_insumos").upsert(
    {
      empresa_id: current.empresaId,
      servico_id: servicoId,
      produto_id: produtoId,
      quantidade_por_servico: quantidadeBase,
      unidade: unidadeBase
    },
    { onConflict: "empresa_id,servico_id,produto_id" }
  );
  if (error) redirect(`/lavagestor/estoque?error=${messageParam(error.message)}`);
  await logAction({ appSlug: "lavagestor", acao: "vincular insumo serviço", detalhes: { servico_id: servicoId, produto_id: produtoId } });
  revalidatePath("/lavagestor/estoque");
  redirect(`/lavagestor/estoque?ok=${messageParam("Insumo vinculado ao serviço.")}`);
}

export async function criarProdutosPadraoLavaGestor() {
  const { current } = await requireLavaGestorAccess("/lavagestor/estoque");
  ensureEmpresa(current, "/lavagestor/estoque");
  const client = (await getSupabaseServer()) as any;
  const { data } = await client.from("lava_estoque_produtos").select("nome").eq("empresa_id", current.empresaId);
  const existing = new Set(((data ?? []) as Row[]).map((row) => normalizeKey(row.nome)));
  const rows = DEFAULT_PRODUCTS.filter((item) => !existing.has(normalizeKey(item.nome))).map((item) => ({
    empresa_id: current.empresaId,
    nome: item.nome,
    categoria: item.categoria,
    unidade: item.unidade,
    unidade_base: item.unidade,
    estoque_atual: 0,
    estoque_minimo: 0,
    custo_unitario: 0,
    ativo: true
  }));
  if (rows.length > 0) {
    const { error } = await client.from("lava_estoque_produtos").insert(rows);
    if (error) redirect(`/lavagestor/estoque?error=${messageParam(error.message)}`);
  }
  revalidatePath("/lavagestor/estoque");
  redirect(`/lavagestor/estoque?ok=${messageParam(`${rows.length} produto(s) padrao criado(s).`)}`);
}

export async function saveLavaPlacaLeitura(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/placa");
  ensureEmpresa(current, "/lavagestor/placa");
  const client = (await getSupabaseServer()) as any;
  const intent = textValue(formData, "intent") || "manual";
  let placa = normalizePlate(textValue(formData, "placa"));
  const file = formData.get("foto");
  let storagePath: string | null = null;

  if (intent !== "gemini" && !placa) {
    redirect(`/lavagestor/placa?error=${messageParam("Informe a placa manualmente para continuar.")}`);
  }

  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) redirect(`/lavagestor/placa?error=${messageParam("Envie apenas imagem da placa.")}`);
    if (file.size > MAX_PLATE_IMAGE_BYTES) redirect(`/lavagestor/placa?error=${messageParam("Foto muito grande. Envie uma imagem menor.")}`);
    storagePath = `${current.empresaId}/placas/${Date.now()}-${crypto.randomUUID()}${extensionFromFile(file)}`;
    const upload = await client.storage.from(LAVA_CHECKLIST_BUCKET).upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "image/jpeg",
      upsert: false
    });
    if (upload.error) redirect(`/lavagestor/placa?error=${messageParam(upload.error.message)}`);
  }

  let provider = "manual";
  let status = "confirmada";
  let erro: string | null = null;
  let confianca: number | null = null;

  if (intent === "gemini") {
    const aiMode = await getLavaAiMode(current);
    if (!aiMode.allowPlateReading) {
      redirect(`/lavagestor/placa?error=${messageParam("Leitura de placa com IAMob nao esta habilitada.")}`);
    }
    if (!storagePath || !(file instanceof File) || file.size <= 0) {
      redirect(`/lavagestor/placa?error=${messageParam("Envie uma foto da placa para usar o IAMob.")}`);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await recognizePlateWithGemini(current, {
      imageBase64: bytes.toString("base64"),
      mimeType: file.type || "image/jpeg"
    });
    provider = "gemini";
    placa = result.plate === "NAO_IDENTIFICADA" ? "" : normalizePlate(result.plate);
    status = placa ? "detectada" : "erro";
    erro = placa ? null : result.error || "IAMob nao identificou a placa. Digite manualmente.";
    confianca = result.ok ? 80 : null;
  }

  if (!placa) {
    const { error } = await client.from("lava_placa_leituras").insert({
      empresa_id: current.empresaId,
      usuario_id: current.usuario.id,
      storage_path: storagePath,
      placa_detectada: null,
      placa_confirmada: null,
      veiculo_id: null,
      provider,
      status: "erro",
      erro: erro || "Placa nao informada ou nao identificada."
    });
    if (error) redirect(`/lavagestor/placa?error=${messageParam(error.message)}`);
    revalidatePath("/lavagestor/placa");
    redirect(`/lavagestor/placa?error=${messageParam(erro || "Placa nao identificada. Digite manualmente.")}`);
  }

  const veiculo = await findVehicleByPlate(client, current.empresaId, placa);
  const { error } = await client.from("lava_placa_leituras").insert({
    empresa_id: current.empresaId,
    usuario_id: current.usuario.id,
    storage_path: storagePath,
    placa_detectada: placa || null,
    placa_confirmada: provider === "gemini" ? null : placa || null,
    veiculo_id: veiculo?.id ?? null,
    provider,
    status,
    confianca,
    erro
  });
  if (error) redirect(`/lavagestor/placa?error=${messageParam(error.message)}`);
  revalidatePath("/lavagestor/placa");
  const suffix = buildPlateRedirectSuffix(placa, veiculo);
  redirect(`/lavagestor/placa?ok=${messageParam(provider === "gemini" ? "IAMob leu uma possivel placa. Confirme antes de continuar." : "Leitura de placa salva em modo manual.")}${suffix}`);
}

export async function confirmarLavaPlacaLeitura(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/placa");
  ensureEmpresa(current, "/lavagestor/placa");
  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");
  const placa = normalizePlate(textValue(formData, "placa"));
  if (!placa) redirect(`/lavagestor/placa?error=${messageParam("Informe a placa para confirmar.")}`);
  const veiculo = await findVehicleByPlate(client, current.empresaId, placa);
  const { error } = await client
    .from("lava_placa_leituras")
    .update({ placa_confirmada: placa, veiculo_id: veiculo?.id ?? null, status: "confirmada", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);
  if (error) redirect(`/lavagestor/placa?error=${messageParam(error.message)}`);
  revalidatePath("/lavagestor/placa");
  redirect(`/lavagestor/placa?ok=${messageParam("Placa confirmada.")}${buildPlateRedirectSuffix(placa, veiculo)}`);
}

export async function saveLavaCobranca(formData: FormData) {
  const { current } = await requireLavaGestorFinanceAccess("/lavagestor/pagamentos-integrados");
  ensureEmpresa(current, "/lavagestor/pagamentos-integrados");
  const client = (await getSupabaseServer()) as any;
  const valor = numberValue(formData, "valor");
  if (valor <= 0) redirect(`/lavagestor/pagamentos-integrados?error=${messageParam("Informe o valor da cobranca.")}`);
  const provider = textValue(formData, "provider") || "manual";
  const lavagemId = nullableTextValue(formData, "lavagem_id");
  const empresaId = lavagemId ? await resolveLavaEmpresaIdFromLavagem(client, lavagemId) : current.empresaId;
  await assertLavaEmpresaAccess(current, empresaId);
  const { error } = await client.from("lava_cobrancas").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    cliente_id: nullableTextValue(formData, "cliente_id"),
    provider,
    valor,
    status: "pendente",
    metodo: nullableTextValue(formData, "metodo"),
    payment_url: `https://mbalabs.vercel.app/lavagestor/pagamentos-integrados/simulado/${crypto.randomUUID()}`,
    vencimento: dateValue(formData, "vencimento")
  });
  if (error) redirect(`/lavagestor/pagamentos-integrados?error=${messageParam(error.message)}`);
  await logAction({ appSlug: "lavagestor", acao: "criar cobranca simulada", detalhes: { provider, valor } });
  revalidatePath("/lavagestor/pagamentos-integrados");
  redirect(`/lavagestor/pagamentos-integrados?ok=${messageParam("Cobrança simulada criada.")}`);
}

export async function updateLavaCobrancaStatus(formData: FormData) {
  const { current } = await requireLavaGestorFinanceAccess("/lavagestor/pagamentos-integrados");
  ensureEmpresa(current, "/lavagestor/pagamentos-integrados");
  const client = (await getSupabaseServer()) as any;
  const status = textValue(formData, "status");
  const id = textValue(formData, "id");
  const existing = await client.from("lava_cobrancas").select("empresa_id").eq("id", id).maybeSingle();
  if (existing.error || !existing.data?.empresa_id) {
    redirect(`/lavagestor/pagamentos-integrados?error=${messageParam(existing.error?.message ?? "Cobrança não encontrada.")}`);
  }
  await assertLavaEmpresaAccess(current, String(existing.data.empresa_id));
  const { error } = await client
    .from("lava_cobrancas")
    .update({ status, erro: status === "erro" ? nullableTextValue(formData, "erro") : null })
    .eq("id", id)
    .eq("empresa_id", String(existing.data.empresa_id));
  if (error) redirect(`/lavagestor/pagamentos-integrados?error=${messageParam(error.message)}`);
  revalidatePath("/lavagestor/pagamentos-integrados");
  redirect(`/lavagestor/pagamentos-integrados?ok=${messageParam("Cobrança atualizada.")}`);
}

export async function saveLavaNotaConfig(formData: FormData) {
  const { current } = await requireLavaGestorFinanceAccess("/lavagestor/notas-fiscais");
  ensureEmpresa(current, "/lavagestor/notas-fiscais");
  const client = (await getSupabaseServer()) as any;
  const { error } = await client.from("lava_nf_configuracoes").upsert(
    {
      empresa_id: current.empresaId,
      provider: nullableTextValue(formData, "provider"),
      status: textValue(formData, "status") || "inativo",
      cidade: nullableTextValue(formData, "cidade"),
      uf: nullableTextValue(formData, "uf"),
      inscricao_municipal: nullableTextValue(formData, "inscricao_municipal"),
      cnae: nullableTextValue(formData, "cnae"),
      aliquota_iss: numberValue(formData, "aliquota_iss"),
      ambiente: textValue(formData, "ambiente") || "homologacao"
    },
    { onConflict: "empresa_id" }
  );
  if (error) redirect(`/lavagestor/notas-fiscais?error=${messageParam(error.message)}`);
  revalidatePath("/lavagestor/notas-fiscais");
  redirect(`/lavagestor/notas-fiscais?ok=${messageParam("Configuracao fiscal salva.")}`);
}

export async function saveLavaNotaFiscal(formData: FormData) {
  const { current } = await requireLavaGestorFinanceAccess("/lavagestor/notas-fiscais");
  ensureEmpresa(current, "/lavagestor/notas-fiscais");
  const client = (await getSupabaseServer()) as any;
  const valor = numberValue(formData, "valor");
  const lavagemId = nullableTextValue(formData, "lavagem_id");
  const empresaId = lavagemId ? await resolveLavaEmpresaIdFromLavagem(client, lavagemId) : current.empresaId;
  await assertLavaEmpresaAccess(current, empresaId);
  const { error } = await client.from("lava_notas_fiscais").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    cliente_id: nullableTextValue(formData, "cliente_id"),
    numero: nullableTextValue(formData, "numero"),
    serie: nullableTextValue(formData, "serie"),
    status: textValue(formData, "status") || "rascunho",
    valor,
    provider: textValue(formData, "provider") || "simulado"
  });
  if (error) redirect(`/lavagestor/notas-fiscais?error=${messageParam(error.message)}`);
  revalidatePath("/lavagestor/notas-fiscais");
  redirect(`/lavagestor/notas-fiscais?ok=${messageParam("Nota fiscal simulada criada.")}`);
}

export async function updateLavaNotaFiscalStatus(formData: FormData) {
  const { current } = await requireLavaGestorFinanceAccess("/lavagestor/notas-fiscais");
  ensureEmpresa(current, "/lavagestor/notas-fiscais");
  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");
  const existing = await client.from("lava_notas_fiscais").select("empresa_id").eq("id", id).maybeSingle();
  if (existing.error || !existing.data?.empresa_id) {
    redirect(`/lavagestor/notas-fiscais?error=${messageParam(existing.error?.message ?? "Nota fiscal não encontrada.")}`);
  }
  await assertLavaEmpresaAccess(current, String(existing.data.empresa_id));
  const { error } = await client
    .from("lava_notas_fiscais")
    .update({ status: textValue(formData, "status"), erro: nullableTextValue(formData, "erro") })
    .eq("id", id)
    .eq("empresa_id", String(existing.data.empresa_id));
  if (error) redirect(`/lavagestor/notas-fiscais?error=${messageParam(error.message)}`);
  revalidatePath("/lavagestor/notas-fiscais");
  redirect(`/lavagestor/notas-fiscais?ok=${messageParam("Nota fiscal atualizada.")}`);
}

export async function saveLavaAutomacao(formData: FormData) {
  const { current } = await requireLavaGestorCounterAccess("/lavagestor/automacoes");
  ensureEmpresa(current, "/lavagestor/automacoes");
  const client = (await getSupabaseServer()) as any;
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");
  if (!nome) redirect(`/lavagestor/automacoes?error=${messageParam("Informe o nome da automacao.")}`);
  const payload = {
    empresa_id: current.empresaId,
    nome,
    tipo: textValue(formData, "tipo") || "agradecimento",
    ativo: formData.get("ativo") !== "false",
    canal: "whatsapp",
    gatilho: nullableTextValue(formData, "gatilho"),
    atraso_dias: numberValue(formData, "atraso_dias"),
    mensagem: nullableTextValue(formData, "mensagem"),
    regras: {}
  };
  const result = id
    ? await client.from("lava_automacoes").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await client.from("lava_automacoes").insert(payload);
  if (result.error) redirect(`/lavagestor/automacoes?error=${messageParam(result.error.message)}`);
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/automacoes");
  redirect(`/lavagestor/automacoes?ok=${messageParam("Automação salva.")}`);
}

export async function gerarFilaLavaAutomacao(formData: FormData) {
  const { current } = await requireLavaGestorCounterAccess("/lavagestor/automacoes");
  ensureEmpresa(current, "/lavagestor/automacoes");
  const client = (await getSupabaseServer()) as any;
  const automacaoId = textValue(formData, "automacao_id");
  const { data: automacao, error } = await client.from("lava_automacoes").select("*").eq("id", automacaoId).eq("empresa_id", current.empresaId).maybeSingle();
  if (error || !automacao) redirect(`/lavagestor/automacoes?error=${messageParam(error?.message ?? "Automação não encontrada.")}`);
  const lavagensResult = await client
    .from("lava_lavagens")
    .select("id,cliente_id,valor_final,valor_pendente,status,status_pagamento,data_entrega,data_lavagem,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo),lava_servicos(nome)")
    .eq("empresa_id", current.empresaId)
    .order("data_lavagem", { ascending: false })
    .limit(200);
  const rows = ((lavagensResult.data ?? []) as Row[]).filter((row) => automationMatches(automacao, row)).slice(0, 40);
  const existingResult = rows.length
    ? await client.from("lava_automacao_fila").select("lavagem_id").eq("empresa_id", current.empresaId).eq("automacao_id", automacaoId).in("lavagem_id", rows.map((row) => row.id))
    : { data: [] };
  const existing = new Set(((existingResult.data ?? []) as Row[]).map((row) => String(row.lavagem_id)));
  const insertRows = rows
    .filter((row) => !existing.has(String(row.id)))
    .map((row) => ({
      empresa_id: current.empresaId,
      automacao_id: automacaoId,
      cliente_id: row.cliente_id,
      lavagem_id: row.id,
      canal: "whatsapp",
      tipo: automacao.tipo,
      mensagem: buildAutomationMessage(automacao, row),
      status: "pronto",
      agendado_para: addDays(new Date(), numberValueFromUnknown(automacao.atraso_dias)).toISOString()
    }));
  if (insertRows.length > 0) {
    const insert = await client.from("lava_automacao_fila").insert(insertRows);
    if (insert.error) redirect(`/lavagestor/automacoes?error=${messageParam(insert.error.message)}`);
  }
  revalidatePath("/lavagestor/automacoes");
  redirect(`/lavagestor/automacoes?ok=${messageParam(`${insertRows.length} item(ns) gerado(s) na fila manual.`)}`);
}

export async function updateLavaAutomacaoFilaStatus(formData: FormData) {
  const { current } = await requireLavaGestorCounterAccess("/lavagestor/automacoes");
  ensureEmpresa(current, "/lavagestor/automacoes");
  const status = textValue(formData, "status");
  const client = (await getSupabaseServer()) as any;
  const { data, error } = await client
    .from("lava_automacao_fila")
    .update({
      status,
      enviado_em: status === "enviado_manual" ? new Date().toISOString() : null,
      erro: status === "erro" ? nullableTextValue(formData, "erro") : null
    })
    .eq("id", textValue(formData, "id"))
    .eq("empresa_id", current.empresaId)
    .select("id,agendamento_id")
    .maybeSingle();
  if (error) redirect(`/lavagestor/automacoes?error=${messageParam(error.message)}`);
  if (data?.agendamento_id) {
    await client
      .from("lava_agendamentos")
      .update({
        confirmacao_status: status,
        confirmacao_enviada_em: status === "enviado_manual" ? new Date().toISOString() : null,
        confirmacao_erro: status === "erro" ? nullableTextValue(formData, "erro") : null
      })
      .eq("id", data.agendamento_id)
      .eq("empresa_id", current.empresaId);
    await client
      .from("lava_whatsapp_envios")
      .update({
        status,
        enviado_em: status === "enviado_manual" ? new Date().toISOString() : null,
        erro: status === "erro" ? nullableTextValue(formData, "erro") : null
      })
      .eq("empresa_id", current.empresaId)
      .eq("agendamento_id", data.agendamento_id);
  }
  revalidatePath("/lavagestor/automacoes");
  revalidatePath("/lavagestor/agendamentos");
  redirect(`/lavagestor/automacoes?ok=${messageParam("Fila atualizada.")}`);
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

async function ensureAgendamentoConfirmationQueue(client: any, current: Current & { empresaId: string }, agendamentoId: string) {
  const { data: agendamento, error } = await client
    .from("lava_agendamentos")
    .select("id,cliente_id,servico_id,data_inicio,lava_clientes(nome,telefone),lava_servicos(nome)")
    .eq("id", agendamentoId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();
  if (error || !agendamento) return;

  const configResult = await client
    .from("lava_configuracoes")
    .select("nome_exibicao,mensagem_confirmacao_agendamento")
    .eq("empresa_id", current.empresaId)
    .maybeSingle();
  const config = (configResult.data ?? {}) as Row;
  const cliente = relationObject(agendamento.lava_clientes);
  const servico = relationObject(agendamento.lava_servicos);
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

  const queue = await enqueueAutomationQueue(client, {
    empresaId: current.empresaId,
    clienteId: String(agendamento.cliente_id ?? "") || null,
    agendamentoId,
    telefone: String(cliente?.telefone ?? ""),
    mensagem,
    tipo: "confirmacao_agendamento",
    agendadoPara: String(agendamento.data_inicio ?? "")
  });
  const envio = await enqueueWhatsappMessage(current, {
    evento: "confirmacao_agendamento",
    clienteId: String(agendamento.cliente_id ?? "") || null,
    agendamentoId,
    telefone: String(cliente?.telefone ?? ""),
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
  const erro = [queue, envio].map((item) => item.ok ? "" : item.error).filter(Boolean).join(" | ");

  await client
    .from("lava_agendamentos")
    .update({
      confirmacao_status: erro ? "erro" : String((envio as Row).status ?? "pronto"),
      confirmacao_erro: erro || null
    })
    .eq("id", agendamentoId)
    .eq("empresa_id", current.empresaId);
}

function ensureEmpresa(current: Current, path: string): asserts current is Current & { empresaId: string } {
  if (!current.empresaId) redirect(`${path}?error=${messageParam("Selecione uma empresa para usar este modulo.")}`);
}

function safeReturn(formData: FormData, fallback: string) {
  const value = textValue(formData, "return_to");
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : fallback;
}

function moneyNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function numberValueFromUnknown(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function movementDelta(tipo: string, quantidade: number) {
  if (tipo === "entrada") return Math.abs(quantidade);
  if (tipo === "ajuste") return quantidade;
  return -Math.abs(quantidade);
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Row) : null;
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  return relation ? String(relation.nome ?? "") : "";
}

function vehicleLabel(value: unknown) {
  const relation = relationObject(value) ?? (value as Row | null);
  if (!relation || typeof relation !== "object") return "-";
  const model = [relation.marca, relation.modelo].filter(Boolean).join(" ");
  return [relation.placa, model].filter(Boolean).join(" - ") || "Veículo";
}

function extensionFromFile(file: File) {
  const match = (file.name || "").match(/\.[a-zA-Z0-9]+$/);
  if (match) return match[0].toLowerCase();
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return ".jpg";
}

async function findVehicleByPlate(client: any, empresaId: string | null, plate: string) {
  const { data } = await client
    .from("lava_veiculos")
    .select("id,cliente_id,placa,marca,modelo,cor,lava_clientes(nome,telefone)")
    .eq("empresa_id", empresaId)
    .ilike("placa", `%${plate}%`)
    .limit(1)
    .maybeSingle();
  return data as Row | null;
}

function buildPlateRedirectSuffix(placa: string, veiculo: Row | null) {
  const params = new URLSearchParams({ placa });
  if (veiculo?.id) params.set("veiculo", String(veiculo.id));
  if (veiculo?.id) params.set("veiculo_id", String(veiculo.id));
  if (veiculo?.cliente_id) params.set("cliente", String(veiculo.cliente_id));
  if (veiculo?.cliente_id) params.set("cliente_id", String(veiculo.cliente_id));
  return `&${params.toString()}`;
}

function automationMatches(automacao: Row, lavagem: Row) {
  const tipo = String(automacao.tipo ?? "");
  const status = String(lavagem.status_pagamento ?? "");
  const entregue = Boolean(lavagem.data_entrega);
  const dias = daysFrom(lavagem.data_entrega ?? lavagem.data_lavagem);
  if (tipo === "cobranca_fiado") return ["fiado", "aberto", "parcial"].includes(status) && moneyNumber(lavagem.valor_pendente) > 0;
  if (tipo === "cliente_inativo" || tipo === "lembrete_retorno") return dias >= 30;
  if (tipo === "agradecimento" || tipo === "pesquisa_satisfacao") return entregue || ["pago", "entregue"].includes(String(lavagem.status));
  return true;
}

function buildAutomationMessage(automacao: Row, lavagem: Row) {
  const variables = {
    cliente: relationName(lavagem.lava_clientes) || "cliente",
    empresa: "MBA Labs",
    veiculo: vehicleLabel(lavagem.lava_veiculos),
    placa: String(relationObject(lavagem.lava_veiculos)?.placa ?? ""),
    valor: Number(lavagem.valor_pendente ?? lavagem.valor_final ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    data: formatDateShort(lavagem.data_lavagem),
    servico: relationName(lavagem.lava_servicos) || "serviço"
  };
  const fallback = "Olá, {cliente}! Temos uma mensagem da {empresa} sobre seu veículo {veiculo}.";
  return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), String(automacao.mensagem ?? fallback));
}

function applyTemplate(template: string, variables: Record<string, string>) {
  if (!template.trim()) return "";
  return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function daysFrom(value: unknown) {
  if (!value) return 9999;
  const time = new Date(String(value)).getTime();
  if (!Number.isFinite(time)) return 9999;
  return Math.max(Math.floor((Date.now() - time) / 86400000), 0);
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
