import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const STATE_ACTION = "estado_campo_v2";
const FINALIZED_ACTION = "operacao_finalizada";
const CONFIG_ACTION = "configuracao_empresa_v1";
const OS_ACTION = "ordem_servico";
const MAX_STATE_BYTES = 220_000;

type StoredState = Record<string, unknown>;
type CompanySettings = {
  insightsObrigatorios: boolean;
  margemPreventiva: number;
  exigirConfirmacao: boolean;
  protocoloBordaduraCigarrinha: boolean;
  bloquearMargemPreventiva: boolean;
};

type ApiContext = {
  usuario: { id: string; tipo: string; nome?: string | null };
  empresaId: string | null;
};

const defaultSettings: CompanySettings = {
  insightsObrigatorios: true,
  margemPreventiva: 90,
  exigirConfirmacao: true,
  protocoloBordaduraCigarrinha: false,
  bloquearMargemPreventiva: true
};

function normalizeType(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}

async function getContext(): Promise<{ current: ApiContext | null; response: NextResponse | null }> {
  const context = await getSessionProfile();
  if (!context.user || !context.profile) {
    return { current: null, response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };
  }

  const admin = ["super_admin", "admin_master"].includes(context.profile.tipo);
  const appAllowed = (context.appsLiberados ?? []).some((app) => app.slug === "dronegestor" && app.canAccess);
  if (!admin && !appAllowed) {
    return { current: null, response: NextResponse.json({ ok: false, error: "Acesso ao DroneGestor não liberado." }, { status: 403 }) };
  }

  return {
    current: {
      usuario: { id: context.profile.id, tipo: context.profile.tipo, nome: context.profile.nome },
      empresaId: context.profile.empresa_id
    },
    response: null
  };
}

function validateState(value: unknown): StoredState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Estado da operação inválido.");
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) throw new Error("Estado da operação excedeu o limite de sincronização.");
  return value as StoredState;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function booleanRecordComplete(value: unknown) {
  const record = objectValue(value);
  const values = Object.values(record);
  return values.length > 0 && values.every((item) => item === true);
}

function scopeQuery(query: any, current: ApiContext) {
  return current.empresaId ? query.eq("empresa_id", current.empresaId) : query.eq("usuario_id", current.usuario.id);
}

function applyHistoryScope(query: any, current: ApiContext) {
  const normalized = normalizeType(current.usuario.tipo);
  const companyManager = ["admin_empresa", "super_admin", "admin_master", "responsavel_tecnico", "rt"].includes(normalized);
  if (companyManager && current.empresaId) return query.eq("empresa_id", current.empresaId);
  return query.eq("usuario_id", current.usuario.id);
}

function sanitizeSettings(value: unknown): CompanySettings {
  const source = objectValue(value);
  const margin = Number(source.margemPreventiva);
  return {
    insightsObrigatorios: source.insightsObrigatorios !== false,
    margemPreventiva: Number.isFinite(margin) ? Math.max(0, Math.min(5000, margin)) : defaultSettings.margemPreventiva,
    exigirConfirmacao: source.exigirConfirmacao !== false,
    protocoloBordaduraCigarrinha: source.protocoloBordaduraCigarrinha === true,
    bloquearMargemPreventiva: source.bloquearMargemPreventiva !== false
  };
}

async function loadCompanySettings(admin: any, current: ApiContext) {
  let query = admin
    .from("core_logs")
    .select("detalhes,created_at")
    .eq("app_slug", "dronegestor")
    .eq("acao", CONFIG_ACTION)
    .order("created_at", { ascending: false })
    .limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  const raw = data?.detalhes && typeof data.detalhes === "object" ? (data.detalhes as any).settings : null;
  return { settings: sanitizeSettings(raw), updatedAt: data?.created_at ?? null };
}

function buildOperationSummary(state: StoredState, pilotName: string, settings: CompanySettings) {
  const mission = objectValue(state.mission);
  const weather = objectValue(state.weather);
  const products = Array.isArray(mission.produtos) ? mission.produtos : [];
  const occurrences = Array.isArray(state.occurrences) ? state.occurrences : [];
  const tankRecords = Array.isArray(state.tankRecords) ? state.tankRecords : [];
  const areaHa = numberValue(mission.area);
  const volumeLHa = numberValue(mission.volume);
  const progressHa = Math.max(0, numberValue(state.progressHa));
  const totalCaldaRealL = tankRecords.reduce((sum, item) => sum + Math.max(0, numberValue(objectValue(item).volumeL)), 0);
  const latitude = nullableNumber(weather.latitude);
  const longitude = nullableNumber(weather.longitude);

  return {
    piloto: pilotName,
    ordemServicoId: textValue(mission.ordemServicoId),
    ordemServicoNumero: textValue(mission.ordemServicoNumero),
    clienteId: textValue(mission.clienteId),
    clienteNome: textValue(mission.clienteNome),
    fazendaId: textValue(mission.fazendaId),
    fazendaNome: textValue(mission.fazendaNome),
    municipio: textValue(mission.municipio),
    uf: textValue(mission.uf),
    talhaoId: textValue(mission.talhaoId),
    talhaoNome: textValue(mission.talhaoNome),
    cultura: textValue(mission.cultura),
    alvo: textValue(mission.alvo),
    tipoAtividade: textValue(mission.tipoAtividade),
    areaHa,
    areaConcluidaHa: Math.min(areaHa, progressHa),
    drone: textValue(mission.drone),
    registroAnac: textValue(mission.registroAnac),
    pontaModelo: textValue(mission.pontaModelo),
    volumeLHa,
    totalCaldaL: areaHa * volumeLHa,
    totalCaldaRealL,
    faixaM: numberValue(mission.faixa),
    velocidadeKmh: numberValue(mission.velocidadeKmh),
    alturaM: numberValue(mission.alturaM),
    sarpasNumero: textValue(mission.sarpasNumero),
    sarpasSituacao: textValue(mission.sarpasSituacao),
    sarpasConfirmado: mission.sarpasConfirmado === true,
    climaCampoConfirmado: mission.climaCampoConfirmado === true,
    climaCampoMedidoEm: textValue(mission.climaCampoMedidoEm),
    climaCampo: {
      ventoKmh: nullableNumber(mission.ventoCampoKmh),
      direcaoVento: textValue(mission.direcaoVentoCampo),
      temperaturaC: nullableNumber(mission.temperaturaCampo),
      umidadePct: nullableNumber(mission.umidadeCampo)
    },
    areaSensivel: {
      semAreaSensivel: mission.semAreaSensivel === true,
      distanciaM: nullableNumber(mission.distanciaSensivel),
      margemPreventivaM: settings.margemPreventiva,
      bloqueioMargemAtivo: settings.bloquearMargemPreventiva
    },
    gps: {
      latitude,
      longitude,
      capturadoEm: textValue(weather.capturedAt),
      disponivel: latitude !== null && longitude !== null
    },
    produtos: products.map((item) => {
      const product = objectValue(item);
      return { nome: textValue(product.nome), dose: numberValue(product.dose), unidade: textValue(product.unidade) };
    }),
    tanques: tankRecords,
    calibracaoConcluida: booleanRecordComplete(state.calibration),
    checklistConcluido: booleanRecordComplete(state.checklist),
    insightConfirmado: state.insightAccepted === true,
    riscoConfirmado: state.riskAccepted === true,
    iniciadaEm: textValue(state.startedAt),
    finalizadaEm: textValue(state.endedAt),
    ocorrencias: occurrences,
    totalOcorrencias: occurrences.length
  };
}

function validateFinalization(summary: ReturnType<typeof buildOperationSummary>, state: StoredState, settings: CompanySettings) {
  if (summary.areaHa <= 0) throw new Error("Área planejada inválida.");
  if (summary.areaConcluidaHa < summary.areaHa - 0.01) {
    throw new Error(`A operação não pode ser concluída: ${summary.areaConcluidaHa.toFixed(2)} ha registrados de ${summary.areaHa.toFixed(2)} ha planejados.`);
  }
  if (!summary.cultura || !summary.alvo || !summary.drone || !summary.tipoAtividade) throw new Error("Cultura, alvo, drone e tipo de atividade são obrigatórios para a conclusão.");
  if (!summary.registroAnac) throw new Error("Informe a identificação/registro ANAC da aeronave.");
  if (!summary.pontaModelo) throw new Error("Informe o tipo/modelo da ponta, bico ou atomizador utilizado.");
  if (summary.volumeLHa <= 0 || summary.faixaM <= 0 || summary.velocidadeKmh <= 0 || summary.alturaM <= 0) throw new Error("Volume, faixa, velocidade e altura precisam ser válidos antes da conclusão.");
  if (!summary.produtos.length || summary.produtos.some((product) => !product.nome || product.dose <= 0 || !product.unidade)) throw new Error("Todos os produtos adicionados precisam ter nome, dose e unidade válidos.");

  const vento = summary.climaCampo.ventoKmh;
  const temperatura = summary.climaCampo.temperaturaC;
  const umidade = summary.climaCampo.umidadePct;
  if (!summary.climaCampoConfirmado || !summary.climaCampoMedidoEm || !summary.climaCampo.direcaoVento || vento === null || temperatura === null || umidade === null) {
    throw new Error("A medição climática de campo precisa estar completa e confirmada.");
  }
  if (vento < 0 || vento > 100) throw new Error("Velocidade do vento fora da faixa de validação do sistema.");
  if (temperatura < -20 || temperatura > 60) throw new Error("Temperatura de campo fora da faixa de validação do sistema.");
  if (umidade <= 0 || umidade > 100) throw new Error("Umidade relativa deve estar entre 1% e 100%.");

  if (!summary.areaSensivel.semAreaSensivel) {
    if (summary.areaSensivel.distanciaM === null || summary.areaSensivel.distanciaM <= 0) throw new Error("Informe a distância da área sensível ou confirme que nenhuma área sensível aplicável foi identificada.");
    if (settings.bloquearMargemPreventiva && summary.areaSensivel.distanciaM < settings.margemPreventiva) {
      throw new Error(`A operação está dentro da margem preventiva interna: ${summary.areaSensivel.distanciaM.toFixed(1)} m informados para ${settings.margemPreventiva.toFixed(1)} m exigidos pela empresa.`);
    }
  }

  if (settings.insightsObrigatorios && !summary.insightConfirmado) throw new Error("A confirmação do protocolo/insight obrigatório está pendente.");
  if (settings.exigirConfirmacao && !summary.riscoConfirmado) throw new Error("A confirmação de risco obrigatória está pendente.");
  if (!summary.gps.disponivel) throw new Error("Registre o ponto GPS da operação antes da conclusão.");
  if (!summary.iniciadaEm || !summary.finalizadaEm) throw new Error("Horários reais de início e término precisam estar registrados.");
  if (!summary.calibracaoConcluida) throw new Error("Calibração incompleta.");
  if (!summary.checklistConcluido) throw new Error("Checklist pré-voo incompleto.");
  if (!summary.sarpasConfirmado || !summary.sarpasSituacao) throw new Error("A situação SARPAS precisa estar conferida.");
  if (summary.sarpasSituacao === "autorizado" && !summary.sarpasNumero) throw new Error("Informe a referência SARPAS da operação autorizada.");
  if (state.concluida !== true) throw new Error("A operação não foi marcada como concluída no dispositivo.");
}

async function ensureOrderConcluded(admin: any, current: ApiContext, osId: string, operationId: string) {
  if (!osId) return { ok: true, skipped: true };
  let query = admin
    .from("core_logs")
    .select("id,detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", OS_ACTION)
    .contains("detalhes", { entityId: osId })
    .limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data || data.detalhes?.ativo === false) throw new Error("A OS vinculada não foi encontrada ou está inativa.");

  const details = data.detalhes ?? {};
  const osData = details.data ?? {};
  if (osData.status === "cancelada") throw new Error("A OS vinculada está cancelada e não pode ser concluída.");
  if (osData.status === "concluida") return { ok: true, already: true };

  const nextDetails = {
    ...details,
    updatedAt: new Date().toISOString(),
    data: {
      ...osData,
      status: "concluida",
      concluidaEm: new Date().toISOString(),
      operacaoId: operationId,
      pilotoId: osData.pilotoId || current.usuario.id,
      pilotoNome: osData.pilotoNome || current.usuario.nome || "Piloto"
    }
  };
  const { error: updateError } = await admin.from("core_logs").update({ detalhes: nextDetails }).eq("id", data.id);
  if (updateError) throw updateError;
  return { ok: true };
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const admin = createSupabaseAdminClient() as any;
    const history = request.nextUrl.searchParams.get("history") === "1";

    if (history) {
      const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 200);
      const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 200));
      const requestedOffset = Number(request.nextUrl.searchParams.get("offset") || 0);
      const offset = Math.max(0, Number.isFinite(requestedOffset) ? requestedOffset : 0);
      let query = admin
        .from("core_logs")
        .select("id,usuario_id,empresa_id,detalhes,created_at")
        .eq("app_slug", "dronegestor")
        .eq("acao", FINALIZED_ACTION)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit);
      const start = textValue(request.nextUrl.searchParams.get("start"));
      const end = textValue(request.nextUrl.searchParams.get("end"));
      if (start) query = query.gte("created_at", start);
      if (end) query = query.lte("created_at", end);
      query = applyHistoryScope(query, current);
      const { data, error } = await query;
      if (error) throw error;
      const items = data ?? [];
      return NextResponse.json({ ok: true, items: items.slice(0, limit), hasMore: items.length > limit, nextOffset: items.length > limit ? offset + limit : null });
    }

    const { data, error } = await admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("usuario_id", current.usuario.id)
      .eq("app_slug", "dronegestor")
      .eq("acao", STATE_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const details = data?.detalhes && typeof data.detalhes === "object" ? data.detalhes as any : null;
    return NextResponse.json({
      ok: true,
      state: details?.state ?? null,
      revision: Number(details?.revision || 0),
      updatedAt: details?.updatedAt ?? data?.created_at ?? null
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar os dados do DroneGestor." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const body = await request.json();
    const state = validateState(body?.state);
    const baseRevision = Number(body?.baseRevision);
    if (!Number.isInteger(baseRevision) || baseRevision < 0) return NextResponse.json({ ok: false, error: "Revisão local inválida. Atualize a tela antes de sincronizar." }, { status: 400 });
    const admin = createSupabaseAdminClient() as any;

    const { data: existing, error: findError } = await admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("usuario_id", current.usuario.id)
      .eq("app_slug", "dronegestor")
      .eq("acao", STATE_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;

    const existingDetails = existing?.detalhes && typeof existing.detalhes === "object" ? existing.detalhes as any : null;
    const currentRevision = Number(existingDetails?.revision || 0);
    if ((existing && baseRevision !== currentRevision) || (!existing && baseRevision !== 0)) {
      return NextResponse.json({
        ok: false,
        conflict: true,
        revision: currentRevision,
        state: existingDetails?.state ?? null,
        updatedAt: existingDetails?.updatedAt ?? existing?.created_at ?? null,
        error: "O estado na nuvem mudou desde a última sincronização. Nenhum dado foi sobrescrito."
      }, { status: 409 });
    }

    const revision = currentRevision + 1;
    const updatedAt = new Date().toISOString();
    const detalhes = { state, revision, updatedAt, version: 4 };
    if (existing?.id) {
      const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("core_logs").insert({ empresa_id: current.empresaId, usuario_id: current.usuario.id, app_slug: "dronegestor", acao: STATE_ACTION, detalhes });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, revision, updatedAt });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao salvar os dados do DroneGestor." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const body = await request.json();
    const state = validateState(body?.state);
    const operationId = textValue(body?.operationId) || textValue(state.operationId) || crypto.randomUUID();
    const pilotName = textValue(body?.pilotName) || current.usuario.nome || "Piloto";
    const admin = createSupabaseAdminClient() as any;
    const finalizedAt = new Date().toISOString();
    const company = await loadCompanySettings(admin, current);
    const summary = buildOperationSummary(state, pilotName, company.settings);
    validateFinalization(summary, state, company.settings);

    const { data: existing, error: existingError } = await admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("usuario_id", current.usuario.id)
      .eq("app_slug", "dronegestor")
      .eq("acao", FINALIZED_ACTION)
      .contains("detalhes", { operationId })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      await ensureOrderConcluded(admin, current, summary.ordemServicoId, operationId);
      return NextResponse.json({ ok: true, duplicate: true, id: existing.id, operationId, osConcluida: true, finalizedAt: (existing.detalhes as any)?.finalizedAt ?? existing.created_at });
    }

    const detalhes = { operationId, finalizedAt, version: 6, settingsSnapshot: company.settings, summary, state };
    const { data, error } = await admin
      .from("core_logs")
      .insert({ empresa_id: current.empresaId, usuario_id: current.usuario.id, app_slug: "dronegestor", acao: FINALIZED_ACTION, detalhes })
      .select("id")
      .single();
    if (error) throw error;

    await ensureOrderConcluded(admin, current, summary.ordemServicoId, operationId);
    return NextResponse.json({ ok: true, id: data.id, operationId, osConcluida: true, finalizedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao finalizar a operação no Supabase.";
    const validationWords = ["não pode ser concluída", "obrigat", "incomplet", "precisa", "Informe", "margem preventiva", "fora da faixa", "Umidade", "GPS", "Horários", "pendente"];
    const status = validationWords.some((word) => message.includes(word)) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
