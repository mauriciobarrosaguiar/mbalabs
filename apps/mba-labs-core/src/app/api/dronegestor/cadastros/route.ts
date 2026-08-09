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
  usuarioNome: string;
  usuarioTipo: string;
  empresaId: string | null;
  canManage: boolean;
};

const OS_STATUSES = ["aberta", "preparacao", "em_execucao", "concluida", "cancelada"] as const;

function normalizeType(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}

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

  const statusRaw = cleanText(source.status, 30);
  return {
    numero: cleanText(source.numero, 60),
    clienteId: cleanText(source.clienteId, 80),
    fazendaId: cleanText(source.fazendaId, 80),
    talhaoId: cleanText(source.talhaoId, 80),
    cultura: cleanText(source.cultura, 120),
    alvo: cleanText(source.alvo, 160),
    areaHa: cleanNumber(source.areaHa),
    dataPrevista: cleanText(source.dataPrevista, 30),
    status: OS_STATUSES.includes(statusRaw as any) ? statusRaw : "aberta",
    observacoes: cleanText(source.observacoes, 800),
    pilotoId: cleanText(source.pilotoId, 80),
    pilotoNome: cleanText(source.pilotoNome, 160),
    assumidaEm: cleanText(source.assumidaEm, 40),
    iniciadaEm: cleanText(source.iniciadaEm, 40),
    concluidaEm: cleanText(source.concluidaEm, 40),
    canceladaEm: cleanText(source.canceladaEm, 40),
    motivoCancelamento: cleanText(source.motivoCancelamento, 500),
    operacaoId: cleanText(source.operacaoId, 100)
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

  const normalized = normalizeType(context.profile.tipo);
  return {
    current: {
      usuarioId: context.profile.id,
      usuarioNome: context.profile.nome || "Piloto",
      usuarioTipo: context.profile.tipo,
      empresaId: context.profile.empresa_id,
      canManage: admin || ["admin_empresa", "responsavel_tecnico", "rt"].includes(normalized)
    },
    response: null
  };
}

function scopeQuery(query: any, current: ApiContext) {
  return current.empresaId ? query.eq("empresa_id", current.empresaId) : query.eq("usuario_id", current.usuarioId);
}

async function findEntity(admin: any, current: ApiContext, type: ResourceType, entityId: string, includeInactive = false) {
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
  if (!data || (!includeInactive && data.detalhes?.ativo === false)) return null;
  return data;
}

async function requireRelations(admin: any, current: ApiContext, type: ResourceType, data: Record<string, unknown>) {
  if (type === "fazenda") {
    if (!await findEntity(admin, current, "cliente", cleanText(data.clienteId, 80))) throw new Error("O cliente selecionado não existe ou está inativo.");
    return;
  }

  if (type === "talhao") {
    if (!await findEntity(admin, current, "fazenda", cleanText(data.fazendaId, 80))) throw new Error("A fazenda selecionada não existe ou está inativa.");
    return;
  }

  if (type === "os") {
    const cliente = await findEntity(admin, current, "cliente", cleanText(data.clienteId, 80));
    const fazenda = await findEntity(admin, current, "fazenda", cleanText(data.fazendaId, 80));
    const talhao = await findEntity(admin, current, "talhao", cleanText(data.talhaoId, 80));
    if (!cliente || !fazenda || !talhao) throw new Error("Cliente, fazenda e talhão precisam estar ativos.");
    const fazendaData = fazenda.detalhes?.data ?? {};
    const talhaoData = talhao.detalhes?.data ?? {};
    if (fazendaData.clienteId !== data.clienteId) throw new Error("A fazenda selecionada não pertence ao cliente informado.");
    if (talhaoData.fazendaId !== data.fazendaId) throw new Error("O talhão selecionado não pertence à fazenda informada.");
  }
}

async function hasDependency(admin: any, current: ApiContext, action: string, dataPatch: Record<string, unknown>) {
  let query = admin
    .from("core_logs")
    .select("id,detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", action)
    .contains("detalhes", { ativo: true, data: dataPatch })
    .limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function hasOpenOsDependency(admin: any, current: ApiContext, talhaoId: string) {
  let query = admin
    .from("core_logs")
    .select("id,detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", ACTIONS.os)
    .contains("detalhes", { ativo: true, data: { talhaoId } })
    .limit(500);
  query = scopeQuery(query, current);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).some((row: any) => ["aberta", "preparacao", "em_execucao"].includes(row.detalhes?.data?.status || "aberta"));
}

async function hasFinalizedOperationForOs(admin: any, current: ApiContext, osId: string) {
  let query = admin
    .from("core_logs")
    .select("id")
    .eq("app_slug", "dronegestor")
    .eq("acao", "operacao_finalizada")
    .contains("detalhes", { summary: { ordemServicoId: osId } })
    .limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

function onlyStatusPatch(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const allowed = new Set(["status", "motivoCancelamento"]);
  return Object.keys(value as Record<string, unknown>).every((key) => allowed.has(key));
}

async function loadNameMaps(admin: any, current: ApiContext) {
  const load = async (type: "cliente" | "fazenda" | "talhao") => {
    let query = admin
      .from("core_logs")
      .select("detalhes")
      .eq("app_slug", "dronegestor")
      .eq("acao", ACTIONS[type])
      .limit(500);
    query = scopeQuery(query, current);
    const { data, error } = await query;
    if (error) throw error;
    return new Map((data ?? []).filter((row: any) => row.detalhes?.ativo !== false).map((row: any) => [row.detalhes?.entityId, row.detalhes?.data ?? {}]));
  };
  const [clientes, fazendas, talhoes] = await Promise.all([load("cliente"), load("fazenda"), load("talhao")]);
  return { clientes, fazendas, talhoes };
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const type = request.nextUrl.searchParams.get("type");
    if (!isResourceType(type)) return NextResponse.json({ ok: false, error: "Tipo de cadastro inválido." }, { status: 400 });
    if (!current.canManage && type !== "os") return NextResponse.json({ ok: false, error: "Seu perfil não possui acesso aos dados administrativos desse cadastro." }, { status: 403 });

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

    let items = (data ?? [])
      .map((row: any) => ({ id: row.id, dbCreatedAt: row.created_at, ...(row.detalhes ?? {}) }))
      .filter((item: any) => item.ativo !== false);

    if (type === "os" && !current.canManage) {
      const maps = await loadNameMaps(admin, current);
      items = items
        .filter((item: any) => {
          const status = item.data?.status || "aberta";
          const assigned = cleanText(item.data?.pilotoId, 80);
          return ["aberta", "preparacao", "em_execucao"].includes(status) && (!assigned || assigned === current.usuarioId);
        })
        .map((item: any) => {
          const data = item.data ?? {};
          const cliente = maps.clientes.get(data.clienteId) as any;
          const fazenda = maps.fazendas.get(data.fazendaId) as any;
          const talhao = maps.talhoes.get(data.talhaoId) as any;
          return {
            id: item.id,
            entityId: item.entityId,
            type: "os",
            data: {
              numero: data.numero,
              clienteId: data.clienteId,
              clienteNome: cliente?.nome || "Cliente",
              fazendaId: data.fazendaId,
              fazendaNome: fazenda?.nome || "Fazenda",
              municipio: fazenda?.municipio || "",
              uf: fazenda?.uf || "",
              talhaoId: data.talhaoId,
              talhaoNome: talhao?.nome || "Talhão",
              cultura: data.cultura || talhao?.culturaPadrao || "",
              alvo: data.alvo || "",
              areaHa: data.areaHa || talhao?.areaHa || 0,
              dataPrevista: data.dataPrevista || "",
              status,
              pilotoNome: data.pilotoNome || ""
            }
          };
        });
    }

    return NextResponse.json({ ok: true, items, canManage: current.canManage });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar cadastros." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    if (!current.canManage) return NextResponse.json({ ok: false, error: "Somente administrador da empresa ou RT pode criar cadastros e ordens de serviço." }, { status: 403 });

    const body = await request.json();
    const type = cleanText(body?.type, 20);
    if (!isResourceType(type)) return NextResponse.json({ ok: false, error: "Tipo de cadastro inválido." }, { status: 400 });

    const data = cleanData(type, body?.data) as Record<string, unknown>;
    validateRequired(type, data);
    const admin = createSupabaseAdminClient() as any;
    await requireRelations(admin, current, type, data);
    const entityId = crypto.randomUUID();
    const now = new Date().toISOString();

    if (type === "os") {
      data.status = "aberta";
      data.pilotoId = "";
      data.pilotoNome = "";
      if (!data.numero) {
        const stamp = now.slice(0, 10).replaceAll("-", "");
        data.numero = `OS-${stamp}-${entityId.slice(0, 5).toUpperCase()}`;
      }
    }

    const detalhes = { entityId, type, ativo: true, createdAt: now, updatedAt: now, data };
    const { data: inserted, error } = await admin
      .from("core_logs")
      .insert({ empresa_id: current.empresaId, usuario_id: current.usuarioId, app_slug: "dronegestor", acao: ACTIONS[type], detalhes })
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

    const statusPatch = type === "os" && onlyStatusPatch(body?.data);
    if (!current.canManage && !statusPatch) return NextResponse.json({ ok: false, error: "Seu perfil não pode editar cadastros administrativos." }, { status: 403 });

    const admin = createSupabaseAdminClient() as any;
    const existing = await findEntity(admin, current, type, entityId);
    if (!existing) return NextResponse.json({ ok: false, error: "Registro não encontrado ou inativo." }, { status: 404 });

    const currentDetails = existing.detalhes ?? {};
    const currentData = currentDetails.data ?? {};
    const requestedStatus = type === "os" ? cleanText(body?.data?.status, 30) : "";

    let patch = body?.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : {};
    if (type === "os" && requestedStatus) {
      if (!OS_STATUSES.includes(requestedStatus as any)) return NextResponse.json({ ok: false, error: "Status de OS inválido." }, { status: 400 });
      const currentStatus = cleanText(currentData.status, 30) || "aberta";
      const assignedPilot = cleanText(currentData.pilotoId, 80);
      const assignedToOther = Boolean(assignedPilot && assignedPilot !== current.usuarioId);

      if (assignedToOther && !current.canManage && ["preparacao", "em_execucao", "concluida"].includes(requestedStatus)) {
        return NextResponse.json({ ok: false, error: `Esta OS já está assumida por ${cleanText(currentData.pilotoNome, 160) || "outro piloto"}.` }, { status: 409 });
      }
      if (["concluida", "cancelada"].includes(currentStatus) && requestedStatus !== currentStatus) {
        return NextResponse.json({ ok: false, error: "OS concluída ou cancelada não pode voltar ao fluxo operacional. Crie/duplique uma nova OS." }, { status: 409 });
      }
      if (requestedStatus === "preparacao" && !["aberta", "preparacao"].includes(currentStatus)) {
        return NextResponse.json({ ok: false, error: "Somente OS aberta pode entrar em preparação." }, { status: 409 });
      }
      if (requestedStatus === "em_execucao" && !["preparacao", "em_execucao"].includes(currentStatus)) {
        return NextResponse.json({ ok: false, error: "A OS precisa estar em preparação antes de iniciar a execução." }, { status: 409 });
      }
      if (requestedStatus === "cancelada") {
        if (!current.canManage) return NextResponse.json({ ok: false, error: "Somente ADMIN/RT pode cancelar uma OS." }, { status: 403 });
        const motivo = cleanText(body?.data?.motivoCancelamento, 500);
        if (!motivo) return NextResponse.json({ ok: false, error: "Informe o motivo do cancelamento da OS." }, { status: 400 });
        patch = { ...patch, canceladaEm: new Date().toISOString(), motivoCancelamento: motivo };
      }
      if (requestedStatus === "concluida" && !current.canManage && !await hasFinalizedOperationForOs(admin, current, entityId)) {
        return NextResponse.json({ ok: false, error: "A OS só pode ser concluída após o registro definitivo da operação no histórico." }, { status: 409 });
      }
      if (requestedStatus === "preparacao") {
        patch = {
          ...patch,
          pilotoId: assignedPilot || current.usuarioId,
          pilotoNome: cleanText(currentData.pilotoNome, 160) || current.usuarioNome,
          assumidaEm: cleanText(currentData.assumidaEm, 40) || new Date().toISOString()
        };
      }
      if (requestedStatus === "em_execucao") {
        patch = {
          ...patch,
          pilotoId: assignedPilot || current.usuarioId,
          pilotoNome: cleanText(currentData.pilotoNome, 160) || current.usuarioNome,
          iniciadaEm: cleanText(currentData.iniciadaEm, 40) || new Date().toISOString()
        };
      }
    }

    const data = cleanData(type, { ...currentData, ...patch }) as Record<string, unknown>;
    validateRequired(type, data);
    await requireRelations(admin, current, type, data);
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
    if (!current.canManage) return NextResponse.json({ ok: false, error: "Seu perfil não pode inativar cadastros." }, { status: 403 });

    const body = await request.json();
    const type = cleanText(body?.type, 20);
    const entityId = cleanText(body?.entityId, 80);
    if (!isResourceType(type) || !entityId) return NextResponse.json({ ok: false, error: "Cadastro inválido." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const existing = await findEntity(admin, current, type, entityId);
    if (!existing) return NextResponse.json({ ok: false, error: "Registro não encontrado ou inativo." }, { status: 404 });

    if (type === "cliente" && await hasDependency(admin, current, ACTIONS.fazenda, { clienteId: entityId })) return NextResponse.json({ ok: false, error: "Este cliente possui fazenda ativa. Inative/reorganize as dependências primeiro." }, { status: 409 });
    if (type === "fazenda" && await hasDependency(admin, current, ACTIONS.talhao, { fazendaId: entityId })) return NextResponse.json({ ok: false, error: "Esta fazenda possui talhão ativo. Inative/reorganize as dependências primeiro." }, { status: 409 });
    if (type === "talhao" && await hasOpenOsDependency(admin, current, entityId)) return NextResponse.json({ ok: false, error: "Este talhão possui OS aberta/em preparação/em execução. Finalize ou cancele essas OS primeiro." }, { status: 409 });
    if (type === "os") {
      const status = existing.detalhes?.data?.status || "aberta";
      if (["preparacao", "em_execucao", "concluida"].includes(status)) return NextResponse.json({ ok: false, error: "OS em preparação, execução ou concluída não pode ser inativada. Cancele quando aplicável." }, { status: 409 });
    }

    const detalhes = { ...(existing.detalhes ?? {}), ativo: false, updatedAt: new Date().toISOString() };
    const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao remover cadastro." }, { status: 500 });
  }
}
