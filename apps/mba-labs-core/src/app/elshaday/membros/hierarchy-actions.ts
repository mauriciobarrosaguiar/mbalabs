"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireElshadayContext, requireElshadayRole } from "@/lib/elshaday";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optional(formData: FormData, name: string) {
  const result = value(formData, name);
  return result || null;
}

function integer(formData: FormData, name: string, fallback = 100) {
  const parsed = Number(value(formData, name));
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 9999 ? parsed : fallback;
}

function date(formData: FormData, name: string) {
  const result = value(formData, name);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : new Date().toISOString().slice(0, 10);
}

function go(path: string, kind: "ok" | "erro", message: string): never {
  redirect(path + (path.includes("?") ? "&" : "?") + kind + "=" + encodeURIComponent(message));
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function refreshMember(memberId?: string) {
  revalidatePath("/elshaday");
  revalidatePath("/elshaday/membros");
  revalidatePath("/elshaday/acessos");
  if (memberId) revalidatePath("/elshaday/membros/" + memberId);
}

export async function createElshadayChurchRole(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/cargos");
  requireElshadayRole(context, ["admin"]);
  const nome = value(formData, "nome");
  if (nome.length < 2) go("/elshaday/configuracoes/cargos", "erro", "Informe o nome do cargo.");

  const { error } = await context.admin.from("igreja_cargos").insert({
    igreja_id: context.igreja.id,
    nome,
    ordem: integer(formData, "ordem"),
    ativo: true,
    created_by: context.current.authUser.id,
    updated_by: context.current.authUser.id
  });

  if (error) {
    const duplicate = String(error.code) === "23505";
    go("/elshaday/configuracoes/cargos", "erro", duplicate ? "Este cargo já está cadastrado." : "Não foi possível cadastrar o cargo.");
  }

  revalidatePath("/elshaday/configuracoes/cargos");
  go("/elshaday/configuracoes/cargos", "ok", "Cargo cadastrado.");
}

export async function updateElshadayChurchRole(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/cargos");
  requireElshadayRole(context, ["admin"]);
  const id = value(formData, "id");
  const nome = value(formData, "nome");
  if (!id || nome.length < 2) go("/elshaday/configuracoes/cargos", "erro", "Confira os dados do cargo.");

  const { data: current, error: currentError } = await context.admin
    .from("igreja_cargos")
    .select("id,nome")
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();

  if (currentError || !current) go("/elshaday/configuracoes/cargos", "erro", "Cargo não encontrado.");

  const { error } = await context.admin
    .from("igreja_cargos")
    .update({
      nome,
      ordem: integer(formData, "ordem"),
      updated_by: context.current.authUser.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("igreja_id", context.igreja.id);

  if (error) go("/elshaday/configuracoes/cargos", "erro", String(error.code) === "23505" ? "Já existe um cargo com esse nome." : "Não foi possível atualizar o cargo.");

  await context.admin
    .from("igreja_membros")
    .update({ cargo: nome, updated_at: new Date().toISOString() })
    .eq("igreja_id", context.igreja.id)
    .eq("cargo_id", id);

  refreshMember();
  revalidatePath("/elshaday/configuracoes/cargos");
  go("/elshaday/configuracoes/cargos", "ok", "Cargo atualizado.");
}

export async function toggleElshadayChurchRole(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/cargos");
  requireElshadayRole(context, ["admin"]);
  const id = value(formData, "id");
  const ativo = value(formData, "ativo") === "true";

  const { error } = await context.admin
    .from("igreja_cargos")
    .update({ ativo, updated_by: context.current.authUser.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("igreja_id", context.igreja.id);

  if (error) go("/elshaday/configuracoes/cargos", "erro", "Não foi possível alterar o cargo.");
  revalidatePath("/elshaday/configuracoes/cargos");
  go("/elshaday/configuracoes/cargos", "ok", ativo ? "Cargo ativado." : "Cargo desativado.");
}

export async function deleteElshadayChurchRole(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/cargos");
  requireElshadayRole(context, ["admin"]);
  const id = value(formData, "id");

  const [{ count: currentCount }, { count: historyCount }] = await Promise.all([
    context.admin.from("igreja_membros").select("id", { count: "exact", head: true }).eq("igreja_id", context.igreja.id).eq("cargo_id", id),
    context.admin.from("igreja_membro_cargos_historico").select("id", { count: "exact", head: true }).eq("igreja_id", context.igreja.id).eq("cargo_id", id)
  ]);

  if ((currentCount ?? 0) > 0 || (historyCount ?? 0) > 0) {
    go("/elshaday/configuracoes/cargos", "erro", "Este cargo está em uso ou possui histórico. Desative-o em vez de excluir.");
  }

  const { error } = await context.admin.from("igreja_cargos").delete().eq("id", id).eq("igreja_id", context.igreja.id);
  if (error) go("/elshaday/configuracoes/cargos", "erro", "Não foi possível excluir o cargo.");
  revalidatePath("/elshaday/configuracoes/cargos");
  go("/elshaday/configuracoes/cargos", "ok", "Cargo excluído.");
}

export async function changeElshadayMemberRole(formData: FormData) {
  const memberId = value(formData, "membro_id");
  const returnTo = "/elshaday/membros/" + memberId;
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "tesouraria"]);

  try {
    const { error } = await context.admin.rpc("elshaday_set_member_cargo", {
      p_igreja_id: context.igreja.id,
      p_membro_id: memberId,
      p_cargo_id: value(formData, "cargo_id"),
      p_data_inicio: date(formData, "data_inicio"),
      p_observacao: optional(formData, "observacao"),
      p_usuario_responsavel: context.current.authUser.id
    });
    if (error) throw error;
  } catch (error) {
    go(returnTo, "erro", message(error, "Não foi possível alterar o cargo."));
  }

  refreshMember(memberId);
  go(returnTo, "ok", "cargo");
}

export async function approveElshadayRequestedRole(formData: FormData) {
  const memberId = value(formData, "membro_id");
  const returnTo = "/elshaday/membros/" + memberId;
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "tesouraria"]);

  try {
    const { data: member, error: memberError } = await context.admin
      .from("igreja_membros")
      .select("cargo_solicitado_id,cargo_solicitado_observacao")
      .eq("id", memberId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();

    if (memberError || !member?.cargo_solicitado_id) {
      throw new Error("Este membro não possui cargo aguardando aprovação.");
    }

    const { error: roleError } = await context.admin.rpc("elshaday_set_member_cargo", {
      p_igreja_id: context.igreja.id,
      p_membro_id: memberId,
      p_cargo_id: member.cargo_solicitado_id,
      p_data_inicio: date(formData, "data_inicio"),
      p_observacao: optional(formData, "observacao") || member.cargo_solicitado_observacao || "Cargo solicitado no cadastro e aprovado pela liderança.",
      p_usuario_responsavel: context.current.authUser.id
    });
    if (roleError) throw roleError;

    const { error: clearError } = await context.admin
      .from("igreja_membros")
      .update({
        cargo_solicitado_id: null,
        cargo_solicitado_em: null,
        cargo_solicitado_observacao: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", memberId)
      .eq("igreja_id", context.igreja.id);
    if (clearError) throw clearError;
  } catch (error) {
    go(returnTo, "erro", message(error, "Não foi possível aprovar o cargo."));
  }

  refreshMember(memberId);
  go(returnTo, "ok", "cargo-aprovado");
}

export async function rejectElshadayRequestedRole(formData: FormData) {
  const memberId = value(formData, "membro_id");
  const returnTo = "/elshaday/membros/" + memberId;
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "tesouraria"]);

  try {
    const { data: member, error: memberError } = await context.admin
      .from("igreja_membros")
      .select("cargo_solicitado_id")
      .eq("id", memberId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();

    if (memberError || !member?.cargo_solicitado_id) {
      throw new Error("Este membro não possui cargo aguardando aprovação.");
    }

    const { error } = await context.admin
      .from("igreja_membros")
      .update({
        cargo_solicitado_id: null,
        cargo_solicitado_em: null,
        cargo_solicitado_observacao: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", memberId)
      .eq("igreja_id", context.igreja.id);
    if (error) throw error;

    await context.admin.from("core_logs").insert({
      empresa_id: context.igreja.empresa_id,
      usuario_id: context.current.usuario.id,
      app_slug: "elshaday",
      acao: "elshaday solicitação de cargo recusada",
      detalhes: {
        membro_id: memberId,
        cargo_solicitado_id: member.cargo_solicitado_id,
        observacao: optional(formData, "observacao")
      }
    });
  } catch (error) {
    go(returnTo, "erro", message(error, "Não foi possível recusar a solicitação."));
  }

  refreshMember(memberId);
  go(returnTo, "ok", "cargo-recusado");
}

export async function createElshadayMinistry(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/ministerios");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);
  const nome = value(formData, "nome");
  if (nome.length < 2) go("/elshaday/configuracoes/ministerios", "erro", "Informe o nome do ministério.");

  const { error } = await context.admin.from("igreja_ministerios").insert({
    igreja_id: context.igreja.id,
    nome,
    descricao: optional(formData, "descricao"),
    ativo: true,
    created_by: context.current.authUser.id,
    updated_by: context.current.authUser.id
  });
  if (error) go("/elshaday/configuracoes/ministerios", "erro", String(error.code) === "23505" ? "Este ministério já está cadastrado." : "Não foi possível cadastrar o ministério.");

  revalidatePath("/elshaday/configuracoes/ministerios");
  go("/elshaday/configuracoes/ministerios", "ok", "Ministério cadastrado.");
}

export async function updateElshadayMinistry(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/ministerios");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);
  const id = value(formData, "id");
  const nome = value(formData, "nome");
  if (!id || nome.length < 2) go("/elshaday/configuracoes/ministerios", "erro", "Confira os dados do ministério.");

  const { error } = await context.admin
    .from("igreja_ministerios")
    .update({
      nome,
      descricao: optional(formData, "descricao"),
      updated_by: context.current.authUser.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("igreja_id", context.igreja.id);
  if (error) go("/elshaday/configuracoes/ministerios", "erro", String(error.code) === "23505" ? "Já existe um ministério com esse nome." : "Não foi possível atualizar o ministério.");

  refreshMember();
  revalidatePath("/elshaday/configuracoes/ministerios");
  go("/elshaday/configuracoes/ministerios", "ok", "Ministério atualizado.");
}

export async function toggleElshadayMinistry(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/ministerios");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);
  const ativo = value(formData, "ativo") === "true";
  const { error } = await context.admin
    .from("igreja_ministerios")
    .update({ ativo, updated_by: context.current.authUser.id, updated_at: new Date().toISOString() })
    .eq("id", value(formData, "id"))
    .eq("igreja_id", context.igreja.id);
  if (error) go("/elshaday/configuracoes/ministerios", "erro", "Não foi possível alterar o ministério.");
  revalidatePath("/elshaday/configuracoes/ministerios");
  go("/elshaday/configuracoes/ministerios", "ok", ativo ? "Ministério ativado." : "Ministério desativado.");
}

export async function deleteElshadayMinistry(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/ministerios");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);
  const id = value(formData, "id");
  const { count } = await context.admin
    .from("igreja_membro_ministerios")
    .select("membro_id", { count: "exact", head: true })
    .eq("igreja_id", context.igreja.id)
    .eq("ministerio_id", id);
  if ((count ?? 0) > 0) go("/elshaday/configuracoes/ministerios", "erro", "Este ministério possui participantes. Desative-o em vez de excluir.");

  const { error } = await context.admin.from("igreja_ministerios").delete().eq("id", id).eq("igreja_id", context.igreja.id);
  if (error) go("/elshaday/configuracoes/ministerios", "erro", "Não foi possível excluir o ministério.");
  revalidatePath("/elshaday/configuracoes/ministerios");
  go("/elshaday/configuracoes/ministerios", "ok", "Ministério excluído.");
}

export async function syncElshadayMemberMinistries(formData: FormData) {
  const memberId = value(formData, "membro_id");
  const returnTo = "/elshaday/membros/" + memberId;
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "tesouraria", "secretaria"]);

  const ids = formData.getAll("ministerio_ids").map(String).filter(Boolean);
  const { error } = await context.admin.rpc("elshaday_sync_member_ministries", {
    p_igreja_id: context.igreja.id,
    p_membro_id: memberId,
    p_ministerio_ids: ids,
    p_usuario_responsavel: context.current.authUser.id
  });
  if (error) go(returnTo, "erro", "Não foi possível atualizar os ministérios.");

  refreshMember(memberId);
  go(returnTo, "ok", "ministerios");
}


export async function syncElshadayMinistryMembers(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes/ministerios");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);
  const ministryId = value(formData, "ministerio_id");
  const memberIds = formData.getAll("membro_ids").map(String).filter(Boolean);

  const { error } = await context.admin.rpc("elshaday_sync_ministry_members", {
    p_igreja_id: context.igreja.id,
    p_ministerio_id: ministryId,
    p_membro_ids: memberIds,
    p_usuario_responsavel: context.current.authUser.id
  });

  if (error) go("/elshaday/configuracoes/ministerios", "erro", "Não foi possível atualizar os participantes.");
  refreshMember();
  revalidatePath("/elshaday/configuracoes/ministerios");
  go("/elshaday/configuracoes/ministerios", "ok", "Participantes atualizados.");
}
