"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type AdminField,
  type AdminResource,
  getAdminResource,
  getCurrentUserProfile,
  isSuperAdminType,
  logAction
} from "@/lib/core-data";
import { getInternalAppBySlug, getProfileOptionsForAppSlug, normalizeRegistrySlug } from "@/lib/app-registry";
import { booleanValue, dateValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function saveAdminResource(formData: FormData) {
  const current = await getCurrentUserProfile();
  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const resource = textValue(formData, "resource") as AdminResource;
  const id = textValue(formData, "id");
  const config = getAdminResource(resource);

  if (!config || config.readOnly) {
    redirect(`/admin/${resource}?error=${messageParam("Recurso nao pode ser alterado.")}`);
  }

  if (resource === "usuarios") {
    await saveUsuario(formData, id);
    return;
  }

  const payload = buildPayload(config.fields, formData);

  if (resource === "empresas") {
    payload.nome = String(payload.nome_fantasia ?? payload.razao_social ?? "").trim();
  }

  if (resource === "apps") {
    const internalApp = getInternalAppBySlug(String(payload.slug ?? ""));
    payload.url_interna = payload.url_interna ?? internalApp?.urlPath ?? null;
    payload.url_path = payload.url_interna ?? null;
    payload.ativo = payload.status === "ativo";
  }

  if (config.companyScoped && !current.isAdminMaster && "empresa_id" in payload) {
    payload.empresa_id = current.empresaId;
  }

  const supabase = await getSupabaseServer();
  let query = id
    ? (supabase as any).from(config.table).update(payload).eq("id", id)
    : (supabase as any).from(config.table).insert(payload);

  if (id && config.companyScoped && !current.isAdminMaster) {
    query = query.eq("empresa_id", current.empresaId);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    redirect(`/admin/${resource}?error=${messageParam(error.message)}`);
  }

  if (resource === "assinaturas") {
    await mirrorAssinaturaToEmpresaApp(data);
  }

  await logAction({ acao: id ? `editar ${resource}` : `criar ${resource}`, detalhes: { id: id || data?.id || null } });
  revalidatePath(`/admin/${resource}`);
  redirect(`/admin/${resource}?ok=${messageParam("Registro salvo com sucesso.")}`);
}

export async function deleteAdminResource(formData: FormData) {
  const current = await getCurrentUserProfile();
  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const resource = textValue(formData, "resource") as AdminResource;
  const id = textValue(formData, "id");
  const config = getAdminResource(resource);

  if (!config || config.readOnly) {
    redirect(`/admin/${resource}?error=${messageParam("Recurso nao pode ser alterado.")}`);
  }

  if (resource === "categorias-empresas") {
    const supabase = await getSupabaseServer();
    const { count, error: countError } = await (supabase as any)
      .from("core_empresas")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", id);

    if (countError) {
      redirect(`/admin/${resource}?error=${messageParam(countError.message)}`);
    }

    if ((count ?? 0) > 0) {
      redirect(`/admin/${resource}?error=${messageParam("Categoria possui empresas vinculadas. Desative em vez de excluir.")}`);
    }
  }

  const supabase = await getSupabaseServer();
  const updatePayload = config.inactiveField ? { [config.inactiveField]: config.inactiveValue } : null;
  if (resource === "apps" && updatePayload) {
    (updatePayload as Record<string, unknown>).ativo = false;
  }

  let query = updatePayload
    ? (supabase as any).from(config.table).update(updatePayload).eq("id", id)
    : (supabase as any).from(config.table).delete().eq("id", id);

  if (config.companyScoped && !current.isAdminMaster) {
    query = query.eq("empresa_id", current.empresaId);
  }

  const { error } = await query;

  if (error) {
    redirect(`/admin/${resource}?error=${messageParam(error.message)}`);
  }

  await logAction({ acao: `inativar ${resource}`, detalhes: { id } });
  revalidatePath(`/admin/${resource}`);
  redirect(`/admin/${resource}?ok=${messageParam("Registro atualizado.")}`);
}

export async function saveEmpresaApp(formData: FormData) {
  const current = await getCurrentUserProfile();
  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const id = textValue(formData, "id");
  const empresaId = textValue(formData, "empresa_id");
  const payload = {
    empresa_id: empresaId,
    app_id: textValue(formData, "app_id"),
    plano_id: nullableTextValue(formData, "plano_id"),
    status: textValue(formData, "status") || "ativo",
    data_inicio: dateValue(formData, "data_inicio") ?? new Date().toISOString().slice(0, 10),
    data_vencimento: dateValue(formData, "data_vencimento"),
    observacoes: nullableTextValue(formData, "observacoes")
  };

  if (!payload.empresa_id || !payload.app_id) {
    redirect(`/admin/empresas/${empresaId}/apps?error=${messageParam("Informe empresa e app.")}`);
  }

  const supabase = await getSupabaseServer();
  const query = id
    ? (supabase as any).from("core_empresa_apps").update(payload).eq("id", id)
    : (supabase as any).from("core_empresa_apps").upsert(payload, { onConflict: "empresa_id,app_id" });

  const { data, error } = await query.select("id,empresa_id,app_id,plano_id,status,data_inicio,data_vencimento").single();

  if (error) {
    redirect(`/admin/empresas/${empresaId}/apps?error=${messageParam(error.message)}`);
  }

  await mirrorEmpresaAppToAssinatura(data);
  await logAction({ acao: id ? "editar app da empresa" : "vincular app a empresa", detalhes: { id: data.id, empresaId } });
  revalidatePath(`/admin/empresas/${empresaId}/apps`);
  revalidatePath("/admin/empresas");
  redirect(`/admin/empresas/${empresaId}/apps?ok=${messageParam("App da empresa atualizado.")}`);
}

export async function cancelEmpresaApp(formData: FormData) {
  const current = await getCurrentUserProfile();
  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const id = textValue(formData, "id");
  const empresaId = textValue(formData, "empresa_id");
  const supabase = await getSupabaseServer();
  const { error } = await (supabase as any)
    .from("core_empresa_apps")
    .update({ status: "cancelado" })
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) {
    redirect(`/admin/empresas/${empresaId}/apps?error=${messageParam(error.message)}`);
  }

  await logAction({ acao: "cancelar app da empresa", detalhes: { id, empresaId } });
  revalidatePath(`/admin/empresas/${empresaId}/apps`);
  redirect(`/admin/empresas/${empresaId}/apps?ok=${messageParam("Vinculo cancelado.")}`);
}

async function saveUsuario(formData: FormData, id: string) {
  const current = await getCurrentUserProfile();
  const admin = getSupabaseAdmin() as any;
  const config = getAdminResource("usuarios")!;
  const payload = buildPayload(config.fields, formData);
  const password = textValue(formData, "senha_provisoria");
  const appId = textValue(formData, "app_id");
  const perfilApp = textValue(formData, "perfil_app") || "usuario";
  const tipo = String(payload.tipo ?? "usuario");

  payload.tipo_global = tipo;

  if (!isSuperAdminType(tipo) && !payload.empresa_id) {
    redirect(`/admin/usuarios?error=${messageParam("Informe a empresa para usuarios que nao sao Super Admin.")}`);
  }

  if (!current.isAdminMaster) {
    payload.empresa_id = current.empresaId;
    if (isSuperAdminType(tipo)) {
      redirect(`/admin/usuarios?error=${messageParam("Admin de empresa nao pode criar Super Admin.")}`);
    }
  }

  if (!id && password.length < 8) {
    redirect(`/admin/usuarios?error=${messageParam("Informe uma senha provisoria com pelo menos 8 caracteres.")}`);
  }

  if (!id) {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: String(payload.email),
      password,
      email_confirm: true,
      user_metadata: {
        nome: payload.nome
      }
    });

    if (authError || !authData.user) {
      redirect(`/admin/usuarios?error=${messageParam(authError?.message ?? "Nao foi possivel criar usuario no Auth.")}`);
    }

    payload.auth_user_id = authData.user.id;
  } else if (password) {
    const { data: existing, error: existingError } = await admin
      .from("core_usuarios")
      .select("auth_user_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      redirect(`/admin/usuarios?error=${messageParam(existingError.message)}`);
    }

    if (existing?.auth_user_id) {
      const { error: passwordError } = await admin.auth.admin.updateUserById(existing.auth_user_id, { password });
      if (passwordError) {
        redirect(`/admin/usuarios?error=${messageParam(passwordError.message)}`);
      }
    }
  }

  const query = id
    ? admin.from("core_usuarios").update(payload).eq("id", id)
    : admin.from("core_usuarios").insert(payload);

  const { data: saved, error } = await query.select("id,empresa_id,tipo").single();

  if (error) {
    redirect(`/admin/usuarios?error=${messageParam(error.message)}`);
  }

  if (appId) {
    const appSlug = await getAppSlugById(admin, appId);
    if (!isValidProfileForApp(appSlug, perfilApp)) {
      redirect(`/admin/usuarios?error=${messageParam("O perfil selecionado nao pertence ao app escolhido.")}`);
    }

    await upsertUserPermission(admin, {
      usuarioId: saved.id,
      empresaId: saved.empresa_id,
      appId,
      perfilApp,
      isSuperAdmin: isSuperAdminType(String(saved.tipo))
    });
  }

  await logAction({ acao: id ? "editar usuarios" : "criar usuarios", detalhes: { id: id || saved.id } });
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?ok=${messageParam("Usuario salvo com sucesso.")}`);
}

async function getAppSlugById(client: any, appId: string) {
  const { data, error } = await client
    .from("core_apps")
    .select("slug")
    .eq("id", appId)
    .maybeSingle();

  if (error) {
    redirect(`/admin/usuarios?error=${messageParam(error.message)}`);
  }

  return normalizeRegistrySlug(String(data?.slug ?? ""));
}

function isValidProfileForApp(appSlug: string, perfilApp: string) {
  return getProfileOptionsForAppSlug(appSlug).some((option) => option.value === perfilApp);
}

async function upsertUserPermission(
  client: any,
  {
    usuarioId,
    empresaId,
    appId,
    perfilApp,
    isSuperAdmin
  }: {
    usuarioId: string;
    empresaId: string | null;
    appId: string;
    perfilApp: string;
    isSuperAdmin: boolean;
  }
) {
  if (!isSuperAdmin) {
    const { data: contract, error: contractError } = await client
      .from("core_empresa_apps")
      .select("id,status,data_vencimento")
      .eq("empresa_id", empresaId)
      .eq("app_id", appId)
      .in("status", ["ativo", "teste"])
      .maybeSingle();

    if (contractError) {
      redirect(`/admin/usuarios?error=${messageParam(contractError.message)}`);
    }

    if (!contract) {
      redirect(`/admin/usuarios?error=${messageParam("A empresa selecionada nao possui este app ativo.")}`);
    }
  }

  const { error } = await client
    .from("core_usuario_app_permissoes")
    .upsert(
      {
        usuario_id: usuarioId,
        empresa_id: empresaId,
        app_id: appId,
        perfil_app: perfilApp,
        status: "ativo"
      },
      { onConflict: "usuario_id,app_id" }
    );

  if (error) {
    redirect(`/admin/usuarios?error=${messageParam(error.message)}`);
  }
}

async function mirrorAssinaturaToEmpresaApp(row: any) {
  if (!row?.empresa_id || !row?.app_id) return;

  const admin = getSupabaseAdmin() as any;
  await admin.from("core_empresa_apps").upsert(
    {
      empresa_id: row.empresa_id,
      app_id: row.app_id,
      plano_id: row.plano_id,
      status: mapAssinaturaStatus(row.status),
      data_inicio: row.inicio,
      data_vencimento: row.vencimento
    },
    { onConflict: "empresa_id,app_id" }
  );
}

async function mirrorEmpresaAppToAssinatura(row: any) {
  if (!row?.empresa_id || !row?.app_id) return;

  const admin = getSupabaseAdmin() as any;
  const { data: existing } = await admin
    .from("core_assinaturas")
    .select("id")
    .eq("empresa_id", row.empresa_id)
    .eq("app_id", row.app_id)
    .maybeSingle();

  const payload = {
    empresa_id: row.empresa_id,
    app_id: row.app_id,
    plano_id: row.plano_id,
    status: mapEmpresaAppStatus(row.status),
    inicio: row.data_inicio,
    vencimento: row.data_vencimento
  };

  if (existing?.id) {
    await admin.from("core_assinaturas").update(payload).eq("id", existing.id);
  } else {
    await admin.from("core_assinaturas").insert(payload);
  }
}

function buildPayload(fields: AdminField[], formData: FormData) {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.skipPayload) {
      continue;
    }

    if (field.required && !textValue(formData, field.name) && field.type !== "boolean") {
      redirect(`/admin/${textValue(formData, "resource")}?error=${messageParam(`Informe o campo ${field.label}.`)}`);
    }

    if (field.type === "boolean") {
      payload[field.name] = booleanValue(formData, field.name);
      continue;
    }

    if (field.type === "number") {
      if (!textValue(formData, field.name) && !field.required) {
        continue;
      }
      payload[field.name] = numberValue(formData, field.name);
      continue;
    }

    if (field.type === "date") {
      payload[field.name] = dateValue(formData, field.name);
      continue;
    }

    payload[field.name] = field.required ? textValue(formData, field.name) : nullableTextValue(formData, field.name);
  }

  return payload;
}

function mapAssinaturaStatus(status: string) {
  if (status === "ativa") return "ativo";
  if (status === "vencida") return "vencido";
  if (status === "bloqueada") return "bloqueado";
  if (status === "cancelada") return "cancelado";
  return status;
}

function mapEmpresaAppStatus(status: string) {
  if (status === "ativo") return "ativa";
  if (status === "vencido") return "vencida";
  if (status === "bloqueado") return "bloqueada";
  if (status === "cancelado") return "cancelada";
  return status;
}
