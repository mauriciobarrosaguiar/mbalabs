import {canReactivatePilot,explicitPilotPermissions} from "@/lib/agrovoo-pilot-reactivation";
import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createOrLinkPilotAccount, PilotAccountError } from "@/lib/dronegestor-pilot-account";
import { canAdministerDroneCompany } from "@/lib/dronegestor-company-access";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const ACTION = "piloto_operacional_v1";

type Permissions = {
  executarOs: boolean;
  editarParametros: boolean;
  editarSeguranca: boolean;
  registrarSarpas: boolean;
  anexarEvidencias: boolean;
  finalizarOperacao: boolean;
  verRelatorios: boolean;
};

type Pilot = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  observacoes: string;
  ativo: boolean;
  usuarioId: string;
  permissoes: Permissions;
  createdAt?: string;
  updatedAt?: string;
};

type Context = {
  usuarioId: string;
  usuarioNome: string;
  empresaId: string | null;
  canManage: boolean;
  canAdministerTeam: boolean;
};

const defaultPermissions: Permissions = {
  executarOs: true,
  editarParametros: false,
  editarSeguranca: true,
  registrarSarpas: false,
  anexarEvidencias: true,
  finalizarOperacao: true,
  verRelatorios: false,
};

class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "_");
}

function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function permissions(value: unknown): Permissions {
  return explicitPilotPermissions(defaultPermissions,value);
}

function sanitize(value: unknown, id: string): Pilot {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    id,
    nome: text(source.nome, 180),
    cpf: text(source.cpf, 32),
    telefone: text(source.telefone, 40),
    email: text(source.email, 180).toLowerCase(),
    observacoes: text(source.observacoes, 500),
    ativo: source.ativo !== false,
    usuarioId: text(source.usuarioId, 80),
    permissoes: permissions(source.permissoes),
    createdAt: text(source.createdAt, 40),
    updatedAt: text(source.updatedAt, 40),
  };
}

async function context(): Promise<{ current: Context | null; response: NextResponse | null }> {
  const data = await getSessionProfile();
  if (!data.user || !data.profile) {
    return { current: null, response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };
  }

  if (data.profile.status !== "ativo") return { current: null, response: NextResponse.json({ ok: false, error: "Acesso inativo." }, { status: 403 }) };
  const type = normalize(data.profile.tipo);
  const master = ["super_admin", "admin_master"].includes(type);
  const allowed = (data.appsLiberados ?? []).some((app) => app.slug === "dronegestor" && app.canAccess);
  if (!master && !allowed) {
    return { current: null, response: NextResponse.json({ ok: false, error: "Acesso ao DroneGestor não liberado." }, { status: 403 }) };
  }

  return {
    current: {
      usuarioId: data.profile.id,
      usuarioNome: data.profile.nome || "Gestor",
      empresaId: data.profile.empresa_id,
      canAdministerTeam: canAdministerDroneCompany({ tipo: data.profile.tipo, isAdminMaster: master, permissoes: data.permissoes }),
      canManage: canManageDroneGestor({ tipo: data.profile.tipo, isAdminMaster: master, permissoes: data.permissoes }),
    },
    response: null,
  };
}

function scope(query: any, current: Context) {
  return current.empresaId ? query.eq("empresa_id", current.empresaId) : query.eq("usuario_id", current.usuarioId);
}

async function findRow(admin: any, current: Context, id: string) {
  let query = admin
    .from("core_logs")
    .select("id,detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", ACTION)
    .contains("detalhes", { id })
    .order("created_at",{ascending:false})
    .limit(1);
  query = scope(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function getDroneGestorApp(admin: any, current: Context, requireCompany = false) {
  const appResult = await admin.from("core_apps").select("id").eq("slug", "dronegestor").eq("ativo", true).maybeSingle();
  if (appResult.error || !appResult.data?.id) {
    throw new ApiError("O DroneGestor não está disponível para criar acessos agora.", 503);
  }

  if (!current.empresaId) {
    if (requireCompany) throw new ApiError("Defina a empresa do gestor antes de cadastrar um piloto.", 400);
    return String(appResult.data.id);
  }

  const contract = await admin
    .from("core_empresa_apps")
    .select("id,data_vencimento")
    .eq("empresa_id", current.empresaId)
    .eq("app_id", appResult.data.id)
    .in("status", ["ativo", "teste"])
    .maybeSingle();
  if (contract.error) throw contract.error;
  if (!contract.data) {
    throw new ApiError("O DroneGestor não está ativo para esta empresa. Regularize o acesso antes de cadastrar pilotos.", 403);
  }

  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date());
  if(contract.data.data_vencimento&&contract.data.data_vencimento.slice(0,10)<today)throw new ApiError("O acesso da empresa está vencido.",403);
  return String(appResult.data.id);
}

async function linkUser(admin: any, current: Context, pilot: Pilot, appId: string) {
  if (!pilot.ativo || !pilot.email || !current.empresaId) return { ...pilot, usuarioId: "" };

  const userResult = await admin
    .from("core_usuarios")
    .select("id,status,empresa_id")
    .ilike("email", pilot.email.replace(/[\\%_]/g, "\\$&"))
    .eq("empresa_id", current.empresaId)
    .limit(1)
    .maybeSingle();
  if(userResult.error)throw userResult.error;
  if (userResult.data?.status !== "ativo") return { ...pilot, usuarioId: "" };

  const permissionResult = await admin
    .from("core_usuario_app_permissoes")
    .select("id")
    .eq("usuario_id", userResult.data.id)
    .eq("empresa_id", current.empresaId)
    .eq("app_id", appId)
    .eq("status", "ativo")
    .in("perfil_app", ["piloto", "aplicador_caar"])
    .maybeSingle();

  if(permissionResult.error)throw permissionResult.error;
  return { ...pilot, usuarioId: permissionResult.data?.id ? String(userResult.data.id) : "" };
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof PilotAccountError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json({ ok: false, error: fallback }, { status: 500 });
}

export async function GET(request:NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const current = access.current!;
    const admin = createSupabaseAdminClient() as any;
    let appId:string;
    try {appId=await getDroneGestorApp(admin,current);}
    catch(error) {
      // A missing team contract must not prevent the already authorized
      // manager from seeing their own identity or preparing a solo OS.
      // It never authorizes creating, editing or linking collaborators.
      if(current.canManage && error instanceof ApiError && error.status===403) {
        return NextResponse.json({ok:true,items:[],canManage:current.canManage,canCreatePilot:false,canAdministerTeam:false,teamUnavailable:true,teamMessage:error.message,currentUserId:current.usuarioId,currentUserName:current.usuarioNome,defaultPermissions});
      }
      throw error;
    }

    let query = admin
      .from("core_logs")
      .select("detalhes,created_at")
      .eq("app_slug", "dronegestor")
      .eq("acao", ACTION)
      .order("created_at", { ascending: false })
      .limit(301);
    query = scope(query, current);
    const { data, error } = await query;
    if (error) throw error;

    if((data??[]).length>300)throw new ApiError("Equipe excede o limite desta consulta. Solicite revisão do cadastro.",409);
    const seen=new Set<string>(),seenUsers=new Set<string>();
    const records:Pilot[]=(data??[]).map((row:any)=>sanitize(row.detalhes,row.detalhes?.id||"")).filter((item:Pilot)=>{
      if(!item.id||seen.has(item.id)||(item.usuarioId&&seenUsers.has(item.usuarioId)))return false;
      seen.add(item.id);if(item.usuarioId)seenUsers.add(item.usuarioId);return true;
    });
    const raw=records.filter(item=>item.ativo);
    const inactiveItems=current.canAdministerTeam&&request.nextUrl.searchParams.get("includeInactive")==="1"?records.filter(item=>!item.ativo).map(item=>({id:item.id,nome:item.nome,email:item.email})):[];
    const linked = await Promise.all(raw.map((item: Pilot) => linkUser(admin, current, item, appId)));
    const items = current.canManage ? linked : linked.filter((item: Pilot) => item.usuarioId === current.usuarioId);

    return NextResponse.json({
      ok: true,
      items,
      inactiveItems,
      canManage: current.canManage,
      canAdministerTeam: current.canAdministerTeam,
      canCreatePilot: current.canAdministerTeam && Boolean(current.empresaId),
      teamUnavailable: false,
      defaultPermissions,
      currentUserId: current.usuarioId,
      currentUserName: current.usuarioNome,
    });
  } catch (error) {
    return errorResponse(error, "Não foi possível carregar os pilotos agora.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const current = access.current!;
    if (!current.canAdministerTeam) {
      return NextResponse.json({ ok: false, error: "Somente o administrador da empresa pode cadastrar pilotos." }, { status: 403 });
    }

    const body = await request.json();
    const existingPilotId = text(body?.pilotId, 80);
    const now = new Date().toISOString();
    const admin = createSupabaseAdminClient() as any;
    const appId = await getDroneGestorApp(admin, current, true);
    const existingRow = existingPilotId ? await findRow(admin, current, existingPilotId) : null;
    if (existingPilotId && !existingRow) {
      return NextResponse.json({ ok: false, error: "Piloto não encontrado nesta empresa." }, { status: 404 });
    }
    if (existingRow) {
      if(existingRow.detalhes?.ativo===false)return NextResponse.json({ok:false,error:"Use a opção Reativar acesso existente."},{status:409});
      const alreadyLinked = await linkUser(admin, current, sanitize(existingRow.detalhes, existingPilotId), appId);
      if (alreadyLinked.usuarioId) {
        return NextResponse.json({ ok: false, error: "Este piloto já possui acesso ativo ao DroneGestor." }, { status: 409 });
      }
    }

    const id = existingPilotId || crypto.randomUUID();
    const base = existingRow?.detalhes ?? {};
    let pilot = sanitize(
      {
        ...base,
        ...body,
        id,
        ativo: true,
        createdAt: text(base?.createdAt, 40) || now,
        updatedAt: now,
        permissoes: body?.permissoes ?? base?.permissoes ?? defaultPermissions,
      },
      id,
    );
    if (!pilot.nome) {
      return NextResponse.json({ ok: false, error: "Informe o nome do piloto." }, { status: 400 });
    }
    if (!pilot.email || !validEmail(pilot.email)) {
      return NextResponse.json({ ok: false, error: "Informe um e-mail válido para o piloto entrar no aplicativo." }, { status: 400 });
    }

    let duplicateQuery = admin
      .from("core_logs")
      .select("id,detalhes")
      .eq("app_slug", "dronegestor")
      .eq("acao", ACTION)
      .contains("detalhes", { email: pilot.email })
      .limit(1);
    duplicateQuery = scope(duplicateQuery, current);
    const duplicate = await duplicateQuery.maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (
      duplicate.data &&
      String(duplicate.data.detalhes?.id ?? "") !== existingPilotId
    ) {
      return NextResponse.json({ ok: false, error: "Já existe um cadastro de piloto com este e-mail. Consulte os registros existentes." }, { status: 409 });
    }

    const account = await createOrLinkPilotAccount(admin, current, appId, {
      nome: pilot.nome,
      email: pilot.email,
      telefone: pilot.telefone,
      senhaAcesso: text(body?.senhaAcesso, 200),
    });
    pilot = { ...pilot, usuarioId: account.usuarioId };

    const saveResult = existingRow
      ? await admin.from("core_logs").update({ detalhes: pilot }).eq("id", existingRow.id)
      : await admin.from("core_logs").insert({
          empresa_id: current.empresaId,
          usuario_id: current.usuarioId,
          app_slug: "dronegestor",
          acao: ACTION,
          detalhes: pilot,
        });
    if (saveResult.error) {
      await account.rollback();
      throw new ApiError("O cadastro não foi concluído e o acesso criado foi desfeito. Tente novamente.", 500);
    }

    return NextResponse.json({ ok: true, item: pilot, createdAccount: account.createdAccount });
  } catch (error) {
    return errorResponse(error, "Não foi possível cadastrar o piloto agora.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const current = access.current!;
    if (!current.canAdministerTeam) {
      return NextResponse.json({ ok: false, error: "Somente o administrador da empresa pode alterar acessos de pilotos." }, { status: 403 });
    }

    const body = await request.json();
    const id = text(body?.id, 80);
    if (!id) return NextResponse.json({ ok: false, error: "Escolha um piloto válido." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const appId = await getDroneGestorApp(admin, current);
    const row = await findRow(admin, current, id);
    if (!row) return NextResponse.json({ ok: false, error: "Piloto não encontrado nesta empresa." }, { status: 404 });

    if(body?.action==="reativar"){
      if(Object.keys(body).some(key=>!["id","action"].includes(key)))throw new ApiError("Informe somente o cadastro a reativar.",400);
      if(!current.empresaId)throw new ApiError("Reativação exige vínculo empresarial.",403);
      const pilot=sanitize(row.detalhes,id);
      if(pilot.ativo||!pilot.usuarioId)throw new ApiError("Cadastro sem vínculo inativo recuperável. Consulte o administrador.",409);
      const user=await admin.from("core_usuarios").select("id,empresa_id,status,email,tipo,tipo_global").eq("id",pilot.usuarioId).eq("empresa_id",current.empresaId).maybeSingle();
      const permission=await admin.from("core_usuario_app_permissoes").select("id,usuario_id,empresa_id,perfil_app,status").eq("usuario_id",pilot.usuarioId).eq("empresa_id",current.empresaId).eq("app_id",appId).maybeSingle();
      if(user.error||permission.error)throw user.error||permission.error;
      if(!canReactivatePilot(pilot,user.data,permission.data,current.empresaId))throw new ApiError("O vínculo ou perfil original não está disponível para reativação. Nenhum acesso foi alterado.",409);
      const next={...pilot,ativo:true,updatedAt:new Date().toISOString()};
      // Only the precise, still-inactive app permission may change.
      const changed=await admin.from("core_usuario_app_permissoes").update({status:"ativo"}).eq("id",permission.data.id).eq("usuario_id",pilot.usuarioId).eq("empresa_id",current.empresaId).eq("app_id",appId).eq("perfil_app",permission.data.perfil_app).eq("status","inativo").select("id").maybeSingle();
      if(changed.error||!changed.data)throw new ApiError("O acesso mudou em outra sessão. Atualize a lista.",409);
      const write=await admin.from("core_logs").update({detalhes:next}).eq("id",row.id).eq("empresa_id",current.empresaId).eq("app_slug","dronegestor").eq("acao",ACTION).contains("detalhes",{id,ativo:false,usuarioId:pilot.usuarioId}).select("id").maybeSingle();
      if(write.error||!write.data){
        const restored=await admin.from("core_usuario_app_permissoes").update({status:"inativo"}).eq("id",permission.data.id).eq("usuario_id",pilot.usuarioId).eq("empresa_id",current.empresaId).eq("app_id",appId).eq("perfil_app",permission.data.perfil_app).eq("status","ativo").select("id").maybeSingle();
        if(restored.error||!restored.data)throw new ApiError("Falha ao confirmar reativação e restaurar vínculo. Administrador deve conferir o acesso antes de operar.",500);
        throw new ApiError("Não foi possível confirmar a reativação. Vínculo restaurado ao estado inativo.",409);
      }
      return NextResponse.json({ok:true,item:next});
    }
    if(row.detalhes?.ativo===false||Object.keys(body??{}).some(key=>!["id","permissoes"].includes(key))||!body?.permissoes||typeof body.permissoes!=="object"||Array.isArray(body.permissoes))throw new ApiError("Informe autorizações válidas de um cadastro ativo.",400);
    if(Object.keys(body.permissoes).some(key=>!(key in defaultPermissions)||typeof body.permissoes[key]!=="boolean"))throw new ApiError("Permissões inválidas.",400);
    let next = sanitize({ ...row.detalhes, permissoes: {...permissions(row.detalhes?.permissoes),...body.permissoes}, id, updatedAt: new Date().toISOString() }, id);
    next = await linkUser(admin, current, next, appId);
    const { error } = await admin.from("core_logs").update({ detalhes: next }).eq("id", row.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, item: next });
  } catch (error) {
    return errorResponse(error, "Não foi possível salvar as autorizações agora.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const current = access.current!;
    if (!current.canAdministerTeam) {
      return NextResponse.json({ ok: false, error: "Somente o administrador da empresa pode inativar pilotos." }, { status: 403 });
    }

    const body = await request.json();
    const id = text(body?.id, 80);
    if (!id) return NextResponse.json({ ok: false, error: "Escolha um piloto válido." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const appId = await getDroneGestorApp(admin, current);
    const row = await findRow(admin, current, id);
    if (!row) return NextResponse.json({ ok: false, error: "Piloto não encontrado nesta empresa." }, { status: 404 });

    const linked = await linkUser(admin, current, sanitize(row.detalhes, id), appId);
    if (linked.usuarioId) {
      const permissionResult = await admin
        .from("core_usuario_app_permissoes")
        .update({ status: "inativo" })
        .eq("usuario_id", linked.usuarioId)
        .eq("empresa_id", current.empresaId)
        .eq("app_id", appId)
        .select("id")
        .maybeSingle();
      if (permissionResult.error || !permissionResult.data?.id) {
        throw new ApiError("Não foi possível bloquear o acesso deste piloto. O cadastro não foi inativado.", 409);
      }
    }

    const next = sanitize({ ...row.detalhes, id, ativo: false, updatedAt: new Date().toISOString() }, id);
    const { error } = await admin.from("core_logs").update({ detalhes: next }).eq("id", row.id);
    if (error) {
      if (linked.usuarioId) {
        await admin
          .from("core_usuario_app_permissoes")
          .update({ status: "ativo" })
          .eq("usuario_id", linked.usuarioId)
          .eq("empresa_id", current.empresaId)
          .eq("app_id", appId);
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Não foi possível inativar o piloto agora.");
  }
}
