"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dateValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { canPortalAccess, getPortalContext, PORTAL_ASSOCIATIVO_PATH } from "@/lib/portal-associativo-data";

export async function savePortalPessoa(formData: FormData) {
  const context = await requirePortalWrite("pessoas", "/portal-associativo/pessoas");
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome_completo");
  const returnTo = "/portal-associativo/pessoas";

  if (!nome) {
    redirectWithError(returnTo, "Informe o nome da pessoa.");
  }

  await assertNoDuplicatePessoa(context.client, context.empresaId, id, {
    cpf_cnpj: nullableTextValue(formData, "cpf_cnpj"),
    email: nullableTextValue(formData, "email"),
    telefone: nullableTextValue(formData, "telefone"),
    whatsapp: nullableTextValue(formData, "whatsapp")
  });

  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, returnTo),
    core_usuario_id: nullableTextValue(formData, "core_usuario_id"),
    nome_completo: nome,
    tipo_pessoa: textValue(formData, "tipo_pessoa") || "fisica",
    cpf_cnpj: nullableTextValue(formData, "cpf_cnpj"),
    rg_ie: nullableTextValue(formData, "rg_ie"),
    telefone: nullableTextValue(formData, "telefone"),
    whatsapp: nullableTextValue(formData, "whatsapp"),
    email: nullableTextValue(formData, "email")?.toLowerCase() ?? null,
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
  const { error } = await context.client
    .from("assoc_pessoas")
    .update({ status_pessoa: "inativa", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError("/portal-associativo/pessoas", error.message);
  await recordPortalAudit(context, "inativar_pessoa", "assoc_pessoas", id);
  revalidatePortal("/portal-associativo/pessoas");
  redirectWithOk("/portal-associativo/pessoas", "Pessoa inativada.");
}

export async function savePortalUnidade(formData: FormData) {
  const context = await requirePortalWrite("unidades", "/portal-associativo/unidades");
  const id = textValue(formData, "id");
  const codigo = textValue(formData, "codigo_unidade");
  const numero = textValue(formData, "numero_unidade");
  const returnTo = "/portal-associativo/unidades";

  if (!codigo || !numero) {
    redirectWithError(returnTo, "Informe codigo e numero da unidade.");
  }

  const empresaId = requireEmpresaId(context.empresaId, returnTo);
  const payload = {
    empresa_id: empresaId,
    codigo_unidade: codigo,
    numero_unidade: numero,
    quadra_setor: nullableTextValue(formData, "quadra_setor"),
    tipo_unidade: textValue(formData, "tipo_unidade") || "propriedade",
    endereco_localizacao: nullableTextValue(formData, "endereco_localizacao"),
    area_m2: nullableNumberValue(formData, "area_m2"),
    coordenadas_maps: nullableTextValue(formData, "coordenadas_maps"),
    status_unidade: textValue(formData, "status_unidade") || "ativa",
    possui_construcao: formData.get("possui_construcao") === "true",
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
  redirectWithOk(returnTo, "Unidade salva com sucesso.");
}

export async function inactivatePortalUnidade(formData: FormData) {
  const context = await requirePortalWrite("unidades", "/portal-associativo/unidades");
  const id = textValue(formData, "id");
  const { error } = await context.client
    .from("assoc_unidades")
    .update({ status_unidade: "inativa", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError("/portal-associativo/unidades", error.message);
  await recordPortalAudit(context, "inativar_unidade", "assoc_unidades", id);
  revalidatePortal("/portal-associativo/unidades");
  redirectWithOk("/portal-associativo/unidades", "Unidade inativada.");
}

export async function savePortalTransferencia(formData: FormData) {
  const context = await requirePortalWrite("transferencias", "/portal-associativo/transferencias");
  const returnTo = "/portal-associativo/transferencias";
  const empresaId = requireEmpresaId(context.empresaId, returnTo);
  const unidadeId = textValue(formData, "unidade_id");
  const novaPessoaId = textValue(formData, "nova_pessoa_id");
  const motivo = textValue(formData, "motivo");

  if (!unidadeId || !novaPessoaId || !motivo) {
    redirectWithError(returnTo, "Informe unidade, novo responsavel e motivo.");
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
  const returnTo = "/portal-associativo/financeiro";
  const id = textValue(formData, "id");
  const unidadeId = textValue(formData, "unidade_id");
  const dataVencimento = dateValue(formData, "data_vencimento");
  const valorOriginal = numberValue(formData, "valor_original");

  if (!unidadeId || !dataVencimento || valorOriginal <= 0) {
    redirectWithError(returnTo, "Informe unidade, vencimento e valor.");
  }

  const dueDate = new Date(String(dataVencimento));
  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, returnTo),
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
  redirectWithOk(returnTo, "Cobranca salva com sucesso.");
}

export async function baixarPortalCobranca(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/financeiro";
  const { error } = await context.client
    .from("assoc_cobrancas")
    .update({
      status: "paga",
      forma_pagamento: textValue(formData, "forma_pagamento") || "manual",
      data_pagamento: new Date().toISOString(),
      comprovante_url: nullableTextValue(formData, "comprovante_url"),
      atualizado_em: new Date().toISOString()
    })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "baixa_manual_cobranca", "assoc_cobrancas", id);
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Pagamento baixado manualmente.");
}

export async function cancelPortalCobranca(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "return_to") || "/portal-associativo/financeiro";
  const { error } = await context.client
    .from("assoc_cobrancas")
    .update({ status: "cancelada", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", context.empresaId);

  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "cancelar_cobranca", "assoc_cobrancas", id);
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, "Cobranca cancelada.");
}

export async function gerarPortalMensalidadesLote(formData: FormData) {
  const context = await requirePortalWrite("financeiro", "/portal-associativo/financeiro");
  const returnTo = "/portal-associativo/financeiro";
  const empresaId = requireEmpresaId(context.empresaId, returnTo);
  const valor = numberValue(formData, "valor_original");
  const vencimentoDia = Math.max(1, Math.min(31, Number(textValue(formData, "vencimento_dia") || 10)));
  const descricao = textValue(formData, "descricao") || "Mensalidade";
  const mesInicial = textValue(formData, "mes_inicial");

  if (!mesInicial || valor <= 0) {
    redirectWithError(returnTo, "Informe mes inicial e valor da mensalidade.");
  }

  const [year, month] = mesInicial.split("-").map(Number);
  const untilDecember = formData.get("ate_dezembro") === "true";
  const months = [];
  for (let monthIndex = month; monthIndex <= (untilDecember ? 12 : month); monthIndex += 1) {
    months.push({ year, month: monthIndex, due: `${year}-${String(monthIndex).padStart(2, "0")}-${String(vencimentoDia).padStart(2, "0")}` });
  }

  const [unitsResult, linksResult, existingResult] = await Promise.all([
    context.client.from("assoc_unidades").select("id").eq("empresa_id", empresaId).eq("status_unidade", "ativa"),
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
  const rows = [];

  for (const unit of unitsResult.data ?? []) {
    for (const item of months) {
      const key = `${unit.id}-${item.year}-${item.month}`;
      if (existing.has(key)) continue;
      rows.push({
        empresa_id: empresaId,
        unidade_id: unit.id,
        pessoa_responsavel_id: responsaveis.get(String(unit.id)) ?? null,
        tipo_cobranca: "mensalidade",
        descricao,
        mes_referencia: item.month,
        ano_referencia: item.year,
        data_vencimento: item.due,
        valor_original: valor,
        valor_total: valor,
        status: "aberta",
        pix_gateway: "manual"
      });
    }
  }

  if (rows.length === 0) {
    redirectWithOk(returnTo, "Nenhuma nova mensalidade para gerar.");
  }

  const { error } = await context.client.from("assoc_cobrancas").insert(rows);
  if (error) redirectWithError(returnTo, error.message);
  await recordPortalAudit(context, "gerar_mensalidades_lote", "assoc_cobrancas", null, { quantidade: rows.length });
  revalidatePortal(returnTo);
  redirectWithOk(returnTo, `${rows.length} mensalidades geradas.`);
}

export async function savePortalReuniao(formData: FormData) {
  const context = await requirePortalWrite("reunioes", "/portal-associativo/reunioes");
  const id = textValue(formData, "id");
  const payload = {
    empresa_id: requireEmpresaId(context.empresaId, "/portal-associativo/reunioes"),
    titulo: textValue(formData, "titulo"),
    data_reuniao: textValue(formData, "data_reuniao"),
    status: textValue(formData, "status") || "agendada",
    descricao: nullableTextValue(formData, "descricao"),
    ata_url: nullableTextValue(formData, "ata_url")
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
    valor_arrecadado: numberValue(formData, "valor_arrecadado")
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
      subtitulo: textValue(formData, "subtitulo") || "Gestao integrada de associados, unidades, cobrancas e comunicados.",
      logo_url: nullableTextValue(formData, "logo_url"),
      tema_visual: textValue(formData, "tema_visual") || "padrao",
      tipo_unidade_padrao: textValue(formData, "tipo_unidade_padrao") || "propriedade",
      valor_mensalidade_padrao: numberValue(formData, "valor_mensalidade_padrao"),
      vencimento_padrao: Number(textValue(formData, "vencimento_padrao") || 10),
      descricao_mensalidade_padrao: textValue(formData, "descricao_mensalidade_padrao") || "Mensalidade",
      pix_chave: nullableTextValue(formData, "pix_chave"),
      pix_tipo_chave: nullableTextValue(formData, "pix_tipo_chave"),
      recebedor_nome: nullableTextValue(formData, "recebedor_nome"),
      recebedor_cidade: nullableTextValue(formData, "recebedor_cidade"),
      webhook_url: nullableTextValue(formData, "webhook_url"),
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

function clean(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
