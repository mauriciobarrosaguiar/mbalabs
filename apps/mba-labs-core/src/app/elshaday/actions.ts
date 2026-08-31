"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  hasElshadayRole,
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullable(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function nullableDate(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function positiveMoney(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/\./g, "").replace(",", ".");
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  return Number(value.toFixed(2));
}

function palmasDateTimeIso(value: string) {
  if (!value) throw new Error("Informe data e horário.");
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00-03:00`
    : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data ou horário inválido.");
  }
  return parsed.toISOString();
}

export async function createElshadayMember(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/membros");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);

  const nome = text(formData, "nome");
  if (nome.length < 2) throw new Error("Informe o nome do membro.");

  const { error } = await context.admin.from("igreja_membros").insert({
    igreja_id: context.igreja.id,
    nome,
    data_nascimento: nullableDate(formData, "data_nascimento"),
    telefone: nullable(formData, "telefone"),
    whatsapp: nullable(formData, "whatsapp"),
    email: nullable(formData, "email"),
    endereco: nullable(formData, "endereco"),
    bairro: nullable(formData, "bairro"),
    cidade: nullable(formData, "cidade"),
    estado: nullable(formData, "estado"),
    data_conversao: nullableDate(formData, "data_conversao"),
    data_batismo: nullableDate(formData, "data_batismo"),
    data_entrada: nullableDate(formData, "data_entrada"),
    cargo: nullable(formData, "cargo"),
    ministerio: nullable(formData, "ministerio"),
    situacao: text(formData, "situacao") || "ativo",
    observacoes: nullable(formData, "observacoes")
  });

  if (error) throw new Error(`Falha ao cadastrar membro: ${error.message}`);
  revalidatePath("/elshaday");
  revalidatePath("/elshaday/membros");
}

export async function createElshadayFinanceEntry(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/financeiro");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  const anonimo = text(formData, "anonimo") === "on";
  const membroId = anonimo ? null : nullable(formData, "membro_id");

  const { error } = await context.admin.from("igreja_financeiro_entradas").insert({
    igreja_id: context.igreja.id,
    membro_id: membroId,
    tipo: text(formData, "tipo") || "dizimo",
    descricao: nullable(formData, "descricao"),
    valor: positiveMoney(formData, "valor"),
    forma_pagamento: text(formData, "forma_pagamento") || "dinheiro",
    data_entrada: text(formData, "data_entrada") || new Date().toISOString().slice(0, 10),
    anonimo,
    observacoes: nullable(formData, "observacoes"),
    created_by: context.current.authUser.id
  });

  if (error) throw new Error(`Falha ao registrar entrada: ${error.message}`);
  revalidatePath("/elshaday");
  revalidatePath("/elshaday/financeiro");
}

export async function createElshadayEvent(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/eventos");
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  const titulo = text(formData, "titulo");
  const inicio = text(formData, "inicio");
  if (titulo.length < 2) throw new Error("Informe o nome do culto ou evento.");
  if (!inicio) throw new Error("Informe data e horário.");

  const { error } = await context.admin.from("igreja_eventos").insert({
    igreja_id: context.igreja.id,
    titulo,
    tipo: text(formData, "tipo") || "culto",
    descricao: nullable(formData, "descricao"),
    inicio: palmasDateTimeIso(inicio),
    local: nullable(formData, "local"),
    pregador: nullable(formData, "pregador"),
    dirigente: nullable(formData, "dirigente"),
    tema: nullable(formData, "tema"),
    texto_biblico: nullable(formData, "texto_biblico"),
    publico: text(formData, "publico") || "todos",
    status: "agendado",
    created_by: context.current.authUser.id
  });

  if (error) throw new Error(`Falha ao cadastrar evento: ${error.message}`);
  revalidatePath("/elshaday");
  revalidatePath("/elshaday/eventos");
}

export async function createElshadaySermon(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/pregacoes");
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  const titulo = text(formData, "titulo");
  const pregador = text(formData, "pregador");
  if (titulo.length < 2) throw new Error("Informe o título da pregação.");
  if (pregador.length < 2) throw new Error("Informe o pregador.");

  const versiculos = text(formData, "versiculos")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const pontos = text(formData, "pontos")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => ({ ordem: index + 1, texto: item }));

  const { error } = await context.admin.from("igreja_pregacoes").insert({
    igreja_id: context.igreja.id,
    titulo,
    tema: nullable(formData, "tema"),
    pregador,
    data_pregacao: text(formData, "data_pregacao") || new Date().toISOString().slice(0, 10),
    texto_base: nullable(formData, "texto_base"),
    versiculos,
    esboco: nullable(formData, "esboco"),
    introducao: nullable(formData, "introducao"),
    pontos,
    conclusao: nullable(formData, "conclusao"),
    observacoes: nullable(formData, "observacoes"),
    video_url: nullable(formData, "video_url"),
    created_by: context.current.authUser.id
  });

  if (error) throw new Error(`Falha ao salvar pregação: ${error.message}`);
  revalidatePath("/elshaday");
  revalidatePath("/elshaday/pregacoes");
}

export async function saveBibleFavorite(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/biblia");
  if (!hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria", "lider", "membro"])) {
    throw new Error("Perfil sem acesso.");
  }

  const referencia = text(formData, "referencia");
  const textoVersiculo = text(formData, "texto");
  if (!referencia) throw new Error("Referência inválida.");

  const { error } = await context.admin.from("igreja_biblia_favoritos").upsert({
    igreja_id: context.igreja.id,
    user_id: context.current.authUser.id,
    referencia,
    texto: textoVersiculo || null,
    traducao: "almeida"
  }, { onConflict: "igreja_id,user_id,referencia,traducao" });

  if (error) throw new Error(`Falha ao favoritar: ${error.message}`);
  revalidatePath("/elshaday/biblia");
}


const ELSHADAY_ROLES = ["admin", "pastor", "tesouraria", "secretaria", "lider", "membro"] as const;

function accessRole(value: string) {
  if (!ELSHADAY_ROLES.includes(value as (typeof ELSHADAY_ROLES)[number])) {
    throw new Error("Perfil de acesso inválido.");
  }
  return value as (typeof ELSHADAY_ROLES)[number];
}

function accessRedirect(kind: "ok" | "erro", message: string) {
  redirect(`/elshaday/acessos?${kind}=${encodeURIComponent(message)}`);
}

async function getElshadayAppId(admin: any) {
  const { data, error } = await admin
    .from("core_apps")
    .select("id")
    .eq("slug", "elshaday")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error("O app Elshaday não está configurado no MBA Labs.");
  }
  return String(data.id);
}

async function findAuthUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((user: any) => String(user.email ?? "").toLowerCase() === email);
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
}

async function getChurchCoreUser(context: any, usuarioId: string) {
  if (!context.igreja.empresa_id) throw new Error("Igreja sem organização vinculada.");

  const { data, error } = await context.admin
    .from("core_usuarios")
    .select("id,auth_user_id,empresa_id,nome,email,status")
    .eq("id", usuarioId)
    .eq("empresa_id", context.igreja.empresa_id)
    .maybeSingle();

  if (error || !data) throw new Error("Usuário não pertence a esta igreja.");
  return data;
}

async function auditChurchAccess(context: any, acao: string, detalhes: Record<string, unknown>) {
  await context.admin.from("core_logs").insert({
    empresa_id: context.igreja.empresa_id,
    usuario_id: context.current.usuario.id,
    app_slug: "elshaday",
    acao,
    detalhes
  }).catch(() => null);
}

export async function createElshadayAccess(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/acessos");
  requireElshadayRole(context, ["admin"]);

  try {
    if (!context.igreja.empresa_id) throw new Error("Igreja sem organização vinculada.");

    const nome = text(formData, "nome");
    const email = text(formData, "email").toLowerCase();
    const telefone = nullable(formData, "telefone");
    const papel = accessRole(text(formData, "papel"));
    const membroId = nullable(formData, "membro_id");

    if (nome.length < 2) throw new Error("Informe o nome completo.");
    if (!email.includes("@")) throw new Error("Informe um e-mail válido.");

    const appId = await getElshadayAppId(context.admin);

    const { data: coreRows, error: coreRowsError } = await context.admin
      .from("core_usuarios")
      .select("id,auth_user_id,empresa_id,nome,email,status")
      .ilike("email", email);

    if (coreRowsError) throw coreRowsError;

    let coreUser = (coreRows ?? []).find(
      (row: any) => String(row.empresa_id) === String(context.igreja.empresa_id)
    ) ?? null;

    let authUser = coreUser?.auth_user_id
      ? await context.admin.auth.admin.getUserById(coreUser.auth_user_id).then((result: any) => {
          if (result.error) throw result.error;
          return result.data?.user ?? null;
        })
      : await findAuthUserByEmail(context.admin, email);

    if (authUser) {
      const { data: ownerRows, error: ownerError } = await context.admin
        .from("core_usuarios")
        .select("id,empresa_id")
        .eq("auth_user_id", authUser.id);

      if (ownerError) throw ownerError;
      const otherOwner = (ownerRows ?? []).find(
        (row: any) => String(row.empresa_id) !== String(context.igreja.empresa_id)
      );
      if (otherOwner) {
        throw new Error("Este e-mail já está vinculado a outra organização do MBA Labs.");
      }
    }

    if (!authUser) {
      const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mbalabs.com.br").replace(/\/$/, "");
      const { data: invite, error: inviteError } = await context.admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/alterar-senha`,
        data: {
          nome,
          origem: "elshaday",
          igreja_id: context.igreja.id
        }
      });
      if (inviteError) throw inviteError;
      authUser = invite?.user ?? null;
      if (!authUser?.id) throw new Error("O convite foi enviado, mas o usuário não foi criado corretamente.");
    }

    if (!coreUser) {
      const { data: inserted, error: insertError } = await context.admin
        .from("core_usuarios")
        .insert({
          auth_user_id: authUser.id,
          empresa_id: context.igreja.empresa_id,
          nome,
          email,
          telefone,
          tipo: "usuario",
          tipo_global: "usuario",
          status: "ativo"
        })
        .select("id,auth_user_id,empresa_id,nome,email,status")
        .single();

      if (insertError) throw insertError;
      coreUser = inserted;
    } else {
      const { data: updated, error: updateError } = await context.admin
        .from("core_usuarios")
        .update({
          auth_user_id: authUser.id,
          nome,
          telefone,
          status: "ativo",
          updated_at: new Date().toISOString()
        })
        .eq("id", coreUser.id)
        .eq("empresa_id", context.igreja.empresa_id)
        .select("id,auth_user_id,empresa_id,nome,email,status")
        .single();

      if (updateError) throw updateError;
      coreUser = updated;
    }

    const { error: permissionError } = await context.admin
      .from("core_usuario_app_permissoes")
      .upsert({
        usuario_id: coreUser.id,
        empresa_id: context.igreja.empresa_id,
        app_id: appId,
        perfil_app: papel,
        status: "ativo",
        updated_at: new Date().toISOString()
      }, { onConflict: "usuario_id,app_id" });
    if (permissionError) throw permissionError;

    const { error: profileError } = await context.admin
      .from("igreja_perfis")
      .upsert({
        igreja_id: context.igreja.id,
        user_id: authUser.id,
        papel,
        ativo: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "igreja_id,user_id" });
    if (profileError) throw profileError;

    if (membroId) {
      const { data: member, error: memberError } = await context.admin
        .from("igreja_membros")
        .select("id,user_id")
        .eq("id", membroId)
        .eq("igreja_id", context.igreja.id)
        .maybeSingle();
      if (memberError || !member) throw new Error("Membro selecionado não pertence a esta igreja.");
      if (member.user_id && String(member.user_id) !== String(authUser.id)) {
        throw new Error("Este membro já está vinculado a outro login.");
      }

      await context.admin
        .from("igreja_membros")
        .update({ user_id: null, updated_at: new Date().toISOString() })
        .eq("igreja_id", context.igreja.id)
        .eq("user_id", authUser.id);

      const { error: linkError } = await context.admin
        .from("igreja_membros")
        .update({ user_id: authUser.id, updated_at: new Date().toISOString() })
        .eq("id", membroId)
        .eq("igreja_id", context.igreja.id);
      if (linkError) throw linkError;
    }

    await auditChurchAccess(context, "elshaday acesso criado/atualizado", {
      usuario_id: coreUser.id,
      email,
      papel,
      membro_id: membroId
    });
  } catch (error) {
    accessRedirect("erro", error instanceof Error ? error.message : "Não foi possível criar o acesso.");
  }

  revalidatePath("/elshaday/acessos");
  accessRedirect("ok", "convite");
}

export async function updateElshadayAccessRole(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/acessos");
  requireElshadayRole(context, ["admin"]);

  try {
    const usuarioId = text(formData, "usuario_id");
    const papel = accessRole(text(formData, "papel"));
    const coreUser = await getChurchCoreUser(context, usuarioId);
    if (!coreUser.auth_user_id) throw new Error("Este usuário ainda não possui login de autenticação.");
    if (String(coreUser.auth_user_id) === context.current.authUser.id) {
      throw new Error("Para evitar bloqueio administrativo, você não pode alterar o próprio perfil.");
    }

    const appId = await getElshadayAppId(context.admin);
    const { error: permissionError } = await context.admin
      .from("core_usuario_app_permissoes")
      .upsert({
        usuario_id: coreUser.id,
        empresa_id: context.igreja.empresa_id,
        app_id: appId,
        perfil_app: papel,
        status: "ativo",
        updated_at: new Date().toISOString()
      }, { onConflict: "usuario_id,app_id" });
    if (permissionError) throw permissionError;

    const { error: profileError } = await context.admin
      .from("igreja_perfis")
      .upsert({
        igreja_id: context.igreja.id,
        user_id: coreUser.auth_user_id,
        papel,
        ativo: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "igreja_id,user_id" });
    if (profileError) throw profileError;

    await auditChurchAccess(context, "elshaday perfil alterado", {
      usuario_id: coreUser.id,
      papel
    });
  } catch (error) {
    accessRedirect("erro", error instanceof Error ? error.message : "Não foi possível alterar o perfil.");
  }

  revalidatePath("/elshaday/acessos");
  accessRedirect("ok", "perfil");
}

export async function setElshadayAccessStatus(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/acessos");
  requireElshadayRole(context, ["admin"]);

  try {
    const usuarioId = text(formData, "usuario_id");
    const status = text(formData, "status") === "ativo" ? "ativo" : "bloqueado";
    const coreUser = await getChurchCoreUser(context, usuarioId);
    if (!coreUser.auth_user_id) throw new Error("Este usuário ainda não possui login de autenticação.");
    if (String(coreUser.auth_user_id) === context.current.authUser.id) {
      throw new Error("Você não pode bloquear o próprio acesso administrativo.");
    }

    const appId = await getElshadayAppId(context.admin);
    const { error: permissionError } = await context.admin
      .from("core_usuario_app_permissoes")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("usuario_id", coreUser.id)
      .eq("empresa_id", context.igreja.empresa_id)
      .eq("app_id", appId);
    if (permissionError) throw permissionError;

    const { error: profileError } = await context.admin
      .from("igreja_perfis")
      .update({ ativo: status === "ativo", updated_at: new Date().toISOString() })
      .eq("igreja_id", context.igreja.id)
      .eq("user_id", coreUser.auth_user_id);
    if (profileError) throw profileError;

    await auditChurchAccess(context, "elshaday acesso status alterado", {
      usuario_id: coreUser.id,
      status
    });
  } catch (error) {
    accessRedirect("erro", error instanceof Error ? error.message : "Não foi possível alterar o status.");
  }

  revalidatePath("/elshaday/acessos");
  accessRedirect("ok", "status");
}

export async function linkElshadayAccessMember(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/acessos");
  requireElshadayRole(context, ["admin"]);

  try {
    const usuarioId = text(formData, "usuario_id");
    const membroId = nullable(formData, "membro_id");
    const coreUser = await getChurchCoreUser(context, usuarioId);
    if (!coreUser.auth_user_id) throw new Error("Este usuário ainda não possui login de autenticação.");

    if (membroId) {
      const { data: member, error: memberError } = await context.admin
        .from("igreja_membros")
        .select("id,user_id")
        .eq("id", membroId)
        .eq("igreja_id", context.igreja.id)
        .maybeSingle();
      if (memberError || !member) throw new Error("Membro selecionado não pertence a esta igreja.");
      if (member.user_id && String(member.user_id) !== String(coreUser.auth_user_id)) {
        throw new Error("Este membro já está vinculado a outro login.");
      }
    }

    const { error: clearError } = await context.admin
      .from("igreja_membros")
      .update({ user_id: null, updated_at: new Date().toISOString() })
      .eq("igreja_id", context.igreja.id)
      .eq("user_id", coreUser.auth_user_id);
    if (clearError) throw clearError;

    if (membroId) {
      const { error: linkError } = await context.admin
        .from("igreja_membros")
        .update({ user_id: coreUser.auth_user_id, updated_at: new Date().toISOString() })
        .eq("id", membroId)
        .eq("igreja_id", context.igreja.id);
      if (linkError) throw linkError;
    }

    await auditChurchAccess(context, "elshaday vínculo membro alterado", {
      usuario_id: coreUser.id,
      membro_id: membroId
    });
  } catch (error) {
    accessRedirect("erro", error instanceof Error ? error.message : "Não foi possível atualizar o vínculo.");
  }

  revalidatePath("/elshaday/acessos");
  accessRedirect("ok", "membro");
}

export async function sendElshadayPasswordEmail(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/acessos");
  requireElshadayRole(context, ["admin"]);

  try {
    const usuarioId = text(formData, "usuario_id");
    const coreUser = await getChurchCoreUser(context, usuarioId);
    if (!coreUser.auth_user_id) throw new Error("Este usuário ainda não possui login de autenticação.");

    const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mbalabs.com.br").replace(/\/$/, "");
    const { error } = await context.admin.auth.resetPasswordForEmail(String(coreUser.email), {
      redirectTo: `${siteUrl}/alterar-senha`
    });
    if (error) throw error;

    await auditChurchAccess(context, "elshaday link de senha enviado", {
      usuario_id: coreUser.id,
      email: coreUser.email
    });
  } catch (error) {
    accessRedirect("erro", error instanceof Error ? error.message : "Não foi possível enviar o link de senha.");
  }

  accessRedirect("ok", "senha");
}
