export type PilotAccountContext = {
  empresaId: string | null;
};

export type PilotAccountInput = {
  nome: string;
  email: string;
  telefone: string;
  senhaAcesso: string;
};

type PermissionSnapshot = {
  id: string;
  perfil_app: string;
  status: string;
} | null;

export class PilotAccountError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function rollbackCreatedAccount(admin: any, coreUserId: string, authUserId: string) {
  if (coreUserId) await admin.from("core_usuarios").delete().eq("id", coreUserId);
  if (authUserId) await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
}

async function restorePermission(admin: any, userId: string, appId: string, snapshot: PermissionSnapshot) {
  if (!snapshot) {
    await admin.from("core_usuario_app_permissoes").delete().eq("usuario_id", userId).eq("app_id", appId);
    return;
  }
  await admin
    .from("core_usuario_app_permissoes")
    .update({ perfil_app: snapshot.perfil_app, status: snapshot.status })
    .eq("id", snapshot.id);
}

export async function createOrLinkPilotAccount(
  admin: any,
  current: PilotAccountContext,
  appId: string,
  input: PilotAccountInput,
) {
  const existingResult = await admin
    .from("core_usuarios")
    .select("id,empresa_id,status,auth_user_id")
    .ilike("email", input.email)
    .limit(1)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;

  const existing = existingResult.data;
  if (existing && existing.empresa_id !== current.empresaId) {
    throw new PilotAccountError("Este e-mail já pertence a outra empresa. Use outro e-mail ou fale com o suporte.", 409);
  }
  if (existing && existing.status !== "ativo") {
    throw new PilotAccountError("Este acesso está inativo ou bloqueado. Reative o usuário antes de vinculá-lo como piloto.", 409);
  }

  let authUserId = "";
  let coreUserId = existing?.id ? String(existing.id) : "";
  let createdAccount = false;

  if (!existing) {
    if (input.senhaAcesso.length < 8) {
      throw new PilotAccountError("Crie uma senha inicial com pelo menos 8 caracteres.", 400);
    }

    const authResult = await admin.auth.admin.createUser({
      email: input.email,
      password: input.senhaAcesso,
      email_confirm: true,
      user_metadata: { nome: input.nome },
    });
    if (authResult.error || !authResult.data.user) {
      const duplicated = /already|registered|exists|unique/i.test(authResult.error?.message ?? "");
      throw new PilotAccountError(
        duplicated
          ? "Este e-mail já possui um acesso. Use o mesmo e-mail cadastrado na empresa ou fale com o suporte."
          : "Não foi possível criar o acesso do piloto. Tente novamente.",
        duplicated ? 409 : 503,
      );
    }
    authUserId = authResult.data.user.id;

    const coreResult = await admin
      .from("core_usuarios")
      .insert({
        auth_user_id: authUserId,
        empresa_id: current.empresaId,
        nome: input.nome,
        email: input.email,
        telefone: input.telefone || null,
        tipo: "usuario",
        tipo_global: "usuario",
        status: "ativo",
      })
      .select("id")
      .single();
    if (coreResult.error || !coreResult.data?.id) {
      await rollbackCreatedAccount(admin, "", authUserId);
      throw new PilotAccountError("O acesso não foi concluído e nenhuma conta foi mantida. Tente novamente.", 500);
    }
    coreUserId = String(coreResult.data.id);
    createdAccount = true;
  }

  const previousPermission = await admin
    .from("core_usuario_app_permissoes")
    .select("id,perfil_app,status")
    .eq("usuario_id", coreUserId)
    .eq("app_id", appId)
    .maybeSingle();
  if (previousPermission.error) {
    if (createdAccount) await rollbackCreatedAccount(admin, coreUserId, authUserId);
    throw previousPermission.error;
  }

  const permissionResult = await admin.from("core_usuario_app_permissoes").upsert(
    {
      usuario_id: coreUserId,
      empresa_id: current.empresaId,
      app_id: appId,
      perfil_app: "piloto",
      status: "ativo",
    },
    { onConflict: "usuario_id,app_id" },
  );
  if (permissionResult.error) {
    if (createdAccount) await rollbackCreatedAccount(admin, coreUserId, authUserId);
    throw new PilotAccountError("Não foi possível liberar o DroneGestor para este piloto. Nenhum acesso incompleto foi mantido.", 500);
  }

  return {
    usuarioId: coreUserId,
    createdAccount,
    rollback: async () => {
      if (createdAccount) await rollbackCreatedAccount(admin, coreUserId, authUserId);
      else await restorePermission(admin, coreUserId, appId, (previousPermission.data as PermissionSnapshot) ?? null);
    },
  };
}
