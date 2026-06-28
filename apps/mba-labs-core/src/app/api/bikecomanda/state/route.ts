import { NextResponse, type NextRequest } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";

const APP_SLUG = "bikecomanda";
const COLLECTIONS = [
  "usuarios",
  "configuracoes_loja",
  "clientes",
  "bicicletas",
  "mecanicos",
  "servicos",
  "produtos",
  "comandas",
  "comanda_servicos",
  "comanda_produtos",
  "pagamentos",
  "comissoes",
  "historico_comandas"
] as const;

type JsonRecord = Record<string, any>;

type PortalUser = {
  id: string;
  nome: string;
  email: string;
  perfil: "Admin" | "Atendente" | "Mecânico";
  ativo: boolean;
  source: "mba-labs";
  empresa_id: string | null;
  empresa_nome: string;
  core_usuario_id: string;
  tipo_core: string;
  created_at: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireAppAccess(APP_SLUG, "/bikecomanda");
    const supabase = await getSupabaseServer();
    const empresaNome = await getEmpresaNome(supabase as any, current.empresaId);
    const scope = getScope(current);
    const portalUser = buildPortalUser(current, empresaNome);

    const { data, error } = await (supabase as any)
      .from("bike_app_state")
      .select("data,updated_at")
      .eq("scope_key", scope.scopeKey)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      hasData: Boolean(data?.data),
      data: data?.data ?? null,
      updatedAt: data?.updated_at ?? null,
      portalUser,
      scope
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao carregar dados do BikeComanda." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const current = await requireAppAccess(APP_SLUG, "/bikecomanda");
    const supabase = await getSupabaseServer();
    const empresaNome = await getEmpresaNome(supabase as any, current.empresaId);
    const scope = getScope(current);
    const portalUser = buildPortalUser(current, empresaNome);
    const body = await request.json().catch(() => ({}));
    const payload = normalizeBikeData(body?.data ?? body, portalUser, current.empresaId);

    const { error } = await (supabase as any).from("bike_app_state").upsert(
      {
        scope_key: scope.scopeKey,
        empresa_id: current.empresaId,
        data: payload,
        updated_by: current.usuario.id,
        updated_at: new Date().toISOString()
      },
      { onConflict: "scope_key" }
    );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updatedAt: new Date().toISOString(), portalUser, scope });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao salvar dados do BikeComanda." },
      { status: 500 }
    );
  }
}

function getScope(current: Awaited<ReturnType<typeof requireAppAccess>>) {
  const scopeKey = current.empresaId ? `empresa:${current.empresaId}` : `usuario:${current.usuario.id}`;
  return {
    scopeKey,
    empresaId: current.empresaId,
    usuarioId: current.usuario.id
  };
}

async function getEmpresaNome(supabase: any, empresaId: string | null) {
  if (!empresaId) return "BikeComanda";

  const { data } = await supabase.from("core_empresas").select("nome,nome_fantasia,razao_social").eq("id", empresaId).maybeSingle();
  return data?.nome_fantasia || data?.nome || data?.razao_social || "BikeComanda";
}

function buildPortalUser(current: Awaited<ReturnType<typeof requireAppAccess>>, empresaNome: string): PortalUser {
  const tipo = current.usuario.tipo || "admin_empresa";
  const perfil = mapPerfil(tipo, current.isAdminMaster);
  const now = new Date().toISOString();

  return {
    id: `portal_${current.usuario.id}`,
    nome: current.usuario.nome || current.authUser.email || "Usuário MBA Labs",
    email: current.usuario.email || current.authUser.email || "",
    perfil,
    ativo: true,
    source: "mba-labs",
    empresa_id: current.empresaId,
    empresa_nome: empresaNome,
    core_usuario_id: current.usuario.id,
    tipo_core: tipo,
    created_at: now
  };
}

function mapPerfil(tipo: string, isAdminMaster: boolean): PortalUser["perfil"] {
  if (isAdminMaster) return "Admin";
  const normalized = tipo.toLowerCase();
  if (["admin_master", "admin_empresa", "dono", "gerente", "caixa"].includes(normalized)) return "Admin";
  if (normalized.includes("mecanico") || normalized.includes("mecânico")) return "Mecânico";
  return "Atendente";
}

function normalizeBikeData(input: unknown, portalUser: PortalUser, empresaId: string | null) {
  const data: JsonRecord = isRecord(input) ? JSON.parse(JSON.stringify(input)) : {};
  const now = new Date().toISOString();

  for (const collection of COLLECTIONS) {
    if (!Array.isArray(data[collection])) data[collection] = [];
    data[collection] = data[collection].map((item: unknown) => tagEmpresa(item, empresaId));
  }

  data.usuarios = [portalUser];
  data.session = { userId: portalUser.id, source: "mba-labs", synced_at: now };
  data.configuracoes_loja = normalizeSettings(data.configuracoes_loja, portalUser, empresaId, now);
  data.product_ready = {
    ...(isRecord(data.product_ready) ? data.product_ready : {}),
    persistence: "supabase",
    state_table: "bike_app_state",
    empresa_id: empresaId,
    updated_at: now
  };

  return data;
}

function normalizeSettings(settings: unknown, portalUser: PortalUser, empresaId: string | null, now: string) {
  const current = Array.isArray(settings) && isRecord(settings[0]) ? settings[0] : {};

  return [
    {
      id: current.id || "cfg_1",
      nome_loja: current.nome_loja || portalUser.empresa_nome || "BikeComanda",
      whatsapp_loja: current.whatsapp_loja || "",
      endereco_loja: current.endereco_loja || "",
      limite_desconto_atendente: Number(current.limite_desconto_atendente ?? 10),
      comissao_sobre_valor_com_desconto: Boolean(current.comissao_sobre_valor_com_desconto),
      empresa_id: empresaId,
      created_at: current.created_at || now,
      updated_at: now
    }
  ];
}

function tagEmpresa(item: unknown, empresaId: string | null) {
  if (!isRecord(item)) return item;
  return { ...item, empresa_id: empresaId };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
