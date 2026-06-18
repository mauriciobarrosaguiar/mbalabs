"use server";

import { redirect } from "next/navigation";
import { obterChecklistPorAreaSubarea } from "@/lib/lexgestor/checklist";
import { ensureLexEscritorio, getLexSupabaseClient, storageProviderLabel } from "@/lib/lexgestor/data";
import { disconnectStorage, testStorageConnection } from "@/lib/lexgestor/storage";
import { requireAppAccess } from "@/lib/core-data";
import { registrarAuditoriaLexGestor } from "@/lib/lexgestor/audit";
import { checarLimiteLexGestor, obterPlanoLexGestor } from "@/lib/lexgestor/plans";

export async function salvarClienteLexGestor(formData: FormData) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/clientes/novo");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect("/lexgestor/clientes/novo?erro=configure-escritorio");
  }

  const plano = await obterPlanoLexGestor(client, current);
  const totalClientes = await countRows(client, "lex_clientes", escritorioId);
  const limitCheck = checarLimiteLexGestor(
    plano,
    { advogados: 0, clientes: totalClientes, casosAtivos: 0, documentos: 0 },
    "clientes",
  );

  if (!limitCheck.allowed) {
    redirect(`/lexgestor/clientes/novo?erro=${encodeURIComponent(limitCheck.message)}`);
  }

  const payload = {
    escritorio_id: escritorioId,
    nome: required(formData, "nome"),
    cpf_cnpj: nullable(formData, "cpf_cnpj"),
    rg: nullable(formData, "rg"),
    data_nascimento: nullable(formData, "data_nascimento"),
    estado_civil: nullable(formData, "estado_civil"),
    profissao: nullable(formData, "profissao"),
    telefone: nullable(formData, "telefone"),
    whatsapp: nullable(formData, "whatsapp"),
    email: nullable(formData, "email"),
    origem: nullable(formData, "origem"),
    status: value(formData, "status") || "Ativo",
    endereco: nullable(formData, "endereco"),
    observacoes: nullable(formData, "observacoes"),
  };

  const { error } = await client.from("lex_clientes").insert(payload);
  if (error) {
    redirect(`/lexgestor/clientes/novo?erro=${encodeURIComponent(error.message)}`);
  }

  await registrarAuditoriaLexGestor({
    current,
    acao: "cliente.criado",
    entidade: "lex_clientes",
    detalhes: { nome: payload.nome },
  });

  redirect("/lexgestor/clientes?status=cliente-salvo");
}
export async function atualizarClienteLexGestor(formData: FormData) {
  const clienteId = required(formData, "id");
  const current = await requireAppAccess("lexgestor", `/lexgestor/clientes/${clienteId}/editar`);
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect(`/lexgestor/clientes/${clienteId}/editar?erro=configure-escritorio`);
  }

  const payload = {
    nome: required(formData, "nome"),
    cpf_cnpj: nullable(formData, "cpf_cnpj"),
    rg: nullable(formData, "rg"),
    data_nascimento: nullable(formData, "data_nascimento"),
    estado_civil: nullable(formData, "estado_civil"),
    profissao: nullable(formData, "profissao"),
    telefone: nullable(formData, "telefone"),
    whatsapp: nullable(formData, "whatsapp"),
    email: nullable(formData, "email"),
    origem: nullable(formData, "origem"),
    status: value(formData, "status") || "Ativo",
    endereco: nullable(formData, "endereco"),
    observacoes: nullable(formData, "observacoes"),
  };

  let query = client.from("lex_clientes").update(payload).eq("id", clienteId);
  if (escritorioId) {
    query = query.eq("escritorio_id", escritorioId);
  }

  const { error } = await query;
  if (error) {
    redirect(`/lexgestor/clientes/${clienteId}/editar?erro=${encodeURIComponent(error.message)}`);
  }

  await registrarAuditoriaLexGestor({
    current,
    acao: "cliente.editado",
    entidade: "lex_clientes",
    entidadeId: clienteId,
    detalhes: { nome: payload.nome },
  });

  redirect(`/lexgestor/clientes/${clienteId}?status=cliente-atualizado`);
}

export async function excluirClienteLexGestor(formData: FormData) {
  const clienteId = required(formData, "id");
  const current = await requireAppAccess("lexgestor", `/lexgestor/clientes/${clienteId}`);
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect(`/lexgestor/clientes/${clienteId}?erro=configure-escritorio`);
  }

  const linkedCases = await countRows(client, "lex_casos", escritorioId, { cliente_id: clienteId });
  const linkedDocs = await countRows(client, "lex_documentos", escritorioId, { cliente_id: clienteId });
  let query = linkedCases > 0 || linkedDocs > 0
    ? client.from("lex_clientes").update({ status: "Inativo", updated_at: new Date().toISOString() }).eq("id", clienteId)
    : client.from("lex_clientes").delete().eq("id", clienteId);
  if (escritorioId) {
    query = query.eq("escritorio_id", escritorioId);
  }

  const { error } = await query;
  if (error) {
    redirect(`/lexgestor/clientes/${clienteId}?erro=${encodeURIComponent(error.message)}`);
  }

  await registrarAuditoriaLexGestor({
    current,
    acao: linkedCases > 0 || linkedDocs > 0 ? "cliente.inativado" : "cliente.excluido",
    entidade: "lex_clientes",
    entidadeId: clienteId,
    detalhes: { casos: linkedCases, documentos: linkedDocs },
  });

  redirect(`/lexgestor/clientes?status=${linkedCases > 0 || linkedDocs > 0 ? "cliente-inativado" : "cliente-excluido"}`);
}

export async function salvarCasoLexGestor(formData: FormData) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/casos/novo");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect("/lexgestor/casos/novo?erro=configure-escritorio");
  }

  const categoria = required(formData, "categoria");
  const subcategoria = required(formData, "subcategoria");
  const clienteId = required(formData, "cliente_id");
  const clienteExiste = await belongsToOffice(client, "lex_clientes", clienteId, escritorioId);

  if (!clienteExiste) {
    redirect("/lexgestor/casos/novo?erro=cliente-invalido");
  }

  const plano = await obterPlanoLexGestor(client, current);
  const casosAtivos = await countRows(client, "lex_casos", escritorioId, { statusNotIn: ["Finalizado", "Arquivado"] });
  const limitCheck = checarLimiteLexGestor(
    plano,
    { advogados: 0, clientes: 0, casosAtivos, documentos: 0 },
    "casosAtivos",
  );

  if (!limitCheck.allowed) {
    redirect(`/lexgestor/casos/novo?erro=${encodeURIComponent(limitCheck.message)}`);
  }

  const advogadoResponsavelId = nullable(formData, "advogado_responsavel_id");
  const advogadoValido = advogadoResponsavelId
    ? await belongsToOffice(client, "lex_advogados", advogadoResponsavelId, escritorioId)
    : false;

  const payload = {
    escritorio_id: escritorioId,
    cliente_id: clienteId,
    titulo: required(formData, "titulo"),
    area: categoria,
    subarea: subcategoria,
    categoria_nome: categoria,
    subcategoria_nome: subcategoria,
    status: value(formData, "status") || "Atendimento inicial",
    prioridade: value(formData, "prioridade") || "Normal",
    relato_inicial: nullable(formData, "relato_inicial"),
    numero_processo: nullable(formData, "numero_processo"),
    chave_processo: nullable(formData, "chave_processo"),
    sistema_judicial: nullable(formData, "sistema_judicial"),
    tribunal: nullable(formData, "tribunal"),
    uf: nullable(formData, "uf"),
    comarca: nullable(formData, "comarca"),
    vara: nullable(formData, "vara"),
    classe_processual: nullable(formData, "classe_processual"),
    assunto: nullable(formData, "assunto"),
    fase_processual: nullable(formData, "fase_processual"),
    grau: nullable(formData, "grau"),
    polo_ativo: nullable(formData, "polo_ativo"),
    polo_passivo: nullable(formData, "polo_passivo"),
    advogado_responsavel_id: advogadoValido ? advogadoResponsavelId : null,
    advogado_responsavel: nullable(formData, "advogado_responsavel"),
    valor_causa: numericOrNull(formData, "valor_causa"),
    justica_gratuita: value(formData, "justica_gratuita") === "sim",
    segredo_justica: value(formData, "segredo_justica") === "sim",
    data_distribuicao: nullable(formData, "data_distribuicao"),
    proximo_prazo: nullable(formData, "proximo_prazo"),
    tipo_prazo: nullable(formData, "tipo_prazo"),
    link_processo: nullable(formData, "link_processo"),
    observacoes_processo: nullable(formData, "observacoes_processo"),
  };

  const created = await client.from("lex_casos").insert(payload).select("id").single();
  if (created.error) {
    redirect(`/lexgestor/casos/novo?erro=${encodeURIComponent(created.error.message)}`);
  }

  await criarChecklistInicial(client, escritorioId, String(created.data.id), categoria, subcategoria);
  await registrarAuditoriaLexGestor({
    current,
    acao: "caso.criado",
    entidade: "lex_casos",
    entidadeId: String(created.data.id),
    detalhes: { titulo: payload.titulo, clienteId, categoria, subcategoria },
  });
  redirect(`/lexgestor/casos/${created.data.id}?status=caso-salvo`);
}

export async function salvarConfiguracoesLexGestor(formData: FormData) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/configuracoes");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  const payload = {
    nome: required(formData, "nome"),
    cnpj: nullable(formData, "cnpj"),
    telefone: nullable(formData, "telefone"),
    whatsapp: nullable(formData, "whatsapp"),
    email: nullable(formData, "email"),
    endereco: nullable(formData, "endereco"),
    logo_url: nullable(formData, "logo_url"),
    watermark_image_url: nullable(formData, "watermark_image_url"),
    watermark_text: nullable(formData, "watermark_text"),
    responsavel_principal: nullable(formData, "responsavel_principal"),
    responsavel_oab: nullable(formData, "responsavel_oab"),
    updated_at: new Date().toISOString(),
  };

  const result = escritorioId
    ? await updateWithLegacyFallback(client, "lex_escritorios", payload, ["logo_url", "watermark_image_url", "responsavel_principal", "responsavel_oab", "updated_at"], { id: escritorioId })
    : await insertWithLegacyFallback(client, "lex_escritorios", { ...payload, empresa_id: current.empresaId }, ["logo_url", "watermark_image_url", "responsavel_principal", "responsavel_oab", "updated_at"], true);

  if (result.error) {
    redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent(result.error.message)}`);
  }

  const advogadoNome = value(formData, "advogado_nome");
  if (advogadoNome && escritorioId) {
    await client.from("lex_advogados").upsert(
      {
        escritorio_id: escritorioId,
        core_usuario_id: current.usuario.id,
        nome: advogadoNome,
        oab: nullable(formData, "oab"),
        uf_oab: nullable(formData, "uf_oab"),
        email: nullable(formData, "advogado_email"),
        telefone: nullable(formData, "advogado_telefone"),
        cargo: nullable(formData, "cargo"),
        ativo: true,
      },
      { onConflict: "escritorio_id,core_usuario_id" },
    );
  }

  await registrarAuditoriaLexGestor({
    current,
    acao: "configuracoes.editadas",
    entidade: "lex_escritorios",
    entidadeId: escritorioId || String((result as any).data?.id ?? ""),
    detalhes: { nome: payload.nome },
  });

  redirect("/lexgestor/configuracoes?status=configuracoes-salvas");
}

export async function salvarAdvogadoLexGestor(formData: FormData) {
  const id = value(formData, "id");
  const current = await requireAppAccess("lexgestor", "/lexgestor/equipe");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect("/lexgestor/equipe?erro=configure-escritorio");
  }

  if (!id) {
    const plano = await obterPlanoLexGestor(client, current);
    const advogados = await countRows(client, "lex_advogados", escritorioId, { ativo: true });
    const limitCheck = checarLimiteLexGestor(
      plano,
      { advogados, clientes: 0, casosAtivos: 0, documentos: 0 },
      "advogados",
    );

    if (!limitCheck.allowed) {
      redirect(`/lexgestor/equipe?erro=${encodeURIComponent(limitCheck.message)}`);
    }
  }

  const coreUsuarioId = nullable(formData, "core_usuario_id");
  if (coreUsuarioId && !(await belongsToCompanyUser(client, coreUsuarioId, current.empresaId))) {
    redirect("/lexgestor/equipe?erro=usuario-invalido");
  }

  const status = value(formData, "status") || "ativo";
  const payload = {
    escritorio_id: escritorioId,
    core_usuario_id: coreUsuarioId,
    nome: required(formData, "nome"),
    email: nullable(formData, "email"),
    telefone: nullable(formData, "telefone"),
    whatsapp: nullable(formData, "whatsapp"),
    oab: nullable(formData, "oab"),
    uf_oab: nullable(formData, "uf_oab"),
    cargo: nullable(formData, "cargo"),
    perfil_acesso: value(formData, "perfil_acesso") || "advogado",
    status,
    ativo: status !== "inativo",
    observacoes: nullable(formData, "observacoes"),
    updated_at: new Date().toISOString(),
  };

  const result = id
    ? await updateWithLegacyFallback(
        client,
        "lex_advogados",
        payload,
        ["whatsapp", "perfil_acesso", "status", "observacoes", "updated_at"],
        { id, escritorio_id: escritorioId },
      )
    : await insertWithLegacyFallback(
        client,
        "lex_advogados",
        payload,
        ["whatsapp", "perfil_acesso", "status", "observacoes", "updated_at"],
        true,
      );

  if (result.error) {
    redirect(`/lexgestor/equipe?erro=${encodeURIComponent(result.error.message)}`);
  }

  await registrarAuditoriaLexGestor({
    current,
    acao: id ? "advogado.editado" : "advogado.criado",
    entidade: "lex_advogados",
    entidadeId: id || String((result as any).data?.id ?? ""),
    detalhes: { nome: payload.nome, perfil: payload.perfil_acesso, status },
  });

  redirect(`/lexgestor/equipe?status=${id ? "advogado-atualizado" : "advogado-criado"}`);
}

export async function alterarStatusAdvogadoLexGestor(formData: FormData) {
  const id = required(formData, "id");
  const status = value(formData, "status") === "inativo" ? "inativo" : "ativo";
  const current = await requireAppAccess("lexgestor", "/lexgestor/equipe");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) redirect("/lexgestor/equipe?erro=configure-escritorio");

  const result = await updateWithLegacyFallback(
    client,
    "lex_advogados",
    { status, ativo: status === "ativo", updated_at: new Date().toISOString() },
    ["status", "updated_at"],
    { id, escritorio_id: escritorioId },
  );

  if (result.error) redirect(`/lexgestor/equipe?erro=${encodeURIComponent(result.error.message)}`);

  await registrarAuditoriaLexGestor({
    current,
    acao: status === "ativo" ? "advogado.ativado" : "advogado.inativado",
    entidade: "lex_advogados",
    entidadeId: id,
  });

  redirect(`/lexgestor/equipe?status=${status === "ativo" ? "advogado-ativado" : "advogado-inativado"}`);
}

export async function excluirOuInativarAdvogadoLexGestor(formData: FormData) {
  const id = required(formData, "id");
  const current = await requireAppAccess("lexgestor", "/lexgestor/equipe");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) redirect("/lexgestor/equipe?erro=configure-escritorio");

  const casosVinculados = await countRows(client, "lex_casos", escritorioId, { advogado_responsavel_id: id });
  const result = casosVinculados > 0
    ? await updateWithLegacyFallback(
        client,
        "lex_advogados",
        { status: "inativo", ativo: false, updated_at: new Date().toISOString() },
        ["status", "updated_at"],
        { id, escritorio_id: escritorioId },
      )
    : await client.from("lex_advogados").delete().eq("id", id).eq("escritorio_id", escritorioId);

  if (result.error) redirect(`/lexgestor/equipe?erro=${encodeURIComponent(result.error.message)}`);

  await registrarAuditoriaLexGestor({
    current,
    acao: casosVinculados > 0 ? "advogado.inativado_por_vinculo" : "advogado.excluido",
    entidade: "lex_advogados",
    entidadeId: id,
    detalhes: { casosVinculados },
  });

  redirect(`/lexgestor/equipe?status=${casosVinculados > 0 ? "advogado-inativado" : "advogado-excluido"}`);
}

export async function atualizarResponsavelCasoLexGestor(formData: FormData) {
  const casoId = required(formData, "caso_id");
  const advogadoId = nullable(formData, "advogado_responsavel_id");
  const current = await requireAppAccess("lexgestor", `/lexgestor/casos/${casoId}`);
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) redirect(`/lexgestor/casos/${casoId}?erro=configure-escritorio`);
  if (!(await belongsToOffice(client, "lex_casos", casoId, escritorioId))) {
    redirect("/lexgestor/casos?erro=caso-invalido");
  }

  let advogadoNome = "";
  if (advogadoId) {
    const advogado = await client
      .from("lex_advogados")
      .select("id,nome")
      .eq("id", advogadoId)
      .eq("escritorio_id", escritorioId)
      .maybeSingle();

    if (advogado.error || !advogado.data) {
      redirect(`/lexgestor/casos/${casoId}?erro=advogado-invalido`);
    }

    advogadoNome = String(advogado.data.nome ?? "");
  }

  const { error } = await client
    .from("lex_casos")
    .update({
      advogado_responsavel_id: advogadoId,
      advogado_responsavel: advogadoNome || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", casoId)
    .eq("escritorio_id", escritorioId);

  if (error) redirect(`/lexgestor/casos/${casoId}?erro=${encodeURIComponent(error.message)}`);

  await registrarAuditoriaLexGestor({
    current,
    acao: "caso.responsavel_alterado",
    entidade: "lex_casos",
    entidadeId: casoId,
    detalhes: { advogadoId, advogadoNome },
  });

  redirect(`/lexgestor/casos/${casoId}?status=responsavel-atualizado`);
}

export async function atualizarPendentesDocumentosLexGestor() {
  const current = await requireAppAccess("lexgestor", "/lexgestor/documentos");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect("/lexgestor/documentos?erro=configure-escritorio");
  }

  const { data, error } = await client
    .from("lex_documentos")
    .select("id,status,storage_path,storage_url,dropbox_path_original")
    .eq("escritorio_id", escritorioId)
    .in("status", ["metadados_criados", "pendente", "erro_envio"]);

  if (error) {
    redirect(`/lexgestor/documentos?erro=${encodeURIComponent(error.message)}`);
  }

  const ids = ((data ?? []) as Array<Record<string, unknown>>)
    .filter((documento) => !text(documento.storage_path) && !text(documento.storage_url) && !text(documento.dropbox_path_original))
    .map((documento) => String(documento.id ?? ""))
    .filter(Boolean);

  if (ids.length > 0) {
    await client
      .from("lex_documentos")
      .update({ status: "precisa_reenviar", updated_at: new Date().toISOString() })
      .eq("escritorio_id", escritorioId)
      .in("id", ids);
  }

  await registrarAuditoriaLexGestor({
    current,
    acao: "documentos.pendentes_atualizados",
    entidade: "lex_documentos",
    detalhes: { documentosMarcados: ids.length },
  });

  redirect(`/lexgestor/documentos?status=${ids.length > 0 ? "pendentes-atualizados" : "sem-pendentes"}`);
}

export async function testarArmazenamentoLexGestor() {
  const current = await requireAppAccess("lexgestor", "/lexgestor/configuracoes");
  let status = "";

  try {
    const provider = await testStorageConnection(current);
    status = `${storageProviderLabel(provider)} conectado`;
  } catch (error) {
    redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect(`/lexgestor/configuracoes?status=${encodeURIComponent(status)}`);
}

export async function desconectarArmazenamentoLexGestor() {
  const current = await requireAppAccess("lexgestor", "/lexgestor/configuracoes");

  try {
    await disconnectStorage(current);
  } catch (error) {
    redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect("/lexgestor/configuracoes?status=armazenamento-desconectado");
}

async function criarChecklistInicial(
  client: any,
  escritorioId: string,
  casoId: string,
  categoria: string,
  subcategoria: string,
) {
  const templatesDb = await client
    .from("lex_checklist_templates")
    .select("id")
    .eq("area", categoria)
    .eq("subarea", subcategoria)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  const templateIds = (templatesDb.data ?? []).map((row: any) => row.id).filter(Boolean);

  if (templateIds.length > 0) {
    await client.from("lex_checklist_respostas").insert(
      templateIds.map((templateId: string) => ({
        escritorio_id: escritorioId,
        caso_id: casoId,
        checklist_template_id: templateId,
        status: "pendente",
      })),
    );
    return;
  }

  const fallback = obterChecklistPorAreaSubarea(categoria, subcategoria);
  if (fallback.length === 0) return;

  const templates = await client
    .from("lex_checklist_templates")
    .insert(
      fallback.map((item) => ({
        area: item.area,
        subarea: item.subarea,
        titulo: item.titulo,
        descricao: item.descricao,
        documentos_necessarios: item.documentosNecessarios,
        obrigatorio: item.obrigatorio,
        ordem: item.ordem,
        ativo: true,
      })),
    )
    .select("id");

  const ids = (templates.data ?? []).map((row: any) => row.id).filter(Boolean);
  if (ids.length > 0) {
    await client.from("lex_checklist_respostas").insert(
      ids.map((templateId: string) => ({
        escritorio_id: escritorioId,
        caso_id: casoId,
        checklist_template_id: templateId,
        status: "pendente",
      })),
    );
  }
}

async function countRows(
  client: any,
  table: string,
  escritorioId: string,
  filters: Record<string, unknown> = {},
) {
  if (!escritorioId) return 0;

  let query = client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("escritorio_id", escritorioId);

  for (const [key, rawValue] of Object.entries(filters)) {
    if (key === "statusNotIn" && Array.isArray(rawValue)) {
      query = query.not("status", "in", `(${rawValue.map((item) => String(item).replace(/[(),]/g, "")).join(",")})`);
    } else {
      query = query.eq(key, rawValue);
    }
  }

  const { count } = await query;
  return count ?? 0;
}

async function belongsToOffice(client: any, table: string, id: string | null, escritorioId: string) {
  if (!id || !escritorioId) return false;

  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

async function belongsToCompanyUser(client: any, id: string, empresaId: string | null) {
  if (!id || !empresaId) return false;

  const { data, error } = await client
    .from("core_usuarios")
    .select("id")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

async function insertWithLegacyFallback(
  client: any,
  table: string,
  payload: Record<string, unknown>,
  optionalColumns: string[],
  selectId = false,
) {
  const insert = client.from(table).insert(payload);
  const result = selectId ? await insert.select("id").single() : await insert;

  if (!shouldRetryWithoutOptionalColumns(result.error)) {
    return result;
  }

  const legacyPayload = omitKeys(payload, optionalColumns);
  const legacyInsert = client.from(table).insert(legacyPayload);
  return selectId ? await legacyInsert.select("id").single() : await legacyInsert;
}

async function updateWithLegacyFallback(
  client: any,
  table: string,
  payload: Record<string, unknown>,
  optionalColumns: string[],
  filters: Record<string, unknown>,
) {
  let query = client.from(table).update(payload);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const result = await query;
  if (!shouldRetryWithoutOptionalColumns(result.error)) {
    return result;
  }

  let legacyQuery = client.from(table).update(omitKeys(payload, optionalColumns));
  for (const [key, value] of Object.entries(filters)) {
    legacyQuery = legacyQuery.eq(key, value);
  }

  return await legacyQuery;
}

function shouldRetryWithoutOptionalColumns(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? "").toLowerCase();
  return Boolean(error && (message.includes("column") || message.includes("schema cache") || error.code === "PGRST204"));
}

function omitKeys<T extends Record<string, unknown>>(payload: T, keys: string[]) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !keys.includes(key)));
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function required(formData: FormData, key: string) {
  const result = value(formData, key);
  if (!result) {
    throw new Error(`Campo obrigatorio: ${key}`);
  }
  return result;
}

function nullable(formData: FormData, key: string) {
  return value(formData, key) || null;
}

function numericOrNull(formData: FormData, key: string) {
  const raw = value(formData, key).replace(/\./g, "").replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao processar solicitacao.";
}
