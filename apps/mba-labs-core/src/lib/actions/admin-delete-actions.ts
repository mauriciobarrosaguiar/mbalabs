"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAdminResource } from "@/lib/actions/admin-actions";
import { type AdminResource, getCurrentUserProfile, logAction } from "@/lib/core-data";
import { messageParam, textValue } from "@/lib/form-utils";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function deleteAdminResourceWithPermanent(formData: FormData) {
  const resource = textValue(formData, "resource") as AdminResource;
  const mode = textValue(formData, "mode");

  if (mode !== "delete" || resource !== "usuarios") {
    await deleteAdminResource(formData);
    return;
  }

  const current = await getCurrentUserProfile();
  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const id = textValue(formData, "id");
  if (!id) {
    redirect(`/admin/usuarios?error=${messageParam("Informe o usuario para excluir.")}`);
  }

  const admin = getSupabaseAdmin() as any;
  const { data: target, error: targetError } = await admin
    .from("core_usuarios")
    .select("id,auth_user_id,nome,email,tipo")
    .eq("id", id)
    .maybeSingle();

  if (targetError) {
    redirect(`/admin/usuarios?error=${messageParam(targetError.message)}`);
  }

  if (!target) {
    redirect(`/admin/usuarios?error=${messageParam("Usuario nao encontrado.")}`);
  }

  if (target.auth_user_id && target.auth_user_id === current.authUser.id) {
    redirect(`/admin/usuarios?error=${messageParam("Voce nao pode excluir o proprio usuario enquanto esta conectado.")}`);
  }

  // Remove primeiro o acesso de autenticacao. Se o banco bloquear a exclusao
  // por algum vinculo historico, a conta continua sem possibilidade de login.
  if (target.auth_user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(target.auth_user_id);
    if (authError) {
      redirect(`/admin/usuarios?error=${messageParam(`Nao foi possivel excluir o acesso do usuario: ${authError.message}`)}`);
    }
  }

  const { error: deleteError } = await admin.from("core_usuarios").delete().eq("id", id);
  if (deleteError) {
    redirect(
      `/admin/usuarios?error=${messageParam(
        `O acesso foi removido, mas o cadastro possui vinculos que impediram a exclusao definitiva: ${deleteError.message}`
      )}`
    );
  }

  await logAction({
    acao: "excluir usuarios",
    detalhes: {
      id,
      nome: target.nome ?? null,
      email: target.email ?? null,
      tipo: target.tipo ?? null
    }
  });

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?ok=${messageParam("Usuario excluido permanentemente.")}`);
}
