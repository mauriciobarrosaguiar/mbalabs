import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { isDroneSystemAdministrator } from "@/lib/dronegestor-company-access";
import { createOrLinkPilotAccount, PilotAccountError } from "@/lib/dronegestor-pilot-account";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const COMPANY_FIELDS = "id,categoria_id,nome,nome_fantasia,razao_social,cnpj,telefone,whatsapp,email,cidade,estado,responsavel,status,observacoes";
const text = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";
const uuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? ""));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function context() {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) throw new PilotAccountError("Autenticação necessária.", 401);
  if (session.profile.status !== "ativo" || !isDroneSystemAdministrator({ tipo: session.profile.tipo })) throw new PilotAccountError("Esta área é exclusiva do gestor do sistema.", 403);
  const admin = createSupabaseAdminClient() as any;
  const app = await admin.from("core_apps").select("id").eq("slug", "dronegestor").eq("ativo", true).maybeSingle();
  if (app.error) throw app.error;
  if (!app.data) throw new PilotAccountError("DroneGestor indisponível.", 503);
  return { admin, appId: String(app.data.id), actorId: session.profile.id };
}
function failure(error: unknown) {
  return NextResponse.json({ ok: false, error: error instanceof PilotAccountError ? error.message : "Não foi possível concluir a operação. Atualize e tente novamente." }, { status: error instanceof PilotAccountError ? error.status : 500, headers });
}
async function companyById(admin: any, id: unknown) {
  if (!uuid(id)) throw new PilotAccountError("Selecione uma empresa válida.", 400);
  const result = await admin.from("core_empresas").select(COMPANY_FIELDS).eq("id", id).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new PilotAccountError("Empresa não encontrada.", 404);
  return result.data;
}
function date(value: unknown) {
  const v = text(value, 10);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw new PilotAccountError("Informe uma data válida.", 400);
  return v;
}

export async function GET() {
  try {
    const { admin, appId } = await context();
    const [companies, categories, contracts, permissions] = await Promise.all([
      admin.from("core_empresas").select(COMPANY_FIELDS).order("created_at", { ascending: false }).limit(500),
      admin.from("core_empresa_categorias").select("id,nome,status").eq("status", "ativa").order("nome"),
      admin.from("core_empresa_apps").select("empresa_id,status,data_inicio,data_vencimento").eq("app_id", appId).limit(500),
      admin.from("core_usuario_app_permissoes").select("usuario_id,empresa_id,perfil_app,status").eq("app_id", appId).eq("perfil_app", "admin_empresa").limit(500),
    ]);
    for (const result of [companies, categories, contracts, permissions]) if (result.error) throw result.error;
    const ids = (permissions.data ?? []).map((p: any) => p.usuario_id);
    const users = ids.length ? await admin.from("core_usuarios").select("id,empresa_id,nome,email,status").in("id", ids) : { data: [] };
    if (users.error) throw users.error;
    const admins = (permissions.data ?? []).flatMap((permission: any) => {
      const user = (users.data ?? []).find((u: any) => u.id === permission.usuario_id && u.empresa_id === permission.empresa_id);
      return user ? [{ ...user, perfil: "admin_empresa", acessoStatus: permission.status }] : [];
    });
    return NextResponse.json({ ok: true, companies: companies.data ?? [], categories: categories.data ?? [], contracts: contracts.data ?? [], administrators: admins }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, appId, actorId } = await context();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new PilotAccountError("Dados inválidos.", 400);
    if (["app_id", "appId", "tipo", "tipo_global", "perfil_app", "perfil", "resource", "returnTo"].some(key => key in body)) throw new PilotAccountError("O aplicativo e o perfil são definidos pelo DroneGestor.", 400);

    if (body.action === "empresa") {
      const id = text(body.id, 36), previous = id ? await companyById(admin, id) : null;
      const nome = text(body.nome_fantasia), categoria = text(body.categoria_id, 36);
      if (!nome || !uuid(categoria)) throw new PilotAccountError("Informe nome e categoria da empresa.", 400);
      const category = await admin.from("core_empresa_categorias").select("id").eq("id", categoria).eq("status", "ativa").maybeSingle();
      if (category.error) throw category.error;
      if (!category.data) throw new PilotAccountError("Escolha uma categoria ativa.", 400);
      const cnpj = text(body.cnpj, 32).replace(/\D/g, "") || null;
      if (cnpj && cnpj.length !== 14) throw new PilotAccountError("O CNPJ deve conter 14 dígitos, ou ficar em branco.", 400);
      if (cnpj) {
        const duplicates = await admin.from("core_empresas").select("id").eq("cnpj", cnpj).limit(2);
        if (duplicates.error) throw duplicates.error;
        if ((duplicates.data ?? []).some((c: any) => c.id !== id)) throw new PilotAccountError("Já existe uma empresa com este CNPJ. Selecione o cadastro existente.", 409);
      }
      const email = text(body.email).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PilotAccountError("Informe um e-mail válido.", 400);
      const payload = { nome, nome_fantasia: nome, categoria_id: categoria, razao_social: text(body.razao_social) || null, cnpj, telefone: text(body.telefone, 40) || null, whatsapp: text(body.whatsapp, 40) || null, email: email || null, cidade: text(body.cidade, 100) || null, estado: text(body.estado, 2).toUpperCase() || null, responsavel: text(body.responsavel) || null, observacoes: text(body.observacoes, 1000) || null };
      // Editing contact data never changes the global company status or its other applications.
      const query = previous ? admin.from("core_empresas").update(payload).eq("id", id) : admin.from("core_empresas").insert({ ...payload, status: "ativa" });
      const saved = await query.select("id").single();
      if (saved.error) throw saved.error;
      return NextResponse.json({ ok: true, empresaId: saved.data.id, message: "Empresa salva no DroneGestor." }, { headers });
    }

    if (body.action === "acesso") {
      const company = await companyById(admin, body.empresaId);
      const status = text(body.status, 20);
      if (!["ativo", "teste", "bloqueado", "cancelado"].includes(status)) throw new PilotAccountError("Escolha uma situação de acesso válida.", 400);
      const start = date(body.data_inicio) || today(), end = date(body.data_vencimento);
      if (end && end < start) throw new PilotAccountError("O vencimento não pode ser anterior ao início.", 400);
      if (["ativo", "teste"].includes(status) && !["ativa", "ativo", "teste"].includes(company.status)) throw new PilotAccountError("A empresa está bloqueada. Não é possível liberar seu acesso.", 403);
      const previous = await admin.from("core_empresa_apps").select("id,empresa_id,app_id,plano_id,status,data_inicio,data_vencimento").eq("empresa_id", company.id).eq("app_id", appId).maybeSingle();
      if (previous.error) throw previous.error;
      const subscription = await admin.from("core_assinaturas").select("id").eq("empresa_id", company.id).eq("app_id", appId).maybeSingle();
      if (subscription.error) throw subscription.error;
      const payload = { empresa_id: company.id, app_id: appId, plano_id: previous.data?.plano_id ?? null, status, data_inicio: start, data_vencimento: end };
      const saved = await admin.from("core_empresa_apps").upsert(payload, { onConflict: "empresa_id,app_id" });
      if (saved.error) throw saved.error;
      const mirrored = { empresa_id: company.id, app_id: appId, plano_id: payload.plano_id, status: ({ ativo: "ativa", bloqueado: "bloqueada", cancelado: "cancelada", teste: "teste" } as Record<string, string>)[status], inicio: start, vencimento: end };
      const mirror = subscription.data ? await admin.from("core_assinaturas").update(mirrored).eq("id", subscription.data.id).eq("empresa_id", company.id).eq("app_id", appId) : await admin.from("core_assinaturas").insert(mirrored);
      if (mirror.error) {
        const restored = previous.data ? await admin.from("core_empresa_apps").update(previous.data).eq("id", previous.data.id).eq("app_id", appId) : await admin.from("core_empresa_apps").delete().eq("empresa_id", company.id).eq("app_id", appId);
        if (restored.error) throw new PilotAccountError("A sincronização do acesso falhou. Não repita a alteração antes de conferir o vínculo com o suporte.", 500);
        throw new PilotAccountError("Não foi possível salvar o acesso. A configuração anterior foi preservada.", 500);
      }
      return NextResponse.json({ ok: true, empresaId: company.id, message: "Acesso ao DroneGestor atualizado." }, { headers });
    }

    if (body.action === "administrador") {
      const company = await companyById(admin, body.empresaId);
      if (!["ativa", "ativo", "teste"].includes(company.status)) throw new PilotAccountError("A empresa está bloqueada.", 403);
      const contract = await admin.from("core_empresa_apps").select("status,data_vencimento").eq("empresa_id", company.id).eq("app_id", appId).in("status", ["ativo", "teste"]).maybeSingle();
      if (contract.error) throw contract.error;
      if (!contract.data || (contract.data.data_vencimento && contract.data.data_vencimento < today())) throw new PilotAccountError("Libere o DroneGestor para esta empresa antes de cadastrar seu administrador.", 403);
      const nome = text(body.nome), email = text(body.email).toLowerCase(), telefone = text(body.telefone, 40);
      if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PilotAccountError("Informe nome e e-mail válidos.", 400);
      const password = typeof body.senhaAcesso === "string" ? body.senhaAcesso : "";
      if (password.length > 200) throw new PilotAccountError("Senha inicial muito longa.", 400);
      const account = await createOrLinkPilotAccount(admin, { empresaId: company.id, allowCompanyAdministrator: true }, appId, { nome, email, telefone, senhaAcesso: password }, "admin_empresa", true);
      const log = await admin.from("core_logs").insert({ empresa_id: company.id, usuario_id: actorId, app_slug: "dronegestor", acao: "administrador_empresa_criado_v1", detalhes: { usuarioId: account.usuarioId, perfil: "admin_empresa", createdAccount: account.createdAccount } });
      if (log.error) { await account.rollback(); throw new PilotAccountError("O cadastro não foi concluído. O vínculo criado foi desfeito.", 500); }
      return NextResponse.json({ ok: true, empresaId: company.id, message: account.createdAccount ? "Administrador cadastrado. Ele já pode acessar o DroneGestor." : "Administrador vinculado. A senha do acesso existente foi preservada." }, { headers });
    }
    throw new PilotAccountError("Ação inválida.", 400);
  } catch (error) { return failure(error); }
}
