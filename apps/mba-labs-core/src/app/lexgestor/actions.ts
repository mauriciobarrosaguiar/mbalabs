"use server";

import { redirect } from "next/navigation";
import { obterChecklistPorAreaSubarea } from "@/lib/lexgestor/checklist";
import { ensureLexEscritorio, getLexSupabaseClient, storageProviderLabel } from "@/lib/lexgestor/data";
import { disconnectStorage, testStorageConnection } from "@/lib/lexgestor/storage";
import { requireAppAccess } from "@/lib/core-data";

export async function salvarClienteLexGestor(formData: FormData) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/clientes/novo");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    redirect("/lexgestor/clientes/novo?erro=configure-escritorio");
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

  redirect("/lexgestor/clientes?status=cliente-salvo");
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
    watermark_text: nullable(formData, "watermark_text"),
  };

  const result = escritorioId
    ? await client.from("lex_escritorios").update(payload).eq("id", escritorioId)
    : await client.from("lex_escritorios").insert({ ...payload, empresa_id: current.empresaId }).select("id").single();

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

  redirect("/lexgestor/configuracoes?status=configuracoes-salvas");
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

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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
