import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const STATE_ACTION = "estado_campo_v2";
const FINALIZED_ACTION = "operacao_finalizada";
const CONFIG_ACTION = "configuracao_empresa_v1";
const OS_ACTION = "ordem_servico";
const OS_EVENT_ACTION = "ordem_servico_evento";
const MAX_STATE_BYTES = 180_000;

type StoredState = Record<string, unknown>;
type ApiContext = { usuario: { id: string; tipo: string; nome?: string | null }; empresaId: string | null };
type Settings = {
  insightsObrigatorios: boolean;
  margemPreventiva: number;
  bloquearMargemPreventiva: boolean;
  exigirConfirmacao: boolean;
  protocoloBordaduraCigarrinha: boolean;
};

const defaults: Settings = {
  insightsObrigatorios: true,
  margemPreventiva: 90,
  bloquearMargemPreventiva: true,
  exigirConfirmacao: true,
  protocoloBordaduraCigarrinha: false
};

function normalizeType(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}
function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function arrayValue(value: unknown) { return Array.isArray(value) ? value : []; }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null;
}
function textValue(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function firstText(...values: unknown[]) {
  for (const value of values) { const text = textValue(value); if (text) return text; }
  return "";
}
function booleanRecordComplete(value: unknown) {
  const values = Object.values(objectValue(value));
  return values.length > 0 && values.every((item) => item === true);
}
function validateState(value: unknown): StoredState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Estado da operação inválido.");
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_STATE_BYTES) throw new Error("Estado da operação excedeu o limite de sincronização.");
  return value as StoredState;
}
function storedRevision(row: any) {
  if (!row) return 0;
  const parsed = Number(row?.detalhes?.revision);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

async function getContext(): Promise<{ current: ApiContext | null; response: NextResponse | null }> {
  const context = await getSessionProfile();
  if (!context.user || !context.profile) return { current: null, response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };
  const admin = ["super_admin", "admin_master"].includes(normalizeType(context.profile.tipo));
  const allowed = (context.appsLiberados ?? []).some((app) => app.slug === "dronegestor" && app.canAccess);
  if (!admin && !allowed) return { current: null, response: NextResponse.json({ ok: false, error: "Acesso ao DroneGestor não liberado." }, { status: 403 }) };
  return { current: { usuario: { id: context.profile.id, tipo: context.profile.tipo, nome: context.profile.nome }, empresaId: context.profile.empresa_id }, response: null };
}
function scopeQuery(query: any, current: ApiContext) {
  return current.empresaId ? query.eq("empresa_id", current.empresaId) : query.eq("usuario_id", current.usuario.id);
}
function companyHistoryRole(current: ApiContext) {
  return ["admin_empresa", "responsavel_tecnico", "rt", "super_admin", "admin_master"].includes(normalizeType(current.usuario.tipo));
}

async function loadSettings(admin: any, current: ApiContext): Promise<Settings> {
  let query = admin.from("core_logs").select("detalhes,created_at").eq("app_slug", "dronegestor").eq("acao", CONFIG_ACTION).order("created_at", { ascending: false }).limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  const raw = data?.detalhes?.settings ?? {};
  const margin = Number(raw.margemPreventiva);
  return {
    insightsObrigatorios: raw.insightsObrigatorios !== false,
    margemPreventiva: Number.isFinite(margin) ? Math.max(0, Math.min(5000, margin)) : defaults.margemPreventiva,
    bloquearMargemPreventiva: raw.bloquearMargemPreventiva !== false,
    exigirConfirmacao: raw.exigirConfirmacao !== false,
    protocoloBordaduraCigarrinha: raw.protocoloBordaduraCigarrinha === true
  };
}

async function findOs(admin: any, current: ApiContext, osId: string) {
  if (!osId) return null;
  let query = admin.from("core_logs").select("id,detalhes,created_at").eq("app_slug", "dronegestor").eq("acao", OS_ACTION).contains("detalhes", { entityId: osId }).limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data && data.detalhes?.ativo !== false ? data : null;
}
async function logOsEvent(admin: any, current: ApiContext, osId: string, evento: string, extra: Record<string, unknown> = {}) {
  await admin.from("core_logs").insert({
    empresa_id: current.empresaId,
    usuario_id: current.usuario.id,
    app_slug: "dronegestor",
    acao: OS_EVENT_ACTION,
    detalhes: { osId, evento, at: new Date().toISOString(), pilotoId: current.usuario.id, pilotoNome: current.usuario.nome || "Piloto", ...extra }
  });
}
async function setOsStatus(admin: any, current: ApiContext, osId: string, desired: "em_preparacao" | "em_execucao" | "suspensa" | "aberta" | "concluida") {
  const os = await findOs(admin, current, osId);
  if (!os) throw new Error("A ordem de serviço vinculada não existe ou está inativa.");
  const details = os.detalhes ?? {};
  const data = { ...(details.data ?? {}) };
  const currentStatus = textValue(data.status) || "aberta";
  const assigned = textValue(data.pilotoResponsavelId);
  if (assigned && assigned !== current.usuario.id) throw new Error(`Esta OS está atribuída a ${data.pilotoResponsavelNome || "outro piloto"}.`);
  if (["concluida", "cancelada"].includes(currentStatus) && desired !== currentStatus) throw new Error("OS concluída/cancelada não pode voltar ao fluxo operacional.");
  if (currentStatus === desired) return true;

  const valid =
    (currentStatus === "aberta" && desired === "em_preparacao") ||
    (currentStatus === "em_preparacao" && ["em_execucao", "aberta"].includes(desired)) ||
    (currentStatus === "em_execucao" && desired === "suspensa") ||
    (currentStatus === "suspensa" && desired === "em_execucao") ||
    (["em_execucao", "suspensa"].includes(currentStatus) && desired === "concluida");
  if (!valid) throw new Error(`Transição da OS de ${currentStatus} para ${desired} não permitida.`);

  const now = new Date().toISOString();
  data.status = desired;
  if (["em_preparacao", "em_execucao", "suspensa", "concluida"].includes(desired)) {
    data.pilotoResponsavelId = current.usuario.id;
    data.pilotoResponsavelNome = current.usuario.nome || "Piloto";
  }
  if (desired === "em_preparacao" && !data.preparadaEm) data.preparadaEm = now;
  if (desired === "em_execucao" && !data.iniciadaEm) data.iniciadaEm = now;
  if (desired === "suspensa") data.suspensaEm = now;
  if (desired === "aberta") {
    data.pilotoResponsavelId = "";
    data.pilotoResponsavelNome = "";
    data.preparadaEm = "";
    data.suspensaEm = "";
  }
  if (desired === "concluida") data.finalizadaEm = now;
  const { error } = await admin.from("core_logs").update({ detalhes: { ...details, updatedAt: now, data } }).eq("id", os.id);
  if (error) throw error;
  await logOsEvent(admin, current, osId, desired, { statusAnterior: currentStatus });
  return true;
}

async function syncOsLifecycle(admin: any, current: ApiContext, previousState: StoredState | null, nextState: StoredState) {
  const previousMission = objectValue(previousState?.mission);
  const nextMission = objectValue(nextState.mission);
  const previousOs = textValue(previousMission.ordemServicoId);
  const nextOs = textValue(nextMission.ordemServicoId);
  const nextStarted = nextState.operationStarted === true;
  const nextPaused = nextState.paused === true;
  const nextStatus = textValue(nextState.missionStatus);

  if (previousOs && previousOs !== nextOs) {
    const os = await findOs(admin, current, previousOs);
    const status = textValue(os?.detalhes?.data?.status);
    const assigned = textValue(os?.detalhes?.data?.pilotoResponsavelId);
    if (os && assigned === current.usuario.id && status === "em_preparacao") await setOsStatus(admin, current, previousOs, "aberta");
  }
  if (!nextOs) return;
  if (nextStarted) {
    const desired = nextPaused || nextStatus === "pausada" ? "suspensa" : "em_execucao";
    const os = await findOs(admin, current, nextOs);
    const currentStatus = textValue(os?.detalhes?.data?.status) || "aberta";
    if (currentStatus === "aberta") await setOsStatus(admin, current, nextOs, "em_preparacao");
    const refreshed = await findOs(admin, current, nextOs);
    const refreshedStatus = textValue(refreshed?.detalhes?.data?.status) || "aberta";
    if (refreshedStatus !== desired) await setOsStatus(admin, current, nextOs, desired);
    return;
  }
  if (!["pendente_sync", "finalizada"].includes(nextStatus)) {
    const os = await findOs(admin, current, nextOs);
    const status = textValue(os?.detalhes?.data?.status) || "aberta";
    if (status === "aberta") await setOsStatus(admin, current, nextOs, "em_preparacao");
  }
}

function buildOperationSummary(state: StoredState, pilotName: string) {
  const mission = objectValue(state.mission);
  const weather = objectValue(state.weather);
  const products = arrayValue(mission.produtos);
  const occurrences = arrayValue(state.occurrences);
  const tankRecords = arrayValue(state.tankRecords);
  const areaHa = numberValue(mission.area);
  const volumeLHa = numberValue(mission.volume);
  const progressHa = Math.max(0, numberValue(state.progressHa));
  const wind = nullableNumber(mission.ventoCampoKmh);
  const temperature = nullableNumber(mission.temperaturaCampo);
  const humidity = nullableNumber(mission.umidadeCampo);
  const gpsLatitude = nullableNumber(weather.latitude);
  const gpsLongitude = nullableNumber(weather.longitude);
  const caldaRealL = tankRecords.reduce((sum: number, item: unknown) => sum + Math.max(0, numberValue(objectValue(item).volumeL)), 0);

  return {
    piloto: pilotName,
    ordemServicoId: textValue(mission.ordemServicoId),
    ordemServicoNumero: textValue(mission.ordemServicoNumero),
    clienteId: textValue(mission.clienteId), clienteNome: textValue(mission.clienteNome),
    fazendaId: textValue(mission.fazendaId), fazendaNome: textValue(mission.fazendaNome),
    municipio: textValue(mission.municipio), uf: textValue(mission.uf),
    talhaoId: textValue(mission.talhaoId), talhaoNome: textValue(mission.talhaoNome),
    cultura: textValue(mission.cultura), alvo: textValue(mission.alvo), tipoAtividade: textValue(mission.tipoAtividade),
    areaHa, areaConcluidaHa: Math.min(areaHa, progressHa), progressSource: "manual_campo",
    drone: textValue(mission.drone),
    identificacaoAnac: firstText(mission.registroAnac, mission.identificacaoAnac),
    pontaPulverizacao: firstText(mission.pontaModelo, mission.pontaPulverizacao),
    documentoTecnicoReferencia: textValue(mission.documentoTecnicoReferencia),
    volumeLHa, totalCaldaL: areaHa * volumeLHa, caldaRealL,
    faixaM: numberValue(mission.faixa), velocidadeKmh: numberValue(mission.velocidadeKmh), alturaM: numberValue(mission.alturaM),
    sarpasNumero: textValue(mission.sarpasNumero), sarpasSituacao: textValue(mission.sarpasSituacao), sarpasConfirmado: mission.sarpasConfirmado === true,
    climaCampoConfirmado: mission.climaCampoConfirmado === true,
    semAreaSensivel: mission.semAreaSensivel === true,
    distanciaSensivelM: nullableNumber(mission.distanciaSensivel),
    climaCampo: { ventoKmh: wind, direcaoVento: textValue(mission.direcaoVentoCampo), temperaturaC: temperature, umidadePct: humidity, medidoEm: textValue(mission.climaCampoMedidoEm) },
    gps: { latitude: gpsLatitude, longitude: gpsLongitude, capturadoEm: textValue(weather.capturedAt) },
    produtos: products.map((item) => { const product = objectValue(item); return { nome: textValue(product.nome), dose: numberValue(product.dose), unidade: textValue(product.unidade) }; }),
    tanques: tankRecords,
    calibracaoConcluida: booleanRecordComplete(state.calibration), checklistConcluido: booleanRecordComplete(state.checklist),
    insightAceito: state.insightAccepted === true, riscoAceito: state.riskAccepted === true,
    ocorrencias: occurrences, totalOcorrencias: occurrences.length,
    iniciadaEm: textValue(state.startedAt),
    finalizadaEm: firstText(state.endedAt, state.finalizedAt, state.concluidaNoDispositivoEm)
  };
}

function validateFinalization(summary: ReturnType<typeof buildOperationSummary>, state: StoredState, settings: Settings) {
  if (summary.areaHa <= 0) throw new Error("Área planejada inválida.");
  if (summary.areaConcluidaHa < summary.areaHa - 0.01) throw new Error(`A operação não pode ser concluída: ${summary.areaConcluidaHa.toFixed(2)} ha registrados de ${summary.areaHa.toFixed(2)} ha planejados.`);
  if (!summary.cultura || !summary.alvo || !summary.tipoAtividade || !summary.drone || !summary.identificacaoAnac || !summary.pontaPulverizacao) throw new Error("Cultura, alvo, atividade, drone, identificação ANAC e ponta/atomizador são obrigatórios.");
  if (summary.volumeLHa <= 0 || summary.faixaM <= 0 || summary.velocidadeKmh <= 0 || summary.alturaM <= 0) throw new Error("Volume, faixa, velocidade e altura precisam ser válidos.");
  if (!summary.produtos.length || !summary.produtos.every((product) => product.nome && product.dose > 0 && product.unidade)) throw new Error("Todos os produtos adicionados precisam ter nome, dose e unidade válidos.");
  if (!summary.climaCampoConfirmado || !summary.climaCampo.medidoEm || !summary.climaCampo.direcaoVento || summary.climaCampo.ventoKmh === null || summary.climaCampo.temperaturaC === null || summary.climaCampo.umidadePct === null) throw new Error("A medição climática de campo precisa estar confirmada.");
  if (summary.climaCampo.ventoKmh < 0 || summary.climaCampo.ventoKmh > 100 || summary.climaCampo.temperaturaC < -20 || summary.climaCampo.temperaturaC > 60 || summary.climaCampo.umidadePct <= 0 || summary.climaCampo.umidadePct > 100) throw new Error("Há valor climático de campo ausente ou fora da faixa plausível.");
  if (!summary.semAreaSensivel && (summary.distanciaSensivelM === null || summary.distanciaSensivelM <= 0)) throw new Error("Informe a distância da área sensível ou confirme que não há área sensível aplicável.");
  if (settings.bloquearMargemPreventiva && !summary.semAreaSensivel && summary.distanciaSensivelM !== null && summary.distanciaSensivelM < settings.margemPreventiva) throw new Error(`A distância informada está abaixo da margem preventiva interna de ${settings.margemPreventiva} m.`);
  if (settings.insightsObrigatorios && !summary.insightAceito) throw new Error("O insight obrigatório da empresa não foi confirmado.");
  if (settings.exigirConfirmacao && !summary.riscoAceito) throw new Error("A análise de risco obrigatória não foi confirmada.");
  if (!summary.calibracaoConcluida) throw new Error("Calibração incompleta.");
  if (!summary.checklistConcluido) throw new Error("Checklist pré-voo incompleto.");
  if (!summary.sarpasConfirmado || !summary.sarpasSituacao) throw new Error("A situação SARPAS precisa estar conferida.");
  if (summary.sarpasSituacao === "autorizado" && !summary.sarpasNumero) throw new Error("Informe a referência SARPAS da operação autorizada.");
  if (summary.gps.latitude === null || summary.gps.longitude === null || !summary.gps.capturadoEm) throw new Error("O ponto GPS da operação precisa estar registrado.");
  if (!summary.iniciadaEm || !summary.finalizadaEm) throw new Error("Horários reais de início e término precisam estar registrados.");
  const start = Date.parse(summary.iniciadaEm), end = Date.parse(summary.finalizadaEm);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("Horários de início/término inválidos.");
  if (state.concluida !== true) throw new Error("A operação não foi marcada como concluída no dispositivo.");
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext(); if (access.response) return access.response;
    const current = access.current!, admin = createSupabaseAdminClient() as any;
    const history = request.nextUrl.searchParams.get("history") === "1";
    if (history) {
      const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 200);
      const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 200));
      const requestedOffset = Number(request.nextUrl.searchParams.get("offset") || 0);
      const offset = Math.max(0, Number.isFinite(requestedOffset) ? requestedOffset : 0);
      let query = admin.from("core_logs").select("id,usuario_id,empresa_id,detalhes,created_at").eq("app_slug", "dronegestor").eq("acao", FINALIZED_ACTION).order("created_at", { ascending: false }).range(offset, offset + limit);
      if (companyHistoryRole(current) && current.empresaId) query = query.eq("empresa_id", current.empresaId); else query = query.eq("usuario_id", current.usuario.id);
      const { data, error } = await query; if (error) throw error;
      const items = data ?? [];
      return NextResponse.json({ ok: true, items: items.slice(0, limit), hasMore: items.length > limit, nextOffset: items.length > limit ? offset + limit : null });
    }
    const { data, error } = await admin.from("core_logs").select("id,detalhes,created_at").eq("usuario_id", current.usuario.id).eq("app_slug", "dronegestor").eq("acao", STATE_ACTION).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    const details = data?.detalhes && typeof data.detalhes === "object" ? data.detalhes : null;
    return NextResponse.json({ ok: true, state: details && "state" in details ? (details as any).state : null, revision: storedRevision(data), updatedAt: (details as any)?.updatedAt ?? data?.created_at ?? null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar os dados do DroneGestor." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getContext(); if (access.response) return access.response;
    const current = access.current!, body = await request.json(), state = validateState(body?.state), baseRevision = Math.max(0, Number(body?.baseRevision) || 0), admin = createSupabaseAdminClient() as any;
    const { data: existing, error: findError } = await admin.from("core_logs").select("id,detalhes,created_at").eq("usuario_id", current.usuario.id).eq("app_slug", "dronegestor").eq("acao", STATE_ACTION).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (findError) throw findError;
    const serverRevision = storedRevision(existing);
    if (serverRevision !== baseRevision) return NextResponse.json({ ok: false, conflict: true, error: "Existe uma versão mais nova no servidor.", state: existing?.detalhes?.state ?? null, revision: serverRevision, updatedAt: existing?.detalhes?.updatedAt ?? existing?.created_at ?? null }, { status: 409 });

    const previousState = existing?.detalhes?.state && typeof existing.detalhes.state === "object" ? existing.detalhes.state as StoredState : null;
    await syncOsLifecycle(admin, current, previousState, state);
    const revision = serverRevision + 1, updatedAt = new Date().toISOString(), detalhes = { state, revision, updatedAt, version: 5 };
    if (existing?.id) {
      const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id); if (error) throw error;
    } else {
      const { error } = await admin.from("core_logs").insert({ empresa_id: current.empresaId, usuario_id: current.usuario.id, app_slug: "dronegestor", acao: STATE_ACTION, detalhes }); if (error) throw error;
    }
    return NextResponse.json({ ok: true, revision, updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar os dados do DroneGestor.";
    return NextResponse.json({ ok: false, error: message }, { status: /atribuída|transição|concluída|cancelada/i.test(message) ? 409 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getContext(); if (access.response) return access.response;
    const current = access.current!, body = await request.json(), state = validateState(body?.state), operationId = firstText(body?.operationId, state.operationId), admin = createSupabaseAdminClient() as any, finalizedAt = new Date().toISOString();
    const summary = buildOperationSummary(state, current.usuario.nome || "Piloto");
    const settings = await loadSettings(admin, current);
    validateFinalization(summary, state, settings);

    if (summary.ordemServicoId) {
      const os = await findOs(admin, current, summary.ordemServicoId);
      if (!os) throw new Error("A ordem de serviço vinculada não existe ou está inativa.");
      const assigned = textValue(os.detalhes?.data?.pilotoResponsavelId);
      if (assigned && assigned !== current.usuario.id) throw new Error("Esta OS está atribuída a outro piloto.");
      if (os.detalhes?.data?.status === "cancelada") throw new Error("Esta OS foi cancelada e não pode receber uma conclusão.");
    }

    if (operationId) {
      const { data: duplicate, error: duplicateError } = await admin.from("core_logs").select("id,detalhes,created_at").eq("usuario_id", current.usuario.id).eq("app_slug", "dronegestor").eq("acao", FINALIZED_ACTION).contains("detalhes", { operationId }).limit(1).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) {
        if (summary.ordemServicoId) {
          const os = await findOs(admin, current, summary.ordemServicoId);
          if (os?.detalhes?.data?.status !== "concluida") await setOsStatus(admin, current, summary.ordemServicoId, "concluida");
        }
        return NextResponse.json({ ok: true, duplicate: true, id: duplicate.id, osConcluida: true, finalizedAt: duplicate.detalhes?.finalizedAt ?? duplicate.created_at });
      }
    }

    const detalhes = { operationId: operationId || crypto.randomUUID(), finalizedAt, version: 7, summary, state };
    const { data, error } = await admin.from("core_logs").insert({ empresa_id: current.empresaId, usuario_id: current.usuario.id, app_slug: "dronegestor", acao: FINALIZED_ACTION, detalhes }).select("id").single();
    if (error) throw error;
    if (summary.ordemServicoId) await setOsStatus(admin, current, summary.ordemServicoId, "concluida");
    return NextResponse.json({ ok: true, id: data.id, operationId: detalhes.operationId, osConcluida: true, finalizedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao finalizar a operação no Supabase.";
    const status = /não pode|obrigat|incomplet|precisa|Informe|abaixo|atribuída|concluída|cancelada|inválid|fora da faixa|GPS/i.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
