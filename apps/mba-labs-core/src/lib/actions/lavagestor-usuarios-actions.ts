"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfileOptionsForAppSlug } from "@/lib/app-registry";
import { logAction } from "@/lib/core-data";
import { messageParam, nullableTextValue, textValue } from "@/lib/form-utils";
import { requireLavaGestorSettingsAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_PROFILES = new Set(getProfileOptionsForAppSlug("lavagestor").map((option) => option.value));

export async function saveLavaGestorUsuario(formData: FormData) {
  const { current } = await requireLavaGestorSettingsAccess("/lavagestor/usuarios");
  if (!current.empresaId) redirect(`/lavagestor/usuarios?error=${messageParam("Selecione uma empresa.")}`);

  const admin = getSupabaseAdmin() as any;
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");
  const email = textValue(formData, "email").toLowerCase();
  const senha = textValue(formData, "senha_provisoria");
  const perfilApp = textValue(formData, "perfil_app") || "lavador";
  const status = textValue(formData, "status") || "ativo";
  const funcionarioId = nullableTextValue(formData, "funcionario_id");

  if (!nome || !email) redirect(`/lavagestor/usuarios?error=${messageParam("Informe nome e e-mail do usuário.")}`);
  if (!ALLOWED_PROFILES.has(perfilApp) || ["admin_master", "super_admin"].includes(perfilApp)) {
    redirect(`/lavagestor/usuarios?error=${messageParam("Perfil invalido para o LavaGestor.")}`);
  }
  if (!id && senha.length < 8) {
    redirect(`/lavagestor/usuarios?error=${messageParam("Informe uma senha provisoria com pelo menos 8 caracteres.")}`);
  }

  const appId = await getLavaGestorAppId(admin);
  const tipo = coreTypeForProfile(perfilApp);
  const payload = {
    empresa_id: current.empresaId,
    nome,
    email,
    telefone: nullableTextValue(formData, "telefone"),
    tipo,
    tipo_global: tipo,
    status
  };

  if (!id) {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome }
    });
    if (authError || !authData.user) {
      redirect(`/lavagestor/usuarios?error=${messageParam(authError?.message ?? "Não foi possível criar usuário no Auth.")}`);
    }
    (payload as Record<string, unknown>).auth_user_id = authData.user.id;
  } else {
    const existing = await admin
      .from("core_usuarios")
      .select("id,auth_user_id,email")
      .eq("id", id)
      .eq("empresa_id", current.empresaId)
      .maybeSingle();
    if (existing.error || !existing.data) {
      redirect(`/lavagestor/usuarios?error=${messageParam(existing.error?.message ?? "Usuário não encontrado nesta empresa.")}`);
    }
    if (existing.data.auth_user_id && (senha || email !== existing.data.email)) {
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(existing.data.auth_user_id, {
        email,
        ...(senha ? { password: senha } : {})
      });
      if (authUpdateError) redirect(`/lavagestor/usuarios?error=${messageParam(authUpdateError.message)}`);
    }
  }

  const query = id
    ? admin.from("core_usuarios").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : admin.from("core_usuarios").insert(payload);
  const { data: saved, error } = await query.select("id,empresa_id").single();
  if (error || !saved?.id) redirect(`/lavagestor/usuarios?error=${messageParam(error?.message ?? "Não foi possível salvar o usuário.")}`);

  const permission = await admin.from("core_usuario_app_permissoes").upsert(
    {
      usuario_id: saved.id,
      empresa_id: current.empresaId,
      app_id: appId,
      perfil_app: perfilApp,
      status
    },
    { onConflict: "usuario_id,app_id" }
  );
  if (permission.error) redirect(`/lavagestor/usuarios?error=${messageParam(permission.error.message)}`);

  await admin.from("lava_funcionarios").update({ core_usuario_id: null }).eq("empresa_id", current.empresaId).eq("core_usuario_id", saved.id);
  if (funcionarioId) {
    const link = await admin
      .from("lava_funcionarios")
      .update({ core_usuario_id: saved.id })
      .eq("id", funcionarioId)
      .eq("empresa_id", current.empresaId);
    if (link.error) redirect(`/lavagestor/usuarios?error=${messageParam(link.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar usuário lavagestor" : "criar usuário lavagestor", detalhes: { id: id || saved.id, perfil_app: perfilApp } });
  revalidatePath("/lavagestor/usuarios");
  redirect(`/lavagestor/usuarios?ok=${messageParam("Usuário do LavaGestor salvo.")}`);
}

export async function updateLavaGestorUsuarioStatus(formData: FormData) {
  const { current } = await requireLavaGestorSettingsAccess("/lavagestor/usuarios");
  if (!current.empresaId) redirect(`/lavagestor/usuarios?error=${messageParam("Selecione uma empresa.")}`);
  const admin = getSupabaseAdmin() as any;
  const id = textValue(formData, "id");
  const status = textValue(formData, "status") || "ativo";
  const appId = await getLavaGestorAppId(admin);

  const update = await admin.from("core_usuarios").update({ status }).eq("id", id).eq("empresa_id", current.empresaId);
  if (update.error) redirect(`/lavagestor/usuarios?error=${messageParam(update.error.message)}`);

  const permission = await admin
    .from("core_usuario_app_permissoes")
    .update({ status })
    .eq("usuario_id", id)
    .eq("empresa_id", current.empresaId)
    .eq("app_id", appId);
  if (permission.error) redirect(`/lavagestor/usuarios?error=${messageParam(permission.error.message)}`);

  revalidatePath("/lavagestor/usuarios");
  redirect(`/lavagestor/usuarios?ok=${messageParam("Status do usuário atualizado.")}`);
}

async function getLavaGestorAppId(client: any) {
  const { data, error } = await client.from("core_apps").select("id").eq("slug", "lavagestor").maybeSingle();
  if (error || !data?.id) redirect(`/lavagestor/usuarios?error=${messageParam(error?.message ?? "App LavaGestor não encontrado no core.")}`);
  return String(data.id);
}

function coreTypeForProfile(profile: string) {
  if (profile === "admin_empresa") return "admin_empresa";
  if (profile === "operador") return "operador";
  if (profile === "lavador") return "funcionario";
  return "usuario";
}
