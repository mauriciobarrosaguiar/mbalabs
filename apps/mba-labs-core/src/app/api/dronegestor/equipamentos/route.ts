import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const ACTION = "cadastro_equipamento";
type ApiContext = {
  usuarioId: string;
  usuarioNome: string;
  empresaId: string | null;
  canManage: boolean;
};

function normalizeType(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}
function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function cleanNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function cleanData(value: unknown) {
  const s = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    nome: cleanText(s.nome, 120),
    marca: cleanText(s.marca, 80) || "DJI",
    modelo: cleanText(s.modelo, 100),
    numeroSerie: cleanText(s.numeroSerie, 120),
    registroAnac: cleanText(s.registroAnac, 120),
    tanqueL: Math.max(0, cleanNumber(s.tanqueL)),
    pontaModelo: cleanText(s.pontaModelo, 160),
    faixaPadraoM: Math.max(0, cleanNumber(s.faixaPadraoM)),
    velocidadePadraoKmh: Math.max(0, cleanNumber(s.velocidadePadraoKmh)),
    alturaPadraoM: Math.max(0, cleanNumber(s.alturaPadraoM)),
    volumePadraoLHa: Math.max(0, cleanNumber(s.volumePadraoLHa)),
    observacoes: cleanText(s.observacoes, 800)
  };
}
function validate(data: ReturnType<typeof cleanData>) {
  if (!data.nome) throw new Error("Informe um nome fácil para identificar o drone.");
  if (!data.modelo) throw new Error("Informe o modelo do drone.");
  if (!data.registroAnac) throw new Error("Informe a identificação/registro ANAC do drone.");
  if (data.tanqueL <= 0) throw new Error("Informe a capacidade do tanque em litros.");
  if (!data.pontaModelo) throw new Error("Informe o bico ou atomizador usado por padrão.");
}
async function getContext(): Promise<{ current: ApiContext | null; response: NextResponse | null }> {
  const context = await getSessionProfile();
  if (!context.user || !context.profile) {
    return { current: null, response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };
  }
  const normalized = normalizeType(context.profile.tipo);
  const admin = ["super_admin", "admin_master"].includes(normalized);
  const allowed = (context.appsLiberados ?? []).some((app) => app.slug === "dronegestor" && app.canAccess);
  if (!admin && !allowed) {
    return { current: null, response: NextResponse.json({ ok: false, error: "Acesso ao DroneGestor não liberado." }, { status: 403 }) };
  }
  return {
    current: {
      usuarioId: context.profile.id,
      usuarioNome: context.profile.nome || "Usuário",
      empresaId: context.profile.empresa_id,
      canManage: canManageDroneGestor({ tipo: context.profile.tipo, isAdminMaster: admin, permissoes: context.permissoes })
    },
    response: null
  };
}
function scopeQuery(query: any, current: ApiContext) {
  return current.empresaId ? query.eq("empresa_id", current.empresaId) : query.eq("usuario_id", current.usuarioId);
}
async function findEquipment(admin: any, current: ApiContext, entityId: string) {
  let query = admin
    .from("core_logs")
    .select("id,detalhes,created_at")
    .eq("app_slug", "dronegestor")
    .eq("acao", ACTION)
    .contains("detalhes", { entityId })
    .limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function GET() {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const admin = createSupabaseAdminClient() as any;
    let query = admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("app_slug", "dronegestor")
      .eq("acao", ACTION)
      .order("created_at", { ascending: false })
      .limit(100);
    query = scopeQuery(query, current);
    const { data, error } = await query;
    if (error) throw error;
    const items = (data ?? [])
      .map((row: any) => ({ id: row.id, dbCreatedAt: row.created_at, ...(row.detalhes ?? {}) }))
      .filter((item: any) => item.ativo !== false);
    return NextResponse.json({ ok: true, items, canManage: current.canManage });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar equipamentos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    if (!current.canManage) return NextResponse.json({ ok: false, error: "Somente ADMIN/RT pode cadastrar equipamentos." }, { status: 403 });
    const body = await request.json();
    const data = cleanData(body?.data);
    validate(data);
    const admin = createSupabaseAdminClient() as any;
    const entityId = crypto.randomUUID();
    const now = new Date().toISOString();
    const detalhes = { entityId, type: "equipamento", ativo: true, createdAt: now, updatedAt: now, data };
    const { data: inserted, error } = await admin.from("core_logs").insert({
      empresa_id: current.empresaId,
      usuario_id: current.usuarioId,
      app_slug: "dronegestor",
      acao: ACTION,
      detalhes
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, item: { id: inserted.id, ...detalhes } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao salvar equipamento." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    if (!current.canManage) return NextResponse.json({ ok: false, error: "Somente ADMIN/RT pode alterar equipamentos." }, { status: 403 });
    const body = await request.json();
    const entityId = cleanText(body?.entityId, 80);
    if (!entityId) return NextResponse.json({ ok: false, error: "Equipamento inválido." }, { status: 400 });
    const admin = createSupabaseAdminClient() as any;
    const existing = await findEquipment(admin, current, entityId);
    if (!existing || existing.detalhes?.ativo === false) return NextResponse.json({ ok: false, error: "Equipamento não encontrado." }, { status: 404 });
    const data = cleanData({ ...(existing.detalhes?.data ?? {}), ...(body?.data ?? {}) });
    validate(data);
    const detalhes = { ...existing.detalhes, data, updatedAt: new Date().toISOString() };
    const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, item: { id: existing.id, ...detalhes } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao alterar equipamento." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    if (!current.canManage) return NextResponse.json({ ok: false, error: "Somente ADMIN/RT pode inativar equipamentos." }, { status: 403 });
    const body = await request.json();
    const entityId = cleanText(body?.entityId, 80);
    if (!entityId) return NextResponse.json({ ok: false, error: "Equipamento inválido." }, { status: 400 });
    const admin = createSupabaseAdminClient() as any;
    const existing = await findEquipment(admin, current, entityId);
    if (!existing || existing.detalhes?.ativo === false) return NextResponse.json({ ok: false, error: "Equipamento não encontrado." }, { status: 404 });
    const detalhes = { ...existing.detalhes, ativo: false, updatedAt: new Date().toISOString() };
    const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao inativar equipamento." }, { status: 500 });
  }
}
