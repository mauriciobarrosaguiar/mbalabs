"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  hasElshadayRole,
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";
import {
  createElshadayIdentifiedPixCharge,
  createElshadayStaticPixQrCode,
  saveElshadayPixConfiguration,
  syncElshadayStaticPixReceipts
} from "@/lib/elshaday-payments";
import {
  parseElshadayPixProvider,
  saveElshadayPixProviderConfig
} from "@/lib/elshaday-payment-providers";

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

const EVENT_RECURRENCE_TYPES = ["nenhuma", "diaria", "semanal", "quinzenal", "mensal"] as const;
type EventRecurrenceType = (typeof EVENT_RECURRENCE_TYPES)[number];

function eventRecurrenceType(value: string): EventRecurrenceType {
  const normalized = value || "nenhuma";
  if (!EVENT_RECURRENCE_TYPES.includes(normalized as EventRecurrenceType)) {
    throw new Error("Recorrência inválida.");
  }
  return normalized as EventRecurrenceType;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function recurringLocalAt(
  baseValue: string,
  type: Exclude<EventRecurrenceType, "nenhuma">,
  occurrence: number
) {
  const match = baseValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Data de início inválida.");

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  let next: Date;

  if (type === "mensal") {
    const targetMonthIndex = month + occurrence;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    next = new Date(
      Date.UTC(targetYear, targetMonth, Math.min(day, lastDay), hour, minute)
    );
  } else {
    const stepDays = type === "diaria" ? 1 : type === "semanal" ? 7 : 14;
    next = new Date(
      Date.UTC(year, month, day + stepDays * occurrence, hour, minute)
    );
  }

  return [
    next.getUTCFullYear(),
    padDatePart(next.getUTCMonth() + 1),
    padDatePart(next.getUTCDate())
  ].join("-") + "T" + padDatePart(next.getUTCHours()) + ":" + padDatePart(next.getUTCMinutes());
}

function buildRecurringLocalStarts(
  start: string,
  type: EventRecurrenceType,
  until: string | null
) {
  if (type === "nenhuma") return [start];
  if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    throw new Error("Informe até quando a programação deve se repetir.");
  }
  if (until < start.slice(0, 10)) {
    throw new Error("A data final da recorrência não pode ser anterior ao primeiro evento.");
  }

  const result = [start];
  let cursor = start;

  while (result.length < 400) {
    cursor = recurringLocalAt(start, type, result.length);
    if (cursor.slice(0, 10) > until) break;
    result.push(cursor);
  }

  if (result.length >= 400 && cursor.slice(0, 10) <= until) {
    throw new Error("A recorrência gerou eventos demais. Reduza o período.");
  }

  return result;
}

const MEMBER_STATUS = ["ativo", "afastado", "visitante", "transferido", "inativo"] as const;

function memberStatus(value: string) {
  if (!MEMBER_STATUS.includes(value as (typeof MEMBER_STATUS)[number])) {
    throw new Error("Situação do membro inválida.");
  }
  return value as (typeof MEMBER_STATUS)[number];
}

function safeElshadayReturn(formData: FormData, fallback: string) {
  const candidate = text(formData, "return_to");
  if (!candidate.startsWith("/elshaday/") || candidate.startsWith("//")) {
    return fallback;
  }
  return candidate;
}

function redirectWithMessage(path: string, kind: "ok" | "erro", message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${kind}=${encodeURIComponent(message)}`);
}

export async function createElshadayMember(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/membros");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);

  const nome = text(formData, "nome");
  if (nome.length < 2) throw new Error("Informe o nome do membro.");

  const email = nullable(formData, "email");
  const estado = nullable(formData, "estado");

  const { data, error } = await context.admin.from("igreja_membros").insert({
    igreja_id: context.igreja.id,
    nome,
    data_nascimento: nullableDate(formData, "data_nascimento"),
    cpf: nullable(formData, "cpf"),
    telefone: nullable(formData, "telefone"),
    whatsapp: nullable(formData, "whatsapp"),
    email: email ? email.toLowerCase() : null,
    endereco: nullable(formData, "endereco"),
    bairro: nullable(formData, "bairro"),
    cidade: nullable(formData, "cidade"),
    estado: estado ? estado.toUpperCase().slice(0, 2) : null,
    data_conversao: nullableDate(formData, "data_conversao"),
    data_batismo: nullableDate(formData, "data_batismo"),
    data_entrada: nullableDate(formData, "data_entrada"),
    cargo: nullable(formData, "cargo"),
    ministerio: nullable(formData, "ministerio"),
    situacao: memberStatus(text(formData, "situacao") || "ativo"),
    observacoes: nullable(formData, "observacoes")
  }).select("id").single();

  if (error) throw new Error(`Falha ao cadastrar membro: ${error.message}`);

  await auditChurchAccess(context, "elshaday membro cadastrado", {
    membro_id: data.id,
    nome
  });

  revalidatePath("/elshaday");
  revalidatePath("/elshaday/membros");
  redirectWithMessage(`/elshaday/membros/${data.id}`, "ok", "cadastrado");
}

export async function createElshadayFinanceEntry(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/financeiro");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  const anonimo = text(formData, "anonimo") === "on";
  const membroId = anonimo ? null : nullable(formData, "membro_id");
  const dataEntrada = text(formData, "data_entrada") || new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const competencia = dataEntrada.slice(0, 7);

  const { data: fechamento, error: fechamentoError } = await context.admin
    .from("igreja_financeiro_fechamentos")
    .select("status")
    .eq("igreja_id", context.igreja.id)
    .eq("competencia", competencia)
    .maybeSingle();

  if (fechamentoError) throw new Error("Falha ao validar fechamento: " + fechamentoError.message);
  if (fechamento?.status === "fechado") {
    throw new Error("A competência " + competencia + " está fechada. Reabra o mês antes de lançar uma entrada.");
  }

  const { error } = await context.admin.from("igreja_financeiro_entradas").insert({
    igreja_id: context.igreja.id,
    membro_id: membroId,
    tipo: text(formData, "tipo") || "dizimo",
    descricao: nullable(formData, "descricao"),
    valor: positiveMoney(formData, "valor"),
    forma_pagamento: text(formData, "forma_pagamento") || "dinheiro",
    data_entrada: dataEntrada,
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

  const recurrence = eventRecurrenceType(text(formData, "recorrencia_tipo"));
  const recurrenceUntil = recurrence === "nenhuma" ? null : nullable(formData, "recorrencia_ate");
  const starts = buildRecurringLocalStarts(inicio, recurrence, recurrenceUntil);
  const firstStartIso = palmasDateTimeIso(inicio);
  const fimRaw = nullable(formData, "fim");
  const durationMs = fimRaw
    ? new Date(palmasDateTimeIso(fimRaw)).getTime() - new Date(firstStartIso).getTime()
    : null;

  if (durationMs !== null && durationMs <= 0) {
    throw new Error("O término precisa ser posterior ao início.");
  }

  const idempotencyBase = text(formData, "idempotency_key") || crypto.randomUUID();
  const firstIdempotency = idempotencyBase + ":0";

  const { data: existing, error: existingError } = await context.admin
    .from("igreja_eventos")
    .select("id")
    .eq("igreja_id", context.igreja.id)
    .eq("idempotency_key", firstIdempotency)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.id) {
    revalidatePath("/elshaday");
    revalidatePath("/elshaday/eventos");
    return;
  }

  const seriesId = recurrence === "nenhuma" ? null : crypto.randomUUID();
  const common = {
    igreja_id: context.igreja.id,
    titulo,
    tipo: text(formData, "tipo") || "culto",
    descricao: nullable(formData, "descricao"),
    local: nullable(formData, "local"),
    pregador: nullable(formData, "pregador"),
    dirigente: nullable(formData, "dirigente"),
    tema: nullable(formData, "tema"),
    texto_biblico: nullable(formData, "texto_biblico"),
    publico: text(formData, "publico") || "todos",
    status: "agendado",
    created_by: context.current.authUser.id,
    serie_id: seriesId,
    recorrencia_tipo: recurrence,
    recorrencia_ate: recurrenceUntil
  };

  const rows = starts.map((localStart, index) => {
    const startIso = palmasDateTimeIso(localStart);
    return {
      ...common,
      inicio: startIso,
      fim: durationMs === null
        ? null
        : new Date(new Date(startIso).getTime() + durationMs).toISOString(),
      recorrencia_ordem: recurrence === "nenhuma" ? null : index + 1,
      idempotency_key: idempotencyBase + ":" + index
    };
  });

  const { error } = await context.admin.from("igreja_eventos").insert(rows);

  if (error && error.code !== "23505") {
    throw new Error(`Falha ao cadastrar evento: ${error.message}`);
  }

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
    audio_url: nullable(formData, "audio_url"),
    arquivo_url: nullable(formData, "arquivo_url"),
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

  const { data: existing, error: findError } = await context.admin
    .from("igreja_biblia_favoritos")
    .select("id")
    .eq("igreja_id", context.igreja.id)
    .eq("user_id", context.current.authUser.id)
    .eq("referencia", referencia)
    .eq("traducao", "almeida")
    .maybeSingle();

  if (findError) throw new Error(`Falha ao consultar favorito: ${findError.message}`);

  if (existing?.id) {
    const { error } = await context.admin
      .from("igreja_biblia_favoritos")
      .delete()
      .eq("id", existing.id)
      .eq("igreja_id", context.igreja.id)
      .eq("user_id", context.current.authUser.id);

    if (error) throw new Error(`Falha ao remover favorito: ${error.message}`);
  } else {
    const { error } = await context.admin.from("igreja_biblia_favoritos").insert({
      igreja_id: context.igreja.id,
      user_id: context.current.authUser.id,
      referencia,
      texto: textoVersiculo || null,
      traducao: "almeida"
    });

    if (error) throw new Error(`Falha ao favoritar: ${error.message}`);
  }

  revalidatePath("/elshaday/biblia");
}


const ELSHADAY_ROLES = ["admin", "pastor", "tesouraria", "secretaria", "lider", "membro"] as const;

function accessRole(value: string) {
  if (!ELSHADAY_ROLES.includes(value as (typeof ELSHADAY_ROLES)[number])) {
    throw new Error("Perfil de acesso inválido.");
  }
  return value as (typeof ELSHADAY_ROLES)[number];
}

function accessRedirect(kind: "ok" | "erro", message: string, returnTo = "/elshaday/acessos"): never {
  redirectWithMessage(returnTo, kind, message);
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
  try {
    await context.admin.from("core_logs").insert({
      empresa_id: context.igreja.empresa_id,
      usuario_id: context.current.usuario.id,
      app_slug: "elshaday",
      acao,
      detalhes
    });
  } catch {
    // O log nunca deve impedir a ação principal de acesso.
  }
}

export async function createElshadayAccess(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/acessos");
  requireElshadayRole(context, ["admin"]);
  const returnTo = safeElshadayReturn(formData, "/elshaday/acessos");

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

      const { data: conflictingMember, error: conflictError } = await context.admin
        .from("igreja_membros")
        .select("id,nome")
        .eq("igreja_id", context.igreja.id)
        .eq("user_id", authUser.id)
        .neq("id", membroId)
        .maybeSingle();

      if (conflictError) throw conflictError;
      if (conflictingMember) {
        throw new Error(`Este login já está vinculado ao membro ${conflictingMember.nome}.`);
      }

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
    accessRedirect("erro", error instanceof Error ? error.message : "Não foi possível criar o acesso.", returnTo);
  }

  revalidatePath("/elshaday/acessos");
  revalidatePath("/elshaday/membros");
  accessRedirect("ok", "convite", returnTo);
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


export async function updateElshadayMember(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/membros");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);
  const membroId = text(formData, "membro_id");
  const returnTo = safeElshadayReturn(formData, `/elshaday/membros/${membroId}`);

  try {
    const nome = text(formData, "nome");
    if (nome.length < 2) throw new Error("Informe o nome do membro.");

    const { data: existing, error: existingError } = await context.admin
      .from("igreja_membros")
      .select("id")
      .eq("id", membroId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();

    if (existingError || !existing) throw new Error("Membro não pertence a esta igreja.");

    const email = nullable(formData, "email");
    const estado = nullable(formData, "estado");

    const { error } = await context.admin
      .from("igreja_membros")
      .update({
        nome,
        data_nascimento: nullableDate(formData, "data_nascimento"),
        cpf: nullable(formData, "cpf"),
        telefone: nullable(formData, "telefone"),
        whatsapp: nullable(formData, "whatsapp"),
        email: email ? email.toLowerCase() : null,
        endereco: nullable(formData, "endereco"),
        bairro: nullable(formData, "bairro"),
        cidade: nullable(formData, "cidade"),
        estado: estado ? estado.toUpperCase().slice(0, 2) : null,
        data_conversao: nullableDate(formData, "data_conversao"),
        data_batismo: nullableDate(formData, "data_batismo"),
        data_entrada: nullableDate(formData, "data_entrada"),
        cargo: nullable(formData, "cargo"),
        ministerio: nullable(formData, "ministerio"),
        situacao: memberStatus(text(formData, "situacao") || "ativo"),
        observacoes: nullable(formData, "observacoes"),
        updated_at: new Date().toISOString()
      })
      .eq("id", membroId)
      .eq("igreja_id", context.igreja.id);

    if (error) throw error;

    await auditChurchAccess(context, "elshaday membro atualizado", {
      membro_id: membroId,
      nome
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "erro",
      error instanceof Error ? error.message : "Não foi possível atualizar o membro."
    );
  }

  revalidatePath("/elshaday");
  revalidatePath("/elshaday/membros");
  revalidatePath(returnTo);
  redirectWithMessage(returnTo, "ok", "atualizado");
}

export async function setElshadayMemberStatus(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/membros");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);
  const membroId = text(formData, "membro_id");
  const returnTo = safeElshadayReturn(formData, `/elshaday/membros/${membroId}`);

  try {
    const situacao = memberStatus(text(formData, "situacao"));
    const { data, error } = await context.admin
      .from("igreja_membros")
      .update({ situacao, updated_at: new Date().toISOString() })
      .eq("id", membroId)
      .eq("igreja_id", context.igreja.id)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new Error("Membro não pertence a esta igreja.");

    await auditChurchAccess(context, "elshaday situação de membro alterada", {
      membro_id: membroId,
      situacao
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "erro",
      error instanceof Error ? error.message : "Não foi possível alterar a situação."
    );
  }

  revalidatePath("/elshaday");
  revalidatePath("/elshaday/membros");
  revalidatePath(returnTo);
  redirectWithMessage(returnTo, "ok", "situacao");
}

export async function linkElshadayMemberAccess(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/membros");
  requireElshadayRole(context, ["admin"]);
  const membroId = text(formData, "membro_id");
  const usuarioId = nullable(formData, "usuario_id");
  const returnTo = safeElshadayReturn(formData, `/elshaday/membros/${membroId}`);

  try {
    if (!context.igreja.empresa_id) throw new Error("Igreja sem organização vinculada.");

    const { data: member, error: memberError } = await context.admin
      .from("igreja_membros")
      .select("id,user_id")
      .eq("id", membroId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();

    if (memberError || !member) throw new Error("Membro não pertence a esta igreja.");

    if (!usuarioId) {
      const { error: unlinkError } = await context.admin
        .from("igreja_membros")
        .update({ user_id: null, updated_at: new Date().toISOString() })
        .eq("id", membroId)
        .eq("igreja_id", context.igreja.id);

      if (unlinkError) throw unlinkError;

      await auditChurchAccess(context, "elshaday membro desvinculado de acesso", {
        membro_id: membroId
      });
    } else {
      const coreUser = await getChurchCoreUser(context, usuarioId);
      if (!coreUser.auth_user_id) throw new Error("O acesso selecionado ainda não possui autenticação.");

      const appId = await getElshadayAppId(context.admin);
      const { data: permission, error: permissionError } = await context.admin
        .from("core_usuario_app_permissoes")
        .select("id,status")
        .eq("usuario_id", coreUser.id)
        .eq("empresa_id", context.igreja.empresa_id)
        .eq("app_id", appId)
        .maybeSingle();

      if (permissionError || !permission || permission.status !== "ativo") {
        throw new Error("O usuário selecionado não possui acesso ativo ao Elshaday.");
      }

      const { data: conflict, error: conflictError } = await context.admin
        .from("igreja_membros")
        .select("id,nome")
        .eq("igreja_id", context.igreja.id)
        .eq("user_id", coreUser.auth_user_id)
        .neq("id", membroId)
        .maybeSingle();

      if (conflictError) throw conflictError;
      if (conflict) {
        throw new Error(`Este login já está vinculado ao membro ${conflict.nome}.`);
      }

      const { error: linkError } = await context.admin
        .from("igreja_membros")
        .update({
          user_id: coreUser.auth_user_id,
          updated_at: new Date().toISOString()
        })
        .eq("id", membroId)
        .eq("igreja_id", context.igreja.id);

      if (linkError) throw linkError;

      await auditChurchAccess(context, "elshaday membro vinculado a acesso", {
        membro_id: membroId,
        usuario_id: coreUser.id
      });
    }
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "erro",
      error instanceof Error ? error.message : "Não foi possível atualizar o vínculo."
    );
  }

  revalidatePath("/elshaday/membros");
  revalidatePath("/elshaday/acessos");
  revalidatePath(returnTo);
  redirectWithMessage(returnTo, "ok", "vinculo");
}


export async function createElshadayIdentifiedPix(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/contribuir");
  if (!hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria", "lider", "membro"])) {
    throw new Error("Perfil sem acesso.");
  }

  try {
    const rawType = text(formData, "tipo");
    const allowedTypes = ["dizimo", "oferta", "oferta_especial", "campanha", "outro"] as const;
    if (!allowedTypes.includes(rawType as (typeof allowedTypes)[number])) {
      throw new Error("Selecione um tipo de contribuição válido.");
    }

    const { data: member, error: memberError } = await context.admin
      .from("igreja_membros")
      .select("id,nome,cpf,email,telefone,whatsapp,situacao")
      .eq("igreja_id", context.igreja.id)
      .eq("user_id", context.current.authUser.id)
      .maybeSingle();

    if (memberError) throw new Error(memberError.message);
    if (!member) {
      throw new Error("Seu login ainda não está vinculado a uma ficha de membro. Procure a Secretaria.");
    }
    if (String(member.situacao) === "inativo") {
      throw new Error("Seu cadastro de membro está inativo. Procure a Secretaria para atualizar.");
    }

    const result = await createElshadayIdentifiedPixCharge({
      igrejaId: context.igreja.id,
      member: {
        id: String(member.id),
        nome: String(member.nome),
        cpf: member.cpf ? String(member.cpf) : null,
        email: member.email ? String(member.email) : null,
        telefone: member.telefone ? String(member.telefone) : null,
        whatsapp: member.whatsapp ? String(member.whatsapp) : null
      },
      type: rawType as (typeof allowedTypes)[number],
      value: positiveMoney(formData, "valor"),
      description: nullable(formData, "descricao"),
      createdBy: context.current.authUser.id
    });

    await auditChurchAccess(context, "elshaday pix identificado criado", {
      membro_id: member.id,
      cobranca_id: result.id,
      provider_payment_id: result.paymentId,
      tipo: rawType
    });

    revalidatePath("/elshaday/contribuir");
    redirect(
      `/elshaday/contribuir?cobranca=${encodeURIComponent(result.id)}&ok=${encodeURIComponent("pix_identificado")}`
    );
  } catch (error) {
    redirectWithMessage(
      "/elshaday/contribuir",
      "erro",
      error instanceof Error ? error.message : "Não foi possível gerar o PIX identificado."
    );
  }
}

export async function saveElshadayPixSettings(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/financeiro");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  try {
    const environment = text(formData, "ambiente") === "production" ? "production" : "sandbox";
    const addressKey = text(formData, "pix_address_key");
    const active = text(formData, "ativo") === "on";

    if (active && !addressKey && !process.env.ELSHADAY_PIX_ADDRESS_KEY) {
      throw new Error("Informe a chave PIX da igreja para ativar a integração.");
    }

    await saveElshadayPixConfiguration({
      igrejaId: context.igreja.id,
      environment,
      active,
      addressKey,
      updatedBy: context.current.authUser.id
    });

    await auditChurchAccess(context, "elshaday configuração pix atualizada", {
      environment,
      active,
      address_key_configured: Boolean(addressKey || process.env.ELSHADAY_PIX_ADDRESS_KEY)
    });
  } catch (error) {
    redirectWithMessage(
      "/elshaday/financeiro",
      "erro",
      error instanceof Error ? error.message : "Não foi possível salvar a configuração PIX."
    );
  }

  revalidatePath("/elshaday/financeiro");
  revalidatePath("/elshaday/contribuir");
  redirectWithMessage("/elshaday/financeiro", "ok", "pix_config");
}

export async function generateElshadayStaticPix() {
  const context = await requireElshadayContext("/elshaday/financeiro");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  try {
    const result = await createElshadayStaticPixQrCode(
      context.igreja.id,
      context.current.authUser.id
    );

    await auditChurchAccess(context, "elshaday qr pix gerado", {
      static_qr_id: result.id
    });
  } catch (error) {
    redirectWithMessage(
      "/elshaday/financeiro",
      "erro",
      error instanceof Error ? error.message : "Não foi possível gerar o QR Code PIX."
    );
  }

  revalidatePath("/elshaday/financeiro");
  revalidatePath("/elshaday/contribuir");
  redirectWithMessage("/elshaday/financeiro", "ok", "pix_qr");
}

export async function syncElshadayPixReceipts() {
  const context = await requireElshadayContext("/elshaday/financeiro");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  try {
    const result = await syncElshadayStaticPixReceipts(context.igreja.id);

    await auditChurchAccess(context, "elshaday pix sincronizado", result);

    revalidatePath("/elshaday");
    revalidatePath("/elshaday/financeiro");
    redirectWithMessage(
      "/elshaday/financeiro",
      "ok",
      `pix_sync:${result.imported}:${result.seen}`
    );
  } catch (error) {
    redirectWithMessage(
      "/elshaday/financeiro",
      "erro",
      error instanceof Error ? error.message : "Não foi possível sincronizar os PIX."
    );
  }
}


export async function saveElshadayPixProviderSettings(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/financeiro/provedores");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  try {
    const provider = parseElshadayPixProvider(text(formData, "provider"));
    const environment = text(formData, "ambiente") === "production" ? "production" : "sandbox";
    const active = text(formData, "ativo") === "on";
    const principal = text(formData, "principal") === "on";

    await saveElshadayPixProviderConfig({
      igrejaId: context.igreja.id,
      provider,
      environment,
      active,
      principal,
      apelido: nullable(formData, "apelido"),
      pixAddressKey: nullable(formData, "pix_address_key"),
      updatedBy: context.current.authUser.id
    });

    await auditChurchAccess(context, "elshaday provedor pix configurado", {
      provider,
      environment,
      active,
      principal
    });
  } catch (error) {
    redirectWithMessage(
      "/elshaday/financeiro/provedores",
      "erro",
      error instanceof Error ? error.message : "Não foi possível salvar o provedor PIX."
    );
  }

  revalidatePath("/elshaday/financeiro");
  revalidatePath("/elshaday/financeiro/provedores");
  revalidatePath("/elshaday/contribuir");
  redirectWithMessage("/elshaday/financeiro/provedores", "ok", "provedor");
}
