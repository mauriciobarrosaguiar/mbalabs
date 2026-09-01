import "server-only";

const BUCKET = "igreja-midia";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadElshadayContentImage(
  admin: any,
  igrejaId: string,
  folder: "eventos" | "pregacoes",
  fileValue: FormDataEntryValue | null
) {
  if (!(fileValue instanceof File) || fileValue.size === 0) return null;
  if (fileValue.size > MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }
  if (!ALLOWED.has(fileValue.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }

  const extension =
    fileValue.type === "image/png"
      ? "png"
      : fileValue.type === "image/webp"
        ? "webp"
        : "jpg";

  const path =
    igrejaId +
    "/" +
    folder +
    "/" +
    crypto.randomUUID() +
    "-" +
    Date.now() +
    "." +
    extension;

  const bytes = Buffer.from(await fileValue.arrayBuffer());
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: fileValue.type,
      cacheControl: "31536000",
      upsert: false
    });

  if (error) throw new Error("Falha ao enviar imagem: " + error.message);

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Falha ao gerar URL pública da imagem.");
  return data.publicUrl as string;
}

export async function removeElshadayContentImage(admin: any, publicUrl: string | null | undefined) {
  const value = String(publicUrl ?? "").trim();
  if (!value) return;

  const marker = "/storage/v1/object/public/" + BUCKET + "/";
  const index = value.indexOf(marker);
  if (index < 0) return;

  const path = decodeURIComponent(value.slice(index + marker.length));
  if (!path) return;

  await admin.storage.from(BUCKET).remove([path]);
}
