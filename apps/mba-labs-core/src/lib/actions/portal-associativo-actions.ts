"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dateValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { canPortalAccess, getPortalContext, PORTAL_ASSOCIATIVO_PATH } from "@/lib/portal-associativo-data";
import { deleteFromPortalStorage, isPortalStorageProvider } from "@/lib/portal-associativo-storage";

export async function savePortalPessoa(formData: FormData) {
  const context = await requirePortalWrite("pessoas", "/portal-associativo/pessoas");
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome_completo");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/pessoas";

  if (!nome) {
    redirectWithError(returnTo, "Informe o nome da pessoa.");
  }

  const telefone = normalizePhone(nullableTextValue(formData, "telefone"));
  const whatsapp = normalizePhone(nullableTextValue(formData, "whatsapp"));
  await assertNoDuplicatePessoa(context.client, context.empresaId, id, {
    cpf_cnpj: nullableTextValue(formData, "cpf_cnpj"),
    email: nullableTextValue(formData, "email"),
    telefone,
    whatsapp
  });

  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, returnTo),
    core_usuario_id: nullableTextValue(formData, "core_usuario_id"),
    nome_completo: nome,
    tipo_pessoa: textValue(formData, "tipo_pessoa") || "fisica",
    cpf_cnpj: nullableTextValue(formData, "cpf_cnpj"),
    rg_ie: nullableTextValue(formData, "rg_ie"),
    data_nascimento: dateValue(formData, "data_nascimento"),
    telefone,
    whatsapp,
    email: nullableTextValue(formData, "email")?.toLowerCase() ?? null,
    endereco: nullableTextValue(formData, "endereco") ?? nullableTextValue(formData, "endereco_residencial"),
    endereco_residencial: nullableTextValue(formData, "endereco_residencial"),
    cidade: nullableTextValue(formData, "cidade"),
    uf: nullableTextValue(formData, "uf"),
    status_pessoa: textValue(formData, "status_pessoa") || "ativa",
    observacoes: nullableTextValue(formData, "observacoes")
  };

  const result = id
    ? await context.client.from("assoc_pessoas").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", id).eq("empresa_id", context.empresaId)
    : await context.client.from("assoc_pessoas").insert(payload).select("id").single();

  if (result.error) {
    redirectWithError(returnTo, result.error.message);
  }

  const pessoaId = id || String(result.data?.id ?? "");
  const perfil = textValue(formData, "perfil");
  if (payload.core_usuario_id && perfil) {
    const { error } = await context.client.from("assoc_perfis_usuarios").upsert(
      {
        empresa_id: context.empresaId,
        core_usuario_id: payload.core_usuario_id,
        pessoa_id: pessoaId,
        perfil,
        status: "ativo",
        atualizado_em: new Date().toISOString()
      },
      { onConflict: "empresa_id,core_usuario_id" }
    );
    if (error) {
      redirectWithError(returnTo, error.message);
    }
  }

  await recordPortalAudit(context, id ? "editar_pessoa" : "criar_pessoa", "assoc_pessoas", pessoaId, { nome });
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Pessoa salva com sucesso.");
}

export async function inactivatePortalPessoa(formData: FormData) {
  const context = await requirePortalWrite("pessoas", "/portal-associativo/pessoas");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/pessoas";
  const { error } = await context.client
    .from("assoc_pessoas")
    .update({ status_pessoa: "inativa", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "inativar_pessoa", "assoc_pessoas", id);
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Pessoa inativada.");
}

export async function reactivatePortalPessoa(formData: FormData) {
  const context = await requirePortalWrite("pessoas", "/portal-associativo/pessoas");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/pessoas";
  const { error } = await context.client
    .from("assoc_pessoas")
    .update({ status_pessoa: "ativa", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "reativar_pessoa", "assoc_pessoas", id);
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Pessoa reativada.");
}

export async function deletePortalPessoa(formData: FormData) {
  const context = await requirePortalWrite("pessoas", "/portal-associativo/pessoas");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/pessoas";
  const confirmacao = textValue(formData, "confirmacao");
  if (confirmacao !== "EXCLUIR") {
    redirectWithError(returnTo, "Digite EXCLUIR para confirmar a exclusão.");
  }

  const [vinculos, cobrancas, arquivos] = await Promise.all([
    countByEmpresa(context.client, "assoc_vinculos_unidade_pessoa", context.empresaId, { pessoa_id: id }),
    countByEmpresa(context.client, "assoc_cobrancas", context.empresaId, { pessoa_responsavel_id: id }),
    countByEmpresa(context.client, "assoc_arquivos", context.empresaId, { pessoa_id: id })
  ]);
  if (vinculos + cobrancas + arquivos > 0) {
    redirectWithError(returnTo, "Não é possível excluir pessoa com vínculo, cobrança ou documento. Inative o cadastro.");
  }

  const { error } = await context.client.from("assoc_pessoas").delete().eq("id", id).eq("empresa_id", context.empresaId);
  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "excluir_pessoa", "assoc_pessoas", id);
  revalidatePortal("/portal-associativo/pessoas");
  redirectWithOk("/portal-associativo/pessoas", "Pessoa excluída.");
}

export async function savePortalLoteamento(formData: FormData) {
  const context = await requirePortalWrite("loteamentos", "/portal-associativo/loteamentos");
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");
  const returnTo = "/portal-associativo/loteamentos";

  if (!nome) {
    redirectWithError(returnTo, "Informe o nome do loteamento.");
  }

  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, returnTo),
    nome,
    codigo: nullableTextValue(formData, "codigo"),
    endereco: nullableTextValue(formData, "endereco"),
    cidade: nullableTextValue(formData, "cidade"),
    uf: nullableTextValue(formData, "uf"),
    status: textValue(formData, "status") || "ativo",
    valor_mensalidade_padrao: numberValue(formData, "valor_mensalidade_padrao"),
    vencimento_padrao: clampDay(Number(textValue(formData, "vencimento_padrao") || 10)),
    descricao_mensalidade_padrao: textValue(formData, "descricao_mensalidade_padrao") || "Mensalidade",
    observacoes: nullableTextValue(formData, "observacoes")
  };

  const result = id
    ? await context.client.from("assoc_loteamentos").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", id).eq("empresa_id", context.empresaId)
    : await context.client.from("assoc_loteamentos").insert(payload).select("id").single();

  if (result.error) {
    redirectWithError(returnTo, result.error.message);
  }

  const loteamentoId = id || String(result.data?.id ?? "");
  await recordPortalAudit(context, id ? "editar_loteamento" : "criar_loteamento", "assoc_loteamentos", loteamentoId, { nome });
  revalidatePortal(returnTo);
  revalidatePath("/portal-associativo/unidades");
  revalidatePath("/portal-associativo/financeiro");
  redirectWithOk(returnTo, "Loteamento salvo com sucesso.");
}

export async function inactivatePortalLoteamento(formData: FormData) {
  const context = await requirePortalWrite("loteamentos", "/portal-associativo/loteamentos");
  const id = textValue(formData, "id");
  const { error } = await context.client
    .from("assoc_loteamentos")
    .update({ status: "inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError("/portal-associativo/loteamentos", error.message);
  await recordPortalAudit(context, "inativar_loteamento", "assoc_loteamentos", id);
  revalidatePortal("/portal-associativo/loteamentos");
  revalidatePath("/portal-associativo/unidades");
  redirectWithOk("/portal-associativo/loteamentos", "Loteamento inativado.");
}

export async function savePortalUnidade(formData: FormData) {
  const context = await requirePortalWrite("unidades", "/portal-associativo/unidades");
  const id = textValue(formData, "id");
  const codigo = textValue(formData, "codigo_unidade");
  const numero = textValue(formData, "numero_unidade");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/unidades";

  if (!codigo || !numero) {
    redirectWithError(returnTo, "Informe codigo e numero da chacara/lote.");
  }

  const empresaId = requireEmpresaId(context.empresaId, returnTo);
  const loteamentoId = nullableTextValue(formData, "loteamento_id");
  if (loteamentoId) {
    await assertRecordBelongsToEmpresa(context, "assoc_loteamentos", loteamentoId, returnTo, "Loteamento invalido para esta empresa.");
  }
  await assertNoDuplicateUnidade(context.client, empresaId, id, codigo, numero, loteamentoId, returnTo);

  const payload = {
    empresa_id: empresaId,
    loteamento_id: loteamentoId,
    codigo_unidade: codigo,
    numero_unidade: numero,
    quadra_setor: nullableTextValue(formData, "quadra_setor"),
    tipo_unidade: textValue(formData, "tipo_unidade") || "propriedade",
    endereco_localizacao: nullableTextValue(formData, "endereco_localizacao"),
    area_m2: nullableNumberValue(formData, "area_m2"),
    coordenadas_maps: nullableTextValue(formData, "coordenadas_maps"),
    status_unidade: textValue(formData, "status_unidade") || "ativa",
    possui_construcao: formData.get("possui_construcao") === "true",
    valor_mensalidade: nullableNumberValue(formData, "valor_mensalidade"),
    vencimento_dia: nullableDayValue(formData, "vencimento_dia"),
    isento_mensalidade: formData.get("isento_mensalidade") === "true",
    observacoes: nullableTextValue(formData, "observacoes")
  };

  const result = id
    ? await context.client.from("assoc_unidades").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", id).eq("empresa_id", empresaId)
    : await context.client.from("assoc_unidades").insert(payload).select("id").single();

  if (result.error) {
    redirectWithError(returnTo, result.error.message);
  }

  const unidadeId = id || String(result.data?.id ?? "");
  await upsertActiveVinculo(context, unidadeId, "proprietario", textValue(formData, "proprietario_id"));
  await upsertActiveVinculo(context, unidadeId, "responsavel_financeiro", textValue(formData, "responsavel_financeiro_id"));
  await upsertActiveVinculo(context, unidadeId, "responsavel_contato", textValue(formData, "responsavel_contato_id"));

  await recordPortalAudit(context, id ? "editar_unidade" : "criar_unidade", "assoc_unidades", unidadeId, { codigo, numero });
  revalidatePortal(returnTo);
  revalidatePath("/portal-associativo/financeiro");
  redirectWithOk(returnTo, "Chacara/lote salvo com sucesso.");
}

export async function inactivatePortalUnidade(formData: FormData) {
  const context = await requirePortalWrite("unidades", "/portal-associativo/unidades");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/unidades";
  const { error } = await context.client
    .from("assoc_unidades")
    .update({ status_unidade: "inativa", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "inativar_unidade", "assoc_unidades", id);
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Unidade inativada.");
}

export async function reactivatePortalUnidade(formData: FormData) {
  const context = await requirePortalWrite("unidades", "/portal-associativo/unidades");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/unidades";
  const { error } = await context.client
    .from("assoc_unidades")
    .update({ status_unidade: "ativa", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "reativar_unidade", "assoc_unidades", id);
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Unidade reativada.");
}

export async function deletePortalUnidade(formData: FormData) {
  const context = await requirePortalWrite("unidades", "/portal-associativo/unidades");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/unidades";
  const confirmacao = textValue(formData, "confirmacao");
  if (confirmacao !== "EXCLUIR") {
    redirectWithError(returnTo, "Digite EXCLUIR para confirmar a exclusão.");
  }

  const [vinculos, cobrancas, arquivos, transferencias] = await Promise.all([
    countByEmpresa(context.client, "assoc_vinculos_unidade_pessoa", context.empresaId, { unidade_id: id }),
    countByEmpresa(context.client, "assoc_cobrancas", context.empresaId, { unidade_id: id }),
    countByEmpresa(context.client, "assoc_arquivos", context.empresaId, { unidade_id: id }),
    countByEmpresa(context.client, "assoc_transferencias", context.empresaId, { unidade_id: id })
  ]);
  if (vinculos + cobrancas + arquivos + transferencias > 0) {
    redirectWithError(returnTo, "Não é possível excluir unidade com vínculo, cobrança, documento ou transferência. Inative a unidade.");
  }

  const { error } = await context.client.from("assoc_unidades").delete().eq("id", id).eq("empresa_id", context.empresaId);
  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "excluir_unidade", "assoc_unidades", id);
  revalidatePortal("/portal-associativo/unidades");
  redirectWithOk("/portal-associativo/unidades", "Unidade excluída.");
}

export async function savePortalTransferencia(formData: FormData) {
  const context = await requirePortalWrite("transferencias", "/portal-associativo/transferencias");
  const returnTo = "/portal-associativo/transferencias";
  const empresaId = requireEmpresaId(context.empresaId, returnTo);
  const unidadeId = textValue(formData, "unidade_id");
  const novaPessoaId = textValue(formData, "nova_pessoa_id");
  const motivo = textValue(formData, "motivo");

  if (!unidadeId || !novaPessoaId || !motivo) {
    redirectWithError(returnTo, "Informe chacara/lote, novo responsavel e motivo.");
  }

  const previousOwner = await context.client
    .from("assoc_vinculos_unidade_pessoa")
    .select("pessoa_id")
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .eq("tipo_vinculo", "proprietario")
    .eq("status_vinculo", "ativo")
    .is("data_fim", null)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  await context.client
    .from("assoc_vinculos_unidade_pessoa")
    .update({ status_vinculo: "encerrado", data_fim: today, motivo_encerramento: motivo, atualizado_em: new Date().toISOString() })
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .in("tipo_vinculo", ["proprietario", "responsavel_financeiro", "responsavel_contato"])
    .eq("status_vinculo", "ativo")
    .is("data_fim", null);

  const transferencia = await context.client
    .from("assoc_transferencias")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      pessoa_anterior_id: previousOwner.data?.pessoa_id ?? null,
      nova_pessoa_id: novaPessoaId,
      responsavel_financeiro_id: nullableTextValue(formData, "responsavel_financeiro_id") ?? novaPessoaId,
      responsavel_contato_id: nullableTextValue(formData, "responsavel_contato_id") ?? novaPessoaId,
      data_transferencia: dateValue(formData, "data_transferencia") ?? today,
      motivo,
      documento_url: nullableTextValue(formData, "documento_url"),
      responsabilidade_debitos: textValue(formData, "responsabilidade_debitos") || "novo",
      observacoes: nullableTextValue(formData, "observacoes"),
      criado_por: context.current.usuario.id
    })
    .select("id")
    .single();

  if (transferencia.error) {
    redirectWithError(returnTo, transferencia.error.message);
  }

  await insertVinculo(context, unidadeId, novaPessoaId, "proprietario");
  await insertVinculo(context, unidadeId, textValue(formData, "responsavel_financeiro_id") || novaPessoaId, "responsavel_financeiro");
  await insertVinculo(context, unidadeId, textValue(formData, "responsavel_contato_id") || novaPessoaId, "responsavel_contato");
  await recordPortalAudit(context, "transferir_unidade", "assoc_transferencias", String(transferencia.data?.id ?? ""), { unidadeId, novaPessoaId });
  revalidatePortal(returnTo);
  revalidatePath("/portal-associativo/unidades");
  redirectWithOk(returnTo, "Transferencia registrada com historico.");
}

export async function savePortalCobranca(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/financeiro";
  const id = textValue(formData, "id");
  const unidadeId = textValue(formData, "unidade_id");
  const dataVencimento = dateValue(formData, "data_vencimento");
  const valorOriginal = numberValue(formData, "valor_original");

  if (!unidadeId || !dataVencimento || valorOriginal <= 0) {
    redirectWithError(returnTo, "Informe chacara/lote, vencimento e valor.");
  }

  const unidade = await resolvePortalUnidade(context, unidadeId, returnTo);
  const dueDate = new Date(String(dataVencimento));
  if (id) {
    const current = await context.client
      .from("assoc_cobrancas")
      .select("id,status")
      .eq("id", id)
      .eq("empresa_id", context.empresaId)
      .maybeSingle();
    if (current.error || !current.data?.id) {
      redirectWithError(returnTo, current.error?.message ?? "Cobrança não encontrada.");
    }
    if (String(current.data.status) === "cancelada" && textValue(formData, "status") !== "cancelada") {
      redirectWithError(returnTo, "Reabra a cobrança cancelada antes de editá-la.");
    }
  }
  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, returnTo),
    loteamento_id: nullableRecordId(unidade.loteamento_id),
    unidade_id: unidadeId,
    pessoa_responsavel_id: nullableTextValue(formData, "pessoa_responsavel_id") || (await resolveResponsavelFinanceiro(context, unidadeId)),
    tipo_cobranca: textValue(formData, "tipo_cobranca") || "mensalidade",
    descricao: textValue(formData, "descricao") || "Mensalidade",
    mes_referencia: Number(textValue(formData, "mes_referencia") || dueDate.getMonth() + 1),
    ano_referencia: Number(textValue(formData, "ano_referencia") || dueDate.getFullYear()),
    data_vencimento: dataVencimento,
    valor_original: valorOriginal,
    valor_juros: numberValue(formData, "valor_juros"),
    valor_multa: numberValue(formData, "valor_multa"),
    valor_desconto: numberValue(formData, "valor_desconto"),
    valor_total:
      valorOriginal + numberValue(formData, "valor_juros") + numberValue(formData, "valor_multa") - numberValue(formData, "valor_desconto"),
    status: textValue(formData, "status") || "aberta",
    forma_pagamento: nullableTextValue(formData, "forma_pagamento"),
    pix_copia_cola: nullableTextValue(formData, "pix_copia_cola"),
    pix_gateway: nullableTextValue(formData, "pix_gateway") ?? "manual",
    observacoes: nullableTextValue(formData, "observacoes")
  };

  const result = id
    ? await context.client.from("assoc_cobrancas").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", id).eq("empresa_id", context.empresaId)
    : await context.client.from("assoc_cobrancas").insert(payload).select("id").single();

  if (result.error) {
    redirectWithError(returnTo, result.error.message);
  }

  const chargeId = id || String(result.data?.id ?? "");
  await recordPortalAudit(context, id ? "editar_cobranca" : "criar_cobranca", "assoc_cobrancas", chargeId, { valor_total: payload.valor_total });
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Mensalidade salva com sucesso.");
}

export async function baixarPortalCobranca(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/financeiro";
  const current = await context.client
    .from("assoc_cobrancas")
    .select("id,status")
    .eq("id", id)
    .eq("empresa_id", context.empresaId)
    .maybeSingle();
  if (current.error || !current.data?.id) {
    redirectWithError(returnTo, current.error?.message ?? "Cobrança não encontrada.");
  }
  if (String(current.data.status) === "cancelada") {
    redirectWithError(returnTo, "Não é possível baixar cobrança cancelada sem reabrir.");
  }
  const paidAt = new Date().toISOString();
  const valorPago = nullableNumberValue(formData, "valor_pago");
  const { error } = await context.client
    .from("assoc_cobrancas")
    .update({
      status: "paga",
      forma_pagamento: textValue(formData, "forma_pagamento") || "manual",
      data_pagamento: paidAt,
      valor_pago: valorPago,
      baixado_por: context.current.usuario.id,
      comprovante_url: nullableTextValue(formData, "comprovante_url"),
      atualizado_em: new Date().toISOString()
    })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "baixar_cobranca", "assoc_cobrancas", id, {
    forma_pagamento: textValue(formData, "forma_pagamento") || "manual",
    data_pagamento: paidAt,
    valor_pago: valorPago
  });
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Pagamento baixado manualmente.");
}

export async function approvePortalComprovante(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/financeiro";
  const cobrancaId = textValue(formData, "cobranca_id");
  if (context.perfil !== "administrador" && context.perfil !== "tesoureiro") {
    redirectWithError(returnTo, "Apenas administrador ou tesoureiro pode aprovar comprovantes.");
  }
  const comprovante = await context.client.from("assoc_comprovantes_pagamento")
    .select("id,comprovante_url,data_pagamento_informada")
    .eq("empresa_id", context.empresaId)
    .eq("cobranca_id", cobrancaId)
    .eq("status", "enviado")
    .order("enviado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (comprovante.error || !comprovante.data?.id) {
    redirectWithError(returnTo, comprovante.error?.message ?? "Comprovante pendente não encontrado.");
  }

  const paidAt = dateValue(formData, "data_pagamento") || comprovante.data.data_pagamento_informada || new Date().toISOString();
  const analyzedAt = new Date().toISOString();
  const charge = await context.client.from("assoc_cobrancas").update({
    status: "paga",
    forma_pagamento: "pix_manual",
    data_pagamento: paidAt,
    comprovante_url: comprovante.data.comprovante_url,
    comprovante_aprovado_url: comprovante.data.comprovante_url,
    comprovante_pendente_url: null,
    motivo_recusa: null,
    aprovado_por: context.current.usuario.id,
    aprovado_em: analyzedAt,
    atualizado_em: analyzedAt
  }).eq("id", cobrancaId).eq("empresa_id", context.empresaId).eq("status", "aguardando_aprovacao");
  if (charge.error) redirectWithError(returnTo, charge.error.message);

  const proof = await context.client.from("assoc_comprovantes_pagamento").update({
    status: "aprovado",
    motivo_recusa: null,
    analisado_por: context.current.usuario.id,
    analisado_em: analyzedAt,
    atualizado_em: analyzedAt
  }).eq("id", comprovante.data.id).eq("empresa_id", context.empresaId).eq("status", "enviado");
  if (proof.error) redirectWithError(returnTo, proof.error.message);
  await recordPortalAudit(context, "aprovar_comprovante", "assoc_cobrancas", cobrancaId, { comprovante_id: comprovante.data.id, data_pagamento: paidAt });
  revalidatePortal(returnTo);
  revalidatePath("/portal-associativo/painel-associado");
  redirectWithOk(returnTo, "Pagamento aprovado. O recibo já está disponível.");
}

export async function rejectPortalComprovante(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/financeiro";
  const cobrancaId = textValue(formData, "cobranca_id");
  const motivo = textValue(formData, "motivo_recusa");
  if (context.perfil !== "administrador" && context.perfil !== "tesoureiro") {
    redirectWithError(returnTo, "Apenas administrador ou tesoureiro pode recusar comprovantes.");
  }
  if (!motivo) redirectWithError(returnTo, "Informe o motivo da recusa.");
  const comprovante = await context.client.from("assoc_comprovantes_pagamento").select("id")
    .eq("empresa_id", context.empresaId).eq("cobranca_id", cobrancaId).eq("status", "enviado")
    .order("enviado_em", { ascending: false }).limit(1).maybeSingle();
  if (comprovante.error || !comprovante.data?.id) redirectWithError(returnTo, comprovante.error?.message ?? "Comprovante pendente não encontrado.");

  const charge = await context.client.from("assoc_cobrancas").select("data_vencimento")
    .eq("id", cobrancaId).eq("empresa_id", context.empresaId).maybeSingle();
  if (charge.error || !charge.data?.data_vencimento) redirectWithError(returnTo, charge.error?.message ?? "Cobrança não encontrada.");
  const nextStatus = new Date(`${charge.data.data_vencimento}T23:59:59`) < new Date() ? "vencida" : "aberta";
  const analyzedAt = new Date().toISOString();
  const updateCharge = await context.client.from("assoc_cobrancas").update({
    status: nextStatus,
    motivo_recusa: motivo,
    comprovante_pendente_url: null,
    recusado_por: context.current.usuario.id,
    recusado_em: analyzedAt,
    atualizado_em: analyzedAt
  }).eq("id", cobrancaId).eq("empresa_id", context.empresaId).eq("status", "aguardando_aprovacao");
  if (updateCharge.error) redirectWithError(returnTo, updateCharge.error.message);
  const proof = await context.client.from("assoc_comprovantes_pagamento").update({
    status: "recusado", motivo_recusa: motivo, analisado_por: context.current.usuario.id, analisado_em: analyzedAt, atualizado_em: analyzedAt
  }).eq("id", comprovante.data.id).eq("empresa_id", context.empresaId).eq("status", "enviado");
  if (proof.error) redirectWithError(returnTo, proof.error.message);
  await recordPortalAudit(context, "recusar_comprovante", "assoc_cobrancas", cobrancaId, { comprovante_id: comprovante.data.id, motivo });
  revalidatePortal(returnTo);
  revalidatePath("/portal-associativo/painel-associado");
  redirectWithOk(returnTo, "Comprovante recusado e cobrança reaberta.");
}

export async function cancelPortalCobranca(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/financeiro";
  const motivo = textValue(formData, "motivo_cancelamento");
  if (!motivo) {
    redirectWithError(returnTo, "Informe o motivo do cancelamento.");
  }

  const current = await context.client
    .from("assoc_cobrancas")
    .select("id,status")
    .eq("id", id)
    .eq("empresa_id", context.empresaId)
    .maybeSingle();

  if (current.error || !current.data?.id) {
    redirectWithError(returnTo, current.error?.message ?? "Cobranca nao encontrada.");
  }

  if (String(current.data.status) === "paga" && textValue(formData, "confirmar_cancelamento_pago") !== "CANCELAR PAGA") {
    redirectWithError(returnTo, "Para cancelar uma cobranca paga, digite CANCELAR PAGA no campo de confirmacao.");
  }

  const canceledAt = new Date().toISOString();
  const { error } = await context.client
    .from("assoc_cobrancas")
    .update({
      status: "cancelada",
      motivo_cancelamento: motivo,
      cancelado_por: context.current.usuario.id,
      cancelado_em: canceledAt,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "cancelar_cobranca", "assoc_cobrancas", id, {
    motivo,
    status_anterior: current.data.status,
    cancelado_em: canceledAt
  });
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Mensalidade cancelada.");
}

export async function reopenPortalCobranca(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/financeiro";
  if (context.perfil !== "administrador" && context.perfil !== "tesoureiro") {
    redirectWithError(returnTo, "Apenas administrador ou tesoureiro pode reabrir cobrança.");
  }
  const { error } = await context.client
    .from("assoc_cobrancas")
    .update({
      status: "aberta",
      motivo_cancelamento: null,
      cancelado_por: null,
      cancelado_em: null,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", id)
    .eq("empresa_id", context.empresaId)
    .eq("status", "cancelada");

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "reabrir_cobranca", "assoc_cobrancas", id);
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Cobrança reaberta.");
}

export async function gerarPortalMensalidadesLote(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const returnTo = "/portal-associativo/financeiro";
  const empresaId = requireEmpresaId(context.empresaId, returnTo);
  const loteamentoId = nullableTextValue(formData, "loteamento_id");
  const valorInformado = numberValue(formData, "valor_original");
  const vencimentoInformado = nullableDayValue(formData, "vencimento_dia");
  const descricaoInformada = textValue(formData, "descricao");
  const mesInicial = textValue(formData, "mes_inicial");

  if (!mesInicial) {
    redirectWithError(returnTo, "Informe o mes inicial.");
  }

  if (textValue(formData, "confirmar_previa") !== "true") {
    redirectWithError(returnTo, "Confira a previa antes de gerar mensalidades em lote.");
  }

  if (loteamentoId) {
    await assertRecordBelongsToEmpresa(context, "assoc_loteamentos", loteamentoId, returnTo, "Loteamento invalido para esta empresa.");
  }

  const [year, month] = mesInicial.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    redirectWithError(returnTo, "Informe um mes inicial valido.");
  }

  const untilDecember = formData.get("ate_dezembro") === "true";
  const months = [];
  for (let monthIndex = month; monthIndex <= (untilDecember ? 12 : month); monthIndex += 1) {
    months.push({ year, month: monthIndex });
  }

  let unitsQuery = context.client
    .from("assoc_unidades")
    .select("id,loteamento_id,valor_mensalidade,vencimento_dia,isento_mensalidade,assoc_loteamentos(valor_mensalidade_padrao,vencimento_padrao,descricao_mensalidade_padrao)")
    .eq("empresa_id", empresaId)
    .eq("status_unidade", "ativa");
  if (loteamentoId) {
    unitsQuery = unitsQuery.eq("loteamento_id", loteamentoId);
  }

  const [unitsResult, linksResult, existingResult] = await Promise.all([
    unitsQuery,
    context.client
      .from("assoc_vinculos_unidade_pessoa")
      .select("unidade_id,pessoa_id")
      .eq("empresa_id", empresaId)
      .eq("tipo_vinculo", "responsavel_financeiro")
      .eq("status_vinculo", "ativo")
      .is("data_fim", null),
    context.client
      .from("assoc_cobrancas")
      .select("unidade_id,mes_referencia,ano_referencia")
      .eq("empresa_id", empresaId)
      .eq("tipo_cobranca", "mensalidade")
      .in("ano_referencia", [year])
  ]);

  if (unitsResult.error || linksResult.error || existingResult.error) {
    redirectWithError(returnTo, unitsResult.error?.message ?? linksResult.error?.message ?? existingResult.error?.message ?? "Nao foi possivel gerar mensalidades.");
  }

  const responsaveis = new Map((linksResult.data ?? []).map((row: Record<string, unknown>) => [String(row.unidade_id), row.pessoa_id]));
  const existing = new Set((existingResult.data ?? []).map((row: Record<string, unknown>) => `${row.unidade_id}-${row.ano_referencia}-${row.mes_referencia}`));
  const configResult = await context.client.from("assoc_configuracoes").select("valor_mensalidade_padrao,vencimento_padrao,descricao_mensalidade_padrao").eq("empresa_id", empresaId).maybeSingle();
  const config = (configResult.data ?? {}) as Record<string, unknown>;
  const rows = [];
  let semValor = 0;
  let isentas = 0;
  let semResponsavel = 0;

  for (const unit of unitsResult.data ?? []) {
    const unitRecord = unit as Record<string, unknown>;
    if (unitRecord.isento_mensalidade === true) {
      isentas += 1;
      continue;
    }

    const responsavelId = responsaveis.get(String(unit.id));
    if (!responsavelId) {
      semResponsavel += 1;
      continue;
    }

    const loteamento = relationObject(unitRecord.assoc_loteamentos);
    const valor = firstPositiveMoney(unitRecord.valor_mensalidade, valorInformado, loteamento?.valor_mensalidade_padrao, config.valor_mensalidade_padrao);
    if (valor <= 0) {
      semValor += 1;
      continue;
    }

    const vencimentoDia = clampDay(firstPositiveInteger(unitRecord.vencimento_dia, vencimentoInformado, loteamento?.vencimento_padrao, config.vencimento_padrao, 10));
    const descricao =
      descricaoInformada ||
      String(loteamento?.descricao_mensalidade_padrao ?? config.descricao_mensalidade_padrao ?? "Mensalidade");

    for (const item of months) {
      const key = `${unit.id}-${item.year}-${item.month}`;
      if (existing.has(key)) continue;
      rows.push({
        empresa_id: empresaId,
        loteamento_id: nullableRecordId(unitRecord.loteamento_id),
        unidade_id: unit.id,
        pessoa_responsavel_id: responsavelId,
        tipo_cobranca: "mensalidade",
        descricao,
        mes_referencia: item.month,
        ano_referencia: item.year,
        data_vencimento: buildDueDate(item.year, item.month, vencimentoDia),
        valor_original: valor,
        valor_total: valor,
        status: "aberta",
        pix_gateway: "manual"
      });
    }
  }

  if (rows.length === 0) {
    redirectWithOk(returnTo, buildMensalidadeMessage(0, semValor, isentas, semResponsavel));
  }

  const { error } = await context.client.from("assoc_cobrancas").insert(rows);
  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "gerar_mensalidades_lote", "assoc_cobrancas", null, { quantidade: rows.length, loteamento_id: loteamentoId, sem_responsavel: semResponsavel });
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, buildMensalidadeMessage(rows.length, semValor, isentas, semResponsavel));
}

export async function savePortalReuniao(formData: FormData) {
  const context = await requirePortalWrite("reunioes", "/portal-associativo/reunioes");
  const id = textValue(formData, "id");
  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, "/portal-associativo/reunioes"),
    titulo: textValue(formData, "titulo"),
    data_reuniao: textValue(formData, "data_reuniao"),
    local: nullableTextValue(formData, "local"),
    pauta: nullableTextValue(formData, "pauta"),
    status: textValue(formData, "status") || "agendada",
    descricao: nullableTextValue(formData, "descricao"),
    ata: nullableTextValue(formData, "ata"),
    ata_url: nullableTextValue(formData, "ata_url"),
    decisoes: nullableTextValue(formData, "decisoes"),
    liberado_associado: formData.get("liberado_associado") === "true"
  };
  if (!payload.titulo || !payload.data_reuniao) redirectWithError("/portal-associativo/reunioes", "Informe titulo e data.");
  await saveGeneric(context, "assoc_reunioes", id, payload, "/portal-associativo/reunioes", "reuniao");
}

export async function savePortalAviso(formData: FormData) {
  const context = await requirePortalWrite("avisos", "/portal-associativo/avisos");
  const id = textValue(formData, "id");
  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, "/portal-associativo/avisos"),
    titulo: textValue(formData, "titulo"),
    mensagem: textValue(formData, "mensagem"),
    prioridade: textValue(formData, "prioridade") || "media",
    publico: textValue(formData, "publico") || "todos",
    perfis: splitCsv(textValue(formData, "perfis")),
    status_cobranca: nullableTextValue(formData, "status_cobranca"),
    unidade_id: nullableTextValue(formData, "unidade_id"),
    link_portal: nullableTextValue(formData, "link_portal"),
    visivel_de: dateValue(formData, "visivel_de") ?? new Date().toISOString().slice(0, 10),
    visivel_ate: dateValue(formData, "visivel_ate"),
    status: textValue(formData, "status") || "ativo",
    mostrar_painel: formData.get("mostrar_painel") === "true"
  };
  if (!payload.titulo || !payload.mensagem) redirectWithError("/portal-associativo/avisos", "Informe titulo e mensagem.");
  await saveGeneric(context, "assoc_avisos", id, payload, "/portal-associativo/avisos", "aviso");
}

export async function savePortalProjeto(formData: FormData) {
  const context = await requirePortalWrite("projetos", "/portal-associativo/projetos");
  const id = textValue(formData, "id");
  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, "/portal-associativo/projetos"),
    nome: textValue(formData, "nome"),
    descricao: nullableTextValue(formData, "descricao"),
    status: textValue(formData, "status") || "planejado",
    valor_previsto: numberValue(formData, "valor_previsto"),
    valor_arrecadado: numberValue(formData, "valor_arrecadado"),
    data_inicio: dateValue(formData, "data_inicio"),
    data_fim: dateValue(formData, "data_fim"),
    liberado_associado: formData.get("liberado_associado") === "true",
    relatorio_url: nullableTextValue(formData, "relatorio_url")
  };
  if (!payload.nome) redirectWithError("/portal-associativo/projetos", "Informe o nome do projeto.");
  await saveGeneric(context, "assoc_projetos", id, payload, "/portal-associativo/projetos", "projeto");
}

export async function savePortalConfiguracoes(formData: FormData) {
  const context = await requirePortalWrite("configuracoes", "/portal-associativo/configuracoes");
  const empresaId = requireEmpresaId(context.empresaId, "/portal-associativo/configuracoes");
  const { error } = await context.client.from("assoc_configuracoes").upsert(
    {
      empresa_id: empresaId,
      nome_publico_entidade: textValue(formData, "nome_publico_entidade") || "Portal Associativo",
      subtitulo: textValue(formData, "subtitulo") || "Gestao integrada de loteamentos, chacaras/lotes, mensalidades e comunicados.",
      logo_url: nullableTextValue(formData, "logo_url"),
      tema_visual: textValue(formData, "tema_visual") || "padrao",
      tipo_unidade_padrao: textValue(formData, "tipo_unidade_padrao") || "propriedade",
      cidade: nullableTextValue(formData, "cidade"),
      uf: nullableTextValue(formData, "uf"),
      responsavel_nome: nullableTextValue(formData, "responsavel_nome"),
      valor_mensalidade_padrao: numberValue(formData, "valor_mensalidade_padrao"),
      vencimento_padrao: Number(textValue(formData, "vencimento_padrao") || 10),
      descricao_mensalidade_padrao: textValue(formData, "descricao_mensalidade_padrao") || "Mensalidade",
      pix_chave: nullableTextValue(formData, "pix_chave"),
      pix_tipo_chave: nullableTextValue(formData, "pix_tipo_chave"),
      recebedor_nome: nullableTextValue(formData, "recebedor_nome"),
      recebedor_cidade: nullableTextValue(formData, "recebedor_cidade"),
      instrucoes_pagamento: nullableTextValue(formData, "instrucoes_pagamento"),
      instrucoes_pagamento_pix: nullableTextValue(formData, "instrucoes_pagamento"),
      qr_code_pix_url: nullableTextValue(formData, "qr_code_pix_url"),
      usar_pix_manual: formData.get("usar_pix_manual") === "true",
      webhook_url: nullableTextValue(formData, "webhook_url"),
      storage_provider_ativo: textValue(formData, "storage_provider_ativo") || "nenhum",
      assinatura_entidade: nullableTextValue(formData, "assinatura_entidade"),
      implantacao_concluida: formData.get("implantacao_concluida") === "true",
      atualizado_em: new Date().toISOString()
    },
    { onConflict: "empresa_id" }
  );
  if (error) redirectWithError("/portal-associativo/configuracoes", error.message);
  await recordPortalAudit(context, "atualizar_configuracoes", "assoc_configuracoes", null);
  revalidatePortal("/portal-associativo/configuracoes");
  redirectWithOk("/portal-associativo/configuracoes", "Configuracoes salvas.");
}

export async function savePortalConfiguracoesPagamento(formData: FormData) {
  const context = await requirePortalWrite("configuracoes", "/portal-associativo/configuracoes");
  const empresaId = requireEmpresaId(context.empresaId, "/portal-associativo/configuracoes");
  const { error } = await context.client.from("assoc_configuracoes_pagamento").upsert(
    {
      empresa_id: empresaId,
      provedor_pix_ativo: textValue(formData, "provedor_pix_ativo") || "manual",
      ambiente: textValue(formData, "ambiente") || "homologacao",
      chave_pix: nullableTextValue(formData, "chave_pix"),
      nome_recebedor: nullableTextValue(formData, "nome_recebedor"),
      cidade_recebedor: nullableTextValue(formData, "cidade_recebedor"),
      webhook_url: nullableTextValue(formData, "webhook_url"),
      modo_cobranca_padrao: textValue(formData, "modo_cobranca_padrao") || "manual",
      gerar_pix_automatico: formData.get("gerar_pix_automatico") === "true",
      descricao_padrao: nullableTextValue(formData, "descricao_padrao"),
      pix_preparado_automatico: formData.get("pix_preparado_automatico") === "true",
      atualizado_por: context.current.usuario.id,
      atualizado_em: new Date().toISOString()
    },
    { onConflict: "empresa_id" }
  );
  if (error) redirectWithError("/portal-associativo/configuracoes", error.message);
  await recordPortalAudit(context, "atualizar_configuracoes_pagamento", "assoc_configuracoes_pagamento", null);
  revalidatePortal("/portal-associativo/configuracoes");
  redirectWithOk("/portal-associativo/configuracoes", "Configuracoes de pagamento salvas.");
}

export async function savePortalArquivoManual(formData: FormData) {
  const context = await requirePortalWrite("documentos", "/portal-associativo/documentos");
  const empresaId = requireEmpresaId(context.empresaId, "/portal-associativo/documentos");
  const sharedUrl = textValue(formData, "shared_url");
  const fileName = textValue(formData, "file_name");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/documentos";
  if (!sharedUrl || !fileName) {
    redirectWithError(returnTo, "Informe o nome e o link do documento.");
  }

  const links = {
    pessoa_id: nullableTextValue(formData, "pessoa_id"),
    unidade_id: nullableTextValue(formData, "unidade_id"),
    cobranca_id: nullableTextValue(formData, "cobranca_id"),
    reuniao_id: nullableTextValue(formData, "reuniao_id"),
    projeto_id: nullableTextValue(formData, "projeto_id"),
    transferencia_id: nullableTextValue(formData, "transferencia_id")
  };
  await assertRecordBelongsToEmpresa(context, "assoc_pessoas", links.pessoa_id ?? "", returnTo, "Pessoa inválida para esta empresa.");
  await assertRecordBelongsToEmpresa(context, "assoc_unidades", links.unidade_id ?? "", returnTo, "Unidade inválida para esta empresa.");
  await assertRecordBelongsToEmpresa(context, "assoc_cobrancas", links.cobranca_id ?? "", returnTo, "Cobrança inválida para esta empresa.");
  await assertRecordBelongsToEmpresa(context, "assoc_reunioes", links.reuniao_id ?? "", returnTo, "Reunião inválida para esta empresa.");
  await assertRecordBelongsToEmpresa(context, "assoc_projetos", links.projeto_id ?? "", returnTo, "Projeto inválido para esta empresa.");
  await assertRecordBelongsToEmpresa(context, "assoc_transferencias", links.transferencia_id ?? "", returnTo, "Transferência inválida para esta empresa.");

  const liberado = formData.get("liberado_associado") === "true";
  const result = await context.client.from("assoc_arquivos").insert({
    empresa_id: empresaId,
    ...links,
    provedor: "manual",
    file_name: fileName,
    mime_type: nullableTextValue(formData, "mime_type") || "text/uri-list",
    size: null,
    path: sharedUrl,
    shared_url: sharedUrl,
    visibility: liberado ? "liberado_associado" : "interno",
    liberado_associado: liberado,
    categoria: textValue(formData, "categoria") || "outro",
    descricao: nullableTextValue(formData, "descricao"),
    criado_por: context.current.usuario.id,
    atualizado_por: context.current.usuario.id
  }).select("id").single();

  if (result.error) redirectWithError(returnTo, result.error.message);
  await recordPortalAudit(context, "enviar_documento", "assoc_arquivos", String(result.data?.id ?? ""), { provedor: "manual", fileName });
  revalidatePortal(returnTo);
  revalidatePath("/portal-associativo/painel-associado");
  redirectWithOk(returnTo, "Documento manual cadastrado.");
}

export async function importPortalCsv(formData: FormData) {
  const context = await requirePortalWrite("importacao", "/portal-associativo/importacao");
  const empresaId = requireEmpresaId(context.empresaId, "/portal-associativo/importacao");
  const tipo = textValue(formData, "tipo");
  const file = formData.get("arquivo");
  const returnTo = "/portal-associativo/importacao";
  if (!["pessoas", "unidades", "cobrancas"].includes(tipo)) {
    redirectWithError(returnTo, "Selecione o tipo de importação.");
  }
  if (!(file instanceof File) || file.size === 0) {
    redirectWithError(returnTo, "Selecione um arquivo CSV.");
  }
  if (file.size > 5 * 1024 * 1024) {
    redirectWithError(returnTo, "Arquivo acima do limite de 5 MB.");
  }

  const parsed = parsePortalCsv(await file.text());
  if (parsed.rows.length === 0) {
    redirectWithError(returnTo, "CSV sem linhas para importar.");
  }

  const errors: Array<{ linha: number; campo?: string; mensagem: string; dados_linha: Record<string, string> }> = [];
  const payloads: Array<Record<string, unknown>> = [];

  if (tipo === "pessoas") {
    const existing = await context.client.from("assoc_pessoas").select("cpf_cnpj,email,whatsapp").eq("empresa_id", empresaId).limit(5000);
    const cpfSet = new Set(((existing.data ?? []) as Array<Record<string, unknown>>).map((row) => clean(row.cpf_cnpj)).filter(Boolean));
    const emailSet = new Set(((existing.data ?? []) as Array<Record<string, unknown>>).map((row) => String(row.email ?? "").toLowerCase()).filter(Boolean));
    const whatsappSet = new Set(((existing.data ?? []) as Array<Record<string, unknown>>).map((row) => clean(row.whatsapp)).filter(Boolean));

    parsed.rows.forEach((row, index) => {
      const line = index + 2;
      const nome = row.nome_completo || row.nome;
      const cpf = clean(row.cpf_cnpj || row.cpf || row.cnpj);
      const email = String(row.email ?? "").trim().toLowerCase();
      const whatsapp = normalizePhone(row.whatsapp);
      if (!nome) errors.push({ linha: line, campo: "nome_completo", mensagem: "Nome obrigatório.", dados_linha: row });
      if (cpf && cpfSet.has(cpf)) errors.push({ linha: line, campo: "cpf_cnpj", mensagem: "CPF/CNPJ duplicado.", dados_linha: row });
      if (email && emailSet.has(email)) errors.push({ linha: line, campo: "email", mensagem: "E-mail duplicado.", dados_linha: row });
      if (whatsapp && whatsappSet.has(whatsapp)) errors.push({ linha: line, campo: "whatsapp", mensagem: "WhatsApp duplicado.", dados_linha: row });
      if (nome) {
        payloads.push({
          empresa_id: empresaId,
          nome_completo: nome,
          cpf_cnpj: cpf || null,
          telefone: normalizePhone(row.telefone),
          whatsapp,
          email: email || null,
          endereco: row.endereco || null,
          endereco_residencial: row.endereco || null,
          cidade: row.cidade || null,
          uf: row.uf || null,
          status_pessoa: row.status || "ativa",
          observacoes: row.observacoes || null
        });
      }
    });
  }

  if (tipo === "unidades") {
    const existing = await context.client.from("assoc_unidades").select("codigo_unidade,numero_unidade,loteamento_id").eq("empresa_id", empresaId).limit(5000);
    const unitSet = new Set(((existing.data ?? []) as Array<Record<string, unknown>>).map((row) => `${row.loteamento_id ?? ""}|${row.codigo_unidade}|${row.numero_unidade}`));

    parsed.rows.forEach((row, index) => {
      const line = index + 2;
      const codigo = row.codigo_unidade || row.codigo;
      const numero = row.numero_unidade || row.numero;
      const key = `|${codigo}|${numero}`;
      if (!codigo) errors.push({ linha: line, campo: "codigo_unidade", mensagem: "Código obrigatório.", dados_linha: row });
      if (!numero) errors.push({ linha: line, campo: "numero_unidade", mensagem: "Número obrigatório.", dados_linha: row });
      if (codigo && numero && unitSet.has(key)) errors.push({ linha: line, campo: "codigo_unidade", mensagem: "Unidade duplicada.", dados_linha: row });
      if (codigo && numero) {
        payloads.push({
          empresa_id: empresaId,
          codigo_unidade: codigo,
          numero_unidade: numero,
          quadra_setor: row.quadra_setor || row.quadra || row.setor || null,
          tipo_unidade: row.tipo || row.tipo_unidade || "propriedade",
          area_m2: parseOptionalNumber(row.area || row.area_m2),
          endereco_localizacao: row.localizacao || row.endereco || null,
          status_unidade: row.status || "ativa",
          observacoes: row.observacoes || null
        });
      }
    });
  }

  if (tipo === "cobrancas") {
    const [units, people] = await Promise.all([
      context.client.from("assoc_unidades").select("id,loteamento_id,codigo_unidade,numero_unidade").eq("empresa_id", empresaId).limit(5000),
      context.client.from("assoc_pessoas").select("id,nome_completo").eq("empresa_id", empresaId).limit(5000)
    ]);
    const unitByKey = new Map(((units.data ?? []) as Array<Record<string, unknown>>).map((row) => [`${row.codigo_unidade}|${row.numero_unidade}`, row]));
    const personByName = new Map(((people.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.nome_completo ?? "").trim().toLowerCase(), row.id]));

    parsed.rows.forEach((row, index) => {
      const line = index + 2;
      const codigo = row.codigo_unidade || row.codigo || row.unidade_codigo;
      const numero = row.numero_unidade || row.numero || row.unidade_numero;
      const unidade = unitByKey.get(`${codigo}|${numero}`);
      const valor = parseOptionalNumber(row.valor || row.valor_original);
      const vencimento = row.vencimento || row.data_vencimento;
      if (!unidade) errors.push({ linha: line, campo: "unidade", mensagem: "Unidade não encontrada pelo código/número.", dados_linha: row });
      if (!vencimento) errors.push({ linha: line, campo: "data_vencimento", mensagem: "Vencimento obrigatório.", dados_linha: row });
      if (!valor || valor <= 0) errors.push({ linha: line, campo: "valor", mensagem: "Valor inválido.", dados_linha: row });
      if (unidade && vencimento && valor && valor > 0) {
        const dueDate = new Date(vencimento);
        payloads.push({
          empresa_id: empresaId,
          loteamento_id: unidade.loteamento_id ?? null,
          unidade_id: unidade.id,
          pessoa_responsavel_id: row.responsavel ? personByName.get(String(row.responsavel).trim().toLowerCase()) ?? null : null,
          tipo_cobranca: row.tipo || "mensalidade",
          descricao: row.descricao || "Mensalidade",
          mes_referencia: Number(row.mes || row.mes_referencia || dueDate.getMonth() + 1),
          ano_referencia: Number(row.ano || row.ano_referencia || dueDate.getFullYear()),
          data_vencimento: vencimento,
          valor_original: valor,
          valor_total: valor,
          status: row.status || "aberta",
          pix_gateway: "manual"
        });
      }
    });
  }

  const importacao = await context.client.from("assoc_importacoes").insert({
    empresa_id: empresaId,
    tipo,
    status: errors.length ? "erro" : "processada",
    total_linhas: parsed.rows.length,
    linhas_importadas: errors.length ? 0 : payloads.length,
    erros: errors,
    criado_por: context.current.usuario.id
  }).select("id").single();

  if (importacao.error) redirectWithError(returnTo, importacao.error.message);
  if (errors.length) {
    await context.client.from("assoc_importacao_erros").insert(errors.slice(0, 300).map((error) => ({
      empresa_id: empresaId,
      importacao_id: importacao.data.id,
      linha: error.linha,
      campo: error.campo ?? null,
      mensagem: error.mensagem,
      dados_linha: error.dados_linha
    })));
    redirectWithError(returnTo, `Importação validada com ${errors.length} erro(s). Nenhuma linha foi salva.`);
  }

  const table = tipo === "pessoas" ? "assoc_pessoas" : tipo === "unidades" ? "assoc_unidades" : "assoc_cobrancas";
  const result = payloads.length ? await context.client.from(table).insert(payloads) : { error: null };
  if (result.error) redirectWithError(returnTo, result.error.message);
  await recordPortalAudit(context, "importar_dados", table, String(importacao.data.id), { tipo, linhas: payloads.length });
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, `${payloads.length} linha(s) importada(s).`);
}

export async function togglePortalArquivoLiberado(formData: FormData) {
  const context = await requirePortalWrite("documentos", "/portal-associativo/documentos");
  const id = textValue(formData, "id");
  const liberado = formData.get("liberado_associado") === "true";
  const { error } = await context.client
    .from("assoc_arquivos")
    .update({
      liberado_associado: liberado,
      visibility: liberado ? "liberado_associado" : "interno",
      atualizado_por: context.current.usuario.id,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError("/portal-associativo/documentos", error.message);
  await recordPortalAudit(context, liberado ? "liberar_documento" : "bloquear_documento", "assoc_arquivos", id, { liberado });
  revalidatePortal("/portal-associativo/documentos");
  revalidatePath("/portal-associativo/painel-associado");
  redirectWithOk("/portal-associativo/documentos", liberado ? "Documento liberado ao associado." : "Documento marcado como interno.");
}

export async function deletePortalArquivo(formData: FormData) {
  const context = await requirePortalWrite("documentos", "/portal-associativo/documentos");
  const id = textValue(formData, "id");
  const confirmacao = textValue(formData, "confirmacao");
  if (confirmacao !== "EXCLUIR") {
    redirectWithError("/portal-associativo/documentos", "Digite EXCLUIR para confirmar a exclusao do arquivo.");
  }

  const current = await context.client
    .from("assoc_arquivos")
    .select("id,provedor,file_id,path,file_name")
    .eq("id", id)
    .eq("empresa_id", context.empresaId)
    .maybeSingle();
  if (current.error || !current.data?.id) {
    redirectWithError("/portal-associativo/documentos", current.error?.message ?? "Arquivo nao encontrado.");
  }

  const provider = String(current.data.provedor ?? "");
  if (isPortalStorageProvider(provider)) {
    try {
      await deleteFromPortalStorage({
        current: context.current,
        provider,
        path: String(current.data.path ?? ""),
        fileId: String(current.data.file_id ?? "")
      });
    } catch (error) {
      redirectWithError("/portal-associativo/documentos", error instanceof Error ? error.message : "Erro ao excluir no armazenamento.");
    }
  }

  const { error } = await context.client.from("assoc_arquivos").delete().eq("id", id).eq("empresa_id", context.empresaId);
  if (error) redirectWithError("/portal-associativo/documentos", error.message);
  await recordPortalAudit(context, "excluir_documento", "assoc_arquivos", id, { nome: current.data.file_name, provedor: provider });
  revalidatePortal("/portal-associativo/documentos");
  revalidatePath("/portal-associativo/painel-associado");
  redirectWithOk("/portal-associativo/documentos", "Arquivo excluido.");
}

async function saveGeneric(context: Awaited<ReturnType<typeof getPortalContext>>, table: string, id: string, payload: Record<string, unknown>, returnTo: string, label: string) {
  const result = id
    ? await context.client.from(table).update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", id).eq("empresa_id", context.empresaId)
    : await context.client.from(table).insert(payload).select("id").single();

  if (result.error) redirectWithError(returnTo, result.error.message);
  await recordPortalAudit(context, id ? `editar_${label}` : `criar_${label}`, table, id || String(result.data?.id ?? ""));
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, `${capitalize(label)} salvo com sucesso.`);
}

async function requirePortalWrite(section: string, nextPath: string) {
  const context = await getPortalContext(nextPath);
  if (!canPortalAccess(context.perfil, section) || context.perfil === "associado" || context.perfil === "portaria" || context.perfil === "conselho_fiscal") {
    redirectWithError(PORTAL_ASSOCIATIVO_PATH, "Seu perfil nao permite alterar estes dados.");
  }
  return context;
}

function requireEmpresaId(empresaId: string | null, returnTo: string) {
  if (!empresaId) {
    redirectWithError(returnTo, "Selecione uma empresa antes de gravar dados do Portal Associativo.");
  }
  return empresaId;
}

async function assertRecordBelongsToEmpresa(
  context: Awaited<ReturnType<typeof getPortalContext>>,
  table: string,
  id: string,
  returnTo: string,
  message: string
) {
  if (!context.empresaId || !id) return;
  const { data, error } = await context.client.from(table).select("id").eq("id", id).eq("empresa_id", context.empresaId).maybeSingle();
  if (error || !data) {
    redirectWithError(returnTo, error?.message ?? message);
  }
}

async function assertNoDuplicatePessoa(
  client: any,
  empresaId: string | null,
  currentId: string,
  values: { cpf_cnpj: string | null; email: string | null; telefone: string | null; whatsapp: string | null }
) {
  if (!empresaId) return;
  const { data, error } = await client
    .from("assoc_pessoas")
    .select("id,nome_completo,cpf_cnpj,email,telefone,whatsapp")
    .eq("empresa_id", empresaId)
    .limit(500);

  if (error) {
    redirectWithError("/portal-associativo/pessoas", error.message);
  }

  const incoming = {
    cpf_cnpj: clean(values.cpf_cnpj),
    email: String(values.email ?? "").trim().toLowerCase(),
    telefone: clean(values.telefone),
    whatsapp: clean(values.whatsapp)
  };

  const duplicate = ((data ?? []) as Array<Record<string, unknown>>).find((row) => {
    if (String(row.id) === currentId) return false;
    return (
      (incoming.cpf_cnpj && incoming.cpf_cnpj === clean(row.cpf_cnpj)) ||
      (incoming.email && incoming.email === String(row.email ?? "").trim().toLowerCase()) ||
      (incoming.telefone && incoming.telefone === clean(row.telefone)) ||
      (incoming.whatsapp && incoming.whatsapp === clean(row.whatsapp))
    );
  });

  if (duplicate) {
    redirectWithError("/portal-associativo/pessoas", `Cadastro possivelmente duplicado: ${duplicate.nome_completo}.`);
  }
}

async function assertNoDuplicateUnidade(
  client: any,
  empresaId: string,
  currentId: string,
  codigo: string,
  numero: string,
  loteamentoId: string | null,
  returnTo: string
) {
  let query = client
    .from("assoc_unidades")
    .select("id,codigo_unidade,numero_unidade,loteamento_id")
    .eq("empresa_id", empresaId)
    .eq("codigo_unidade", codigo)
    .eq("numero_unidade", numero)
    .limit(10);

  query = loteamentoId ? query.eq("loteamento_id", loteamentoId) : query.is("loteamento_id", null);
  const { data, error } = await query;
  if (error) redirectWithError(returnTo, error.message);
  const duplicate = ((data ?? []) as Array<Record<string, unknown>>).find((row) => String(row.id) !== currentId);
  if (duplicate) {
    redirectWithError(returnTo, "Já existe unidade com este código e número nesta empresa.");
  }
}

async function countByEmpresa(client: any, table: string, empresaId: string | null, filters: Record<string, unknown>) {
  if (!empresaId) return 0;
  let query = client.from(table).select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { count } = await query;
  return count ?? 0;
}

async function upsertActiveVinculo(context: Awaited<ReturnType<typeof getPortalContext>>, unidadeId: string, tipo: string, pessoaId: string) {
  if (!pessoaId || !context.empresaId) return;
  const active = await context.client
    .from("assoc_vinculos_unidade_pessoa")
    .select("id,pessoa_id")
    .eq("empresa_id", context.empresaId)
    .eq("unidade_id", unidadeId)
    .eq("tipo_vinculo", tipo)
    .eq("status_vinculo", "ativo")
    .is("data_fim", null);

  for (const row of active.data ?? []) {
    if (String(row.pessoa_id) === pessoaId) continue;
    await context.client
      .from("assoc_vinculos_unidade_pessoa")
      .update({ status_vinculo: "encerrado", data_fim: new Date().toISOString().slice(0, 10), atualizado_em: new Date().toISOString() })
      .eq("id", row.id)
      .eq("empresa_id", context.empresaId);
  }

  const alreadyActive = (active.data ?? []).some((row: Record<string, unknown>) => String(row.pessoa_id) === pessoaId);
  if (!alreadyActive) {
    await insertVinculo(context, unidadeId, pessoaId, tipo);
  }
}

async function insertVinculo(context: Awaited<ReturnType<typeof getPortalContext>>, unidadeId: string, pessoaId: string, tipo: string) {
  if (!pessoaId || !context.empresaId) return;
  await context.client.from("assoc_vinculos_unidade_pessoa").insert({
    empresa_id: context.empresaId,
    unidade_id: unidadeId,
    pessoa_id: pessoaId,
    tipo_vinculo: tipo,
    data_inicio: new Date().toISOString().slice(0, 10),
    status_vinculo: "ativo"
  });
}

async function resolveResponsavelFinanceiro(context: Awaited<ReturnType<typeof getPortalContext>>, unidadeId: string) {
  if (!context.empresaId) return null;
  const { data } = await context.client
    .from("assoc_vinculos_unidade_pessoa")
    .select("pessoa_id")
    .eq("empresa_id", context.empresaId)
    .eq("unidade_id", unidadeId)
    .eq("tipo_vinculo", "responsavel_financeiro")
    .eq("status_vinculo", "ativo")
    .is("data_fim", null)
    .maybeSingle();
  return data?.pessoa_id ?? null;
}

async function resolvePortalUnidade(context: Awaited<ReturnType<typeof getPortalContext>>, unidadeId: string, returnTo: string) {
  if (!context.empresaId) {
    redirectWithError(returnTo, "Selecione uma empresa antes de gravar dados do Portal Associativo.");
  }
  const { data, error } = await context.client
    .from("assoc_unidades")
    .select("id,loteamento_id,status_unidade")
    .eq("id", unidadeId)
    .eq("empresa_id", context.empresaId)
    .maybeSingle();

  if (error || !data) {
    redirectWithError(returnTo, error?.message ?? "Chacara/lote nao encontrado nesta empresa.");
  }

  return data as Record<string, unknown>;
}

async function recordPortalAudit(
  context: Awaited<ReturnType<typeof getPortalContext>>,
  acao: string,
  entidade: string,
  entidadeId?: string | null,
  dadosNovos?: Record<string, unknown>
) {
  if (!context.empresaId) return;
  await context.client.from("assoc_auditoria_logs").insert({
    empresa_id: context.empresaId,
    usuario_id: context.current.usuario.id,
    acao,
    entidade,
    entidade_id: entidadeId || null,
    dados_novos: dadosNovos ?? null
  });
}

function redirectWithError(path: string, message: string): never {
  redirect(`${safePath(path)}?error=${messageParam(message)}`);
}

function redirectWithOk(path: string, message: string): never {
  redirect(`${safePath(path)}?ok=${messageParam(message)}`);
}

function revalidatePortal(path: string) {
  revalidatePath(PORTAL_ASSOCIATIVO_PATH);
  revalidatePath(path);
}

function safePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : PORTAL_ASSOCIATIVO_PATH;
}

function nullableNumberValue(formData: FormData, key: string) {
  const raw = textValue(formData, key);
  return raw ? numberValue(formData, key) : null;
}

function nullableDayValue(formData: FormData, key: string) {
  const raw = textValue(formData, key);
  if (!raw) return null;
  return clampDay(Number(raw));
}

function clampDay(value: number) {
  if (!Number.isFinite(value)) return 10;
  return Math.max(1, Math.min(31, Math.trunc(value)));
}

function firstPositiveMoney(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value ?? 0);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function firstPositiveInteger(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value ?? 0);
    if (Number.isFinite(number) && number > 0) return Math.trunc(number);
  }
  return 10;
}

function buildDueDate(year: number, month: number, day: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const dueDay = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
}

function buildMensalidadeMessage(geradas: number, semValor: number, isentas: number, semResponsavel = 0) {
  const detalhes = [
    semValor ? `${semValor} chacara(s)/lote(s) sem valor configurado` : "",
    isentas ? `${isentas} isenta(s)` : "",
    semResponsavel ? `${semResponsavel} sem responsavel financeiro` : ""
  ].filter(Boolean);
  const base = geradas > 0 ? `${geradas} mensalidade(s) gerada(s).` : "Nenhuma nova mensalidade para gerar.";
  return detalhes.length ? `${base} ${detalhes.join(". ")}.` : base;
}

function nullableRecordId(value: unknown) {
  const id = String(value ?? "");
  return id || null;
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizePhone(value: string | null) {
  const digits = clean(value);
  return digits || null;
}

function parsePortalCsv(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= 1) return { headers: [] as string[], rows: [] as Array<Record<string, string>> };
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], separator).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line, separator);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = String(values[index] ?? "").trim();
      return row;
    }, {});
  });
  return { headers, rows };
}

function splitCsvLine(line: string, separator: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === separator && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseOptionalNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
