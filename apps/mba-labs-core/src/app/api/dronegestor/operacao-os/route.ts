import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import {
  droneOsErrorResponse,
  requireDroneOsAccess,
  scopeDroneOsQuery,
} from "@/lib/dronegestor-os-access";

export const dynamic = "force-dynamic";

const STATE_ACTION = "estado_campo_v2";
const FINALIZED_ACTION = "operacao_finalizada";
const ACTIONS = {
  cliente: "cadastro_cliente",
  fazenda: "cadastro_fazenda",
  talhao: "cadastro_talhao",
} as const;

type Context = {
  userId: string;
  userName: string;
  empresaId: string | null;
  canManage: boolean;
};
function normalize(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}
function text(v: unknown, max = 240) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function obj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
}
async function context(): Promise<{ current: Context | null; response: NextResponse | null }> {
  const s = await getSessionProfile();
  if (!s.user || !s.profile)
    return {
      current: null,
      response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }),
    };
  const type = normalize(s.profile.tipo || "");
  const master = ["super_admin", "admin_master"].includes(type);
  const allowed = (s.appsLiberados ?? []).some((a) => a.slug === "dronegestor" && a.canAccess);
  if (!master && !allowed)
    return {
      current: null,
      response: NextResponse.json(
        { ok: false, error: "Acesso ao DroneGestor não liberado." },
        { status: 403 },
      ),
    };
  return {
    current: {
      userId: s.profile.id,
      userName: s.profile.nome || "Usuário",
      empresaId: s.profile.empresa_id,
      canManage: master || ["admin_empresa", "responsavel_tecnico", "rt"].includes(type),
    },
    response: null,
  };
}
async function rows(admin: any, c: Context, action: string, limit = 500) {
  let q = admin
    .from("core_logs")
    .select("id,usuario_id,detalhes,created_at")
    .eq("app_slug", "dronegestor")
    .eq("acao", action)
    .order("created_at", { ascending: false })
    .limit(limit);
  q = scopeDroneOsQuery(q, c);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
async function entity(admin: any, c: Context, action: string, entityId: string) {
  if (!entityId) return {};
  let q = admin
    .from("core_logs")
    .select("detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", action)
    .contains("detalhes", { entityId })
    .limit(1);
  q = scopeDroneOsQuery(q, c);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data?.detalhes?.ativo === false ? {} : obj(data?.detalhes?.data);
}
function osIdFromState(state: Record<string, any>) {
  return text(obj(state.mission).ordemServicoId, 120);
}

export async function GET(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const c = access.current!;
    const osId = text(request.nextUrl.searchParams.get("osId"), 120);
    if (!osId)
      return NextResponse.json(
        { ok: false, error: "Informe a OS que deseja abrir." },
        { status: 400 },
      );

    const admin = createSupabaseAdminClient() as any;
    const osAccess = await requireDroneOsAccess(admin, c, osId);
    const os = osAccess.row;
    const osData = osAccess.data;
    const assigned = osAccess.assignedPilotId;

    let state: Record<string, any> = {};
    let source: "finalized" | "live" | "os" = "os";
    let pilotId = "";
    let pilotName = text(osData.pilotoResponsavelNome || osData.pilotoNome, 180);
    let syncUpdatedAt = "";
    let finalizedAt = "";

    const finalizedRows = await rows(admin, c, FINALIZED_ACTION, 500);
    const finalized = finalizedRows.find((r: any) => {
      const details = obj(r.detalhes);
      const summary = obj(details.summary);
      const savedState = obj(details.state);
      return text(summary.ordemServicoId, 120) === osId || osIdFromState(savedState) === osId;
    });
    if (finalized) {
      const details = obj(finalized.detalhes);
      state = obj(details.state);
      source = "finalized";
      pilotId = String(finalized.usuario_id || assigned || "");
      pilotName = text(obj(details.summary).piloto, 180) || pilotName;
      syncUpdatedAt = text(details.finalizedAt, 50) || String(finalized.created_at || "");
      finalizedAt = syncUpdatedAt;
    } else {
      const liveRows = await rows(admin, c, STATE_ACTION, 500);
      const live = liveRows.find((r: any) => osIdFromState(obj(r?.detalhes?.state)) === osId);
      if (live) {
        state = obj(live.detalhes?.state);
        source = "live";
        pilotId = String(live.usuario_id || assigned || "");
        syncUpdatedAt = text(live.detalhes?.updatedAt, 50) || String(live.created_at || "");
      }
    }

    const [cliente, fazenda, talhao] = await Promise.all([
      entity(admin, c, ACTIONS.cliente, text(osData.clienteId, 100)),
      entity(admin, c, ACTIONS.fazenda, text(osData.fazendaId, 100)),
      entity(admin, c, ACTIONS.talhao, text(osData.talhaoId, 100)),
    ]);
    const storedMission = obj(state.mission);
    const mission = {
      ...storedMission,
      ordemServicoId: osId,
      ordemServicoNumero: text(osData.numero, 80) || text(storedMission.ordemServicoNumero, 80),
      clienteId: text(osData.clienteId, 100) || text(storedMission.clienteId, 100),
      clienteNome: text(storedMission.clienteNome, 180) || text(cliente.nome, 180),
      fazendaId: text(osData.fazendaId, 100) || text(storedMission.fazendaId, 100),
      fazendaNome: text(storedMission.fazendaNome, 180) || text(fazenda.nome, 180),
      municipio: text(storedMission.municipio, 120) || text(fazenda.municipio, 120),
      uf: text(storedMission.uf, 2) || text(fazenda.uf, 2),
      talhaoId: text(osData.talhaoId, 100) || text(storedMission.talhaoId, 100),
      talhaoNome: text(storedMission.talhaoNome, 180) || text(talhao.nome, 180),
      area: Number(storedMission.area) || Number(osData.areaHa) || Number(talhao.areaHa) || 0,
      cultura:
        text(storedMission.cultura, 120) || text(osData.cultura, 120) || text(talhao.culturaPadrao, 120),
      alvo: text(storedMission.alvo, 160) || text(osData.alvo, 160),
      responsavelPropriedade:
        text(osData.responsavelPropriedade, 180) || text(storedMission.responsavelPropriedade, 180),
      enderecoPropriedade:
        text(osData.enderecoPropriedade, 240) || text(storedMission.enderecoPropriedade, 240),
    };
    state = { ...state, mission };
    return NextResponse.json({
      ok: true,
      os: {
        id: osId,
        status: text(osData.status, 40) || "aberta",
        numero: text(osData.numero, 80),
        fechamentoStatus: text(osData.fechamentoStatus, 60),
        pendencias: Array.isArray(osData.pendenciasFechamento) ? osData.pendenciasFechamento : [],
        responsavelPropriedade: text(osData.responsavelPropriedade, 180),
        enderecoPropriedade: text(osData.enderecoPropriedade, 240),
      },
      state,
      source,
      pilotId: pilotId || assigned,
      pilotName: pilotName || "Piloto",
      syncUpdatedAt,
      finalizedAt,
      canManage: c.canManage,
    });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao abrir os dados da OS." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const c = access.current!;
    const body = await request.json();
    const osId = text(body?.osId, 120);
    if (!osId) return NextResponse.json({ ok: false, error: "Informe a OS." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const osAccess = await requireDroneOsAccess(admin, c, osId);
    const os = osAccess.row;
    const data = osAccess.data;
    if (text(data.status, 40) === "concluida")
      return NextResponse.json({ ok: false, error: "Esta OS já está encerrada." }, { status: 409 });

    const responsavelPropriedade = text(body?.responsavelPropriedade, 180);
    const enderecoPropriedade = text(body?.enderecoPropriedade, 240);
    if (!responsavelPropriedade || !enderecoPropriedade)
      return NextResponse.json(
        { ok: false, error: "Informe responsável/proprietário e endereço/referência da propriedade." },
        { status: 400 },
      );

    const now = new Date().toISOString();
    const nextData = {
      ...data,
      responsavelPropriedade,
      enderecoPropriedade,
      fechamentoAtualizadoEm: now,
      fechamentoAtualizadoPor: c.userName,
    };
    const details = { ...(os.detalhes ?? {}), updatedAt: now, data: nextData };
    const { error } = await admin.from("core_logs").update({ detalhes: details }).eq("id", os.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, responsavelPropriedade, enderecoPropriedade, updatedAt: now });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar dados da propriedade." },
      { status: 500 },
    );
  }
}
