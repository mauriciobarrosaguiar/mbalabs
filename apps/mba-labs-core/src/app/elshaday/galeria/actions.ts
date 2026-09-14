"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireElshadayContext, requireElshadayRole } from "@/lib/elshaday";
import {
  ELSHADAY_GALLERY_MANAGER_ROLES,
  removeElshadayGalleryPhotos,
  uploadElshadayGalleryPhoto,
  type ElshadayGalleryVisibility
} from "@/lib/elshaday-gallery";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function albumDate(formData: FormData) {
  const value = text(formData, "data_album");
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Data do álbum inválida.");
  return value;
}

function visibility(formData: FormData, role: string): ElshadayGalleryVisibility {
  const value = text(formData, "visibilidade") || "membros";
  if (!["membros", "lideranca", "administracao"].includes(value)) {
    throw new Error("Visibilidade inválida.");
  }
  if (value === "administracao" && role !== "admin") {
    throw new Error("Somente o administrador pode criar álbum exclusivo da administração.");
  }
  return value as ElshadayGalleryVisibility;
}

function photos(formData: FormData) {
  const files = formData
    .getAll("fotos")
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > 30) throw new Error("Envie no máximo 30 fotos por vez.");
  return files;
}

function redirectGallery(kind: "ok" | "erro", message: string, albumId?: string): never {
  const base = albumId ? "/elshaday/galeria/" + albumId : "/elshaday/galeria";
  redirect(base + "?" + kind + "=" + encodeURIComponent(message));
}

function revalidateGallery(albumId?: string) {
  revalidatePath("/elshaday/galeria");
  revalidatePath("/elshaday/gestao");
  revalidatePath("/elshaday");
  if (albumId) revalidatePath("/elshaday/galeria/" + albumId);
}

async function managerContext(nextPath: string) {
  const context = await requireElshadayContext(nextPath);
  requireElshadayRole(context, ELSHADAY_GALLERY_MANAGER_ROLES);
  return context;
}

export async function createElshadayAlbum(formData: FormData) {
  const context = await managerContext("/elshaday/galeria");
  const title = text(formData, "titulo");
  const description = optionalText(formData, "descricao");
  const files = photos(formData);

  if (!title) redirectGallery("erro", "Informe o nome do álbum.");
  if (title.length > 120) redirectGallery("erro", "O nome do álbum deve ter até 120 caracteres.");
  if (description && description.length > 1000) {
    redirectGallery("erro", "A descrição deve ter até 1000 caracteres.");
  }

  const albumId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  try {
    const { error: albumError } = await context.admin.from("igreja_albuns").insert({
      id: albumId,
      igreja_id: context.igreja.id,
      titulo: title,
      descricao: description,
      data_album: albumDate(formData),
      visibilidade: visibility(formData, context.papel),
      permitir_compartilhamento: text(formData, "permitir_compartilhamento") === "on",
      ativo: true,
      created_by: context.current.authUser.id,
      updated_by: context.current.authUser.id
    });

    if (albumError) throw new Error("Falha ao criar álbum: " + albumError.message);

    if (files.length) {
      const rows: any[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const storagePath = await uploadElshadayGalleryPhoto(
          context.admin,
          context.igreja.id,
          albumId,
          files[index]
        );
        if (!storagePath) continue;
        uploadedPaths.push(storagePath);
        rows.push({
          igreja_id: context.igreja.id,
          album_id: albumId,
          storage_path: storagePath,
          ordem: (index + 1) * 10,
          created_by: context.current.authUser.id
        });
      }

      if (rows.length) {
        const { error: photosError } = await context.admin.from("igreja_album_fotos").insert(rows);
        if (photosError) throw new Error("Falha ao registrar fotos: " + photosError.message);

        await context.admin
          .from("igreja_albuns")
          .update({
            capa_storage_path: rows[0].storage_path,
            updated_by: context.current.authUser.id,
            updated_at: new Date().toISOString()
          })
          .eq("id", albumId)
          .eq("igreja_id", context.igreja.id);
      }
    }
  } catch (error) {
    if (uploadedPaths.length) await removeElshadayGalleryPhotos(context.admin, uploadedPaths);
    await context.admin
      .from("igreja_albuns")
      .delete()
      .eq("id", albumId)
      .eq("igreja_id", context.igreja.id);
    redirectGallery("erro", error instanceof Error ? error.message : "Não foi possível criar o álbum.");
  }

  revalidateGallery(albumId);
  redirectGallery("ok", "Álbum criado com sucesso.", albumId);
}

export async function uploadElshadayAlbumPhotos(formData: FormData) {
  const albumId = text(formData, "album_id");
  const context = await managerContext("/elshaday/galeria/" + albumId);
  if (!albumId) redirectGallery("erro", "Álbum inválido.");

  const files = photos(formData);
  if (!files.length) redirectGallery("erro", "Selecione pelo menos uma foto.", albumId);

  const { data: album, error: albumError } = await context.admin
    .from("igreja_albuns")
    .select("id,capa_storage_path")
    .eq("id", albumId)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();

  if (albumError || !album) redirectGallery("erro", "Álbum não encontrado.");

  const { data: lastPhoto } = await context.admin
    .from("igreja_album_fotos")
    .select("ordem")
    .eq("album_id", albumId)
    .eq("igreja_id", context.igreja.id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startOrder = Number(lastPhoto?.ordem ?? 0);
  const uploadedPaths: string[] = [];

  try {
    const rows: any[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const storagePath = await uploadElshadayGalleryPhoto(
        context.admin,
        context.igreja.id,
        albumId,
        files[index]
      );
      if (!storagePath) continue;
      uploadedPaths.push(storagePath);
      rows.push({
        igreja_id: context.igreja.id,
        album_id: albumId,
        storage_path: storagePath,
        ordem: startOrder + (index + 1) * 10,
        created_by: context.current.authUser.id
      });
    }

    const { error } = await context.admin.from("igreja_album_fotos").insert(rows);
    if (error) throw new Error("Falha ao registrar fotos: " + error.message);

    const update: Record<string, any> = {
      updated_by: context.current.authUser.id,
      updated_at: new Date().toISOString()
    };
    if (!album.capa_storage_path && rows[0]?.storage_path) update.capa_storage_path = rows[0].storage_path;

    await context.admin
      .from("igreja_albuns")
      .update(update)
      .eq("id", albumId)
      .eq("igreja_id", context.igreja.id);
  } catch (error) {
    if (uploadedPaths.length) await removeElshadayGalleryPhotos(context.admin, uploadedPaths);
    redirectGallery("erro", error instanceof Error ? error.message : "Não foi possível enviar as fotos.", albumId);
  }

  revalidateGallery(albumId);
  redirectGallery("ok", files.length === 1 ? "Foto adicionada." : "Fotos adicionadas.", albumId);
}

export async function updateElshadayAlbum(formData: FormData) {
  const albumId = text(formData, "album_id");
  const context = await managerContext("/elshaday/galeria/" + albumId);
  if (!albumId) redirectGallery("erro", "Álbum inválido.");

  const title = text(formData, "titulo");
  const description = optionalText(formData, "descricao");
  if (!title) redirectGallery("erro", "Informe o nome do álbum.", albumId);
  if (title.length > 120) redirectGallery("erro", "O nome do álbum deve ter até 120 caracteres.", albumId);
  if (description && description.length > 1000) {
    redirectGallery("erro", "A descrição deve ter até 1000 caracteres.", albumId);
  }

  const { error } = await context.admin
    .from("igreja_albuns")
    .update({
      titulo: title,
      descricao: description,
      data_album: albumDate(formData),
      visibilidade: visibility(formData, context.papel),
      permitir_compartilhamento: text(formData, "permitir_compartilhamento") === "on",
      updated_by: context.current.authUser.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", albumId)
    .eq("igreja_id", context.igreja.id);

  if (error) redirectGallery("erro", "Falha ao atualizar álbum: " + error.message, albumId);
  revalidateGallery(albumId);
  redirectGallery("ok", "Álbum atualizado.", albumId);
}

export async function setElshadayAlbumCover(formData: FormData) {
  const albumId = text(formData, "album_id");
  const photoId = text(formData, "foto_id");
  const context = await managerContext("/elshaday/galeria/" + albumId);

  const { data: photo, error: photoError } = await context.admin
    .from("igreja_album_fotos")
    .select("id,storage_path")
    .eq("id", photoId)
    .eq("album_id", albumId)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();

  if (photoError || !photo) redirectGallery("erro", "Foto não encontrada.", albumId);

  const { error } = await context.admin
    .from("igreja_albuns")
    .update({
      capa_storage_path: photo.storage_path,
      updated_by: context.current.authUser.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", albumId)
    .eq("igreja_id", context.igreja.id);

  if (error) redirectGallery("erro", "Falha ao definir a capa.", albumId);
  revalidateGallery(albumId);
  redirectGallery("ok", "Capa do álbum atualizada.", albumId);
}

export async function deleteElshadayAlbumPhoto(formData: FormData) {
  const albumId = text(formData, "album_id");
  const photoId = text(formData, "foto_id");
  const context = await managerContext("/elshaday/galeria/" + albumId);

  const { data: photo, error: photoError } = await context.admin
    .from("igreja_album_fotos")
    .select("id,storage_path")
    .eq("id", photoId)
    .eq("album_id", albumId)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();

  if (photoError || !photo) redirectGallery("erro", "Foto não encontrada.", albumId);

  const { data: album } = await context.admin
    .from("igreja_albuns")
    .select("capa_storage_path")
    .eq("id", albumId)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();

  const { error } = await context.admin
    .from("igreja_album_fotos")
    .delete()
    .eq("id", photoId)
    .eq("album_id", albumId)
    .eq("igreja_id", context.igreja.id);

  if (error) redirectGallery("erro", "Falha ao excluir foto: " + error.message, albumId);

  if (album?.capa_storage_path === photo.storage_path) {
    const { data: nextPhoto } = await context.admin
      .from("igreja_album_fotos")
      .select("storage_path")
      .eq("album_id", albumId)
      .eq("igreja_id", context.igreja.id)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    await context.admin
      .from("igreja_albuns")
      .update({
        capa_storage_path: nextPhoto?.storage_path ?? null,
        updated_by: context.current.authUser.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", albumId)
      .eq("igreja_id", context.igreja.id);
  }

  await removeElshadayGalleryPhotos(context.admin, [photo.storage_path]);
  revalidateGallery(albumId);
  redirectGallery("ok", "Foto removida.", albumId);
}

export async function setElshadayAlbumActive(formData: FormData) {
  const albumId = text(formData, "album_id");
  const context = await managerContext("/elshaday/galeria/" + albumId);
  const active = text(formData, "ativo") === "true";

  const { error } = await context.admin
    .from("igreja_albuns")
    .update({
      ativo: active,
      updated_by: context.current.authUser.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", albumId)
    .eq("igreja_id", context.igreja.id);

  if (error) redirectGallery("erro", "Falha ao alterar o álbum.", albumId);
  revalidateGallery(albumId);
  redirectGallery("ok", active ? "Álbum reativado." : "Álbum arquivado.", albumId);
}

export async function deleteElshadayAlbum(formData: FormData) {
  const albumId = text(formData, "album_id");
  const context = await managerContext("/elshaday/galeria/" + albumId);

  const { data: rows, error: photosError } = await context.admin
    .from("igreja_album_fotos")
    .select("storage_path")
    .eq("album_id", albumId)
    .eq("igreja_id", context.igreja.id);

  if (photosError) redirectGallery("erro", "Falha ao localizar as fotos.", albumId);

  const { error } = await context.admin
    .from("igreja_albuns")
    .delete()
    .eq("id", albumId)
    .eq("igreja_id", context.igreja.id);

  if (error) redirectGallery("erro", "Falha ao excluir álbum: " + error.message, albumId);

  await removeElshadayGalleryPhotos(
    context.admin,
    (rows ?? []).map((row: any) => String(row.storage_path ?? ""))
  );

  revalidateGallery();
  redirectGallery("ok", "Álbum excluído.");
}
