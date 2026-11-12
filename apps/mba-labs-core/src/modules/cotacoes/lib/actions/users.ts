"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";
import { requireSuperAdmin } from "@/modules/cotacoes/lib/auth/session";
import { syncCotacoesCompanyAccess } from "@/modules/cotacoes/lib/auth/company-provisioning";

const profileRoles = ["SUPER_ADMIN", "ADMIN_EMPRESA", "COMPRADOR", "CONFERENTE", "FINANCEIRO"] as const;
const statuses = ["ativo", "inativo", "convidado"] as const;
const tenantRoles = ["ADMIN_EMPRESA", "COMPRADOR", "CONFERENTE", "FINANCEIRO"] as const;

type TenantRole = Exclude<(typeof profileRoles)[number], "SUPER_ADMIN">;
type ProfileStatus = (typeof statuses)[number];

export type CreateUserAccessState = { error: string | null };

// Formulario de cadastro usa useActionState: erros validos nao derrubam a pagina.
export async function createUserAccessAction(
  _previousState: CreateUserAccessState,
  formData: FormData,
): Promise<CreateUserAccessState> {
  await requireSuperAdmin("/cotacoes/gestao/usuarios");
  try {
    await createUserAccess(formData);
  } catch (error) {
    // Nunca exibir informacoes tecnicas/SQL e dados pessoais ao administrador.
    const message = error instanceof Error ? error.message : "";
    const expected = [
      "Campo obrigatorio ausente:",
      "Selecione uma empresa",
      "Informe uma senha provisoria",
      "A senha padrao",
      "A senha provisoria",
      "Empresa do MBA",
      "Categoria da empresa",
      "Vinculo da empresa",
      "O CNPJ difere",
      "Mais de uma empresa MBA Labs",
      "Este e-mail ja pertence",
      "Este e-mail já pertence",
      "O acesso do usuario esta bloqueado",
    ];
    if (expected.some((prefix) => message.startsWith(prefix))) return { error: message };
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unclassified";
    console.error("[MBA Cotacoes] Falha no cadastro de usuario", { code });
    return { error: "Nao foi possivel criar o acesso. Verifique os dados e tente novamente. Se persistir, contate o administrador." };
  }

  revalidatePath("/cotacoes/gestao/usuarios");
  redirect("/cotacoes/gestao/usuarios");
}

async function createUserAccess(formData: FormData) {
  const fullName = readRequired(formData, "fullName");
  const email = readRequired(formData, "email").toLowerCase();
  const role = readEnum(formData, "role", profileRoles, "COMPRADOR");
  const status = readEnum(formData, "status", statuses, "ativo");
  const tenantId = normalizeOptionalId(String(formData.get("tenantId") ?? ""));
  if (!tenantId || role === "SUPER_ADMIN") {
    throw new Error("Selecione uma empresa e um perfil operacional do MBA Cotações.");
  }
  const temporaryPassword = readSecureTemporaryPassword(formData);
  const mustChangePassword = formData.get("mustChangePassword") !== "false";

  const supabase = createSupabaseAdminClient();
  const { data: tenant, error: tenantError } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
  if (tenantError || !tenant) throw new Error("Empresa do MBA Cotações não encontrada.");
  const coreCompanyId = await syncCotacoesCompanyAccess({
    id: tenant.id, cnpj: tenant.cnpj, nomeFantasia: tenant.nome_fantasia,
    razaoSocial: tenant.razao_social, tipoCliente: tenant.tipo_cliente,
    status: tenant.status, responsavelEmail: tenant.responsavel_email,
  });
  const authUser = await getOrCreateAuthUser({
    email,
    fullName,
    temporaryPassword,
    mustChangePassword,
  });

  // Criação de usuário feita aqui sem distribuir permissões de outros aplicativos.
  const { data: oldCore, error: oldCoreError } = await supabase.from("core_usuarios")
    .select("id,empresa_id,status").eq("auth_user_id", authUser.id).maybeSingle();
  if (oldCoreError) throw oldCoreError;
  if (oldCore && oldCore.empresa_id !== coreCompanyId) {
    throw new Error("Este e-mail já pertence a outra empresa do portal MBA Labs.");
  }
  if (oldCore && oldCore.status !== "ativo") {
    throw new Error("O acesso do usuario esta bloqueado no MBA Labs. Reative-o no cadastro central.");
  }
  let coreUserId = oldCore?.id;
  if (!coreUserId) {
    const { data: createdCore, error: coreError } = await supabase.from("core_usuarios").insert({
      auth_user_id: authUser.id, empresa_id: coreCompanyId,
      nome: fullName, email, tipo: "usuario", status: "ativo",
    }).select("id").single();
    if (coreError) throw coreError;
    coreUserId = createdCore.id;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users_profile")
    .upsert(
      {
        auth_user_id: authUser.id,
        core_usuario_id: coreUserId,
        full_name: fullName,
        email,
        role,
        status,
        must_change_password: mustChangePassword,
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();

  if (profileError) throw profileError;

  if (!coreUserId) throw new Error("Nao foi possivel vincular o usuario ao MBA Labs.");
  await upsertTenantUser(profile.id, tenantId, role, status);
  // Permissao explicita somente do MBA Cotacoes (sem liberar outros aplicativos).
  await ensureCotacoesCorePermission(coreUserId, coreCompanyId, role, status);
}

export async function updateUserAccessAction(formData: FormData) {
  await requireSuperAdmin("/cotacoes/gestao/usuarios");

  const profileId = readRequired(formData, "profileId");
  const role = readEnum(formData, "role", tenantRoles, "COMPRADOR");
  const status = readEnum(formData, "status", statuses, "ativo");
  const tenantId = normalizeOptionalId(String(formData.get("tenantId") ?? ""));

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users_profile")
    .update({ role, status })
    .eq("id", profileId);

  if (error) throw error;

  if (!tenantId) throw new Error("Escolha a empresa do usuário.");
  await upsertTenantUser(profileId, tenantId, role, status);

  revalidatePath("/cotacoes/gestao/usuarios");
  redirect("/cotacoes/gestao/usuarios");
}

async function getOrCreateAuthUser({
  email,
  fullName,
  temporaryPassword,
  mustChangePassword,
}: {
  email: string;
  fullName: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const existing = await findUserByEmail(email);

  if (existing) {
    // NUNCA alterar a senha de um usuário de outro aplicativo ao vinculá-lo.
    // A vinculação ao mesmo core_empresa_id é validada antes do cadastro.
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      must_change_password: mustChangePassword,
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error("Supabase nao retornou o usuario criado.");
  return data.user;
}

async function findUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const found = data.users.find((user: { email?: string | null }) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }

  return null;
}


// O cadastro feito pelo MBA Cotacoes precisa aparecer na entrada central do MBA Labs.
// Nunca alterar credenciais de Auth nem permissoes de outros aplicativos.
async function ensureCotacoesCorePermission(
  coreUserId: string,
  coreCompanyId: string,
  role: TenantRole,
  status: ProfileStatus,
) {
  const supabase = createSupabaseAdminClient();
  const { data: app, error: appError } = await supabase.from("core_apps")
    .select("id").in("slug", ["mba-cotacoes", "mbacotacoes"]).limit(1).maybeSingle();
  if (appError) throw appError;
  if (!app) throw new Error("Aplicativo MBA Cotações não cadastrado no portal MBA Labs.");

  const { data: existing, error: existingError } = await supabase.from("core_usuario_app_permissoes")
    .select("id,empresa_id,status").eq("usuario_id", coreUserId).eq("app_id", app.id).maybeSingle();
  if (existingError) throw existingError;
  if (existing?.empresa_id && existing.empresa_id !== coreCompanyId) {
    throw new Error("Este e-mail já pertence a outra empresa do portal MBA Labs.");
  }
  if (existing && ["bloqueado", "inativo"].includes(existing.status)) {
    throw new Error("O acesso do usuario esta bloqueado no MBA Labs. Reative-o no cadastro central.");
  }
  const appRole = role === "ADMIN_EMPRESA" ? "admin_empresa"
    : role === "COMPRADOR" ? "comprador" : "visualizador";
  const { error } = await supabase.from("core_usuario_app_permissoes").upsert({
    usuario_id: coreUserId,
    empresa_id: coreCompanyId,
    app_id: app.id,
    perfil_app: appRole,
    status: status === "ativo" ? "ativo" : status === "convidado" ? "pendente" : "inativo",
  }, { onConflict: "usuario_id,app_id" });
  if (error) throw error;
}

async function upsertTenantUser(
  userProfileId: string,
  tenantId: string,
  role: TenantRole,
  status: ProfileStatus,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("tenant_users").upsert(
    {
      tenant_id: tenantId,
      user_profile_id: userProfileId,
      role,
      status,
    },
    { onConflict: "tenant_id,user_profile_id" },
  );

  if (error) throw error;
}

function readRequired(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`Campo obrigatorio ausente: ${name}`);
  return value;
}

function readSecureTemporaryPassword(formData: FormData) {
  const value = String(formData.get("temporaryPassword") ?? "").trim();
  if (!value) throw new Error("Informe uma senha provisoria exclusiva para este usuario.");
  if (value === "Alterar@123") throw new Error("A senha padrao Alterar@123 nao pode ser usada em clientes reais.");
  if (value.length < 10) throw new Error("A senha provisoria deve ter pelo menos 10 caracteres.");
  return value;
}

function normalizeOptionalId(value: string) {
  return value && value !== "none" ? value : "";
}

function readEnum<T extends readonly string[]>(
  formData: FormData,
  name: string,
  values: T,
  fallback: T[number],
) {
  const value = String(formData.get(name) ?? fallback);
  return values.includes(value) ? (value as T[number]) : fallback;
}

export async function deactivateCotacoesUserAction(formData: FormData) {
  await requireSuperAdmin("/cotacoes/gestao/usuarios");
  const tenantId = readRequired(formData, "tenantId");
  const profileId = readRequired(formData, "profileId");
  const supabase = createSupabaseAdminClient();
  const { data: link, error: linkError } = await supabase.from("tenant_users")
    .select("id").eq("tenant_id", tenantId).eq("user_profile_id", profileId).maybeSingle();
  if (linkError) throw linkError;
  if (!link) throw new Error("Este usuário não possui vínculo com a empresa selecionada.");
  const { error } = await supabase.from("tenant_users").update({ status: "inativo" }).eq("id", link.id);
  if (error) throw error;
  revalidatePath("/cotacoes/gestao/usuarios");
  redirect("/cotacoes/gestao/usuarios");
}
