import crypto from "node:crypto";
import type { CurrentUserProfile } from "@/lib/core-data";
import { ensureLexEscritorio, getLexSupabaseClient } from "./data";

export type LexTribunalDataJud = {
  sigla: string;
  nome: string;
  aliasDatajud: string;
  segmento: string;
};

export type LexProcesso = {
  id: string;
  empresaId: string;
  escritorioId: string;
  advogadoId: string;
  clienteId: string;
  casoId: string;
  numeroCnj: string;
  numeroCnjLimpo: string;
  tribunal: string;
  tribunalAliasDatajud: string;
  grau: string;
  classeCodigo: string;
  classeNome: string;
  sistemaNome: string;
  formatoNome: string;
  orgaoJulgadorNome: string;
  orgaoJulgadorCodigo: string;
  dataAjuizamento: string;
  dataUltimaAtualizacaoDatajud: string;
  nivelSigilo: number | null;
  segredoJustica: boolean;
  chaveEprocOpcional: string;
  urlEproc: string;
  categoria: string;
  subcategoria: string;
  status: string;
  observacoes: string;
  possuiNovaMovimentacao: boolean;
  ultimaSincronizacao: string;
  createdAt: string;
  updatedAt: string;
  clienteNome: string;
  casoTitulo: string;
  ultimaMovimentacao: string;
  ultimaMovimentacaoData: string;
  movimentacoesCount: number;
};

export type LexMovimentacao = {
  id: string;
  processoId: string;
  codigoMovimento: string;
  nomeMovimento: string;
  descricao: string;
  eventoNumero: string;
  dataMovimento: string;
  hashMovimento: string;
  temDocumento: boolean;
  documentoStatus: string;
  visualizado: boolean;
};

export const tribunaisDataJudIniciais: LexTribunalDataJud[] = [
  { sigla: "TJTO", nome: "Tribunal de Justica do Tocantins", aliasDatajud: "api_publica_tjto", segmento: "estadual" },
  { sigla: "TRF1", nome: "Tribunal Regional Federal da 1 Regiao", aliasDatajud: "api_publica_trf1", segmento: "federal" },
  { sigla: "TRF2", nome: "Tribunal Regional Federal da 2 Regiao", aliasDatajud: "api_publica_trf2", segmento: "federal" },
  { sigla: "TRF3", nome: "Tribunal Regional Federal da 3 Regiao", aliasDatajud: "api_publica_trf3", segmento: "federal" },
  { sigla: "TRF4", nome: "Tribunal Regional Federal da 4 Regiao", aliasDatajud: "api_publica_trf4", segmento: "federal" },
  { sigla: "TRF5", nome: "Tribunal Regional Federal da 5 Regiao", aliasDatajud: "api_publica_trf5", segmento: "federal" },
  { sigla: "TRF6", nome: "Tribunal Regional Federal da 6 Regiao", aliasDatajud: "api_publica_trf6", segmento: "federal" },
  { sigla: "TRT10", nome: "Tribunal Regional do Trabalho da 10 Regiao", aliasDatajud: "api_publica_trt10", segmento: "trabalhista" },
  { sigla: "STJ", nome: "Superior Tribunal de Justica", aliasDatajud: "api_publica_stj", segmento: "superior" },
];

export function normalizarNumeroCnj(value: string) {
  return value.replace(/\D/g, "");
}

export function numeroCnjMinimoValido(value: string) {
  const clean = normalizarNumeroCnj(value);
  return clean.length >= 20 && clean.length <= 25;
}

export async function listTribunaisDataJud() {
  const client = await getLexSupabaseClient();
  const { data, error } = await client
    .from("lex_tribunais")
    .select("nome,sigla,alias_datajud,segmento")
    .eq("ativo", true)
    .order("sigla", { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) {
    return tribunaisDataJudIniciais;
  }

  return data.map((row: any) => ({
    sigla: text(row.sigla),
    nome: text(row.nome),
    aliasDatajud: text(row.alias_datajud),
    segmento: text(row.segmento),
  }));
}

export async function listProcessosLex(params: {
  current: CurrentUserProfile;
  escritorioId: string;
  filters?: {
    numero?: string;
    clienteId?: string;
    casoId?: string;
    tribunal?: string;
    grau?: string;
    status?: string;
  };
}) {
  if (!params.escritorioId) return [];
  const client = await getLexSupabaseClient();

  let query = client
    .from("lex_processos")
    .select("*,lex_clientes(id,nome),lex_casos(id,titulo)")
    .eq("escritorio_id", params.escritorioId)
    .order("updated_at", { ascending: false })
    .limit(300);

  const filters = params.filters ?? {};
  if (filters.numero) query = query.ilike("numero_cnj", `%${filters.numero}%`);
  if (filters.clienteId) query = query.eq("cliente_id", filters.clienteId);
  if (filters.casoId) query = query.eq("caso_id", filters.casoId);
  if (filters.tribunal) query = query.eq("tribunal", filters.tribunal);
  if (filters.grau) query = query.eq("grau", filters.grau);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const ids = rows.map((row) => text(row.id)).filter(Boolean);
  const movimentos = await listUltimasMovimentacoes(client, params.escritorioId, ids);
  const counts = await countMovimentacoes(client, params.escritorioId, ids);

  return rows.map((row) => mapProcesso(row, movimentos.get(text(row.id)), counts.get(text(row.id)) ?? 0));
}

export async function getProcessoLex(params: {
  current: CurrentUserProfile;
  escritorioId: string;
  processoId: string;
}) {
  if (!params.escritorioId) return null;
  const client = await getLexSupabaseClient();
  const { data, error } = await client
    .from("lex_processos")
    .select("*,lex_clientes(id,nome),lex_casos(id,titulo)")
    .eq("id", params.processoId)
    .eq("escritorio_id", params.escritorioId)
    .maybeSingle();

  if (error || !data) return null;

  const movimentos = await listMovimentacoesProcesso({
    current: params.current,
    escritorioId: params.escritorioId,
    processoId: params.processoId,
  });

  const latest = movimentos[0];
  return {
    processo: mapProcesso(data as Record<string, unknown>, latest, movimentos.length),
    movimentacoes: movimentos,
  };
}

export async function listMovimentacoesProcesso(params: {
  current: CurrentUserProfile;
  escritorioId: string;
  processoId: string;
}) {
  if (!params.escritorioId || !params.processoId) return [];
  const client = await getLexSupabaseClient();
  const { data, error } = await client
    .from("lex_movimentacoes")
    .select("*")
    .eq("escritorio_id", params.escritorioId)
    .eq("processo_id", params.processoId)
    .order("data_movimento", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) throw error;
  return (data ?? []).map(mapMovimentacao);
}

export async function syncProcessoDataJud(params: {
  processoId: string;
  current: CurrentUserProfile;
}) {
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, params.current);
  const escritorioId = text(escritorio?.id);

  if (!escritorioId) {
    throw new Error("Configure o escritorio antes de consultar o DataJud.");
  }

  const processoResult = await client
    .from("lex_processos")
    .select("*")
    .eq("id", params.processoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (processoResult.error) throw processoResult.error;
  const processo = processoResult.data as Record<string, unknown> | null;

  if (!processo) {
    throw new Error("Processo nao encontrado para este escritorio.");
  }

  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) {
    await registrarLogIntegracao(client, params.current, escritorioId, params.processoId, "datajud.sync", "erro", "DATAJUD_API_KEY nao configurada.");
    throw new Error("Configure DATAJUD_API_KEY na Vercel antes de consultar o DataJud.");
  }

  const alias = text(processo.tribunal_alias_datajud);
  if (!alias) {
    throw new Error("Informe o alias DataJud do tribunal antes de sincronizar.");
  }

  const numeroCnjLimpo = normalizarNumeroCnj(text(processo.numero_cnj_limpo) || text(processo.numero_cnj));
  const endpoint = `https://api-publica.datajud.cnj.jus.br/${encodeURIComponent(alias)}/_search`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `APIKey ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: {
          match: {
            numeroProcesso: numeroCnjLimpo,
          },
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = text(payload.error?.reason) || text(payload.message) || "Falha ao consultar DataJud.";
      await registrarLogIntegracao(client, params.current, escritorioId, params.processoId, "datajud.sync", "erro", message, {
        status: response.status,
        alias,
      });
      throw new Error(message);
    }

    const source = getFirstHitSource(payload);
    const now = new Date().toISOString();

    if (!source) {
      await client
        .from("lex_processos")
        .update({
          ultima_sincronizacao: now,
          updated_at: now,
        })
        .eq("id", params.processoId)
        .eq("escritorio_id", escritorioId);

      await registrarLogIntegracao(client, params.current, escritorioId, params.processoId, "datajud.sync", "nao_encontrado", null, { alias, numeroCnjLimpo });
      return {
        found: false,
        insertedMovements: 0,
        message: "Processo cadastrado, mas nao localizado no DataJud neste momento.",
      };
    }

    const capa = mapCapaDataJud(source);
    await client
      .from("lex_processos")
      .update({
        ...capa,
        numero_cnj_limpo: numeroCnjLimpo,
        raw_json: source,
        ultima_sincronizacao: now,
        updated_at: now,
      })
      .eq("id", params.processoId)
      .eq("escritorio_id", escritorioId);

    const movements = normalizeMovimentos(source.movimentos).map((movimento) => ({
      processo_id: params.processoId,
      empresa_id: params.current.empresaId,
      escritorio_id: escritorioId,
      advogado_id: text(processo.advogado_id) || null,
      cliente_id: text(processo.cliente_id) || null,
      caso_id: text(processo.caso_id) || null,
      codigo_movimento: movimento.codigo,
      nome_movimento: movimento.nome,
      descricao: movimento.descricao,
      evento_numero: movimento.eventoNumero,
      data_movimento: movimento.dataMovimento || null,
      hash_movimento: movimentoHash(params.processoId, movimento),
      raw_json: movimento.raw,
      documento_status: "sem_documento",
      visualizado: false,
    }));

    const insertedMovements = await insertMovimentacoesSemDuplicar(client, escritorioId, movements);

    if (insertedMovements > 0) {
      await client
        .from("lex_processos")
        .update({ possui_nova_movimentacao: true, updated_at: now })
        .eq("id", params.processoId)
        .eq("escritorio_id", escritorioId);
    }

    await registrarLogIntegracao(client, params.current, escritorioId, params.processoId, "datajud.sync", "sucesso", null, {
      alias,
      numeroCnjLimpo,
      movimentacoesNovas: insertedMovements,
    });

    return {
      found: true,
      insertedMovements,
      message: insertedMovements > 0 ? "Eventos atualizados com novas movimentacoes." : "Eventos atualizados. Nenhuma movimentacao nova.",
    };
  } catch (error) {
    await registrarLogIntegracao(
      client,
      params.current,
      escritorioId,
      params.processoId,
      "datajud.sync",
      "erro",
      errorMessage(error),
      { alias, numeroCnjLimpo },
    );
    throw error;
  }
}

export async function registrarLogIntegracao(
  client: any,
  current: CurrentUserProfile,
  escritorioId: string,
  processoId: string | null,
  acao: string,
  status: string,
  erro?: string | null,
  detalhes?: Record<string, unknown>,
) {
  await client.from("lex_logs_integracao").insert({
    empresa_id: current.empresaId,
    escritorio_id: escritorioId || null,
    usuario_id: current.usuario.id,
    processo_id: processoId,
    acao,
    status,
    erro: erro || null,
    detalhes: detalhes ?? null,
  });
}

function mapProcesso(row: Record<string, unknown>, latest?: LexMovimentacao, movimentacoesCount = 0): LexProcesso {
  const cliente = relationObject(row.lex_clientes);
  const caso = relationObject(row.lex_casos);

  return {
    id: text(row.id),
    empresaId: text(row.empresa_id),
    escritorioId: text(row.escritorio_id),
    advogadoId: text(row.advogado_id),
    clienteId: text(row.cliente_id),
    casoId: text(row.caso_id),
    numeroCnj: text(row.numero_cnj),
    numeroCnjLimpo: text(row.numero_cnj_limpo),
    tribunal: text(row.tribunal),
    tribunalAliasDatajud: text(row.tribunal_alias_datajud),
    grau: text(row.grau),
    classeCodigo: text(row.classe_codigo),
    classeNome: text(row.classe_nome),
    sistemaNome: text(row.sistema_nome),
    formatoNome: text(row.formato_nome),
    orgaoJulgadorNome: text(row.orgao_julgador_nome),
    orgaoJulgadorCodigo: text(row.orgao_julgador_codigo),
    dataAjuizamento: text(row.data_ajuizamento),
    dataUltimaAtualizacaoDatajud: text(row.data_ultima_atualizacao_datajud),
    nivelSigilo: row.nivel_sigilo === null || row.nivel_sigilo === undefined ? null : Number(row.nivel_sigilo),
    segredoJustica: Boolean(row.segredo_justica),
    chaveEprocOpcional: text(row.chave_eproc_opcional),
    urlEproc: text(row.url_eproc),
    categoria: text(row.categoria),
    subcategoria: text(row.subcategoria),
    status: text(row.status) || "ativo",
    observacoes: text(row.observacoes),
    possuiNovaMovimentacao: Boolean(row.possui_nova_movimentacao),
    ultimaSincronizacao: text(row.ultima_sincronizacao),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    clienteNome: text(cliente?.nome) || "-",
    casoTitulo: text(caso?.titulo) || "",
    ultimaMovimentacao: latest?.nomeMovimento || latest?.descricao || "",
    ultimaMovimentacaoData: latest?.dataMovimento || "",
    movimentacoesCount,
  };
}

function mapMovimentacao(row: Record<string, unknown>): LexMovimentacao {
  return {
    id: text(row.id),
    processoId: text(row.processo_id),
    codigoMovimento: text(row.codigo_movimento),
    nomeMovimento: text(row.nome_movimento),
    descricao: text(row.descricao),
    eventoNumero: text(row.evento_numero),
    dataMovimento: text(row.data_movimento),
    hashMovimento: text(row.hash_movimento),
    temDocumento: Boolean(row.tem_documento),
    documentoStatus: text(row.documento_status) || "sem_documento",
    visualizado: Boolean(row.visualizado),
  };
}

async function listUltimasMovimentacoes(client: any, escritorioId: string, processoIds: string[]) {
  const result = new Map<string, LexMovimentacao>();
  if (processoIds.length === 0) return result;

  const { data } = await client
    .from("lex_movimentacoes")
    .select("*")
    .eq("escritorio_id", escritorioId)
    .in("processo_id", processoIds)
    .order("data_movimento", { ascending: false, nullsFirst: false })
    .limit(1000);

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const processoId = text(row.processo_id);
    if (!result.has(processoId)) {
      result.set(processoId, mapMovimentacao(row));
    }
  }

  return result;
}

async function countMovimentacoes(client: any, escritorioId: string, processoIds: string[]) {
  const result = new Map<string, number>();
  if (processoIds.length === 0) return result;

  const { data } = await client
    .from("lex_movimentacoes")
    .select("processo_id")
    .eq("escritorio_id", escritorioId)
    .in("processo_id", processoIds);

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const processoId = text(row.processo_id);
    result.set(processoId, (result.get(processoId) ?? 0) + 1);
  }

  return result;
}

function getFirstHitSource(payload: any) {
  const hit = payload?.hits?.hits?.[0];
  return hit?._source && typeof hit._source === "object" ? hit._source as Record<string, any> : null;
}

function mapCapaDataJud(source: Record<string, any>) {
  return {
    classe_codigo: text(source.classe?.codigo),
    classe_nome: text(source.classe?.nome),
    sistema_nome: text(source.sistema?.nome),
    formato_nome: text(source.formato?.nome),
    orgao_julgador_nome: text(source.orgaoJulgador?.nome),
    orgao_julgador_codigo: text(source.orgaoJulgador?.codigo),
    data_ajuizamento: dateOrNull(source.dataAjuizamento),
    data_ultima_atualizacao_datajud: dateOrNull(source.dataHoraUltimaAtualizacao),
    nivel_sigilo: Number.isFinite(Number(source.nivelSigilo)) ? Number(source.nivelSigilo) : null,
    segredo_justica: Number(source.nivelSigilo ?? 0) > 0,
  };
}

function normalizeMovimentos(value: unknown) {
  const rows = Array.isArray(value) ? value : [];

  return rows.map((row: any, index) => {
    const complements = Array.isArray(row.complementosTabelados)
      ? row.complementosTabelados.map((item: any) => [item.nome, item.descricao].map(text).filter(Boolean).join(": ")).filter(Boolean)
      : [];
    const descricao = [
      text(row.descricao),
      text(row.complemento),
      ...complements,
    ].filter(Boolean).join(" | ");

    return {
      codigo: text(row.codigo) || text(row.movimentoNacional?.codigo),
      nome: text(row.nome) || text(row.movimentoNacional?.nome) || "Movimentacao",
      descricao,
      eventoNumero: text(row.numeroEvento) || extractEventoNumber(descricao) || String(index + 1),
      dataMovimento: dateOrNull(row.dataHora) || dateOrNull(row.dataMovimento) || null,
      raw: row,
    };
  });
}

async function insertMovimentacoesSemDuplicar(client: any, escritorioId: string, movements: Array<Record<string, unknown>>) {
  if (movements.length === 0) return 0;

  const hashes = movements.map((row) => text(row.hash_movimento)).filter(Boolean);
  const existing = hashes.length > 0
    ? await client
        .from("lex_movimentacoes")
        .select("hash_movimento")
        .eq("escritorio_id", escritorioId)
        .in("hash_movimento", hashes)
    : { data: [] };

  const existingHashes = new Set(((existing.data ?? []) as Array<Record<string, unknown>>).map((row) => text(row.hash_movimento)));
  const missing = movements.filter((row) => !existingHashes.has(text(row.hash_movimento)));
  if (missing.length === 0) return 0;

  const { error } = await client.from("lex_movimentacoes").insert(missing);
  if (error) throw error;
  return missing.length;
}

function movimentoHash(processoId: string, movimento: { codigo: string; nome: string; descricao: string; eventoNumero: string; dataMovimento: string | null }) {
  return crypto
    .createHash("sha256")
    .update([processoId, movimento.dataMovimento, movimento.codigo, movimento.nome, movimento.descricao, movimento.eventoNumero].join("|"))
    .digest("hex");
}

function extractEventoNumber(value: string) {
  const match = value.match(/\bevento\s+(\d+)/i) || value.match(/\bev\.\s*(\d+)/i);
  return match?.[1] ?? "";
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? relation as Record<string, unknown> : null;
}

function dateOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao consultar DataJud.";
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
