import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const STATE_ACTION = "estado_campo_v2";
const FINALIZED_ACTION = "operacao_finalizada";
const MAX_STATE_BYTES = 180_000;

type StoredState = Record<string, unknown>;

type ApiContext = {
  usuario: {
    id: string;
    tipo: string;
    nome?: string | null;
  };
  empresaId: string | null;
};

async function getContext(): Promise<{ current: ApiContext | null; response: NextResponse | null }> {
  const context = await getSessionProfile();

  if (!context.user || !context.profile) {
    return {
      current: null,
      response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 })
    };
  }

  const admin = ["super_admin", "admin_master"].includes(context.profile.tipo);
  const appAllowed = (context.appsLiberados ?? []).some(
    (app) => app.slug === "dronegestor" && app.canAccess
  );

  if (!admin && !appAllowed) {
    return {
      current: null,
      response: NextResponse.json({ ok: false, error: "Acesso ao DroneGestor não liberado." }, { status: 403 })
    };
  }

  return {
    current: {
      usuario: {
        id: context.profile.id,
        tipo: context.profile.tipo,
        nome: context.profile.nome
      },
      empresaId: context.profile.empresa_id
    },
    response: null
  };
}

function validateState(value: unknown): StoredState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Estado da operação inválido.");
  }

  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) {
    throw new Error("Estado da operação excedeu o limite de sincronização.");
  }

  return value as StoredState;
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

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function booleanRecordComplete(value: unknown) {
  const record = objectValue(value);
  const values = Object.values(record);
  return values.length > 0 && values.every((item) => item === true);
}

function buildOperationSummary(state: StoredState, pilotName: string) {
  const mission = objectValue(state.mission);
  const weather = objectValue(state.weather);
  const products = Array.isArray(mission.produtos) ? mission.produtos : [];
  const occurrences = Array.isArray(state.occurrences) ? state.occurrences : [];
  const areaHa = numberValue(mission.area);
  const volumeLHa = numberValue(mission.volume);

  return {
    piloto: pilotName,
    cultura: textValue(mission.cultura),
    alvo: textValue(mission.alvo),
    areaHa,
    areaConcluidaHa: areaHa,
    drone: textValue(mission.drone),
    volumeLHa,
    totalCaldaL: areaHa * volumeLHa,
    faixaM: numberValue(mission.faixa),
    velocidadeKmh: numberValue(mission.velocidadeKmh),
    alturaM: numberValue(mission.alturaM),
    sarpasNumero: textValue(mission.sarpasNumero),
    sarpasConfirmado: mission.sarpasConfirmado === true,
    climaCampo: {
      ventoKmh: numberValue(mission.ventoCampoKmh),
      direcaoVento: textValue(mission.direcaoVentoCampo),
      temperaturaC: numberValue(mission.temperaturaCampo),
      umidadePct: numberValue(mission.umidadeCampo)
    },
    gps: {
      latitude: numberValue(weather.latitude),
      longitude: numberValue(weather.longitude),
      capturadoEm: textValue(weather.capturedAt)
    },
    produtos: products.map((item) => {
      const product = objectValue(item);
      return {
        nome: textValue(product.nome),
        dose: numberValue(product.dose),
        unidade: textValue(product.unidade)
      };
    }),
    calibracaoConcluida: booleanRecordComplete(state.calibration),
    checklistConcluido: booleanRecordComplete(state.checklist),
    ocorrencias: occurrences,
    totalOcorrencias: occurrences.length
  };
}

function applyHistoryScope(query: any, current: ApiContext) {
  const companyManager = ["admin_empresa", "super_admin", "admin_master"].includes(current.usuario.tipo);
  if (companyManager && current.empresaId) {
    return query.eq("empresa_id", current.empresaId);
  }
  return query.eq("usuario_id", current.usuario.id);
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const admin = createSupabaseAdminClient() as any;
    const history = request.nextUrl.searchParams.get("history") === "1";

    if (history) {
      let query = admin
        .from("core_logs")
        .select("id,usuario_id,empresa_id,detalhes,created_at")
        .eq("app_slug", "dronegestor")
        .eq("acao", FINALIZED_ACTION)
        .order("created_at", { ascending: false })
        .limit(100);

      query = applyHistoryScope(query, current);
      const { data, error } = await query;

      if (error) throw error;
      return NextResponse.json({ ok: true, items: data ?? [] });
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

    const details = data?.detalhes && typeof data.detalhes === "object" ? data.detalhes : null;
    return NextResponse.json({
      ok: true,
      state: details && "state" in details ? (details as any).state : null,
      updatedAt: details && "updatedAt" in details ? (details as any).updatedAt : data?.created_at ?? null
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao carregar os dados do DroneGestor." },
      { status: 500 }
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
    const updatedAt = typeof body?.updatedAt === "string" ? body.updatedAt : new Date().toISOString();
    const admin = createSupabaseAdminClient() as any;

    const { data: existing, error: findError } = await admin
      .from("core_logs")
      .select("id")
      .eq("usuario_id", current.usuario.id)
      .eq("app_slug", "dronegestor")
      .eq("acao", STATE_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    const detalhes = { state, updatedAt, version: 2 };
    if (existing?.id) {
      const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("core_logs").insert({
        empresa_id: current.empresaId,
        usuario_id: current.usuario.id,
        app_slug: "dronegestor",
        acao: STATE_ACTION,
        detalhes
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, updatedAt });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar os dados do DroneGestor." },
      { status: 500 }
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
    const operationId = textValue(body?.operationId) || textValue(state.operationId);
    const pilotName = textValue(body?.pilotName) || current.usuario.nome || "Piloto";
    const admin = createSupabaseAdminClient() as any;
    const finalizedAt = new Date().toISOString();

    if (operationId) {
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
        return NextResponse.json({
          ok: true,
          duplicate: true,
          id: existing.id,
          finalizedAt: (existing.detalhes as any)?.finalizedAt ?? existing.created_at
        });
      }
    }

    const summary = buildOperationSummary(state, pilotName);
    const detalhes = {
      operationId: operationId || crypto.randomUUID(),
      finalizedAt,
      version: 3,
      summary,
      state
    };

    const { data, error } = await admin
      .from("core_logs")
      .insert({
        empresa_id: current.empresaId,
        usuario_id: current.usuario.id,
        app_slug: "dronegestor",
        acao: FINALIZED_ACTION,
        detalhes
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id, operationId: detalhes.operationId, finalizedAt });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao finalizar a operação no Supabase." },
      { status: 500 }
    );
  }
}
