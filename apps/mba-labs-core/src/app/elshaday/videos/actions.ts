"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireElshadayContext, requireElshadayRole } from "@/lib/elshaday";
import { getYouTubeVideoId } from "@/lib/youtube";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createElshadayYoutubeVideo(formData: FormData) {
  const context = await requireElshadayContext("/elshaday/videos");
  requireElshadayRole(context, ["admin", "pastor", "tesouraria", "secretaria", "lider"]);

  const titulo = text(formData, "titulo");
  const videoUrl = text(formData, "video_url");
  const pregador = text(formData, "pregador") || "Culto Elshaday";
  const dataPregacao = text(formData, "data_pregacao") || new Date().toISOString().slice(0, 10);

  if (titulo.length < 2) {
    redirect("/elshaday/videos?erro=" + encodeURIComponent("Informe um título para o vídeo."));
  }

  if (!getYouTubeVideoId(videoUrl)) {
    redirect("/elshaday/videos?erro=" + encodeURIComponent("Cole um link válido do YouTube."));
  }

  const { error } = await context.admin.from("igreja_pregacoes").insert({
    igreja_id: context.igreja.id,
    titulo,
    pregador,
    data_pregacao: dataPregacao,
    video_url: videoUrl,
    status: "ativo",
    created_by: context.current.authUser.id
  });

  if (error) {
    redirect("/elshaday/videos?erro=" + encodeURIComponent("Não foi possível salvar o vídeo: " + error.message));
  }

  revalidatePath("/elshaday/videos");
  revalidatePath("/elshaday/pregacoes");
  revalidatePath("/elshaday/gestao");
  redirect("/elshaday/videos?ok=1");
}
