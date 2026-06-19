"use server";

import { redirect } from "next/navigation";
import { obterChecklistPorAreaSubarea } from "@/lib/lexgestor/checklist";
import { ensureLexEscritorio, getLexSupabaseClient, storageProviderLabel } from "@/lib/lexgestor/data";
import { deleteFromConnectedStorage, disconnectStorage, isStorageProvider, montarPastaRaizEscritorio, testStorageConnection, uploadToConnectedStorage } from "@/lib/lexgestor/storage";
import { requireAppAccess } from "@/lib/core-data";
import { registrarAuditoriaLexGestor } from "@/lib/lexgestor/audit";
import { obterUsuarioLexGestorAtual } from "@/lib/lexgestor/auth";
import { checarLimiteLexGestor, obterPlanoLexGestor } from "@/lib/lexgestor/plans";
import { createLogoStorageUrl } from "@/lib/lexgestor/pdf-branding";
import { possuiPermissao } from "@/lib/lexgestor/permissions";
import { normalizarNumeroCnj, numeroCnjMinimoValido, syncProcessoDataJud } from "@/lib/lexgestor/processos";

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
  const nomeEscritorio = required(formData, "nome");
  const logoUrl = await resolverLogoEscritorio({
    current,
    escritorioNome: nomeEscritorio,
    file: formData.get("logo_file"),
    currentLogoUrl: text(escritorio?.logo_url) || null,
    currentStorageLogoUrl: text(escritorio?.watermark_image_url) || null,
  });

  const payload = {
    nome: nomeEscritorio,
    cnpj: nullable(formData, "cnpj"),
    telefone: nullable(formData, "telefone"),
    whatsapp: nullable(formData, "whatsapp"),
    email: nullable(formData, "email"),
    endereco: nullable(formData, "endereco"),
    logo_url: logoUrl.pdfLogoUrl,
    watermark_image_url: logoUrl.storageLogoUrl,
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

async function resolverLogoEscritorio({
  current,
  escritorioNome,
  file,
  currentLogoUrl,
  currentStorageLogoUrl,
}: {
  current: Awaited<ReturnType<typeof requireAppAccess>>;
  escritorioNome: string;
  file: FormDataEntryValue | null;
  currentLogoUrl: string | null;
  currentStorageLogoUrl: string | null;
}) {
  if (!(file instanceof File) || file.size === 0) {
    return {
      pdfLogoUrl: currentLogoUrl,
      storageLogoUrl: currentStorageLogoUrl,
    };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent("Selecione uma logo em PNG, JPG ou WebP.")}`);
  }

  if (file.size > 4 * 1024 * 1024) {
    redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent("A logo deve ter no máximo 4 MB.")}`);
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const pdfLogoUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
    const result = await uploadToConnectedStorage({
      current,
      provider: "google_drive",
      fileName: logoFileName(escritorioNome, file),
      mimeType: file.type,
      bytes,
      folderPath: `${montarPastaRaizEscritorio(escritorioNome)}/00 - Identidade Visual`,
    });

    if (!result?.fileId) {
      redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent("Conecte o Google Drive antes de carregar a logo.")}`);
    }

    return {
      pdfLogoUrl,
      storageLogoUrl: createLogoStorageUrl("google_drive", { fileId: result.fileId }),
    };
  } catch (error) {
    redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`);
  }
}

function logoFileName(escritorioNome: string, file: File) {
  const extensionByMime: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  const extension = extensionByMime[file.type] ?? "";
  const name = escritorioNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "escritorio";

  return `logo-${name}${extension}`;
}

export async function salvarAdvogadoLexGestor(formData: FormData) {
  const id = value(formData, "id");
  const current = await requireAppAccess("lexgestor", "/lexgestor/equipe");
  await ensureCanManageEquipeLexGestor();
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
  if (coreUsuarioId) {
    const userValidation = await validateCoreUsuarioLexGestor({
      client,
      coreUsuarioId,
      current,
      escritorioId,
      profissionalId: id,
    });

    if (!userValidation.ok) {
      redirect(`/lexgestor/equipe?erro=${userValidation.reason}`);
    }
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
  await ensureCanManageEquipeLexGestor();
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
  await ensureCanManageEquipeLexGestor();
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
    .select("id,status,storage_path,storage_url,dropbox_path_original,storage_file_id,dropbox_file_id")
    .eq("escritorio_id", escritorioId)
    .in("status", ["metadados_criados", "pendente", "erro_envio", "precisa_reenviar"]);

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
    acao: "documentos.pendentes_revisados",
    entidade: "lex_documentos",
    detalhes: { documentosMarcados: ids.length },
  });

  redirect(`/lexgestor/documentos?status=${ids.length > 0 ? "pendentes-atualizados" : "sem-pendentes"}`);
}

export async function excluirDocumentoLexGestor(formData: FormData) {
  const documentoId = required(formData, "documento_id");
  const current = await requireAppAccess("lexgestor", "/lexgestor/documentos");
  const usuarioLex = await obterUsuarioLexGestorAtual("/lexgestor/documentos");
  if (!possuiPermissao(usuarioLex, "lex:documentos:excluir")) {
    redirect("/lexgestor/documentos?erro=sem-permissao");
  }
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect("/lexgestor/documentos?erro=configure-escritorio");
  }

  const documentoResult = await client
    .from("lex_documentos")
    .select("*")
    .eq("id", documentoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (documentoResult.error || !documentoResult.data) {
    redirect("/lexgestor/documentos?erro=documento-invalido");
  }

  const documento = documentoResult.data as Record<string, unknown>;
  const provider = text(documento.storage_provider) || text(documento.provider) || (text(documento.dropbox_path_original) ? "dropbox" : "");
  const clienteId = text(documento.cliente_id);
  const casoId = text(documento.caso_id);
  const movimentacaoId = text(documento.movimentacao_id);

  let storageDeleteError = "";

  if (isStorageProvider(provider)) {
    try {
      await deleteFromConnectedStorage({
        current,
        provider,
        path: text(documento.storage_path) || text(documento.caminho_original) || text(documento.dropbox_path_original),
        fileId: text(documento.storage_file_id) || text(documento.dropbox_file_id),
      });
      await deleteFromConnectedStorage({
        current,
        provider,
        path: text(documento.pdf_storage_path) || text(documento.caminho_pdf) || text(documento.dropbox_path_pdf_marca_dagua),
        fileId: text(documento.pdf_storage_file_id),
      });
    } catch (error) {
      storageDeleteError = errorMessage(error);
    }
  }

  const deleted = await client
    .from("lex_documentos")
    .delete()
    .eq("id", documentoId)
    .eq("escritorio_id", escritorioId);

  if (deleted.error) {
    redirect(`/lexgestor/documentos?cliente=${clienteId}&caso=${casoId}&erro=${encodeURIComponent(deleted.error.message)}`);
  }

  if (movimentacaoId) {
    const remaining = await client
      .from("lex_documentos")
      .select("id", { count: "exact", head: true })
      .eq("escritorio_id", escritorioId)
      .eq("movimentacao_id", movimentacaoId);

    if ((remaining.count ?? 0) === 0) {
      await client
        .from("lex_movimentacoes")
        .update({ tem_documento: false, documento_status: "sem_documento" })
        .eq("id", movimentacaoId)
        .eq("escritorio_id", escritorioId);
    }
  }

  await registrarAuditoriaLexGestor({
    current,
    acao: "documento.excluido",
    entidade: "lex_documentos",
    entidadeId: documentoId,
    detalhes: { provider, clienteId, casoId, storageDeleteError: storageDeleteError || null },
  });

  redirect(`/lexgestor/documentos?cliente=${clienteId}${casoId ? `&caso=${casoId}` : ""}&status=${storageDeleteError ? "documento-excluido-storage-pendente" : "documento-excluido"}`);
}

export async function salvarProcessoLexGestor(formData: FormData) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/processos/novo");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect("/lexgestor/processos/novo?erro=configure-escritorio");
  }

  const numeroCnj = required(formData, "numero_cnj");
  const numeroCnjLimpo = normalizarNumeroCnj(numeroCnj);
  if (!numeroCnjMinimoValido(numeroCnj)) {
    redirect("/lexgestor/processos/novo?erro=numero-cnj-invalido");
  }

  const clienteId = required(formData, "cliente_id");
  if (!(await belongsToOffice(client, "lex_clientes", clienteId, escritorioId))) {
    redirect("/lexgestor/processos/novo?erro=cliente-invalido");
  }

  const casoId = nullable(formData, "caso_id");
  if (casoId) {
    const caso = await client
      .from("lex_casos")
      .select("id,cliente_id")
      .eq("id", casoId)
      .eq("escritorio_id", escritorioId)
      .maybeSingle();

    if (caso.error || !caso.data?.id || String(caso.data.cliente_id ?? "") !== clienteId) {
      redirect("/lexgestor/processos/novo?erro=caso-invalido");
    }
  }

  const duplicate = await client
    .from("lex_processos")
    .select("id")
    .eq("escritorio_id", escritorioId)
    .eq("numero_cnj_limpo", numeroCnjLimpo)
    .maybeSingle();

  if (duplicate.error && duplicate.error.code !== "PGRST116") {
    redirect(`/lexgestor/processos/novo?erro=${encodeURIComponent(duplicate.error.message)}`);
  }

  if (duplicate.data?.id) {
    redirect(`/lexgestor/processos/${duplicate.data.id}?erro=processo-duplicado`);
  }

  const advogadoId = await resolveAdvogadoAtual(client, escritorioId, current.usuario.id);
  const payload = {
    empresa_id: current.empresaId,
    escritorio_id: escritorioId,
    advogado_id: advogadoId,
    cliente_id: clienteId,
    caso_id: casoId,
    numero_cnj: numeroCnj,
    numero_cnj_limpo: numeroCnjLimpo,
    tribunal: required(formData, "tribunal"),
    tribunal_alias_datajud: required(formData, "tribunal_alias_datajud"),
    grau: required(formData, "grau"),
    categoria: nullable(formData, "categoria"),
    subcategoria: nullable(formData, "subcategoria"),
    chave_eproc_opcional: nullable(formData, "chave_eproc_opcional"),
    url_eproc: nullable(formData, "url_eproc"),
    observacoes: nullable(formData, "observacoes"),
    status: value(formData, "status") || "ativo",
    updated_at: new Date().toISOString(),
  };

  const created = await client.from("lex_processos").insert(payload).select("id").single();
  if (created.error) {
    redirect(`/lexgestor/processos/novo?erro=${encodeURIComponent(created.error.message)}`);
  }

  await registrarAuditoriaLexGestor({
    current,
    acao: "processo.criado",
    entidade: "lex_processos",
    entidadeId: String(created.data.id),
    detalhes: { numeroCnj, tribunal: payload.tribunal, clienteId, casoId },
  });

  redirect(`/lexgestor/processos/${created.data.id}?status=processo-salvo`);
}

export async function sincronizarProcessoLexGestor(formData: FormData) {
  const processoId = required(formData, "processo_id");
  const current = await requireAppAccess("lexgestor", `/lexgestor/processos/${processoId}`);
  let destination = `/lexgestor/processos/${processoId}`;

  try {
    const result = await syncProcessoDataJud({ processoId, current });
    destination = `/lexgestor/processos/${processoId}?status=${encodeURIComponent(result.message)}`;
  } catch (error) {
    destination = `/lexgestor/processos/${processoId}?erro=${encodeURIComponent(errorMessage(error))}`;
  }

  redirect(destination);
}

export async function marcarMovimentacoesVistasLexGestor(formData: FormData) {
  const processoId = required(formData, "processo_id");
  const current = await requireAppAccess("lexgestor", `/lexgestor/processos/${processoId}`);
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect(`/lexgestor/processos/${processoId}?erro=configure-escritorio`);
  }

  const processoExiste = await belongsToOffice(client, "lex_processos", processoId, escritorioId);
  if (!processoExiste) {
    redirect("/lexgestor/processos?erro=processo-invalido");
  }

  await Promise.all([
    client
      .from("lex_processos")
      .update({ possui_nova_movimentacao: false, updated_at: new Date().toISOString() })
      .eq("id", processoId)
      .eq("escritorio_id", escritorioId),
    client
      .from("lex_movimentacoes")
      .update({ visualizado: true })
      .eq("processo_id", processoId)
      .eq("escritorio_id", escritorioId),
  ]);

  redirect(`/lexgestor/processos/${processoId}?status=movimentacoes-vistas`);
}

export async function testarArmazenamentoLexGestor(formData?: FormData) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/configuracoes");
  let status = "";
  const providerValue = value(formData, "provider");
  const providerFilter = isStorageProvider(providerValue) ? providerValue : undefined;

  try {
    const provider = await testStorageConnection(current, providerFilter);
    status = `${storageProviderLabel(provider)} conectado`;
  } catch (error) {
    redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect(`/lexgestor/configuracoes?status=${encodeURIComponent(status)}`);
}

export async function desconectarArmazenamentoLexGestor(formData?: FormData) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/configuracoes");
  const providerValue = value(formData, "provider");
  const providerFilter = isStorageProvider(providerValue) ? providerValue : undefined;

  try {
    await disconnectStorage(current, providerFilter);
  } catch (error) {
    redirect(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect(`/lexgestor/configuracoes?status=${providerFilter ? encodeURIComponent(`${storageProviderLabel(providerFilter)} desconectado`) : "armazenamento-desconectado"}`);
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

async function validateCoreUsuarioLexGestor({
  client,
  coreUsuarioId,
  current,
  escritorioId,
  profissionalId,
}: {
  client: any;
  coreUsuarioId: string;
  current: Awaited<ReturnType<typeof requireAppAccess>>;
  escritorioId: string;
  profissionalId?: string;
}) {
  if (!coreUsuarioId || !current.empresaId) return { ok: false, reason: "usuario-invalido" };

  const usuario = await client
    .from("core_usuarios")
    .select("id,empresa_id,tipo,status")
    .eq("id", coreUsuarioId)
    .eq("empresa_id", current.empresaId)
    .eq("status", "ativo")
    .maybeSingle();

  const tipo = text(usuario.data?.tipo);
  if (usuario.error || !usuario.data?.id || tipo === "super_admin" || tipo === "admin_master") {
    return { ok: false, reason: "usuario-invalido" };
  }

  const duplicateQuery = client
    .from("lex_advogados")
    .select("id")
    .eq("escritorio_id", escritorioId)
    .eq("core_usuario_id", coreUsuarioId);
  const duplicates = profissionalId ? await duplicateQuery.neq("id", profissionalId) : await duplicateQuery;
  if (!duplicates.error && (duplicates.data ?? []).length > 0) {
    return { ok: false, reason: "usuario-ja-vinculado" };
  }

  const appId = await resolveLexGestorAppId(client);
  if (!appId) return { ok: true, reason: "" };

  const permission = await client
    .from("core_usuario_app_permissoes")
    .select("id,status")
    .eq("empresa_id", current.empresaId)
    .eq("usuario_id", coreUsuarioId)
    .eq("app_id", appId)
    .in("status", ["ativo", "teste"])
    .maybeSingle();

  if (permission.error && permission.error.code !== "PGRST116") {
    return { ok: true, reason: "" };
  }

  return permission.data?.id ? { ok: true, reason: "" } : { ok: false, reason: "usuario-sem-lexgestor" };
}

async function resolveLexGestorAppId(client: any) {
  const { data, error } = await client
    .from("core_apps")
    .select("id")
    .in("slug", ["lexgestor", "lex-gestor"])
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return "";
  return text(data.id);
}

async function resolveAdvogadoAtual(client: any, escritorioId: string, coreUsuarioId: string) {
  if (!escritorioId || !coreUsuarioId) return null;

  const { data, error } = await client
    .from("lex_advogados")
    .select("id")
    .eq("escritorio_id", escritorioId)
    .eq("core_usuario_id", coreUsuarioId)
    .maybeSingle();

  if (error || !data?.id) return null;
  return String(data.id);
}

async function ensureCanManageEquipeLexGestor() {
  const usuarioLex = await obterUsuarioLexGestorAtual("/lexgestor/equipe");
  if (!possuiPermissao(usuarioLex, "lex:equipe:gerenciar")) {
    redirect("/lexgestor?erro=equipe-restrita");
  }
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

function value(formData: FormData | undefined, key: string) {
  return String(formData?.get(key) ?? "").trim();
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
