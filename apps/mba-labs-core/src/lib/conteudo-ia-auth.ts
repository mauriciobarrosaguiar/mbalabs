import { getSessionProfile, isSuperAdminType } from "@/lib/core-data";

export async function getConteudoIaApiContext() {
  const context = await getSessionProfile();

  if (!context.user || !context.profile) {
    return { ok: false as const, status: 401, error: "Sessão não encontrada." };
  }

  const isAdminMaster = isSuperAdminType(context.profile.tipo);
  const canAccess =
    isAdminMaster ||
    (context.appsLiberados ?? []).some(
      (app) => app.slug === "conteudo-ia" && app.canAccess
    );

  if (!canAccess) {
    return { ok: false as const, status: 403, error: "Acesso ao MBA Conteúdo IA não liberado." };
  }

  if (!context.profile.empresa_id) {
    return { ok: false as const, status: 422, error: "O usuário precisa estar vinculado a uma empresa." };
  }

  return {
    ok: true as const,
    user: context.user,
    profile: context.profile,
    empresaId: context.profile.empresa_id
  };
}
