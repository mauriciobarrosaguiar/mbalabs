"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";
import {
  removeElshadayContentImage,
  uploadElshadayContentImage
} from "@/lib/elshaday-media";

const CONTENT_EDITOR_ROLES = ["admin", "pastor"] as const;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullable(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function orderValue(formData: FormData, fallback = 10) {
  const raw = text(formData, "ordem");
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 9999) {
    throw new Error("A ordem deve ser um número entre 0 e 9999.");
  }
  return value;
}

function safeCarouselHref(formData: FormData) {
  const value = text(formData, "link_url");
  if (!value) return null;

  if (value.startsWith("/elshaday") && !value.startsWith("//")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // Mensagem única abaixo.
  }

  throw new Error("O link deve começar com /elshaday ou ser uma URL http/https válida.");
}

function redirectWithMessage(kind: "ok" | "erro", message: string): never {
  redirect("/elshaday/configuracoes?" + kind + "=" + encodeURIComponent(message));
}

function revalidateCarousel() {
  revalidatePath("/elshaday");
  revalidatePath("/elshaday/configuracoes");
}

export async function createElshadayCarouselItem(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes");
  requireElshadayRole(context, [...CONTENT_EDITOR_ROLES]);

  let imageUrl: string | null = null;

  try {
    imageUrl = await uploadElshadayContentImage(
      context.admin,
      context.igreja.id,
      "carrossel",
      formData.get("imagem")
    );

    if (!imageUrl) {
      throw new Error("Selecione uma imagem para o carrossel.");
    }

    const { data: lastItem, error: lastItemError } = await context.admin
      .from("igreja_carrossel")
      .select("ordem")
      .eq("igreja_id", context.igreja.id)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastItemError) {
      throw new Error("Falha ao calcular a posição do destaque: " + lastItemError.message);
    }

    const { error } = await context.admin.from("igreja_carrossel").insert({
      igreja_id: context.igreja.id,
      titulo: nullable(formData, "titulo"),
      subtitulo: nullable(formData, "subtitulo"),
      imagem_url: imageUrl,
      link_url: safeCarouselHref(formData),
      ordem: Number(lastItem?.ordem ?? 0) + 10,
      ativo: true,
      created_by: context.current.authUser.id,
      updated_by: context.current.authUser.id
    });

    if (error) {
      throw new Error("Falha ao adicionar imagem ao carrossel: " + error.message);
    }
  } catch (error) {
    if (imageUrl) {
      await removeElshadayContentImage(context.admin, imageUrl);
    }
    redirectWithMessage(
      "erro",
      error instanceof Error ? error.message : "Não foi possível adicionar a imagem."
    );
  }

  revalidateCarousel();
  redirectWithMessage("ok", "Imagem adicionada ao carrossel.");
}

export async function updateElshadayCarouselItem(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes");
  requireElshadayRole(context, [...CONTENT_EDITOR_ROLES]);

  const id = text(formData, "id");
  if (!id) redirectWithMessage("erro", "Destaque inválido.");

  const { data: current, error: currentError } = await context.admin
    .from("igreja_carrossel")
    .select("id,imagem_url")
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();

  if (currentError || !current) {
    redirectWithMessage("erro", "Destaque não encontrado.");
  }

  let newImageUrl: string | null = null;

  try {
    newImageUrl = await uploadElshadayContentImage(
      context.admin,
      context.igreja.id,
      "carrossel",
      formData.get("imagem")
    );

    const { error } = await context.admin
      .from("igreja_carrossel")
      .update({
        titulo: nullable(formData, "titulo"),
        subtitulo: nullable(formData, "subtitulo"),
        imagem_url: newImageUrl || current.imagem_url,
        link_url: safeCarouselHref(formData),
        ordem: orderValue(formData),
        ativo: text(formData, "ativo") === "on",
        updated_by: context.current.authUser.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("igreja_id", context.igreja.id);

    if (error) {
      throw new Error("Falha ao atualizar destaque: " + error.message);
    }

    if (newImageUrl && current.imagem_url && current.imagem_url !== newImageUrl) {
      await removeElshadayContentImage(context.admin, current.imagem_url);
    }
  } catch (error) {
    if (newImageUrl) {
      await removeElshadayContentImage(context.admin, newImageUrl);
    }
    redirectWithMessage(
      "erro",
      error instanceof Error ? error.message : "Não foi possível atualizar o destaque."
    );
  }

  revalidateCarousel();
  redirectWithMessage("ok", "Carrossel atualizado.");
}

export async function deleteElshadayCarouselItem(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/configuracoes");
  requireElshadayRole(context, [...CONTENT_EDITOR_ROLES]);

  const id = text(formData, "id");
  if (!id) redirectWithMessage("erro", "Destaque inválido.");

  const { data: current, error: currentError } = await context.admin
    .from("igreja_carrossel")
    .select("id,imagem_url")
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();

  if (currentError || !current) {
    redirectWithMessage("erro", "Destaque não encontrado.");
  }

  const { error } = await context.admin
    .from("igreja_carrossel")
    .delete()
    .eq("id", id)
    .eq("igreja_id", context.igreja.id);

  if (error) {
    redirectWithMessage("erro", "Falha ao excluir destaque: " + error.message);
  }

  await removeElshadayContentImage(context.admin, current.imagem_url);
  revalidateCarousel();
  redirectWithMessage("ok", "Imagem removida do carrossel.");
}
