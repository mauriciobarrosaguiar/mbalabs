import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const ACTIONS = {
  cliente: "cadastro_cliente",
  fazenda: "cadastro_fazenda",
  talhao: "cadastro_talhao",
  os: "ordem_servico"
} as const;

type ResourceType = keyof typeof ACTIONS;

type ApiContext = {
  usuarioId: string;
  usuarioTipo: string;
  empresaId: string | null;
};

function isResourceType(value: string | null): value is ResourceType {
  return value === "cliente" || value === "fazenda" || value === "talhao" || value === "os";
}

function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanData(type: ResourceType, value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

  if (type === "cliente") {
    return {
      nome: cleanText(source.nome),
      cpfCnpj: cleanText(source.cpfCnpj, 30),
      telefone: cleanText(source.telefone, 40),
      email: cleanText(source.email, 120),
      observacoes: cleanText(source.observacoes, 500)
    };
  }

  if (type === "fazenda") {
    return {
      clienteId: cleanText(source.clienteId, 80),
      nome: cleanText(source.nome),
      municipio: cleanText(source.municipio, 120),
      uf: cleanText(source.uf, 2).toUpperCase(),
      endereco: cleanText(source.endereco, 240),
      latitude: cleanNumber(source.latitude),
      longitude: cleanNumber(source.longitude),
      observacoes: cleanText(source.observacoes, 500)
    };
  }

  if (type === "talhao") {
    return {
      fazendaId: cleanText(source.fazendaId, 80),
      nome: cleanText(source.nome),
      areaHa: cleanNumber(source.areaHa),
      culturaPadrao: cleanText(source.culturaPadrao, 120),
      latitude: cleanNumber(source.latitude),
      longitude: cleanNumber(source.longitude),
      observacoes: cleanText(source.observacoes, 500)
    };
  }

  return {
    numero: cleanText(source.numero, 60),
    clienteId: cleanText(source.clienteId, 80),
    fazendaId: cleanText(source.fazendaId, 80),
    talhaoId: cleanText(source.talhaoId, 80),
    cultura: cleanText(source.cultura, 120),
    alvo: cleanText(source.alvo, 160),
    areaHa: cleanNumber(source.areaHa),
    dataPrevista: cleanText(source.dataPrevista, 30),
    status: ["aberta", "em_execucao", "concluida", "cancelada"].includes(cleanText(source.status, 30)) ? cleanText(source.status, 30) : "aberta",
    observacoes: cleanText(source.observacoes, 800)
  };
}

function validateRequired(type: ResourceType, data: Record<string, unknown>) {
  if (type === "cliente" && !data.nome) throw new Error("Informe o nome do cliente.");
  if (type === "fazenda" && (!data.clienteId || !data.nome || !data.municipio || !data.uf)) throw new Error("Informe cliente, fazenda, município e UF.");
  if (type === "talhao" && (!data.fazendaId || !data.nome || cleanNumber(data.areaHa) <= 0)) throw new Error("Informe fazenda, nome do talhão e área maior que zero.");
  if (type === "os" && (!data.clienteId || !data.fazendaId || !data.talhaoId || cleanNumber(data.areaHa) <= 0)) throw new Error("Informe cliente, fazenda, talhão e área da ordem de serviço.");
}

async function getContext(): Promise<{ current: ApiContext | null; response: NextResponse | null }> {
  const context = await getSessionProfile();
  if (!context.user || !context.profile) {
    return { current: null, response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };
  }

  const admin = ["super_admin", "admin_master"].includes(context.profile.tipo);
  const allowed = (context.appsLiberados ?? []).some((app) => app.slug === "dronegestor" && app.canAccess);
  if (!admin && !allowed) {
    return { current: null, response: NextResponse.json({ ok: false, error: "Acesso ao DroneGestor não liberado." }, { status: 403 }) };
  }

  return {
    current: {
      usuarioId: context.profile.id,
      usuarioTipo: context.profile.tipo,
      empresaId: context.profile.empresa_id
    },
    response: null
  };
}

function scopeQuery(query: any, current: ApiContext) {
  return current.empresaId ? query.eq("empresa_id", current.empresaId) : query.eq("usuario_id", current.usuarioId);
}

async function findEntity(admin: any, current: ApiContext, type: ResourceType, entityId: string) {
  let query = admin
    .from("core_logs")
    .select("id,detalhes,created_at")
    .eq("app_slug", "dronegestor")
    .eq("acao", ACTIONS[type])
    .contains("detalhes", { entityId })
    .limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const type = request.nextUrl.searchParams.get("type");
    if (!isResourceType(type)) return NextResponse.json({ ok: false, error: "Tipo de cadastro inválido." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    let query = admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("app_slug", "dronegestor")
      .eq("acao", ACTIONS[type])
      .order("created_at", { ascending: false })
      .limit(500);
    query = scopeQuery(query, current);
    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? [])
      .map((row: any) => ({ id: row.id, dbCreatedAt: row.created_at, ...(row.detalhes ?? {}) }))
      .filter((item: any) => item.ativo !== false);

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar cadastros." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const body = await request.json();
    const type = cleanText(body?.type, 20);
    if (!isResourceType(type)) return NextResponse.json({ ok: false, error: "Tipo de cadastro inválido." }, { status: 400 });

    const data = cleanData(type, body?.data) as Record<string, unknown>;
    validateRequired(type, data);
    const admin = createSupabaseAdminClient() as any;
    const entityId = crypto.randomUUID();
    const now = new Date().toISOString();

    if (type === "os" && !data.numero) {
      const stamp = now.slice(0, 10).replaceAll("-", "");
      data.numero = `OS-${stamp}-${entityId.slice(0, 5).toUpperCase()}`;
    }

    const detalhes = { entityId, type, ativo: true, createdAt: now, updatedAt: now, data };
    const { data: inserted, error } = await admin
      .from("core_logs")
      .insert({
        empresa_id: current.empresaId,
        usuario_id: current.usuarioId,
        app_slug: "dronegestor",
        acao: ACTIONS[type],
        detalhes
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, item: { id: inserted.id, ...detalhes } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao salvar cadastro." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const body = await request.json();
    const type = cleanText(body?.type, 20);
    const entityId = cleanText(body?.entityId, 80);
    if (!isResourceType(type) || !entityId) return NextResponse.json({ ok: false, error: "Cadastro inválido." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const existing = await findEntity(admin, current, type, entityId);
    if (!existing) return NextResponse.json({ ok: false, error: "Registro não encontrado." }, { status: 404 });

    const currentDetails = existing.detalhes ?? {};
    const currentData = currentDetails.data ?? {};
    const data = cleanData(type, { ...currentData, ...(body?.data ?? {}) }) as Record<string, unknown>;
    validateRequired(type, data);
    const detalhes = { ...currentDetails, entityId, type, ativo: true, updatedAt: new Date().toISOString(), data };
    const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, item: { id: existing.id, ...detalhes } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao atualizar cadastro." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const body = await request.json();
    const type = cleanText(body?.type, 20);
    const entityId = cleanText(body?.entityId, 80);
    if (!isResourceType(type) || !entityId) return NextResponse.json({ ok: false, error: "Cadastro inválido." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const existing = await findEntity(admin, current, type, entityId);
    if (!existing) return NextResponse.json({ ok: false, error: "Registro não encontrado." }, { status: 404 });
    const detalhes = { ...(existing.detalhes ?? {}), ativo: false, updatedAt: new Date().toISOString() };
    const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao remover cadastro." }, { status: 500 });
  }
}
