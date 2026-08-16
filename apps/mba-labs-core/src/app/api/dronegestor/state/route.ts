import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { droneGestorRole } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import {
  DroneOsAccessError,
  droneOsErrorResponse,
  requireDroneOsAccess,
} from "@/lib/dronegestor-os-access";

export const dynamic = "force-dynamic";

const STATE_ACTION = "estado_campo_v2";
const FINALIZED_ACTION = "operacao_finalizada";
const CONFIG_ACTION = "configuracao_empresa_v1";
const OS_EVENT_ACTION = "ordem_servico_evento";
const PILOT_ACTION = "piloto_operacional_v1";
const DOC_ACTION = "documento_operacao_v1";
const SARPAS_ACTION = "sarpas_operacao_v1";
const MAX_STATE_BYTES = 220_000;

type StoredState = Record<string, unknown>;
type ApiContext = {
  usuario: { id: string; tipo: string; nome?: string | null };
  empresaId: string | null;
};
type Settings = {
  insightsObrigatorios: boolean;
  margemPreventiva: number;
  bloquearMargemPreventiva: boolean;
  exigirConfirmacao: boolean;
  protocoloBordaduraCigarrinha: boolean;
};

const defaultSettings: Settings = {
  insightsObrigatorios: true,
  margemPreventiva: 90,
  bloquearMargemPreventiva: true,
  exigirConfirmacao: true,
  protocoloBordaduraCigarrinha: false,
};

function normalizeType(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "_");
}
function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  const values = Object.values(objectValue(value));
  return values.length > 0 && values.every((item) => item === true);
}
function validateState(value: unknown): StoredState {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Estado da operação inválido.");
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_STATE_BYTES)
    throw new Error("Estado da operação excedeu o limite de sincronização.");
  return value as StoredState;
}
function storedRevision(row: any) {
  if (!row) return 0;
  const parsed = Number(row?.detalhes?.revision);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}
function companyHistoryRole(current: ApiContext) {
  return ["admin_empresa", "gestor_operacional", "responsavel_tecnico", "rt", "super_admin", "admin_master"].includes(
    normalizeType(current.usuario.tipo),
  );
}
function accessContext(current: ApiContext) {
  return {
    userId: current.usuario.id,
    empresaId: current.empresaId,
    canManage: companyHistoryRole(current),
  };
}
function finalizedOsId(row: any) {
  const details = objectValue(row?.detalhes);
  const summary = objectValue(details.summary);
  const state = objectValue(details.state);
  return textValue(summary.ordemServicoId) || textValue(objectValue(state.mission).ordemServicoId);
}

async function getContext(): Promise<{ current: ApiContext | null; response: NextResponse | null }> {
  const context = await getSessionProfile();
  if (!context.user || !context.profile)
    return {
      current: null,
      response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }),
    };
  const admin = ["super_admin", "admin_master"].includes(normalizeType(context.profile.tipo));
  const allowed = (context.appsLiberados ?? []).some(
    (app) => app.slug === "dronegestor" && app.canAccess,
  );
  if (!admin && !allowed)
    return {
      current: null,
      response: NextResponse.json(
        { ok: false, error: "Acesso ao DroneGestor não liberado." },
        { status: 403 },
      ),
    };
  const roleInput = { tipo: context.profile.tipo, isAdminMaster: admin, permissoes: context.permissoes };
  return {
    current: {
      usuario: {
        id: context.profile.id,
        tipo: droneGestorRole(roleInput),
        nome: context.profile.nome,
      },
      empresaId: context.profile.empresa_id,
    },
    response: null,
  };
}

function scopeQuery(query: any, current: ApiContext) {
  return current.empresaId
    ? query.eq("empresa_id", current.empresaId)
    : query.eq("usuario_id", current.usuario.id);
}

async function loadSettings(admin: any, current: ApiContext): Promise<Settings> {
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
  const raw = data?.detalhes?.settings ?? {};
  const margin = Number(raw.margemPreventiva);
  return {
    insightsObrigatorios: raw.insightsObrigatorios !== false,
    margemPreventiva: Number.isFinite(margin)
      ? Math.max(0, Math.min(5000, margin))
      : defaultSettings.margemPreventiva,
    bloquearMargemPreventiva: raw.bloquearMargemPreventiva !== false,
    exigirConfirmacao: raw.exigirConfirmacao !== false,
    protocoloBordaduraCigarrinha: raw.protocoloBordaduraCigarrinha === true,
  };
}

function buildOperationSummary(state: StoredState, pilotName: string, settings: Settings) {
  const mission = objectValue(state.mission);
  const weather = objectValue(state.weather);
  const products = Array.isArray(mission.produtos) ? mission.produtos : [];
  const occurrences = Array.isArray(state.occurrences) ? state.occurrences : [];
  const tankRecords = Array.isArray(state.tankRecords) ? state.tankRecords : [];
  const areaHa = numberValue(mission.area);
  const volumeLHa = numberValue(mission.volume);
  const progressHa = Math.max(0, numberValue(state.progressHa));
  const latitude = nullableNumber(weather.latitude);
  const longitude = nullableNumber(weather.longitude);
  const totalCaldaRealL = tankRecords.reduce(
    (sum, item) => sum + Math.max(0, numberValue(objectValue(item).volumeL)),
    0,
  );
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
    registroAnac: textValue(mission.registroAnac) || textValue(mission.identificacaoAnac),
    pontaModelo: textValue(mission.pontaModelo) || textValue(mission.pontaPulverizacao),
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
      umidadePct: nullableNumber(mission.umidadeCampo),
    },
    areaSensivel: {
      semAreaSensivel: mission.semAreaSensivel === true,
      distanciaM: nullableNumber(mission.distanciaSensivel),
      margemPreventivaM: settings.margemPreventiva,
      bloqueioMargemAtivo: settings.bloquearMargemPreventiva,
    },
    gps: {
      latitude,
      longitude,
      capturadoEm: textValue(weather.capturedAt),
      disponivel: latitude !== null && longitude !== null,
    },
    produtos: products.map((item) => {
      const p = objectValue(item);
      return {
        nome: textValue(p.nome),
        dose: numberValue(p.dose),
        unidade: textValue(p.unidade),
      };
    }),
    tanques: tankRecords,
    calibracaoConcluida: booleanRecordComplete(state.calibration),
    checklistConcluido: booleanRecordComplete(state.checklist),
    insightConfirmado: state.insightAccepted === true,
    riscoConfirmado: state.riskAccepted === true,
    ocorrencias: occurrences,
    totalOcorrencias: occurrences.length,
    iniciadaEm: textValue(state.startedAt),
    finalizadaEm: textValue(state.endedAt) || textValue(state.concluidaNoDispositivoEm),
  };
}

function validateFinalization(
  summary: ReturnType<typeof buildOperationSummary>,
  state: StoredState,
  settings: Settings,
) {
  if (!summary.ordemServicoId)
    throw new DroneOsAccessError("Selecione uma OS antes de concluir a aplicação em campo.", 400);
  if (summary.areaHa <= 0) throw new Error("Área planejada inválida.");
  if (summary.areaConcluidaHa < summary.areaHa - 0.01)
    throw new Error(
      `A operação não pode ser concluída: ${summary.areaConcluidaHa.toFixed(2)} ha registrados de ${summary.areaHa.toFixed(2)} ha planejados.`,
    );
  if (
    !summary.cultura ||
    !summary.alvo ||
    !summary.tipoAtividade ||
    !summary.drone ||
    !summary.registroAnac ||
    !summary.pontaModelo
  )
    throw new Error(
      "Cultura, alvo, atividade, drone, identificação ANAC e ponta/atomizador são obrigatórios.",
    );
  if (
    summary.volumeLHa <= 0 ||
    summary.faixaM <= 0 ||
    summary.velocidadeKmh <= 0 ||
    summary.alturaM <= 0
  )
    throw new Error("Volume, faixa, velocidade e altura precisam ser válidos.");
  if (
    !summary.produtos.length ||
    summary.produtos.some((product) => !product.nome || product.dose <= 0 || !product.unidade)
  )
    throw new Error("Todos os produtos adicionados precisam ter nome, dose e unidade válidos.");

  const vento = summary.climaCampo.ventoKmh;
  const temp = summary.climaCampo.temperaturaC;
  const ur = summary.climaCampo.umidadePct;
  if (
    !summary.climaCampoConfirmado ||
    !summary.climaCampoMedidoEm ||
    !summary.climaCampo.direcaoVento ||
    vento === null ||
    temp === null ||
    ur === null
  )
    throw new Error("A medição climática de campo precisa estar completa e confirmada.");
  if (vento < 0 || vento > 100)
    throw new Error("Velocidade do vento fora da faixa de validação do sistema.");
  if (temp < -20 || temp > 60)
    throw new Error("Temperatura de campo fora da faixa de validação do sistema.");
  if (ur <= 0 || ur > 100) throw new Error("Umidade relativa deve estar entre 1% e 100%.");

  if (!summary.areaSensivel.semAreaSensivel) {
    if (summary.areaSensivel.distanciaM === null || summary.areaSensivel.distanciaM <= 0)
      throw new Error(
        "Informe a distância da área sensível ou confirme que não há área sensível aplicável.",
      );
    if (
      settings.bloquearMargemPreventiva &&
      summary.areaSensivel.distanciaM < settings.margemPreventiva
    )
      throw new Error(
        `A distância informada está abaixo da margem preventiva interna de ${settings.margemPreventiva} m.`,
      );
  }
  if (settings.insightsObrigatorios && !summary.insightConfirmado)
    throw new Error("O protocolo/insight obrigatório da empresa não foi confirmado.");
  if (settings.exigirConfirmacao && !summary.riscoConfirmado)
    throw new Error("A análise de risco obrigatória não foi confirmada.");
  if (!summary.gps.disponivel)
    throw new Error("Registre o ponto GPS da operação antes da conclusão.");
  if (!summary.calibracaoConcluida) throw new Error("Calibração incompleta.");
  if (!summary.checklistConcluido) throw new Error("Checklist pré-voo incompleto.");
  if (!summary.sarpasConfirmado || summary.sarpasSituacao !== "autorizado")
    throw new Error("A autorização SARPAS precisa estar conferida para esta aplicação agrícola.");
  if (!summary.sarpasNumero)
    throw new Error("Informe a referência SARPAS da operação autorizada.");
  if (!summary.iniciadaEm || !summary.finalizadaEm)
    throw new Error("Horários reais de início e término precisam estar registrados.");
  const start = Date.parse(summary.iniciadaEm);
  const end = Date.parse(summary.finalizadaEm);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    throw new Error("Horários de início/término inválidos.");
  if (state.concluida !== true)
    throw new Error("A aplicação não foi marcada como concluída no dispositivo.");
}

async function pilotCanFinalize(admin: any, current: ApiContext) {
  if (!current.empresaId || companyHistoryRole(current)) return true;
  let query = admin
    .from("core_logs")
    .select("detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", PILOT_ACTION)
    .contains("detalhes", { usuarioId: current.usuario.id, ativo: true })
    .limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return data.detalhes?.permissoes?.finalizarOperacao !== false;
}

async function validateServerPreflight(
  admin: any,
  current: ApiContext,
  osId: string,
  tipoAtividade: string,
) {
  let sarpasQuery = admin
    .from("core_logs")
    .select("detalhes,created_at")
    .eq("app_slug", "dronegestor")
    .eq("acao", SARPAS_ACTION)
    .contains("detalhes", { ordemServicoId: osId })
    .order("created_at", { ascending: false })
    .limit(1);
  sarpasQuery = scopeQuery(sarpasQuery, current);

  let docsQuery = admin
    .from("core_logs")
    .select("detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", DOC_ACTION)
    .contains("detalhes", { ordemServicoId: osId })
    .limit(500);
  docsQuery = scopeQuery(docsQuery, current);

  const [sarpasResult, docsResult] = await Promise.all([sarpasQuery.maybeSingle(), docsQuery]);
  if (sarpasResult.error) throw sarpasResult.error;
  if (docsResult.error) throw docsResult.error;

  const sarpas = sarpasResult.data?.detalhes ?? {};
  if (textValue(sarpas.status) !== "autorizado" || !textValue(sarpas.numero))
    throw new Error(
      "A autorização SARPAS desta OS ainda não está registrada no servidor. Peça ao gestor/RT para conferir antes de concluir.",
    );

  const types = new Set(
    (docsResult.data ?? []).map((row: any) => textValue(row?.detalhes?.tipo)),
  );
  if (!types.has("sisant_certidao"))
    throw new Error("Falta a Certidão SISANT/ANAC vinculada a esta OS.");
  if ((tipoAtividade || "pulverizacao") === "pulverizacao" && !types.has("receituario"))
    throw new Error("Falta o receituário vinculado a esta pulverização.");
  if (!types.has("sarpas_autorizacao"))
    throw new Error("Falta o comprovante da autorização SARPAS vinculado a esta OS.");
}

async function setFieldCompleted(
  admin: any,
  current: ApiContext,
  osRow: any,
  operationId: string,
) {
  const details = osRow.detalhes ?? {};
  const data = details.data ?? {};
  if (data.status === "concluida" || data.status === "campo_concluido") return;
  if (data.status === "cancelada")
    throw new DroneOsAccessError("A OS vinculada está cancelada.", 409);

  const now = new Date().toISOString();
  const assigned = textValue(data.pilotoResponsavelId || data.pilotoId);
  const nextData = {
    ...data,
    status: "campo_concluido",
    pilotoId: assigned || current.usuario.id,
    pilotoNome:
      data.pilotoResponsavelNome || data.pilotoNome || current.usuario.nome || "Piloto",
    campoConcluidoEm: now,
    operacaoId: operationId,
  };
  const { error } = await admin
    .from("core_logs")
    .update({ detalhes: { ...details, updatedAt: now, data: nextData } })
    .eq("id", osRow.id);
  if (error) throw error;

  const event = await admin.from("core_logs").insert({
    empresa_id: current.empresaId,
    usuario_id: current.usuario.id,
    app_slug: "dronegestor",
    acao: OS_EVENT_ACTION,
    detalhes: {
      osId: details.entityId,
      evento: "campo_concluido",
      at: now,
      pilotoId: current.usuario.id,
      pilotoNome: current.usuario.nome || "Piloto",
      operationId,
    },
  });
  if (event.error)
    console.error("DroneGestor: falha ao registrar evento campo_concluido", event.error);
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const admin = createSupabaseAdminClient() as any;

    if (request.nextUrl.searchParams.get("history") === "1") {
      const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 200);
      const limit = Math.max(
        1,
        Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 200),
      );
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
      if (companyHistoryRole(current) && current.empresaId)
        query = query.eq("empresa_id", current.empresaId);
      else query = query.eq("usuario_id", current.usuario.id);
      const { data, error } = await query;
      if (error) throw error;
      const rawItems = data ?? [];
      // Registros antigos de teste, criados antes da OS obrigatória, são preservados no banco
      // mas não aparecem no histórico operacional normal do piloto/gestor.
      const validItems = rawItems.filter((row: any) => Boolean(finalizedOsId(row)));
      return NextResponse.json({
        ok: true,
        items: validItems.slice(0, limit),
        legacyHidden: rawItems.length - validItems.length,
        hasMore: rawItems.length > limit,
        nextOffset: rawItems.length > limit ? offset + limit : null,
      });
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
    return NextResponse.json({
      ok: true,
      state: data?.detalhes?.state ?? null,
      revision: storedRevision(data),
      updatedAt: data?.detalhes?.updatedAt ?? data?.created_at ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao carregar os dados do DroneGestor.",
      },
      { status: 500 },
    );
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
    if (!Number.isInteger(baseRevision) || baseRevision < 0)
      return NextResponse.json({ ok: false, error: "Revisão local inválida." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const mission = objectValue(state.mission);
    const osId = textValue(mission.ordemServicoId);
    if (osId) {
      const osAccess = await requireDroneOsAccess(admin, accessContext(current), osId);
      if (
        current.empresaId &&
        osAccess.assignedPilotId &&
        osAccess.assignedPilotId !== current.usuario.id
      )
        throw new DroneOsAccessError(
          "Esta OS está atribuída a outro piloto. Abra o Painel do gestor para acompanhá-la.",
          403,
        );
    }

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
    const serverRevision = storedRevision(existing);
    if (serverRevision !== baseRevision)
      return NextResponse.json(
        {
          ok: false,
          conflict: true,
          error: "Existe uma versão diferente no servidor. Nenhum dado foi sobrescrito.",
          state: existing?.detalhes?.state ?? null,
          revision: serverRevision,
          updatedAt: existing?.detalhes?.updatedAt ?? existing?.created_at ?? null,
        },
        { status: 409 },
      );

    const revision = serverRevision + 1;
    const updatedAt = new Date().toISOString();
    const detalhes = { state, revision, updatedAt, version: 6 };
    if (existing?.id) {
      const { error } = await admin
        .from("core_logs")
        .update({ detalhes })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("core_logs").insert({
        empresa_id: current.empresaId,
        usuario_id: current.usuario.id,
        app_slug: "dronegestor",
        acao: STATE_ACTION,
        detalhes,
      });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, revision, updatedAt });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json(
        { ok: false, error: accessError.message },
        { status: accessError.status },
      );
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao salvar os dados do DroneGestor.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const body = await request.json();
    const state = validateState(body?.state);
    const operationId =
      textValue(body?.operationId) || textValue(state.operationId) || crypto.randomUUID();
    const pilotName = textValue(body?.pilotName) || current.usuario.nome || "Piloto";
    const admin = createSupabaseAdminClient() as any;
    const settings = await loadSettings(admin, current);
    const summary = buildOperationSummary(state, pilotName, settings);

    validateFinalization(summary, state, settings);

    const osAccess = await requireDroneOsAccess(
      admin,
      accessContext(current),
      summary.ordemServicoId,
    );
    const osData = osAccess.data;
    const assigned = textValue(osData.pilotoResponsavelId || osData.pilotoId);
    if (current.empresaId) {
      if (!assigned)
        throw new DroneOsAccessError(
          "Defina o piloto responsável desta OS antes de concluir a aplicação.",
          400,
        );
      if (assigned !== current.usuario.id)
        throw new DroneOsAccessError("Esta OS pertence a outro piloto.", 403);
    }
    if (osData.status === "cancelada")
      throw new DroneOsAccessError("Esta OS foi cancelada e não pode ser concluída.", 409);

    if (!(await pilotCanFinalize(admin, current)))
      throw new DroneOsAccessError(
        "Seu perfil não tem permissão para concluir aplicações. Peça ao gestor/RT para revisar sua permissão.",
        403,
      );

    await validateServerPreflight(
      admin,
      current,
      summary.ordemServicoId,
      summary.tipoAtividade,
    );

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
      const existingSummary = objectValue(existing.detalhes?.summary);
      if (textValue(existingSummary.ordemServicoId) !== summary.ordemServicoId)
        throw new DroneOsAccessError(
          "A conclusão protegida pertence a outra OS. Nenhum dado foi alterado.",
          409,
        );
      await setFieldCompleted(admin, current, osAccess.row, operationId);
      return NextResponse.json({
        ok: true,
        duplicate: true,
        id: existing.id,
        operationId,
        // Mantido por compatibilidade com os dois modos de Campo atuais. O significado
        // aqui é “a atualização da OS foi confirmada”; o estado real continua Campo concluído.
        osConcluida: true,
        osCampoConcluido: true,
        osEncerrada: false,
        finalizedAt: existing.detalhes?.finalizedAt ?? existing.created_at,
      });
    }

    if (osData.status === "concluida")
      throw new DroneOsAccessError("Esta OS já foi encerrada.", 409);

    const finalizedAt = new Date().toISOString();
    const detalhes = {
      operationId,
      finalizedAt,
      version: 9,
      settingsSnapshot: settings,
      summary,
      state,
      closureStage: "campo_concluido",
    };
    const { data, error } = await admin
      .from("core_logs")
      .insert({
        empresa_id: current.empresaId,
        usuario_id: current.usuario.id,
        app_slug: "dronegestor",
        acao: FINALIZED_ACTION,
        detalhes,
      })
      .select("id")
      .single();
    if (error) throw error;

    try {
      await setFieldCompleted(admin, current, osAccess.row, operationId);
    } catch (fieldError) {
      await admin.from("core_logs").delete().eq("id", data.id);
      throw fieldError;
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      operationId,
      osConcluida: true,
      osCampoConcluido: true,
      osEncerrada: false,
      finalizedAt,
    });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json(
        { ok: false, error: accessError.message },
        { status: accessError.status },
      );

    const message =
      error instanceof Error ? error.message : "Falha ao concluir a aplicação no Supabase.";
    const validation = [
      "não pode ser concluída",
      "obrigat",
      "incomplet",
      "precisa",
      "Informe",
      "margem preventiva",
      "fora da faixa",
      "Umidade",
      "GPS",
      "Horários",
      "cancelada",
      "outro piloto",
      "SARPAS",
      "Certidão",
      "receituário",
      "comprovante",
      "servidor",
    ];
    return NextResponse.json(
      { ok: false, error: message },
      { status: validation.some((word) => message.includes(word)) ? 400 : 500 },
    );
  }
}
