import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import {
  droneOsErrorResponse,
  requireDroneOsAccess,
  scopeDroneOsQuery,
} from "@/lib/dronegestor-os-access";

export const dynamic = "force-dynamic";

const ACTION = "sarpas_operacao_v1";
const PILOT_ACTION = "piloto_operacional_v1";
const STATUSES = new Set(["nao_solicitado", "em_preparacao", "solicitado", "autorizado", "negado"]);
const LEGACY_INVALID = new Set(["dispensado", "nao_aplicavel"]);

type Context = {
  userId: string;
  empresaId: string | null;
  userName: string;
  canManage: boolean;
};

function normalize(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}
function text(v: unknown, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function context(): Promise<{ current: Context | null; response: NextResponse | null }> {
  const s = await getSessionProfile();
  if (!s.user || !s.profile)
    return {
      current: null,
      response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }),
    };
  const t = normalize(s.profile.tipo || "");
  const master = ["super_admin", "admin_master"].includes(t);
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
      empresaId: s.profile.empresa_id,
      userName: s.profile.nome || "Piloto",
      canManage: master || ["admin_empresa", "responsavel_tecnico", "rt"].includes(t),
    },
    response: null,
  };
}

function sanitize(source: any) {
  const status = text(source?.status, 40);
  return {
    status: STATUSES.has(status) ? status : "nao_solicitado",
    numero: text(source?.numero, 120),
    solicitadoEm: text(source?.solicitadoEm, 40),
    validoDe: text(source?.validoDe, 40),
    validoAte: text(source?.validoAte, 40),
    observacao: text(source?.observacao, 800),
    ordemServicoId: text(source?.ordemServicoId, 120),
    ordemServicoNumero: text(source?.ordemServicoNumero, 120),
  };
}

async function canRegisterSarpas(admin: any, current: Context) {
  if (current.canManage || !current.empresaId) return true;
  let query = admin
    .from("core_logs")
    .select("detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", PILOT_ACTION)
    .contains("detalhes", { usuarioId: current.userId, ativo: true })
    .limit(1);
  query = scopeDroneOsQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  // A permissão padrão de SARPAS é restrita ao gestor/RT. Se o piloto não tem
  // cadastro operacional, não presumimos autorização para registrar uma liberação oficial.
  return data?.detalhes?.permissoes?.registrarSarpas === true;
}

export async function GET(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const current = access.current!;
    const admin = createSupabaseAdminClient() as any;
    const osId = text(request.nextUrl.searchParams.get("osId"), 120);
    if (!osId) return NextResponse.json({ ok: true, sarpas: null });

    await requireDroneOsAccess(admin, current, osId);

    let query = admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("app_slug", "dronegestor")
      .eq("acao", ACTION)
      .contains("detalhes", { ordemServicoId: osId })
      .order("created_at", { ascending: false })
      .limit(1);
    query = scopeDroneOsQuery(query, current);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      sarpas: data
        ? {
            ...sanitize(data.detalhes),
            updatedAt: data.created_at,
            updatedBy: text(data?.detalhes?.updatedBy, 180),
          }
        : null,
    });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao carregar SARPAS." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const current = access.current!;
    const body = await request.json();
    const rawStatus = text(body?.status, 40);
    if (LEGACY_INVALID.has(rawStatus))
      return NextResponse.json(
        {
          ok: false,
          error:
            "Para aplicação agrícola, o DroneGestor exige a autorização SARPAS registrada. As opções genéricas de dispensa/não aplicável foram removidas do fluxo.",
        },
        { status: 400 },
      );

    const sarpas = sanitize(body);
    if (!sarpas.ordemServicoId)
      return NextResponse.json(
        { ok: false, error: "Selecione uma OS antes de registrar o SARPAS." },
        { status: 400 },
      );
    if (sarpas.status === "autorizado" && !sarpas.numero)
      return NextResponse.json(
        { ok: false, error: "Informe o número da autorização SARPAS." },
        { status: 400 },
      );

    const admin = createSupabaseAdminClient() as any;
    await requireDroneOsAccess(admin, current, sarpas.ordemServicoId);
    if (!(await canRegisterSarpas(admin, current)))
      return NextResponse.json(
        {
          ok: false,
          error:
            "Seu perfil não tem permissão para registrar SARPAS. Peça ao gestor/RT para registrar a situação desta OS.",
        },
        { status: 403 },
      );

    const now = new Date().toISOString();
    const details = { ...sarpas, updatedAt: now, updatedBy: current.userName };
    const { error } = await admin.from("core_logs").insert({
      empresa_id: current.empresaId,
      usuario_id: current.userId,
      app_slug: "dronegestor",
      acao: ACTION,
      detalhes: details,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, sarpas: details });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar SARPAS." },
      { status: 500 },
    );
  }
}
