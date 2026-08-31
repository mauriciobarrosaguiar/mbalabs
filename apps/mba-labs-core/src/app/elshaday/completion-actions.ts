"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
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

function money(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/\./g, "").replace(",", ".");
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor maior que zero.");
  return Number(value.toFixed(2));
}

function palmasDateTimeIso(value: string | null) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00-03:00`
    : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data ou horário inválido.");
  return parsed.toISOString();
}

function safeReturn(formData: FormData, fallback: string) {
  const value = text(formData, "return_to");
  return value.startsWith("/elshaday/") && !value.startsWith("//") ? value : fallback;
}

function withMessage(path: string, kind: "ok" | "erro", message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${kind}=${encodeURIComponent(message)}`);
}

async function audit(context: any, action: string, details: Record<string, unknown>) {
  try {
    await context.admin.from("core_logs").insert({
      empresa_id: context.igreja.empresa_id,
      usuario_id: context.current.usuario.id,
      app_slug: "elshaday",
      acao: action,
      detalhes: details
    });
  } catch {
    // Auditoria não interrompe a operação principal.
  }
}

async function assertEvent(context: any, id: string) {
  const { data, error } = await context.admin
    .from("igreja_eventos")
    .select("id,igreja_id,status,inicio")
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();
  if (error || !data) throw new Error("Evento não localizado.");
  return data;
}

async function assertSermon(context: any, id: string) {
  const { data, error } = await context.admin
    .from("igreja_pregacoes")
    .select("id,igreja_id,status")
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();
  if (error || !data) throw new Error("Pregação não localizada.");
  return data;
}

export async function updateElshadayEvent(formData: FormData) {
  const eventId = text(formData, "evento_id");
  const returnTo = safeReturn(formData, `/elshaday/eventos/${eventId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  try {
    await assertEvent(context, eventId);
    const titulo = text(formData, "titulo");
    const inicio = palmasDateTimeIso(text(formData, "inicio"));
    if (titulo.length < 2 || !inicio) throw new Error("Informe título, data e horário.");

    const { error } = await context.admin
      .from("igreja_eventos")
      .update({
        titulo,
        tipo: text(formData, "tipo") || "culto",
        descricao: nullable(formData, "descricao"),
        inicio,
        fim: palmasDateTimeIso(nullable(formData, "fim")),
        local: nullable(formData, "local"),
        pregador: nullable(formData, "pregador"),
        dirigente: nullable(formData, "dirigente"),
        tema: nullable(formData, "tema"),
        texto_biblico: nullable(formData, "texto_biblico"),
        publico: text(formData, "publico") || "todos",
        updated_at: new Date().toISOString()
      })
      .eq("id", eventId)
      .eq("igreja_id", context.igreja.id);

    if (error) throw new Error(error.message);
    await audit(context, "elshaday evento atualizado", { evento_id: eventId });
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao atualizar evento.");
  }

  revalidatePath("/elshaday");
  revalidatePath("/elshaday/eventos");
  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "evento_atualizado");
}

export async function setElshadayEventStatus(formData: FormData) {
  const eventId = text(formData, "evento_id");
  const returnTo = safeReturn(formData, `/elshaday/eventos/${eventId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  try {
    await assertEvent(context, eventId);
    const status = text(formData, "status");
    if (!["agendado", "realizado", "cancelado"].includes(status)) {
      throw new Error("Status do evento inválido.");
    }

    const { error } = await context.admin
      .from("igreja_eventos")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", eventId)
      .eq("igreja_id", context.igreja.id);

    if (error) throw new Error(error.message);
    await audit(context, "elshaday status evento alterado", { evento_id: eventId, status });
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao alterar evento.");
  }

  revalidatePath("/elshaday/eventos");
  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "status_evento");
}

export async function saveElshadayAttendance(formData: FormData) {
  const eventId = text(formData, "evento_id");
  const memberId = text(formData, "membro_id");
  const returnTo = safeReturn(formData, `/elshaday/eventos/${eventId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  try {
    await assertEvent(context, eventId);
    const { data: member, error: memberError } = await context.admin
      .from("igreja_membros")
      .select("id")
      .eq("id", memberId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();
    if (memberError || !member) throw new Error("Membro não pertence a esta igreja.");

    const present = text(formData, "presente") === "true";
    const { error } = await context.admin
      .from("igreja_evento_presencas")
      .upsert({
        igreja_id: context.igreja.id,
        evento_id: eventId,
        membro_id: memberId,
        presente: present,
        registrado_em: new Date().toISOString()
      }, { onConflict: "evento_id,membro_id" });
    if (error) throw new Error(error.message);
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao registrar presença.");
  }

  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "presenca");
}

export async function markAllElshadayAttendance(formData: FormData) {
  const eventId = text(formData, "evento_id");
  const returnTo = safeReturn(formData, `/elshaday/eventos/${eventId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  try {
    await assertEvent(context, eventId);
    const { data: members, error: membersError } = await context.admin
      .from("igreja_membros")
      .select("id")
      .eq("igreja_id", context.igreja.id)
      .in("situacao", ["ativo", "visitante"]);
    if (membersError) throw new Error(membersError.message);

    const rows = (members ?? []).map((member: any) => ({
      igreja_id: context.igreja.id,
      evento_id: eventId,
      membro_id: member.id,
      presente: true,
      registrado_em: new Date().toISOString()
    }));

    if (rows.length) {
      const { error } = await context.admin
        .from("igreja_evento_presencas")
        .upsert(rows, { onConflict: "evento_id,membro_id" });
      if (error) throw new Error(error.message);
    }

    await audit(context, "elshaday presenca em massa", { evento_id: eventId, total: rows.length });
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao marcar presenças.");
  }

  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "todos_presentes");
}

function sermonPayload(formData: FormData) {
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

  return {
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
    updated_at: new Date().toISOString()
  };
}

export async function updateElshadaySermon(formData: FormData) {
  const sermonId = text(formData, "pregacao_id");
  const returnTo = safeReturn(formData, `/elshaday/pregacoes/${sermonId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  try {
    await assertSermon(context, sermonId);
    const { error } = await context.admin
      .from("igreja_pregacoes")
      .update(sermonPayload(formData))
      .eq("id", sermonId)
      .eq("igreja_id", context.igreja.id);
    if (error) throw new Error(error.message);
    await audit(context, "elshaday pregacao atualizada", { pregacao_id: sermonId });
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao atualizar pregação.");
  }

  revalidatePath("/elshaday/pregacoes");
  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "pregacao_atualizada");
}

export async function setElshadaySermonStatus(formData: FormData) {
  const sermonId = text(formData, "pregacao_id");
  const returnTo = safeReturn(formData, `/elshaday/pregacoes/${sermonId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  try {
    await assertSermon(context, sermonId);
    const status = text(formData, "status");
    if (!["ativo", "arquivado"].includes(status)) throw new Error("Status inválido.");
    const { error } = await context.admin
      .from("igreja_pregacoes")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", sermonId)
      .eq("igreja_id", context.igreja.id);
    if (error) throw new Error(error.message);
    await audit(context, "elshaday pregacao status", { pregacao_id: sermonId, status });
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao alterar pregação.");
  }

  revalidatePath("/elshaday/pregacoes");
  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "status_pregacao");
}

export async function saveBibleNote(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/biblia");
  if (!hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria", "lider", "membro"])) {
    throw new Error("Perfil sem acesso.");
  }

  const referencia = text(formData, "referencia");
  const anotacao = text(formData, "anotacao");
  if (!referencia || !anotacao) throw new Error("Informe referência e anotação.");

  const { error } = await context.admin
    .from("igreja_biblia_anotacoes")
    .upsert({
      igreja_id: context.igreja.id,
      user_id: context.current.authUser.id,
      referencia,
      anotacao,
      updated_at: new Date().toISOString()
    }, { onConflict: "igreja_id,user_id,referencia" });

  if (error) throw new Error(error.message);
  revalidatePath("/elshaday/biblia");
}

export async function removeBibleNote(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/biblia");
  const id = text(formData, "id");
  const { error } = await context.admin
    .from("igreja_biblia_anotacoes")
    .delete()
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .eq("user_id", context.current.authUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/elshaday/biblia");
}

export async function removeBibleFavorite(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/biblia");
  const id = text(formData, "id");
  const { error } = await context.admin
    .from("igreja_biblia_favoritos")
    .delete()
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .eq("user_id", context.current.authUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/elshaday/biblia");
}

async function financeMonthClosed(context: any, date: string) {
  const competencia = String(date).slice(0, 7);
  const { data, error } = await context.admin
    .from("igreja_financeiro_fechamentos")
    .select("status")
    .eq("igreja_id", context.igreja.id)
    .eq("competencia", competencia)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status === "fechado";
}

export async function updateElshadayFinanceEntry(formData: FormData) {
  const entryId = text(formData, "entrada_id");
  const returnTo = safeReturn(formData, `/elshaday/financeiro/lancamentos/${entryId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "tesouraria"]);

  try {
    const { data: entry, error: findError } = await context.admin
      .from("igreja_financeiro_entradas")
      .select("id,origem,data_entrada,status")
      .eq("id", entryId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();
    if (findError || !entry) throw new Error("Lançamento não localizado.");
    if (entry.origem !== "manual") throw new Error("Recebimentos automáticos não podem ser editados manualmente.");
    if (entry.status === "estornado") throw new Error("Lançamento estornado não pode ser editado.");
    if (await financeMonthClosed(context, String(entry.data_entrada))) {
      throw new Error("Esta competência está fechada. Reabra o mês antes de editar.");
    }

    const date = text(formData, "data_entrada");
    if (date && await financeMonthClosed(context, date)) {
      throw new Error("A competência de destino está fechada.");
    }

    const anonimo = text(formData, "anonimo") === "on";
    const { error } = await context.admin
      .from("igreja_financeiro_entradas")
      .update({
        membro_id: anonimo ? null : nullable(formData, "membro_id"),
        tipo: text(formData, "tipo") || "outro",
        descricao: nullable(formData, "descricao"),
        valor: money(formData, "valor"),
        forma_pagamento: text(formData, "forma_pagamento") || "outro",
        data_entrada: date || entry.data_entrada,
        anonimo,
        observacoes: nullable(formData, "observacoes"),
        alterado_em: new Date().toISOString(),
        alterado_por: context.current.authUser.id
      })
      .eq("id", entryId)
      .eq("igreja_id", context.igreja.id);
    if (error) throw new Error(error.message);

    await audit(context, "elshaday financeiro alterado", { entrada_id: entryId, origem: entry.origem });
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao alterar lançamento.");
  }

  revalidatePath("/elshaday/financeiro");
  revalidatePath("/elshaday/financeiro/relatorios");
  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "lancamento_atualizado");
}

export async function voidElshadayFinanceEntry(formData: FormData) {
  const entryId = text(formData, "entrada_id");
  const returnTo = safeReturn(formData, `/elshaday/financeiro/lancamentos/${entryId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "tesouraria"]);

  try {
    const motivo = text(formData, "motivo");
    if (motivo.length < 4) throw new Error("Informe o motivo do estorno.");
    const { data: entry, error: findError } = await context.admin
      .from("igreja_financeiro_entradas")
      .select("id,data_entrada,status,origem")
      .eq("id", entryId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();
    if (findError || !entry) throw new Error("Lançamento não localizado.");
    if (entry.origem !== "manual") throw new Error("Recebimentos automáticos devem ser estornados pelo fluxo do provedor.");
    if (entry.status === "estornado") throw new Error("Este lançamento já está estornado.");
    if (await financeMonthClosed(context, String(entry.data_entrada))) {
      throw new Error("Esta competência está fechada. Reabra o mês antes de estornar.");
    }

    const { error } = await context.admin
      .from("igreja_financeiro_entradas")
      .update({
        status: "estornado",
        estornado_em: new Date().toISOString(),
        estornado_por: context.current.authUser.id,
        estorno_motivo: motivo
      })
      .eq("id", entryId)
      .eq("igreja_id", context.igreja.id);
    if (error) throw new Error(error.message);

    await audit(context, "elshaday financeiro estornado", { entrada_id: entryId, motivo });
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao estornar lançamento.");
  }

  revalidatePath("/elshaday/financeiro");
  revalidatePath("/elshaday/financeiro/relatorios");
  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "estornado");
}

export async function closeElshadayFinanceMonth(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/financeiro/relatorios");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  try {
    const competencia = text(formData, "competencia");
    if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Competência inválida.");
    const start = `${competencia}-01`;
    const [year, month] = competencia.split("-").map(Number);
    const next = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const { data: entries, error } = await context.admin
      .from("igreja_financeiro_entradas")
      .select("tipo,forma_pagamento,valor,status")
      .eq("igreja_id", context.igreja.id)
      .gte("data_entrada", start)
      .lt("data_entrada", next);
    if (error) throw new Error(error.message);

    const confirmed = (entries ?? []).filter((entry: any) => entry.status !== "estornado");
    const total = confirmed.reduce((sum: number, entry: any) => sum + Number(entry.valor ?? 0), 0);
    const resumo = {
      quantidade: confirmed.length,
      dizimos: confirmed.filter((e: any) => e.tipo === "dizimo").reduce((s: number, e: any) => s + Number(e.valor ?? 0), 0),
      ofertas: confirmed.filter((e: any) => e.tipo !== "dizimo").reduce((s: number, e: any) => s + Number(e.valor ?? 0), 0),
      dinheiro: confirmed.filter((e: any) => e.forma_pagamento === "dinheiro").reduce((s: number, e: any) => s + Number(e.valor ?? 0), 0),
      pix: confirmed.filter((e: any) => e.forma_pagamento === "pix").reduce((s: number, e: any) => s + Number(e.valor ?? 0), 0)
    };

    const { error: closeError } = await context.admin
      .from("igreja_financeiro_fechamentos")
      .upsert({
        igreja_id: context.igreja.id,
        competencia,
        total_calculado: Number(total.toFixed(2)),
        resumo,
        observacoes: nullable(formData, "observacoes"),
        fechado_por: context.current.authUser.id,
        fechado_em: new Date().toISOString(),
        reaberto_por: null,
        reaberto_em: null,
        reabertura_motivo: null,
        status: "fechado",
        updated_at: new Date().toISOString()
      }, { onConflict: "igreja_id,competencia" });
    if (closeError) throw new Error(closeError.message);

    await audit(context, "elshaday financeiro competencia fechada", { competencia, total });
  } catch (error) {
    withMessage("/elshaday/financeiro/relatorios", "erro", error instanceof Error ? error.message : "Falha ao fechar competência.");
  }

  revalidatePath("/elshaday/financeiro/relatorios");
  withMessage("/elshaday/financeiro/relatorios", "ok", "mes_fechado");
}

export async function reopenElshadayFinanceMonth(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/financeiro/relatorios");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  try {
    const competencia = text(formData, "competencia");
    const motivo = text(formData, "motivo");
    if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Competência inválida.");
    if (motivo.length < 4) throw new Error("Informe o motivo da reabertura.");

    const { error } = await context.admin
      .from("igreja_financeiro_fechamentos")
      .update({
        status: "reaberto",
        reaberto_por: context.current.authUser.id,
        reaberto_em: new Date().toISOString(),
        reabertura_motivo: motivo,
        updated_at: new Date().toISOString()
      })
      .eq("igreja_id", context.igreja.id)
      .eq("competencia", competencia);
    if (error) throw new Error(error.message);

    await audit(context, "elshaday financeiro competencia reaberta", { competencia, motivo });
  } catch (error) {
    withMessage("/elshaday/financeiro/relatorios", "erro", error instanceof Error ? error.message : "Falha ao reabrir competência.");
  }

  revalidatePath("/elshaday/financeiro/relatorios");
  withMessage("/elshaday/financeiro/relatorios", "ok", "mes_reaberto");
}

export async function addElshadayMemberRelation(formData: FormData) {
  const memberId = text(formData, "membro_id");
  const returnTo = safeReturn(formData, `/elshaday/membros/${memberId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);

  try {
    const relativeId = text(formData, "parente_id");
    const relation = text(formData, "tipo");
    const allowed = ["conjuge","pai","mae","filho","filha","irmao","irma","responsavel","dependente","outro"];
    if (!allowed.includes(relation)) throw new Error("Relação familiar inválida.");
    if (!relativeId || relativeId === memberId) throw new Error("Selecione outro membro.");

    const { error } = await context.admin
      .from("igreja_membro_relacoes")
      .upsert({
        igreja_id: context.igreja.id,
        membro_id: memberId,
        parente_id: relativeId,
        tipo: relation,
        observacoes: nullable(formData, "observacoes"),
        created_by: context.current.authUser.id,
        updated_at: new Date().toISOString()
      }, { onConflict: "igreja_id,membro_id,parente_id,tipo" });
    if (error) throw new Error(error.message);
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao vincular familiar.");
  }

  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "familia");
}

export async function removeElshadayMemberRelation(formData: FormData) {
  const memberId = text(formData, "membro_id");
  const returnTo = safeReturn(formData, `/elshaday/membros/${memberId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);

  const id = text(formData, "relacao_id");
  const { error } = await context.admin
    .from("igreja_membro_relacoes")
    .delete()
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .eq("membro_id", memberId);
  if (error) withMessage(returnTo, "erro", error.message);

  revalidatePath(returnTo);
  withMessage(returnTo, "ok", "familia_removida");
}

export async function uploadElshadayMemberPhoto(formData: FormData) {
  const memberId = text(formData, "membro_id");
  const returnTo = safeReturn(formData, `/elshaday/membros/${memberId}`);
  const context = await requireElshadayContext(returnTo);
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);

  try {
    const file = formData.get("foto");
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
    if (file.size > 5 * 1024 * 1024) throw new Error("A foto deve ter no máximo 5 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Use uma imagem JPG, PNG ou WebP.");
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${context.igreja.id}/${memberId}/perfil-${Date.now()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await context.admin.storage
      .from("igreja-membros")
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: current } = await context.admin
      .from("igreja_membros")
      .select("foto_url")
      .eq("id", memberId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();

    const { error: updateError } = await context.admin
      .from("igreja_membros")
      .update({ foto_url: path, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("igreja_id", context.igreja.id);
    if (updateError) throw new Error(updateError.message);

    if (current?.foto_url && current.foto_url !== path) {
      await context.admin.storage.from("igreja-membros").remove([current.foto_url]);
    }
  } catch (error) {
    withMessage(returnTo, "erro", error instanceof Error ? error.message : "Falha ao enviar foto.");
  }

  revalidatePath(returnTo);
  revalidatePath("/elshaday/membros");
  withMessage(returnTo, "ok", "foto");
}

export async function importElshadayMembers(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/membros");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);

  try {
    const file = formData.get("arquivo");
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo CSV ou XLSX.");
    if (file.size > 5 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 5 MB.");

    let rows: Record<string, unknown>[] = [];
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".xlsx")) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("A planilha não possui abas.");
      const headerRow = sheet.getRow(1);
      const headers = headerRow.values instanceof Array
        ? headerRow.values.slice(1).map((value) => normalizeHeader(String(value ?? "")))
        : [];
      sheet.eachRow((row, number) => {
        if (number === 1) return;
        const values = row.values instanceof Array ? row.values.slice(1) : [];
        const record: Record<string, unknown> = {};
        headers.forEach((header, index) => { if (header) record[header] = values[index] ?? ""; });
        rows.push(record);
      });
    } else if (lowerName.endsWith(".csv")) {
      const source = await file.text();
      const lines = source.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) throw new Error("CSV sem registros.");
      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
      rows = lines.slice(1).map((line) => {
        const values = parseCsvLine(line, delimiter);
        const record: Record<string, unknown> = {};
        headers.forEach((header, index) => { if (header) record[header] = values[index] ?? ""; });
        return record;
      });
    } else {
      throw new Error("Formato não suportado. Use CSV ou XLSX.");
    }

    const payload = rows
      .map((row) => {
        const nome = cell(row, "nome", "nome_completo");
        if (!nome) return null;
        const situacaoRaw = cell(row, "situacao") || "ativo";
        const situacao = ["ativo","afastado","visitante","transferido","inativo"].includes(situacaoRaw)
          ? situacaoRaw
          : "ativo";
        return {
          igreja_id: context.igreja.id,
          nome,
          cpf: cell(row, "cpf") || null,
          telefone: cell(row, "telefone") || null,
          whatsapp: cell(row, "whatsapp") || null,
          email: (cell(row, "email") || "").toLowerCase() || null,
          data_nascimento: normalizeDateCell(cell(row, "data_nascimento", "nascimento")),
          endereco: cell(row, "endereco") || null,
          bairro: cell(row, "bairro") || null,
          cidade: cell(row, "cidade") || null,
          estado: (cell(row, "estado", "uf") || "").toUpperCase().slice(0, 2) || null,
          cargo: cell(row, "cargo") || null,
          ministerio: cell(row, "ministerio") || null,
          situacao,
          observacoes: cell(row, "observacoes") || null
        };
      })
      .filter(Boolean);

    if (!payload.length) throw new Error("Nenhum membro válido encontrado.");

    const emails = payload.map((row: any) => row.email).filter(Boolean);
    const cpfs = payload.map((row: any) => row.cpf).filter(Boolean);
    const { data: existing, error: existingError } = await context.admin
      .from("igreja_membros")
      .select("email,cpf")
      .eq("igreja_id", context.igreja.id);
    if (existingError) throw new Error(existingError.message);

    const existingEmails = new Set((existing ?? []).map((row: any) => String(row.email ?? "").toLowerCase()).filter(Boolean));
    const existingCpfs = new Set((existing ?? []).map((row: any) => String(row.cpf ?? "").replace(/\D/g, "")).filter(Boolean));

    const filtered = payload.filter((row: any) => {
      const email = String(row.email ?? "").toLowerCase();
      const cpf = String(row.cpf ?? "").replace(/\D/g, "");
      return !(email && existingEmails.has(email)) && !(cpf && existingCpfs.has(cpf));
    });

    if (!filtered.length) throw new Error("Todos os registros já existem por e-mail ou CPF.");

    const { error } = await context.admin.from("igreja_membros").insert(filtered);
    if (error) throw new Error(error.message);

    await audit(context, "elshaday membros importados", {
      arquivo: file.name,
      lidos: payload.length,
      importados: filtered.length,
      ignorados: payload.length - filtered.length
    });

    revalidatePath("/elshaday/membros");
    withMessage("/elshaday/membros", "ok", `importados:${filtered.length}:${payload.length - filtered.length}`);
  } catch (error) {
    withMessage("/elshaday/membros", "erro", error instanceof Error ? error.message : "Falha ao importar membros.");
  }
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizeDateCell(value: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2,"0")}-${br[1].padStart(2,"0")}`;
  return null;
}

function parseCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}
