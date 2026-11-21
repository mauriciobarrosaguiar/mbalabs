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
  return NextResponse.json({ ok: false, error: error instanceof PilotAccountError ? error.message : "Não foi possível concluir o cadastro de funcionários. Tente novamente." }, { status: error instanceof PilotAccountError ? error.status : 500, headers });
}

export async function GET() {
  try {
    const { admin, empresaId, appId, company } = await context();
    const permissions = await admin.from("core_usuario_app_permissoes").select("usuario_id,perfil_app,status").eq("empresa_id", empresaId).eq("app_id", appId).limit(500);
    if (permissions.error) throw permissions.error;
    const ids = (permissions.data ?? []).map((item: { usuario_id: string }) => item.usuario_id);
    if (!ids.length) return NextResponse.json({ ok: true, empresaNome: company.nome_fantasia || company.nome, items: [] }, { headers });
    const users = await admin.from("core_usuarios").select("id,nome,email,status").eq("empresa_id", empresaId).in("id", ids);
    if (users.error) throw users.error;
    const byId = new Map((permissions.data ?? []).map((item: any) => [item.usuario_id, item]));
    const items = (users.data ?? []).map((user: any) => { const permission = byId.get(user.id) as any; return { id: user.id, nome: user.nome, email: user.email, perfil: permission.perfil_app, status: user.status === "ativo" ? permission.status : user.status }; });
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
