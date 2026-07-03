"use server";

import { redirect } from "next/navigation";
import { obterChecklistPorAreaSubarea } from "@/lib/lexgestor/checklist";
import { requireAppAccess } from "@/lib/core-data";
import { registrarAuditoriaLexGestor } from "@/lib/lexgestor/audit";
import { ensureLexEscritorio, getLexSupabaseClient } from "@/lib/lexgestor/data";
import { checarLimiteLexGestor, obterPlanoLexGestor } from "@/lib/lexgestor/plans";

export async function vincularProcessoAoCasoLexGestor(formData: FormData) {
  const processoId = required(formData, "processo_id");
  const casoId = required(formData, "caso_id");
  const current = await requireAppAccess("lexgestor", `/lexgestor/processos/${processoId}`);
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = text(escritorio?.id);

  if (!escritorioId) {
    redirect(`/lexgestor/processos/${processoId}?erro=configure-escritorio`);
  }

  const [processoResult, casoResult] = await Promise.all([
    client
      .from("lex_processos")
      .select("*")
      .eq("id", processoId)
      .eq("escritorio_id", escritorioId)
      .maybeSingle(),
    client
      .from("lex_casos")
      .select("id,cliente_id,titulo")
      .eq("id", casoId)
      .eq("escritorio_id", escritorioId)
      .maybeSingle(),
  ]);

  if (processoResult.error || !processoResult.data?.id) {
    redirect(`/lexgestor/processos/${processoId}?erro=processo-invalido`);
  }

  if (casoResult.error || !casoResult.data?.id) {
    redirect(`/lexgestor/processos/${processoId}?erro=caso-invalido`);
  }

  const processo = processoResult.data as Record<string, unknown>;
  const caso = casoResult.data as Record<string, unknown>;
  const processoClienteId = text(processo.cliente_id);
  const casoClienteId = text(caso.cliente_id);

  if (!processoClienteId || processoClienteId !== casoClienteId) {
    redirect(`/lexgestor/processos/${processoId}?erro=caso-cliente-diferente`);
  }

  const now = new Date().toISOString();
  const updateProcesso = await client
    .from("lex_processos")
    .update({ caso_id: casoId, updated_at: now })
    .eq("id", processoId)
    .eq("escritorio_id", escritorioId);

  if (updateProcesso.error) {
    redirect(`/lexgestor/processos/${processoId}?erro=${encodeURIComponent(updateProcesso.error.message)}`);
  }

  await atualizarDocumentosDoProcesso(client, escritorioId, processoId, casoId, processoClienteId);
  await preencherCasoComDadosDoProcessoSeVazio(client, escritorioId, casoId, processo);

  await registrarAuditoriaLexGestor({
    current,
    acao: "processo.vinculado_caso",
    entidade: "lex_processos",
    entidadeId: processoId,
    detalhes: { casoId, clienteId: processoClienteId, numeroCnj: text(processo.numero_cnj) },
  });

  redirect(`/lexgestor/processos/${processoId}?status=processo-vinculado-caso`);
}

export async function criarCasoAPartirProcessoLexGestor(formData: FormData) {
  const processoId = required(formData, "processo_id");
  const current = await requireAppAccess("lexgestor", `/lexgestor/processos/${processoId}`);
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = text(escritorio?.id);

  if (!escritorioId) {
    redirect(`/lexgestor/processos/${processoId}?erro=configure-escritorio`);
  }

  const processoResult = await client
    .from("lex_processos")
    .select("*,lex_clientes(id,nome)")
    .eq("id", processoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (processoResult.error || !processoResult.data?.id) {
    redirect(`/lexgestor/processos/${processoId}?erro=processo-invalido`);
  }

  const processo = processoResult.data as Record<string, unknown>;
  const clienteId = text(processo.cliente_id);
  if (!clienteId || !(await belongsToOffice(client, "lex_clientes", clienteId, escritorioId))) {
    redirect(`/lexgestor/processos/${processoId}?erro=cliente-invalido`);
  }

  if (text(processo.caso_id)) {
    redirect(`/lexgestor/processos/${processoId}?status=processo-ja-vinculado`);
  }

  const plano = await obterPlanoLexGestor(client, current);
  const casosAtivos = await countRows(client, "lex_casos", escritorioId, { statusNotIn: ["Finalizado", "Arquivado"] });
  const limitCheck = checarLimiteLexGestor(
    plano,
    { advogados: 0, clientes: 0, casosAtivos, documentos: 0 },
    "casosAtivos",
  );

  if (!limitCheck.allowed) {
    redirect(`/lexgestor/processos/${processoId}?erro=${encodeURIComponent(limitCheck.message)}`);
  }

  const cliente = relationObject(processo.lex_clientes);
  const clienteNome = text(cliente?.nome) || "Cliente";
  const categoria = text(processo.categoria) || inferirCategoriaProcessual(text(processo.classe_nome)) || "Civil";
  const subcategoria = text(processo.subcategoria) || text(processo.classe_nome) || "Processo judicial";
  const advogadoResponsavelId = await resolveAdvogadoAtual(client, escritorioId, current.usuario.id);
  const titulo = montarTituloCaso(processo, clienteNome);
  const now = new Date().toISOString();

  const payload = {
    escritorio_id: escritorioId,
    cliente_id: clienteId,
    titulo,
    area: categoria,
    subarea: subcategoria,
    categoria_nome: categoria,
    subcategoria_nome: subcategoria,
    status: "Em andamento",
    prioridade: "Normal",
    relato_inicial: text(processo.observacoes) || null,
    numero_processo: text(processo.numero_cnj) || null,
    chave_processo: text(processo.chave_eproc_opcional) || null,
    sistema_judicial: text(processo.sistema_judicial) || text(processo.sistema_nome) || null,
    tribunal: text(processo.tribunal) || null,
    vara: text(processo.orgao_julgador_nome) || null,
    classe_processual: text(processo.classe_nome) || null,
    assunto: text(processo.categoria) || categoria,
    fase_processual: "Em andamento",
    grau: text(processo.grau) || null,
    advogado_responsavel_id: advogadoResponsavelId,
    valor_causa: null,
    justica_gratuita: false,
    segredo_justica: Boolean(processo.segredo_justica),
    data_distribuicao: dateOnly(processo.data_ajuizamento),
    link_processo: text(processo.url_eproc) || null,
    observacoes_processo: `Caso criado automaticamente a partir do processo ${text(processo.numero_cnj) || processoId}.`,
    criado_em: now,
    updated_at: now,
  };

  const created = await client.from("lex_casos").insert(payload).select("id").single();
  if (created.error || !created.data?.id) {
    redirect(`/lexgestor/processos/${processoId}?erro=${encodeURIComponent(created.error?.message ?? "Nao foi possivel criar o caso.")}`);
  }

  const casoId = String(created.data.id);
  const updateProcesso = await client
    .from("lex_processos")
    .update({ caso_id: casoId, categoria, subcategoria, updated_at: now })
    .eq("id", processoId)
    .eq("escritorio_id", escritorioId);

  if (updateProcesso.error) {
    redirect(`/lexgestor/processos/${processoId}?erro=${encodeURIComponent(updateProcesso.error.message)}`);
  }

  await criarChecklistInicial(client, escritorioId, casoId, categoria, subcategoria);
  await atualizarDocumentosDoProcesso(client, escritorioId, processoId, casoId, clienteId);

  await registrarAuditoriaLexGestor({
    current,
    acao: "caso.criado_a_partir_processo",
    entidade: "lex_casos",
    entidadeId: casoId,
    detalhes: { processoId, numeroCnj: text(processo.numero_cnj), clienteId, titulo },
  });

  redirect(`/lexgestor/processos/${processoId}?status=caso-criado-vinculado`);
}

async function atualizarDocumentosDoProcesso(
  client: any,
  escritorioId: string,
  processoId: string,
  casoId: string,
  clienteId: string,
) {
  await client
    .from("lex_documentos")
    .update({ caso_id: casoId, cliente_id: clienteId })
    .eq("processo_id", processoId)
    .eq("escritorio_id", escritorioId);
}

async function preencherCasoComDadosDoProcessoSeVazio(
  client: any,
  escritorioId: string,
  casoId: string,
  processo: Record<string, unknown>,
) {
  const casoResult = await client
    .from("lex_casos")
    .select("numero_processo,sistema_judicial,tribunal,vara,classe_processual,assunto,grau,link_processo,updated_at")
    .eq("id", casoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (casoResult.error || !casoResult.data) return;

  const caso = casoResult.data as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  setIfEmpty(patch, caso, "numero_processo", text(processo.numero_cnj));
  setIfEmpty(patch, caso, "sistema_judicial", text(processo.sistema_judicial) || text(processo.sistema_nome));
  setIfEmpty(patch, caso, "tribunal", text(processo.tribunal));
  setIfEmpty(patch, caso, "vara", text(processo.orgao_julgador_nome));
  setIfEmpty(patch, caso, "classe_processual", text(processo.classe_nome));
  setIfEmpty(patch, caso, "assunto", text(processo.categoria));
  setIfEmpty(patch, caso, "grau", text(processo.grau));
  setIfEmpty(patch, caso, "link_processo", text(processo.url_eproc));

  if (Object.keys(patch).length <= 1) return;

  await client
    .from("lex_casos")
    .update(patch)
    .eq("id", casoId)
    .eq("escritorio_id", escritorioId);
}

function setIfEmpty(patch: Record<string, unknown>, current: Record<string, unknown>, key: string, nextValue: string) {
  if (!text(current[key]) && nextValue) {
    patch[key] = nextValue;
  }
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

function montarTituloCaso(processo: Record<string, unknown>, clienteNome: string) {
  const classe = text(processo.classe_nome) || "Processo judicial";
  const numero = text(processo.numero_cnj);
  const titulo = [classe, clienteNome].filter(Boolean).join(" - ");
  return numero ? `${titulo} (${numero})` : titulo;
}

function inferirCategoriaProcessual(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("criminal") || normalized.includes("penal")) return "Criminal";
  if (normalized.includes("familia") || normalized.includes("divorcio") || normalized.includes("alimentos")) return "Família";
  if (normalized.includes("trabalh")) return "Trabalhista";
  if (normalized.includes("previd")) return "Previdenciário";
  return "Civil";
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? relation as Record<string, unknown> : null;
}

function dateOnly(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function required(formData: FormData, key: string) {
  const result = value(formData, key);
  if (!result) {
    throw new Error(`Campo obrigatorio: ${key}`);
  }
  return result;
}

function value(formData: FormData | undefined, key: string) {
  return String(formData?.get(key) ?? "").trim();
}

function text(value: unknown) {
  return String(value ?? "").trim();
}
