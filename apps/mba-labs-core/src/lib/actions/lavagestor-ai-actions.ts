"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { booleanValue, messageParam, textValue } from "@/lib/form-utils";
import {
  analyzeVehiclePhotoWithGemini,
  removeLavaGeminiKey,
  saveLavaGeminiKey,
  testLavaGeminiConnection
} from "@/lib/lavagestor-ai";
import { LAVA_CHECKLIST_BUCKET } from "@/lib/lavagestor-checklists-data";
import { requireLavaGestorAccess, requireLavaGestorSettingsAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

type Row = Record<string, unknown>;

export async function saveLavaAiSettingsAction(formData: FormData) {
  await requireLavaGestorSettingsAccess("/lavagestor/configuracoes");
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");
  try {
    await saveLavaGeminiKey(current, textValue(formData, "gemini_api_key"), textValue(formData, "iamob_model"), {
      mode: textValue(formData, "iamob_modo") === "regras" ? "regras" : "gemini",
      allowPhotoAnalysis: booleanValue(formData, "iamob_permitir_analise_foto"),
      allowPlateReading: booleanValue(formData, "iamob_permitir_leitura_placa")
    });
  } catch (err) {
    redirect(`/lavagestor/configuracoes?error=${messageParam(err instanceof Error ? err.message : "Falha ao salvar IA.")}`);
  }
  revalidatePath("/lavagestor/configuracoes");
  revalidatePath("/lavagestor/iamob");
  redirect(`/lavagestor/configuracoes?ok=${messageParam("Configuracao do IAMob com Gemini salva.")}`);
}

export async function testLavaAiConnectionAction() {
  await requireLavaGestorSettingsAccess("/lavagestor/configuracoes");
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");
  try {
    const result = await testLavaGeminiConnection(current);
    revalidatePath("/lavagestor/configuracoes");
    redirect(`/lavagestor/configuracoes?ok=${messageParam(result.text || "Gemini conectado.")}`);
  } catch (err) {
    redirect(`/lavagestor/configuracoes?error=${messageParam(err instanceof Error ? err.message : "Falha ao testar Gemini.")}`);
  }
}

export async function removeLavaAiConnectionAction() {
  await requireLavaGestorSettingsAccess("/lavagestor/configuracoes");
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");
  try {
    await removeLavaGeminiKey(current);
  } catch (err) {
    redirect(`/lavagestor/configuracoes?error=${messageParam(err instanceof Error ? err.message : "Falha ao remover Gemini.")}`);
  }
  revalidatePath("/lavagestor/configuracoes");
  revalidatePath("/lavagestor/iamob");
  redirect(`/lavagestor/configuracoes?ok=${messageParam("Gemini removido. IAMob voltou para modo regras.")}`);
}

export async function analyzeLavaChecklistPhotoAction(formData: FormData) {
  const lavagemId = textValue(formData, "lavagem_id");
  const fotoId = textValue(formData, "foto_id");
  const returnTo = safeReturn(formData, lavagemId ? `/lavagestor/checklists/${lavagemId}` : "/lavagestor/fila");
  const { current } = await requireLavaGestorAccess(returnTo);
  const client = (await getSupabaseServer()) as any;

  const { data: foto, error } = await client
    .from("lava_checklist_fotos")
    .select("id,empresa_id,lavagem_id,checklist_id,storage_path,lava_lavagens(cliente_id,veiculo_id)")
    .eq("id", fotoId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !foto) {
    redirect(`${returnTo}?error=${messageParam(error?.message ?? "Foto nao encontrada.")}`);
  }

  const storagePath = String(foto.storage_path ?? "");
  if (!storagePath) {
    redirect(`${returnTo}?error=${messageParam("Foto sem caminho no Supabase Storage.")}`);
  }

  const download = await client.storage.from(LAVA_CHECKLIST_BUCKET).download(storagePath);
  if (download.error || !download.data) {
    redirect(`${returnTo}?error=${messageParam(download.error?.message ?? "Nao foi possivel baixar a foto.")}`);
  }

  const buffer = Buffer.from(await download.data.arrayBuffer());
  const result = await analyzeVehiclePhotoWithGemini(current, {
    imageBase64: buffer.toString("base64"),
    mimeType: download.data.type || "image/jpeg",
    lavagemId: String(foto.lavagem_id ?? ""),
    clienteId: String(relationObject(foto.lava_lavagens)?.cliente_id ?? "") || null,
    veiculoId: String(relationObject(foto.lava_lavagens)?.veiculo_id ?? "") || null
  });

  revalidatePath(returnTo.split("#")[0] || "/lavagestor/fila");
  if (!result.ok) {
    redirect(`${returnTo}?error=${messageParam(result.error || "Gemini nao analisou a foto.")}`);
  }
  redirect(`${returnTo}?ok=${messageParam(`Analise IAMob: ${result.text.slice(0, 300)}`)}`);
}

function safeReturn(formData: FormData, fallback: string) {
  const value = textValue(formData, "return_to");
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : fallback;
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? relation as Row : null;
}
