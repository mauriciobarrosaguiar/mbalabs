"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/core-data";
import { booleanValue, messageParam, nullableTextValue, textValue } from "@/lib/form-utils";
import { ensureChecklistForLavagem, LAVA_CHECKLIST_BUCKET } from "@/lib/lavagestor-checklists-data";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

type Row = Record<string, unknown>;

export async function saveLavaChecklist(formData: FormData) {
  const lavagemId = textValue(formData, "lavagem_id");
  const intent = textValue(formData, "intent") || "save";
  const returnTo = `/lavagestor/checklists/${lavagemId}`;
  const { current } = await requireLavaGestorAccess(returnTo);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const checklist = await getChecklist(client, current.empresaId, lavagemId);

  if (!checklist) {
    redirect(`${returnTo}?error=${messageParam("Checklist nao encontrado.")}`);
  }

  if (checklist.status === "concluido" && intent !== "cancelar") {
    redirect(`${returnTo}?error=${messageParam("Checklist concluido nao pode ser alterado. Cancele e registre novo historico se necessario.")}`);
  }

  const status = intent === "concluir" ? "concluido" : intent === "cancelar" ? "cancelado" : "rascunho";
  const payload = {
    status,
    pintura_ok: booleanValue(formData, "pintura_ok"),
    riscos: booleanValue(formData, "riscos"),
    amassados: booleanValue(formData, "amassados"),
    vidro_trincado: booleanValue(formData, "vidro_trincado"),
    retrovisor_ok: booleanValue(formData, "retrovisor_ok"),
    pneus_ok: booleanValue(formData, "pneus_ok"),
    farois_ok: booleanValue(formData, "farois_ok"),
    interior_ok: booleanValue(formData, "interior_ok"),
    objetos_cliente: booleanValue(formData, "objetos_cliente"),
    combustivel_nivel: nullableTextValue(formData, "combustivel_nivel"),
    km: nullableTextValue(formData, "km"),
    observacao_avarias: nullableTextValue(formData, "observacao_avarias"),
    observacao_geral: nullableTextValue(formData, "observacao_geral"),
    updated_at: new Date().toISOString()
  };

  const { error } = await client
    .from("lava_checklists")
    .update(payload)
    .eq("id", checklist.id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`${returnTo}?error=${messageParam(error.message)}`);
  }

  await updateChecklistServicos(client, current.empresaId, checklist.id, formData);
  await insertHistory(client, current, lavagemId, intent === "concluir" ? "checklist_concluido" : intent === "cancelar" ? "checklist_cancelado" : "checklist_salvo");
  await logAction({ appSlug: "lavagestor", acao: "salvar checklist", detalhes: { lavagem_id: lavagemId, status } });
  revalidateLavaChecklistPaths(lavagemId);
  redirect(`${returnTo}?ok=${messageParam(intent === "concluir" ? "Checklist concluido." : "Checklist salvo.")}`);
}

export async function uploadLavaChecklistFoto(formData: FormData) {
  const lavagemId = textValue(formData, "lavagem_id");
  const returnTo = `/lavagestor/checklists/${lavagemId}`;
  const { current } = await requireLavaGestorAccess(returnTo);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const lavagem = await getLavagem(client, current.empresaId, lavagemId);

  if (!lavagem) {
    redirect(`${returnTo}?error=${messageParam("Lavagem nao encontrada.")}`);
  }

  const checklist = await ensureChecklistForLavagem(client, current, lavagem);
  if (checklist.status === "concluido") {
    redirect(`${returnTo}?error=${messageParam("Checklist concluido nao aceita novas fotos.")}`);
  }

  const file = formData.get("foto");
  if (!(file instanceof File) || file.size <= 0) {
    redirect(`${returnTo}?error=${messageParam("Selecione uma foto para enviar.")}`);
  }

  if (!file.type.startsWith("image/")) {
    redirect(`${returnTo}?error=${messageParam("Envie apenas arquivos de imagem.")}`);
  }

  const tipo = sanitizePathPart(textValue(formData, "tipo") || "outras");
  const extension = extensionFromFile(file);
  const storagePath = `${current.empresaId}/${lavagemId}/${tipo}/${Date.now()}-${crypto.randomUUID()}${extension}`;
  const bytes = await file.arrayBuffer();
  const upload = await client.storage.from(LAVA_CHECKLIST_BUCKET).upload(storagePath, bytes, {
    contentType: file.type || "image/jpeg",
    upsert: false
  });

  if (upload.error) {
    redirect(`${returnTo}?error=${messageParam(upload.error.message)}`);
  }

  const publicUrl = client.storage.from(LAVA_CHECKLIST_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const { error } = await client.from("lava_checklist_fotos").insert({
    empresa_id: current.empresaId,
    checklist_id: checklist.id,
    lavagem_id: lavagemId,
    tipo,
    storage_path: storagePath,
    public_url: publicUrl,
    legenda: nullableTextValue(formData, "legenda")
  });

  if (error) {
    await client.storage.from(LAVA_CHECKLIST_BUCKET).remove([storagePath]);
    redirect(`${returnTo}?error=${messageParam(error.message)}`);
  }

  await insertHistory(client, current, lavagemId, "checklist_foto_adicionada");
  await logAction({ appSlug: "lavagestor", acao: "adicionar foto checklist", detalhes: { lavagem_id: lavagemId, tipo } });
  revalidateLavaChecklistPaths(lavagemId);
  redirect(`${returnTo}?ok=${messageParam("Foto anexada ao checklist.")}`);
}

export async function deleteLavaChecklistFoto(formData: FormData) {
  const lavagemId = textValue(formData, "lavagem_id");
  const fotoId = textValue(formData, "foto_id");
  const returnTo = `/lavagestor/checklists/${lavagemId}`;
  const { current } = await requireLavaGestorAccess(returnTo);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const checklist = await getChecklist(client, current.empresaId, lavagemId);

  if (!checklist || checklist.status === "concluido") {
    redirect(`${returnTo}?error=${messageParam("Foto nao pode ser excluida de checklist concluido.")}`);
  }

  const { data: foto, error: fotoError } = await client
    .from("lava_checklist_fotos")
    .select("id,storage_path")
    .eq("id", fotoId)
    .eq("empresa_id", current.empresaId)
    .eq("checklist_id", checklist.id)
    .maybeSingle();

  if (fotoError || !foto) {
    redirect(`${returnTo}?error=${messageParam(fotoError?.message ?? "Foto nao encontrada.")}`);
  }

  await client.storage.from(LAVA_CHECKLIST_BUCKET).remove([String(foto.storage_path)]);
  const { error } = await client
    .from("lava_checklist_fotos")
    .delete()
    .eq("id", fotoId)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`${returnTo}?error=${messageParam(error.message)}`);
  }

  await insertHistory(client, current, lavagemId, "checklist_foto_excluida");
  revalidateLavaChecklistPaths(lavagemId);
  redirect(`${returnTo}?ok=${messageParam("Foto removida.")}`);
}

async function getLavagem(client: any, empresaId: string | null, lavagemId: string) {
  const { data } = await client
    .from("lava_lavagens")
    .select("id,cliente_id,veiculo_id")
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data as Row | null;
}

async function getChecklist(client: any, empresaId: string | null, lavagemId: string) {
  const { data } = await client
    .from("lava_checklists")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("lavagem_id", lavagemId)
    .maybeSingle();
  return data as Row | null;
}

async function updateChecklistServicos(client: any, empresaId: string | null, checklistId: unknown, formData: FormData) {
  const ids = formData.getAll("checklist_servico_ids").map(String).filter(Boolean);
  await Promise.all(
    ids.map((id) =>
      client
        .from("lava_checklist_servicos")
        .update({
          conferido: booleanValue(formData, `servico_${id}_conferido`),
          observacao: nullableTextValue(formData, `servico_${id}_observacao`),
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("checklist_id", checklistId)
        .eq("empresa_id", empresaId)
    )
  );
}

async function insertHistory(client: any, current: { empresaId: string | null; usuario: { id: string } }, lavagemId: string, acao: string) {
  await client.from("lava_historico").insert({
    empresa_id: current.empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao,
    status_anterior: null,
    status_novo: null,
    observacao: null
  });
}

function revalidateLavaChecklistPaths(lavagemId: string) {
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/lavagens");
  revalidatePath(`/lavagestor/checklists/${lavagemId}`);
  revalidatePath(`/lavagestor/tickets/${lavagemId}`);
  revalidatePath(`/lavagestor/recibos/${lavagemId}`);
}

function sanitizePathPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "outras";
}

function extensionFromFile(file: File) {
  const name = file.name || "";
  const match = name.match(/\.[a-zA-Z0-9]+$/);
  if (match) return match[0].toLowerCase();
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return ".jpg";
}
