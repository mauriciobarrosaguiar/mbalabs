"use server";

import { revalidatePath } from "next/cache";
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

  if (error) throw new Error(\`Falha ao cadastrar membro: \${error.message}\`);
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

  if (error) throw new Error(\`Falha ao registrar entrada: \${error.message}\`);
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
    inicio: new Date(inicio).toISOString(),
    local: nullable(formData, "local"),
    pregador: nullable(formData, "pregador"),
    dirigente: nullable(formData, "dirigente"),
    tema: nullable(formData, "tema"),
    texto_biblico: nullable(formData, "texto_biblico"),
    publico: text(formData, "publico") || "todos",
    status: "agendado",
    created_by: context.current.authUser.id
  });

  if (error) throw new Error(\`Falha ao cadastrar evento: \${error.message}\`);
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

  if (error) throw new Error(\`Falha ao salvar pregação: \${error.message}\`);
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

  if (error) throw new Error(\`Falha ao favoritar: \${error.message}\`);
  revalidatePath("/elshaday/biblia");
}
