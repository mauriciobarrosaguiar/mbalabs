import "server-only";

import type { ElshadayRole } from "@/lib/elshaday";

export const ELSHADAY_GALLERY_BUCKET = "igreja-galeria";
export const ELSHADAY_GALLERY_MANAGER_ROLES: ElshadayRole[] = [
  "admin",
  "pastor",
  "tesouraria",
  "secretaria",
  "lider"
];

export type ElshadayGalleryVisibility = "membros" | "lideranca" | "administracao";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function canManageElshadayGallery(role: ElshadayRole) {
  return ELSHADAY_GALLERY_MANAGER_ROLES.includes(role);
}

export function canViewElshadayGalleryVisibility(
  role: ElshadayRole,
  visibility: string | null | undefined
) {
  const value = String(visibility ?? "membros");
  if (value === "membros") return true;
  if (value === "lideranca") return role !== "membro";
  if (value === "administracao") return role === "admin";
  return false;
}

export function galleryVisibilityLabel(value: string | null | undefined) {
  if (value === "administracao") return "Administração";
  if (value === "lideranca") return "Liderança";
  return "Todos os membros";
}

export async function uploadElshadayGalleryPhoto(
  admin: any,
  igrejaId: string,
  albumId: string,
  fileValue: FormDataEntryValue | null
) {
  if (!(fileValue instanceof File) || fileValue.size === 0) return null;
  if (!ALLOWED_IMAGE_TYPES.has(fileValue.type)) {
    throw new Error("Use fotos JPG, PNG ou WebP.");
  }
  if (fileValue.size > MAX_IMAGE_BYTES) {
    throw new Error("Cada foto deve ter no máximo 8 MB.");
  }

  const extension =
    fileValue.type === "image/png"
      ? "png"
      : fileValue.type === "image/webp"
        ? "webp"
        : "jpg";

  const storagePath =
    igrejaId +
    "/albuns/" +
    albumId +
    "/" +
    crypto.randomUUID() +
    "-" +
    Date.now() +
    "." +
    extension;

  const bytes = Buffer.from(await fileValue.arrayBuffer());
  const { error } = await admin.storage.from(ELSHADAY_GALLERY_BUCKET).upload(storagePath, bytes, {
    contentType: fileValue.type,
    cacheControl: "31536000",
    upsert: false
  });

  if (error) throw new Error("Falha ao enviar foto: " + error.message);
  return storagePath;
}

export async function createElshadayGallerySignedUrl(
  admin: any,
  storagePath: string | null | undefined,
  expiresIn = 60 * 60 * 2
) {
  const path = String(storagePath ?? "").trim();
  if (!path) return null;

  const { data, error } = await admin.storage
    .from(ELSHADAY_GALLERY_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl as string;
}

export async function removeElshadayGalleryPhotos(admin: any, storagePaths: string[]) {
  const paths = Array.from(new Set(storagePaths.map((item) => String(item ?? "").trim()).filter(Boolean)));
  if (!paths.length) return;
  await admin.storage.from(ELSHADAY_GALLERY_BUCKET).remove(paths);
}
