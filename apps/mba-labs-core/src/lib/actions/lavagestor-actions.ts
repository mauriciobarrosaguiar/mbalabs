"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { booleanValue, dateValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { normalizeLavaStatus } from "@/lib/lavagestor-data";
import { baixarEstoqueDaLavagem } from "@/lib/lavagestor-estoque-sync";
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveCliente(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");
  const telefone = textValue(formData, "telefone");

  if (!nome || !telefone) {
    redirect(`/lavagestor/clientes?error=${messageParam("Informe o nome e o WhatsApp do cliente.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    nome,
    telefone,
    email: nullableTextValue(formData, "email"),
    documento: nullableTextValue(formData, "documento"),
    observacao: nullableTextValue(formData, "observacao")
  };

  const result = id
    ? await (supabase as any).from("lava_clientes").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_clientes").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/clientes?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar cliente" : "criar cliente", detalhes: { nome } });
  revalidatePath("/lavagestor/clientes");
  redirect(`/lavagestor/clientes?ok=${messageParam("Cliente salvo com sucesso.")}`);
}

export async function deleteCliente(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any).from("lava_clientes").delete().eq("id", id).eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/clientes?error=${messageParam("Não foi possível excluir. Verifique se o cliente possui veículos ou lavagens.")}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "excluir cliente", detalhes: { id } });
  revalidatePath("/lavagestor/clientes");
  redirect(`/lavagestor/clientes?ok=${messageParam("Cliente excluído.")}`);
}

export async function saveVeiculo(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const clienteId = textValue(formData, "cliente_id");

  if (!clienteId) {
    redirect(`/lavagestor/veiculos?error=${messageParam("Selecione o cliente.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    cliente_id: clienteId,
    placa: nullableTextValue(formData, "placa"),
    modelo: nullableTextValue(formData, "modelo"),
    marca: nullableTextValue(formData, "marca"),
    cor: nullableTextValue(formData, "cor"),
    tipo: nullableTextValue(formData, "tipo"),
    observacao: nullableTextValue(formData, "observacao")
  };

  const result = id
    ? await (supabase as any).from("lava_veiculos").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_veiculos").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/veiculos?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar veículo" : "criar veículo", detalhes: { placa: payload.placa } });
  revalidatePath("/lavagestor/veiculos");
  redirect(`/lavagestor/veiculos?ok=${messageParam("Veículo salvo com sucesso.")}`);
}

export async function deleteVeiculo(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any).from("lava_veiculos").delete().eq("id", id).eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/veiculos?error=${messageParam("Não foi possível excluir. Verifique se o veículo possui lavagens.")}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "excluir veículo", detalhes: { id } });
  revalidatePath("/lavagestor/veiculos");
  redirect(`/lavagestor/veiculos?ok=${messageParam("Veículo excluído.")}`);
}

export async function saveFuncionario(formData: FormData) {
  await requireLavaGestorFinanceAccess("/lavagestor/funcionarios");
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");

  if (!nome) {
    redirect(`/lavagestor/funcionarios?error=${messageParam("Informe o nome do funcionário.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    nome,
    telefone: nullableTextValue(formData, "telefone"),
    percentual_comissao: numberValue(formData, "percentual_comissao"),
    ativo: booleanValue(formData, "ativo")
  };

  const result = id
    ? await (supabase as any).from("lava_funcionarios").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_funcionarios").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/funcionarios?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar funcionário" : "criar funcionário", detalhes: { nome } });
  revalidatePath("/lavagestor/funcionarios");
  redirect(`/lavagestor/funcionarios?ok=${messageParam("Funcionário salvo com sucesso.")}`);
}

export async function inactivateFuncionario(formData: FormData) {
  await requireLavaGestorFinanceAccess("/lavagestor/funcionarios");
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any)
    .from("lava_funcionarios")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/funcionarios?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "inativar funcionário", detalhes: { id } });
  revalidatePath("/lavagestor/funcionarios");
  redirect(`/lavagestor/funcionarios?ok=${messageParam("Funcionário inativado.")}`);
}

export async function saveServico(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");

  if (!nome) {
    redirect(`/lavagestor/servicos?error=${messageParam("Informe o nome do serviço.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    nome,
    descricao: nullableTextValue(formData, "descricao"),
    preco: numberValue(formData, "preco"),
    percentual_comissao: nullableTextValue(formData, "percentual_comissao") === null ? null : numberValue(formData, "percentual_comissao"),
    ativo: booleanValue(formData, "ativo")
  };

  const result = id
    ? await (supabase as any).from("lava_servicos").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_servicos").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/servicos?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar serviço" : "criar serviço", detalhes: { nome } });
  revalidatePath("/lavagestor/servicos");
  redirect(`/lavagestor/servicos?ok=${messageParam("Serviço salvo com sucesso.")}`);
}

export async function inactivateServico(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any)
    .from("lava_servicos")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/servicos?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "inativar serviço", detalhes: { id } });
  revalidatePath("/lavagestor/servicos");
  redirect(`/lavagestor/servicos?ok=${messageParam("Serviço inativado.")}`);
}

export async function createLavagem(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const clienteId = await resolveLavagemCliente(client, current.empresaId, formData);
  const veiculoId = await resolveLavagemVeiculo(client, current.empresaId, clienteId, formData);
  const funcionarioId = textValue(formData, "funcionario_id");
  const servicoId = textValue(formData, "servico_id");
  const servicoAvulso = textValue(formData, "servico_avulso");

  if (!clienteId || !veiculoId || !funcionarioId || (!servicoId && !servicoAvulso)) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Informe cliente, veículo, serviço e funcionário.")}`);
  }

  const [funcionarioResult, servicoResult] = await Promise.all([
    client
      .from("lava_funcionarios")
      .select("id,nome,percentual_comissao")
      .eq("id", funcionarioId)
      .eq("empresa_id", current.empresaId)
      .maybeSingle(),
    servicoId
      ? client
          .from("lava_servicos")
          .select("id,nome,preco,percentual_comissao")
          .eq("id", servicoId)
          .eq("empresa_id", current.empresaId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (funcionarioResult.error || !funcionarioResult.data) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Funcionário não encontrado.")}`);
  }

  if (servicoId && (servicoResult.error || !servicoResult.data)) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Serviço não encontrado.")}`);
  }

  const funcionarioPercent = Number(funcionarioResult.data?.percentual_comissao ?? 0);
  const servicePercent = servicoResult.data?.percentual_comissao;
  const percent = servicePercent === null || servicePercent === undefined ? funcionarioPercent : Number(servicePercent);
  const valorServico = numberValue(formData, "valor_servico") || Number(servicoResult.data?.preco ?? 0);
  const valorAvulso = numberValue(formData, "valor_avulso");
  const totalBruto = numberValue(formData, "valor_total") || valorServico + valorAvulso;
  const desconto = numberValue(formData, "valor_desconto");
  const valorFinal = numberValue(formData, "valor_final") || Math.max(totalBruto - desconto, 0);
  const valorRecebidoInput = numberValue(formData, "valor_recebido");
  const statusPagamento = textValue(formData, "status_pagamento") || "aberto";
  const formaPagamento = nullableTextValue(formData, "forma_pagamento");
  const valorRecebido = statusPagamento === "pago" && valorRecebidoInput <= 0 ? valorFinal : valorRecebidoInput;
  const valorPendente = Math.max(valorFinal - valorRecebido, 0);
  const comissaoServico = roundMoney((valorServico * percent) / 100);
  const percentualAvulso = numberValue(formData, "percentual_comissao_avulso");
  const comissaoAvulsa = roundMoney((valorAvulso * percentualAvulso) / 100);
  const comissao = comissaoServico + comissaoAvulsa;
  const now = new Date().toISOString();

  const { data: lavagem, error } = await client
    .from("lava_lavagens")
    .insert({
      empresa_id: current.empresaId,
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      funcionario_id: funcionarioId,
      servico_id: servicoId || null,
      descricao_extra: nullableTextValue(formData, "descricao_extra"),
      valor: valorFinal,
      valor_total: totalBruto,
      valor_desconto: desconto,
      valor_final: valorFinal,
      valor_recebido: valorRecebido,
      valor_pendente: valorPendente,
      status_pagamento: statusPagamento,
      forma_pagamento: formaPagamento,
      comissao,
      status: "na_fila",
      data_entrada: now,
      data_lavagem: now,
      observacoes: nullableTextValue(formData, "observacoes")
    })
    .select("id")
    .single();

  if (error || !lavagem?.id) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível salvar a lavagem.")}`);
  }

  const serviceRows = [];
  if (servicoId) {
    serviceRows.push({
      empresa_id: current.empresaId,
      lavagem_id: lavagem.id,
      servico_id: servicoId,
      funcionario_id: funcionarioId,
      descricao: servicoResult.data?.nome ?? "Serviço",
      valor: valorServico,
      tipo_comissao: percent > 0 ? "percentual" : "sem_comissao",
      percentual_comissao: percent,
      valor_comissao: comissaoServico
    });
  }

  if (servicoAvulso && valorAvulso > 0) {
    serviceRows.push({
      empresa_id: current.empresaId,
      lavagem_id: lavagem.id,
      servico_id: null,
      funcionario_id: funcionarioId,
      descricao: servicoAvulso,
      valor: valorAvulso,
      tipo_comissao: percentualAvulso > 0 ? "percentual" : "sem_comissao",
      percentual_comissao: percentualAvulso,
      valor_comissao: comissaoAvulsa
    });
  }

  if (serviceRows.length > 0) {
    const { error: serviceError } = await client.from("lava_lavagem_servicos").insert(serviceRows);
    if (serviceError) {
      redirect(`/lavagestor/nova-lavagem?error=${messageParam(serviceError.message)}`);
    }
  }

  if (valorRecebido > 0) {
    const { error: paymentError } = await client.from("lava_pagamentos").insert({
      empresa_id: current.empresaId,
      lavagem_id: lavagem.id,
      valor: valorRecebido,
      forma_pagamento: formaPagamento,
      data_pagamento: now,
      observacoes: "Pagamento registrado na entrada."
    });

    if (paymentError) {
      redirect(`/lavagestor/nova-lavagem?error=${messageParam(paymentError.message)}`);
    }
  }

  await insertLavaHistory(client, {
    empresaId: current.empresaId,
    lavagemId: lavagem.id,
    usuarioId: current.usuario.id,
    acao: "entrada_lavagem",
    statusAnterior: null,
    statusNovo: "na_fila",
    observacao: "Lavagem registrada na fila."
  });

  await logAction({
    appSlug: "lavagestor",
    acao: "criar lavagem",
    detalhes: { lavagem_id: lavagem.id, valor: valorFinal, comissao, percentual: percent }
  });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  redirect(`/lavagestor/checklists/${lavagem.id}?ok=${messageParam("Lavagem registrada na fila. Complete o checklist de entrada.")}`);
}

export async function updateLavagemStatus(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const id = textValue(formData, "id");
  const action = textValue(formData, "acao");
  const returnTo = returnPath(formData, "/lavagestor/fila");

  const { data: lavagem, error } = await client
    .from("lava_lavagens")
    .select("id,status,status_pagamento")
    .eq("id", id)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !lavagem) {
    redirect(`${returnTo}?error=${messageParam(error?.message ?? "Lavagem não encontrada.")}`);
  }

  const [configResult, checklistResult, entradaFotosResult, checkoutFotosResult] = await Promise.all([
    current.empresaId
      ? client
          .from("lava_configuracoes")
          .select("exigir_checklist_antes_finalizar,exigir_checklist_antes_entregar,exigir_foto_entrada,permitir_concluir_checklist_sem_foto,exigir_foto_checkout_antes_entrega")
          .eq("empresa_id", current.empresaId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from("lava_checklists")
      .select("id,status")
      .eq("lavagem_id", id)
      .eq("empresa_id", current.empresaId)
      .maybeSingle(),
    client
      .from("lava_checklist_fotos")
      .select("id", { count: "exact", head: true })
      .eq("lavagem_id", id)
      .eq("empresa_id", current.empresaId)
      .eq("momento", "entrada"),
    client
      .from("lava_checklist_fotos")
      .select("id", { count: "exact", head: true })
      .eq("lavagem_id", id)
      .eq("empresa_id", current.empresaId)
      .eq("momento", "checkout")
  ]);
  const config = (configResult.data ?? {}) as Record<string, unknown>;
  const checklistConcluido = checklistResult.data?.status === "concluido";
  const entradaFotos = entradaFotosResult.count ?? 0;
  const checkoutFotos = checkoutFotosResult.count ?? 0;

  const statusAnterior = normalizeLavaStatus(lavagem.status);
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {};
  let statusNovo = statusAnterior;
  let observacao = nullableTextValue(formData, "observacao");

  if (action === "iniciar") {
    ensureTransition(returnTo, statusAnterior, ["na_fila"], "Só é possível iniciar uma lavagem que está na fila.");
    statusNovo = "em_lavagem";
    payload.data_inicio = now;
  } else if (action === "finalizar") {
    ensureTransition(returnTo, statusAnterior, ["em_lavagem", "aguardando_finalizacao"], "Só é possível finalizar uma lavagem em andamento.");
    if (config.exigir_checklist_antes_finalizar === true && !checklistConcluido) {
      redirect(`${returnTo}?error=${messageParam("Conclua o checklist antes de finalizar a lavagem.")}`);
    }
    if (config.exigir_foto_entrada !== false && config.permitir_concluir_checklist_sem_foto !== true && entradaFotos < 1) {
      redirect(`${returnTo}?error=${messageParam("Tire pelo menos uma foto de entrada antes de concluir o serviço.")}`);
    }
    statusNovo = "finalizado";
    payload.data_finalizacao = now;
  } else if (action === "avisar_cliente") {
    ensureTransition(returnTo, statusAnterior, ["finalizado"], "Finalize a lavagem antes de avisar o cliente.");
    statusNovo = "cliente_avisado";
    payload.data_cliente_avisado = now;
  } else if (action === "entregar") {
    ensureTransition(returnTo, statusAnterior, ["finalizado", "cliente_avisado", "pago"], "A lavagem precisa estar finalizada para entrega.");
    if (config.exigir_checklist_antes_entregar === true && !checklistConcluido) {
      redirect(`${returnTo}?error=${messageParam("Conclua o checklist antes de entregar.")}`);
    }
    if (config.exigir_foto_entrada !== false && config.permitir_concluir_checklist_sem_foto !== true && entradaFotos < 1) {
      redirect(`${returnTo}?error=${messageParam("Tire pelo menos uma foto de entrada antes de concluir o serviço.")}`);
    }
    if (config.exigir_foto_checkout_antes_entrega === true && checkoutFotos < 1) {
      redirect(`${returnTo}?error=${messageParam("Adicione uma foto de checkout antes de entregar.")}`);
    }
    const paymentStatus = String(lavagem.status_pagamento ?? "aberto");
    const manualRelease = current.isAdminMaster && textValue(formData, "liberacao_manual") === "true";
    if (!["pago", "fiado"].includes(paymentStatus) && !manualRelease) {
      redirect(`${returnTo}?error=${messageParam("Não é possível entregar sem pagamento, fiado marcado ou liberação manual do Admin.")}`);
    }
    statusNovo = "entregue";
    payload.data_entrega = now;
  } else if (action === "cancelar") {
    const motivo = textValue(formData, "motivo_cancelamento");
    if (!motivo) {
      redirect(`${returnTo}?error=${messageParam("Informe o motivo do cancelamento.")}`);
    }
    statusNovo = "cancelado";
    payload.motivo_cancelamento = motivo;
    payload.status_pagamento = "cancelado";
    payload.valor_recebido = 0;
    payload.valor_pendente = 0;
    payload.comissao = 0;
    payload.forma_pagamento = null;
    payload.data_pagamento = null;
    observacao = motivo;
  } else {
    redirect(`${returnTo}?error=${messageParam("Ação inválida para a lavagem.")}`);
  }

  payload.status = statusNovo;
  const { error: updateError } = await client
    .from("lava_lavagens")
    .update(payload)
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (updateError) {
    redirect(`${returnTo}?error=${messageParam(updateError.message)}`);
  }

  if (action === "cancelar") {
    await client.from("lava_comissoes").update({ status: "cancelado" }).eq("lavagem_id", id).eq("empresa_id", current.empresaId);
  }

  if (action === "finalizar") {
    try {
      const estoque = await baixarEstoqueDaLavagem(client, current, id);
      if (estoque.baixados > 0 || estoque.avisos.length > 0) {
        await insertLavaHistory(client, {
          empresaId: current.empresaId,
          lavagemId: id,
          usuarioId: current.usuario.id,
          acao: "estoque_baixa_servico",
          statusAnterior,
          statusNovo,
          observacao: [`${estoque.baixados} baixa(s) de estoque.`, ...estoque.avisos].join(" ")
        });
      }
    } catch (error) {
      await insertLavaHistory(client, {
        empresaId: current.empresaId,
        lavagemId: id,
        usuarioId: current.usuario.id,
        acao: "estoque_alerta",
        statusAnterior,
        statusNovo,
        observacao: error instanceof Error ? error.message : "Nao foi possivel baixar estoque automaticamente."
      });
    }
  }

  await insertLavaHistory(client, {
    empresaId: current.empresaId,
    lavagemId: id,
    usuarioId: current.usuario.id,
    acao: action,
    statusAnterior,
    statusNovo,
    observacao
  });

  await logAction({ appSlug: "lavagestor", acao: `lavagem ${action}`, detalhes: { id, statusAnterior, statusNovo } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/lavagens");
  revalidatePath("/lavagestor/pagamentos");
  revalidatePath("/lavagestor/comissoes");
  revalidatePath("/lavagestor/relatorios");
  revalidatePath("/lavagestor/estoque");
  redirect(`${returnTo}?ok=${messageParam(action === "cancelar" ? "Lavagem cancelada. Pagamento e comissão foram zerados." : "Status atualizado.")}`);
}

export async function registrarPagamentoLavagem(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const id = textValue(formData, "id");
  const valorInformado = numberValue(formData, "valor_recebido");
  const formaPagamento = textValue(formData, "forma_pagamento");
  const statusPagamento = textValue(formData, "status_pagamento") || "pago";
  const returnTo = returnPath(formData, "/lavagestor/pagamentos");

  const { data: lavagem, error } = await client
    .from("lava_lavagens")
    .select("id,status,valor,valor_final,valor_recebido")
    .eq("id", id)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !lavagem) {
    redirect(`${returnTo}?error=${messageParam(error?.message ?? "Lavagem não encontrada.")}`);
  }

  const valorFinal = Number(lavagem.valor_final ?? lavagem.valor ?? 0);
  const valorRecebidoAnterior = Number(lavagem.valor_recebido ?? 0);
  const valorLancamento = statusPagamento === "pago" && valorInformado <= 0 ? Math.max(valorFinal - valorRecebidoAnterior, 0) : valorInformado;
  const valorRecebido = statusPagamento === "fiado" ? valorRecebidoAnterior : valorRecebidoAnterior + valorLancamento;
  const valorPendente = statusPagamento === "fiado" ? Math.max(valorFinal - valorRecebidoAnterior, 0) : Math.max(valorFinal - valorRecebido, 0);
  const normalizedStatus = normalizeLavaStatus(lavagem.status);
  const nextLavagemStatus =
    statusPagamento === "pago" && !["entregue", "cancelado"].includes(normalizedStatus) ? "pago" : normalizedStatus;
  const now = new Date().toISOString();

  if (valorLancamento > 0) {
    const { error: paymentError } = await client.from("lava_pagamentos").insert({
      empresa_id: current.empresaId,
      lavagem_id: id,
      valor: valorLancamento,
      forma_pagamento: formaPagamento || null,
      data_pagamento: now,
      observacoes: nullableTextValue(formData, "observacoes")
    });

    if (paymentError) {
      redirect(`${returnTo}?error=${messageParam(paymentError.message)}`);
    }
  }

  const { error: updateError } = await client
    .from("lava_lavagens")
    .update({
      status: nextLavagemStatus,
      status_pagamento: statusPagamento,
      forma_pagamento: formaPagamento || null,
      valor_recebido: valorRecebido,
      valor_pendente: valorPendente,
      data_pagamento: statusPagamento === "pago" ? now : null
    })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (updateError) {
    redirect(`${returnTo}?error=${messageParam(updateError.message)}`);
  }

  await insertLavaHistory(client, {
    empresaId: current.empresaId,
    lavagemId: id,
    usuarioId: current.usuario.id,
    acao: "registrar_pagamento",
    statusAnterior: normalizedStatus,
    statusNovo: nextLavagemStatus,
    observacao: `Pagamento: ${statusPagamento}`
  });

  await logAction({ appSlug: "lavagestor", acao: "registrar pagamento", detalhes: { id, statusPagamento, valorLancamento } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/pagamentos");
  redirect(`${returnTo}?ok=${messageParam("Pagamento atualizado.")}`);
}

export async function markComissaoPaga(formData: FormData) {
  await requireLavaGestorFinanceAccess("/lavagestor/comissoes");
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any)
    .from("lava_comissoes")
    .update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/comissoes?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "marcar comissão como paga", detalhes: { id } });
  revalidatePath("/lavagestor/comissoes");
  redirect(`/lavagestor/comissoes?ok=${messageParam("Comissão marcada como paga.")}`);
}

export async function saveVale(formData: FormData) {
  await requireLavaGestorFinanceAccess("/lavagestor/vales");
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const funcionarioId = textValue(formData, "funcionario_id");
  const valor = numberValue(formData, "valor");

  if (!funcionarioId || valor <= 0) {
    redirect(`/lavagestor/vales?error=${messageParam("Selecione o funcionário e informe o valor.")}`);
  }

  const { error } = await (supabase as any).from("lava_vales").insert({
    empresa_id: current.empresaId,
    funcionario_id: funcionarioId,
    valor,
    descricao: nullableTextValue(formData, "descricao"),
    data_vale: dateValue(formData, "data_vale"),
    status: "aberto"
  });

  if (error) {
    redirect(`/lavagestor/vales?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "criar vale", detalhes: { funcionario_id: funcionarioId, valor } });
  revalidatePath("/lavagestor/vales");
  redirect(`/lavagestor/vales?ok=${messageParam("Vale salvo com sucesso.")}`);
}

export async function updateValeStatus(formData: FormData) {
  await requireLavaGestorFinanceAccess("/lavagestor/vales");
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");

  const { error } = await (supabase as any)
    .from("lava_vales")
    .update({ status })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/vales?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: `atualizar vale para ${status}`, detalhes: { id } });
  revalidatePath("/lavagestor/vales");
  redirect(`/lavagestor/vales?ok=${messageParam("Vale atualizado.")}`);
}

async function resolveLavagemCliente(client: any, empresaId: string | null, formData: FormData) {
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

async function resolveLavagemVeiculo(client: any, empresaId: string | null, clienteId: string, formData: FormData) {
  const selectedVeiculoId = textValue(formData, "veiculo_id");
  if (selectedVeiculoId) {
    return selectedVeiculoId;
  }

  const tipo = textValue(formData, "veiculo_tipo");
  const placa = nullableTextValue(formData, "veiculo_placa");
  const marca = nullableTextValue(formData, "veiculo_marca");
  const modelo = nullableTextValue(formData, "veiculo_modelo");

  if (!tipo || (!placa && !marca && !modelo)) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Selecione um veículo ou cadastre um veículo no fluxo.")}`);
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
    redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível cadastrar o veículo.")}`);
  }

  return String(data.id);
}

async function insertLavaHistory(
  client: any,
  {
    empresaId,
    lavagemId,
    usuarioId,
    acao,
    statusAnterior,
    statusNovo,
    observacao
  }: {
    empresaId: string | null;
    lavagemId: string;
    usuarioId: string;
    acao: string;
    statusAnterior: string | null;
    statusNovo: string;
    observacao?: string | null;
  }
) {
  await client.from("lava_historico").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    usuario_id: usuarioId,
    acao,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    observacao: observacao ?? null
  });
}

function ensureTransition(returnTo: string, currentStatus: string, allowedStatuses: string[], message: string) {
  if (!allowedStatuses.includes(currentStatus)) {
    redirect(`${returnTo}?error=${messageParam(message)}`);
  }
}

function returnPath(formData: FormData, fallback: string) {
  const path = textValue(formData, "return_to");
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
