import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canAdministerDroneCompany, isDroneEmployeeRole, isDroneSystemAdministrator } from "@/lib/dronegestor-company-access";
import { createOrLinkPilotAccount, PilotAccountError } from "@/lib/dronegestor-pilot-account";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const text = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function context() {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) throw new PilotAccountError("Autenticação necessária.", 401);
  const profile = session.profile;
  if (profile.status !== "ativo") throw new PilotAccountError("Acesso inativo.", 403);
  const input = { tipo: profile.tipo, permissoes: session.permissoes };
  const master = isDroneSystemAdministrator(input);
  if (!master && !(session.appsLiberados ?? []).some(app => app.slug === "dronegestor" && app.canAccess)) throw new PilotAccountError("O DroneGestor não está liberado para este acesso.", 403);
  if (!canAdministerDroneCompany(input)) throw new PilotAccountError("Somente o administrador da empresa pode cadastrar funcionários.", 403);
  if (!profile.empresa_id) throw new PilotAccountError("Selecione e vincule uma empresa pelo painel do gestor do sistema.", 409);
  const admin = createSupabaseAdminClient() as any;
  const app = await admin.from("core_apps").select("id").eq("slug", "dronegestor").eq("ativo", true).maybeSingle();
  if (app.error) throw app.error;
  if (!app.data) throw new PilotAccountError("DroneGestor indisponível.", 503);
  const company = await admin.from("core_empresas").select("id,nome,nome_fantasia,status").eq("id", profile.empresa_id).maybeSingle();
  if (company.error) throw company.error;
  if (!company.data || !["ativa", "ativo", "teste"].includes(company.data.status)) throw new PilotAccountError("A empresa está inativa ou bloqueada.", 403);
  const contract = await admin.from("core_empresa_apps").select("id,status,data_vencimento").eq("empresa_id", profile.empresa_id).eq("app_id", app.data.id).in("status", ["ativo", "teste"]).maybeSingle();
  if (contract.error) throw contract.error;
  if (!contract.data) throw new PilotAccountError("O gestor do sistema precisa liberar o DroneGestor para esta empresa antes do cadastro de funcionários.", 403);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (contract.data.data_vencimento && contract.data.data_vencimento.slice(0, 10) < today) throw new PilotAccountError("O acesso da empresa ao DroneGestor está vencido.", 403);
  return { admin, usuarioId: profile.id, empresaId: profile.empresa_id, appId: String(app.data.id), company: company.data };
}

function failure(error: unknown) {
  return NextResponse.json({ ok: false, error: error instanceof PilotAccountError ? error.message : "Não foi possível concluir a alteração de funcionários. Tente novamente." }, { status: error instanceof PilotAccountError ? error.status : 500, headers });
}

export async function GET() {
  try {
    const { admin, empresaId, appId, company } = await context();
    const permissions = await admin.from("core_usuario_app_permissoes").select("usuario_id,perfil_app,status").eq("empresa_id", empresaId).eq("app_id", appId).limit(500);
    if (permissions.error) throw permissions.error;
    const ids = (permissions.data ?? []).map((item: { usuario_id: string }) => item.usuario_id);
    if (!ids.length) return NextResponse.json({ ok: true, empresaNome: company.nome_fantasia || company.nome, items: [] }, { headers });
    const users = await admin.from("core_usuarios").select("id,nome,email,telefone,status").eq("empresa_id", empresaId).in("id", ids);
    if (users.error) throw users.error;
    const byId = new Map((permissions.data ?? []).map((item: any) => [item.usuario_id, item]));
    const items = (users.data ?? []).map((user: any) => { const permission = byId.get(user.id) as any; return { id: user.id, nome: user.nome, email: user.email, telefone: user.telefone || "", perfil: permission.perfil_app, status: user.status === "ativo" ? permission.status : user.status }; });
    return NextResponse.json({ ok: true, empresaNome: company.nome_fantasia || company.nome, items }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, usuarioId, empresaId, appId } = await context();
    const body = await request.json().catch(() => null);
    // Tenant/app/global roles are never accepted from a company form.
    if (!body || typeof body !== "object" || Array.isArray(body) || ["empresa_id", "empresaId", "app_id", "appId", "tipo", "tipo_global", "isAdminMaster", "permissoes"].some(key => key in body)) throw new PilotAccountError("O vínculo da empresa e o aplicativo são definidos pelo seu acesso.", 400);
    if (!isDroneEmployeeRole(body.perfil)) throw new PilotAccountError("Escolha um perfil de funcionário válido.", 400);
    const nome = text(body.nome), email = text(body.email).toLowerCase(), telefone = text(body.telefone, 40);
    if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PilotAccountError("Informe nome e e-mail válidos.", 400);
    const senhaAcesso = typeof body.senhaAcesso === "string" ? body.senhaAcesso : "";
    if (senhaAcesso.length > 200) throw new PilotAccountError("Senha inicial muito longa.", 400);
    const account = await createOrLinkPilotAccount(admin, { empresaId }, appId, { nome, email, telefone, senhaAcesso }, body.perfil, true);
    const logs: Array<Record<string, unknown>> = [{ empresa_id: empresaId, usuario_id: usuarioId, app_slug: "dronegestor", acao: "funcionario_acesso_criado_v1", detalhes: { usuarioId: account.usuarioId, perfil: body.perfil, createdAccount: account.createdAccount } }];
    if (["piloto", "aplicador_caar"].includes(body.perfil)) {
      const now = new Date().toISOString();
      logs.push({ empresa_id: empresaId, usuario_id: usuarioId, app_slug: "dronegestor", acao: "piloto_operacional_v1", detalhes: {
        id: crypto.randomUUID(), nome, email, telefone, cpf: "", observacoes: "", ativo: true, usuarioId: account.usuarioId, createdAt: now, updatedAt: now,
        permissoes: { executarOs: true, editarParametros: false, editarSeguranca: true, registrarSarpas: false, anexarEvidencias: true, finalizarOperacao: true, verRelatorios: false },
      } });
    }
    const saved = await admin.from("core_logs").insert(logs);
    if (saved.error) { await account.rollback(); throw new PilotAccountError("O cadastro não foi concluído e o acesso criado foi desfeito.", 500); }
    return NextResponse.json({ ok: true, createdAccount: account.createdAccount }, { status: 201, headers });
  } catch (error) { return failure(error); }
}


export async function PATCH(request: NextRequest) {
  try {
    const { admin, usuarioId, empresaId, appId } = await context();
    const body = await request.json().catch(() => null);
    if (body?.action === "senha") return await changeEmployeePassword(admin, { usuarioId, empresaId, appId }, body);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["id", "nome", "telefone", "perfil"].includes(key))) throw new PilotAccountError("Informe somente os dados editáveis do funcionário.", 400);
    const id = text(body.id, 36), nome = text(body.nome), telefone = text(body.telefone, 40);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !nome) throw new PilotAccountError("Informe funcionário e nome válidos.", 400);
    const userResult = await admin.from("core_usuarios").select("id,nome,email,telefone,status,tipo,tipo_global").eq("id", id).eq("empresa_id", empresaId).maybeSingle();
    if (userResult.error) throw userResult.error;
    const permissionResult = await admin.from("core_usuario_app_permissoes").select("id,perfil_app,status").eq("usuario_id", id).eq("empresa_id", empresaId).eq("app_id", appId).maybeSingle();
    if (permissionResult.error) throw permissionResult.error;
    const user = userResult.data, permission = permissionResult.data;
    if (!user || !permission) throw new PilotAccountError("Funcionário não encontrado nesta empresa.", 404);
    const protectedAccount = permission.perfil_app === "admin_empresa" || [user.tipo, user.tipo_global].some(type => ["super_admin", "admin_master", "admin_empresa"].includes(String(type)));
    if (protectedAccount && body.perfil !== permission.perfil_app) throw new PilotAccountError("O perfil administrativo só pode ser alterado pelo gestor do sistema.", 403);
    if (!protectedAccount && !isDroneEmployeeRole(body.perfil)) throw new PilotAccountError("Escolha um perfil de funcionário válido.", 400);
    // No authentication, email, global status or other-app permission is changed here.
    const pilotRows = await admin.from("core_logs").select("detalhes").eq("empresa_id", empresaId).eq("app_slug", "dronegestor").eq("acao", "piloto_operacional_v1").contains("detalhes", { usuarioId: id }).order("created_at", { ascending: false }).limit(1);
    if (pilotRows.error) throw pilotRows.error;
    const previousPilot = (pilotRows.data ?? []).find((row: any) => row.detalhes?.usuarioId === id)?.detalhes;
    const now = new Date().toISOString(), pilotRole = ["piloto", "aplicador_caar"].includes(body.perfil);
    const logs: Array<Record<string, unknown>> = [{ empresa_id: empresaId, usuario_id: usuarioId, app_slug: "dronegestor", acao: "funcionario_acesso_editado_v1", detalhes: { usuarioId: id, perfilAnterior: permission.perfil_app, perfil: body.perfil } }];
    if (previousPilot || pilotRole) logs.push({ empresa_id: empresaId, usuario_id: usuarioId, app_slug: "dronegestor", acao: "piloto_operacional_v1", detalhes: {
      ...(previousPilot ?? { id: crypto.randomUUID(), cpf: "", observacoes: "", createdAt: now, permissoes: { executarOs: true, editarParametros: false, editarSeguranca: true, registrarSarpas: false, anexarEvidencias: true, finalizarOperacao: true, verRelatorios: false } }),
      nome, telefone, email: user.email, usuarioId: id, updatedAt: now,
      // Changing the role must never silently reactivate a blocked pilot/account.
      ativo: (pilotRole || protectedAccount) && user.status === "ativo" && permission.status === "ativo" && previousPilot?.ativo !== false,
    } });
    const changedUser = await admin.from("core_usuarios").update({ nome, telefone: telefone || null }).eq("id", id).eq("empresa_id", empresaId);
    if (changedUser.error) throw changedUser.error;
    const restoreUser = () => admin.from("core_usuarios").update({ nome: user.nome, telefone: user.telefone }).eq("id", id).eq("empresa_id", empresaId);
    const changedPermission = await admin.from("core_usuario_app_permissoes").update({ perfil_app: body.perfil }).eq("id", permission.id).eq("empresa_id", empresaId).eq("app_id", appId);
    if (changedPermission.error) {
      const restored = await restoreUser();
      if (restored.error) throw new PilotAccountError("Falha ao restaurar os dados. Confira o cadastro com o suporte antes de repetir.", 500);
      throw changedPermission.error;
    }
    const audit = await admin.from("core_logs").insert(logs);
    if (audit.error) {
      const [restoredUser, restoredPermission] = await Promise.all([
        restoreUser(),
        admin.from("core_usuario_app_permissoes").update({ perfil_app: permission.perfil_app }).eq("id", permission.id).eq("empresa_id", empresaId).eq("app_id", appId),
      ]);
      if (restoredUser.error || restoredPermission.error) throw new PilotAccountError("Falha ao restaurar os dados. Confira o cadastro com o suporte antes de repetir.", 500);
      throw new PilotAccountError("A edição não foi concluída. Os dados anteriores foram restaurados.", 500);
    }
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) { return failure(error); }
}


async function changeEmployeePassword(admin: any, current: { usuarioId: string; empresaId: string; appId: string }, body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !["action", "id", "novaSenha", "confirmarSenha"].includes(key))) throw new PilotAccountError("Informe somente os dados da alteração de senha.", 400);
  const id = text(body.id, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new PilotAccountError("Selecione um funcionário válido.", 400);
  const password = typeof body.novaSenha === "string" ? body.novaSenha : "";
  if (password.length < 8 || password.length > 200) throw new PilotAccountError("A nova senha deve ter entre 8 e 200 caracteres.", 400);
  if (password !== body.confirmarSenha) throw new PilotAccountError("A confirmação da senha não confere.", 400);
  const userResult = await admin.from("core_usuarios").select("id,auth_user_id,tipo,tipo_global").eq("id", id).eq("empresa_id", current.empresaId).maybeSingle();
  if (userResult.error) throw userResult.error;
  const permissionResult = await admin.from("core_usuario_app_permissoes").select("id,perfil_app,status").eq("usuario_id", id).eq("empresa_id", current.empresaId).eq("app_id", current.appId).maybeSingle();
  if (permissionResult.error) throw permissionResult.error;
  const user = userResult.data, permission = permissionResult.data;
  if (!user || !permission) throw new PilotAccountError("Funcionário não encontrado nesta empresa.", 404);
  const types = [user.tipo, user.tipo_global].map(type => String(type ?? "").trim().toLowerCase());
  if (types.some(type => ["super_admin", "admin_master"].includes(type)) || (id !== current.usuarioId && (permission.perfil_app === "admin_empresa" || types.includes("admin_empresa")))) throw new PilotAccountError("A senha deste administrador deve ser alterada pelo próprio titular.", 403);
  if (!user.auth_user_id) throw new PilotAccountError("Este funcionário não possui login vinculado.", 409);
  // An app administrator must not gain access to another app through a shared credential.
  if (id !== current.usuarioId) {
    const otherApps = await admin.from("core_usuario_app_permissoes").select("id").eq("usuario_id", id).neq("app_id", current.appId).eq("status", "ativo").limit(1);
    if (otherApps.error) throw otherApps.error;
    if (otherApps.data?.length) throw new PilotAccountError("Este login também acessa outros aplicativos. A senha deve ser alterada pelo próprio titular.", 403);
  }
  const auditRow = (acao: string) => ({ empresa_id: current.empresaId, usuario_id: current.usuarioId, app_slug: "dronegestor", acao, detalhes: { usuarioId: id } });
  // Audit intent before changing an irreversible credential; never store passwords or provider errors.
  const intent = await admin.from("core_logs").insert([auditRow("funcionario_senha_solicitada_v1")]);
  if (intent.error) throw new PilotAccountError("Não foi possível registrar a solicitação. A senha foi preservada.", 500);
  const updated = await admin.auth.admin.updateUserById(user.auth_user_id, { password });
  if (updated.error) {
    await admin.from("core_logs").insert([auditRow("funcionario_senha_falhou_v1")]);
    throw new PilotAccountError("Não foi possível alterar a senha. Confira os requisitos e tente novamente.", 503);
  }
  const completed = await admin.from("core_logs").insert([auditRow("funcionario_senha_alterada_v1")]);
  // Do not report a failed password change when Auth has already changed it.
  return NextResponse.json({ ok: true, auditoriaPendente: !!completed.error }, { headers });
}
