"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/core-data";
import { booleanValue, messageParam, nullableTextValue, textValue } from "@/lib/form-utils";
import { canUploadCheckoutPhoto, ensureChecklistForLavagem, LAVA_CHECKLIST_BUCKET } from "@/lib/lavagestor-checklists-data";
import {
  assertLavaEmpresaAccess,
  currentForLavaEmpresa,
  requireLavaGestorOperationAccess,
  resolveLavaEmpresaIdFromLavagem
} from "@/lib/lavagestor-permissions";
import { ensurePendingSyncRowsForPhoto } from "@/lib/lavagestor-storage";
import { enqueueWhatsappMessage } from "@/lib/lavagestor-whatsapp";
import { getSupabaseServer } from "@/lib/supabase";

type Row = Record<string, unknown>;
const MAX_LAVA_PHOTO_BYTES = 8 * 1024 * 1024;

export async function saveLavaChecklist(formData: FormData) {
  const lavagemId = textValue(formData, "lavagem_id");
  const intent = textValue(formData, "intent") || "save";
  const returnTo = `/lavagestor/checklists/${lavagemId}`;
  const { current } = await requireLavaGestorOperationAccess(returnTo);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = await resolveLavaEmpresaIdFromLavagem(client, lavagemId);
  await assertLavaEmpresaAccess(current, empresaId);
  const scopedCurrent = currentForLavaEmpresa(current, empresaId);
  const checklist = await getChecklist(client, empresaId, lavagemId);

  if (!checklist) {
    redirect(`${returnTo}?error=${messageParam("Checklist nao encontrado.")}`);
  }

  if (checklist.status === "concluido" && intent !== "cancelar") {
    redirect(`${returnTo}?error=${messageParam("Checklist concluido nao pode ser alterado. Cancele e registre novo historico se necessario.")}`);
  }

  if (intent === "concluir") {
    const config = await getChecklistConfig(client, empresaId);
    if (config.exigir_foto_entrada && !config.permitir_concluir_checklist_sem_foto) {
      const missingTypes = await missingRequiredEntryTypes(client, empresaId, checklist.id, config.fotos_entrada_obrigatorias);
      if (missingTypes.length > 0) {
        redirect(`${returnTo}?error=${messageParam(`Faltam fotos obrigatorias de entrada: ${missingTypes.join(", ")}.`)}`);
      }

      const entradaCount = await countChecklistPhotos(client, empresaId, checklist.id, "entrada");
      if (entradaCount < 1) {
        redirect(`${returnTo}?error=${messageParam("Adicione pelo menos uma foto de entrada antes de concluir o checklist.")}`);
      }
    }
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
    .eq("empresa_id", empresaId);

  if (error) {
    redirect(`${returnTo}?error=${messageParam(error.message)}`);
  }

  await updateChecklistServicos(client, empresaId, checklist.id, formData);
  await insertHistory(client, scopedCurrent, lavagemId, intent === "concluir" ? "checklist_entrada_concluido" : intent === "cancelar" ? "checklist_cancelado" : "checklist_salvo");
  if (intent === "concluir") {
    await enqueueChecklistWhatsapp(client, scopedCurrent, lavagemId).catch(async (err) => {
      await insertHistory(client, scopedCurrent, lavagemId, "whatsapp_erro_checklist", err instanceof Error ? err.message : "Falha ao enfileirar WhatsApp.");
    });
  }
  await logAction({ appSlug: "lavagestor", acao: "salvar checklist", detalhes: { lavagem_id: lavagemId, status } });
  revalidateLavaChecklistPaths(lavagemId);
  redirect(`${returnTo}?ok=${messageParam(intent === "concluir" ? "Checklist concluido." : "Checklist salvo.")}`);
}

export async function uploadLavaChecklistFoto(formData: FormData) {
  const lavagemId = textValue(formData, "lavagem_id");
  const returnTo = `/lavagestor/checklists/${lavagemId}`;
  const { current } = await requireLavaGestorOperationAccess(returnTo);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = await resolveLavaEmpresaIdFromLavagem(client, lavagemId);
  await assertLavaEmpresaAccess(current, empresaId);
  const scopedCurrent = currentForLavaEmpresa(current, empresaId);
  const lavagem = await getLavagem(client, empresaId, lavagemId);

  if (!lavagem) {
    redirect(`${returnTo}?error=${messageParam("Lavagem nao encontrada.")}`);
  }

  const checklist = await ensureChecklistForLavagem(client, scopedCurrent, lavagem);
  const momento = normalizeMomento(textValue(formData, "momento"));
  const lavagemStatus = String(lavagem.status ?? "na_fila");

  if (momento === "entrada" && checklist.status === "concluido") {
    redirect(`${returnTo}?error=${messageParam("Checklist concluido nao aceita novas fotos de entrada.")}`);
  }

  if (momento === "checkout") {
    if (lavagemStatus === "entregue") {
      redirect(`${returnTo}?error=${messageParam("Lavagem entregue fica apenas para consulta.")}`);
    }
    if (!canUploadCheckoutPhoto(lavagemStatus)) {
      redirect(`${returnTo}?error=${messageParam("Fotos de checkout sao liberadas depois que a lavagem estiver finalizada.")}`);
    }
  }

  const file = formData.get("foto");
  if (!(file instanceof File) || file.size <= 0) {
    redirect(`${returnTo}?error=${messageParam("Selecione uma foto para enviar.")}`);
  }

  if (!file.type.startsWith("image/")) {
    redirect(`${returnTo}?error=${messageParam("Envie apenas arquivos de imagem.")}`);
  }

  if (file.size > MAX_LAVA_PHOTO_BYTES) {
    redirect(`${returnTo}?error=${messageParam("Foto muito grande. Tire outra foto ou envie uma imagem menor.")}`);
  }

  const tipo = sanitizePathPart(textValue(formData, "tipo") || "outras");
  const extension = extensionFromFile(file);
  const storagePath = `${empresaId}/${lavagemId}/${momento}/${tipo}/${Date.now()}-${crypto.randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const checkoutCountBefore = momento === "checkout" ? await countChecklistPhotos(client, empresaId, checklist.id, "checkout") : 0;
  const upload = await client.storage.from(LAVA_CHECKLIST_BUCKET).upload(storagePath, bytes, {
    contentType: file.type || "image/jpeg",
    upsert: false
  });

  if (upload.error) {
    redirect(`${returnTo}?error=${messageParam(upload.error.message)}`);
  }

  const publicUrl = client.storage.from(LAVA_CHECKLIST_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const { data: foto, error } = await client.from("lava_checklist_fotos").insert({
    empresa_id: empresaId,
    checklist_id: checklist.id,
    lavagem_id: lavagemId,
    tipo,
    momento,
    storage_path: storagePath,
    public_url: publicUrl,
    legenda: nullableTextValue(formData, "legenda")
  }).select("id,empresa_id,checklist_id,lavagem_id,tipo,momento,storage_path,legenda,created_at").single();

  if (error) {
    await client.storage.from(LAVA_CHECKLIST_BUCKET).remove([storagePath]);
    redirect(`${returnTo}?error=${messageParam(error.message)}`);
  }

  const pending = foto ? await ensurePendingSyncRowsForPhoto(scopedCurrent, foto).catch(() => ({ created: 0, skipped: 0, connected: 0 })) : { created: 0, skipped: 0, connected: 0 };

  await insertHistory(client, scopedCurrent, lavagemId, "foto_local_salva", momento === "checkout" ? "Foto de checkout salva no Supabase." : "Foto de entrada salva no Supabase.");
  if (pending.created > 0) {
    await insertHistory(client, scopedCurrent, lavagemId, "backup_pendente", `${pending.created} backup(s) externo(s) pendente(s).`);
  }
  if (momento === "checkout" && checkoutCountBefore === 0) {
    await insertHistory(client, scopedCurrent, lavagemId, "checkout_concluido", "Primeira foto de checkout registrada.");
  }
  await logAction({ appSlug: "lavagestor", acao: "adicionar foto checklist", detalhes: { lavagem_id: lavagemId, tipo, momento } });
  revalidateLavaChecklistPaths(lavagemId);
  redirect(`${returnTo}?ok=${messageParam("Foto salva no LavaGestor. Backup externo sera sincronizado em seguida.")}#fotos-${momento}`);
}

export async function deleteLavaChecklistFoto(formData: FormData) {
  const lavagemId = textValue(formData, "lavagem_id");
  const fotoId = textValue(formData, "foto_id");
  const returnTo = `/lavagestor/checklists/${lavagemId}`;
  const { current } = await requireLavaGestorOperationAccess(returnTo);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = await resolveLavaEmpresaIdFromLavagem(client, lavagemId);
  await assertLavaEmpresaAccess(current, empresaId);
  const scopedCurrent = currentForLavaEmpresa(current, empresaId);
  const checklist = await getChecklist(client, empresaId, lavagemId);

  if (!checklist) {
    redirect(`${returnTo}?error=${messageParam("Checklist nao encontrado.")}`);
  }

  const { data: foto, error: fotoError } = await client
    .from("lava_checklist_fotos")
    .select("id,storage_path,momento")
    .eq("id", fotoId)
    .eq("empresa_id", empresaId)
    .eq("checklist_id", checklist.id)
    .maybeSingle();

  if (fotoError || !foto) {
    redirect(`${returnTo}?error=${messageParam(fotoError?.message ?? "Foto nao encontrada.")}`);
  }

  const lavagem = await getLavagem(client, empresaId, lavagemId);
  if (String(lavagem?.status ?? "") === "entregue") {
    redirect(`${returnTo}?error=${messageParam("Lavagem entregue fica apenas para consulta.")}`);
  }

  const momento = String(foto.momento ?? "entrada");
  if (checklist.status === "concluido" && momento !== "checkout") {
    redirect(`${returnTo}?error=${messageParam("Foto de entrada nao pode ser excluida de checklist concluido.")}`);
  }

  await client.storage.from(LAVA_CHECKLIST_BUCKET).remove([String(foto.storage_path)]);
  const { error } = await client
    .from("lava_checklist_fotos")
    .delete()
    .eq("id", fotoId)
    .eq("empresa_id", empresaId);

  if (error) {
    redirect(`${returnTo}?error=${messageParam(error.message)}`);
  }

  await insertHistory(client, scopedCurrent, lavagemId, momento === "checkout" ? "foto_checkout_excluida" : "foto_entrada_excluida");
  revalidateLavaChecklistPaths(lavagemId);
  redirect(`${returnTo}?ok=${messageParam("Foto removida.")}`);
}

async function getLavagem(client: any, empresaId: string | null, lavagemId: string) {
  const { data } = await client
    .from("lava_lavagens")
    .select("id,cliente_id,veiculo_id,status,data_entrada,data_lavagem,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor,tipo)")
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data as Row | null;
}

async function enqueueChecklistWhatsapp(client: any, current: { empresaId: string | null; usuario: { id: string } }, lavagemId: string) {
  const lavagem = await getLavagem(client, current.empresaId, lavagemId);
  if (!lavagem) return;
  const cliente = relationObject(lavagem.lava_clientes);
  const veiculo = relationObject(lavagem.lava_veiculos);
  await enqueueWhatsappMessage(current, {
    evento: "checklist_concluido",
    clienteId: String(lavagem.cliente_id ?? "") || null,
    lavagemId,
    telefone: String(cliente?.telefone ?? ""),
    data: {
      cliente: String(cliente?.nome ?? "cliente"),
      veiculo: vehicleLabel(veiculo),
      placa: String(veiculo?.placa ?? ""),
      empresa: "LavaGestor"
    }
  });
}

async function getChecklistConfig(client: any, empresaId: string | null) {
  const { data } = await client
    .from("lava_configuracoes")
    .select("exigir_foto_entrada,fotos_entrada_obrigatorias,permitir_concluir_checklist_sem_foto")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const row = (data ?? {}) as Row;
  return {
    exigir_foto_entrada: row.exigir_foto_entrada !== false,
    fotos_entrada_obrigatorias: arrayValue(row.fotos_entrada_obrigatorias),
    permitir_concluir_checklist_sem_foto: row.permitir_concluir_checklist_sem_foto === true
  };
}

async function countChecklistPhotos(client: any, empresaId: string | null, checklistId: unknown, momento: "entrada" | "checkout") {
  const { count } = await client
    .from("lava_checklist_fotos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("checklist_id", checklistId)
    .eq("momento", momento);
  return count ?? 0;
}

async function missingRequiredEntryTypes(client: any, empresaId: string | null, checklistId: unknown, requiredTypes: string[]) {
  const required = requiredTypes.map(sanitizePathPart).filter(Boolean);
  if (required.length === 0) return [];
  const { data } = await client
    .from("lava_checklist_fotos")
    .select("tipo")
    .eq("empresa_id", empresaId)
    .eq("checklist_id", checklistId)
    .eq("momento", "entrada")
    .in("tipo", required);
  const existing = new Set(((data ?? []) as Row[]).map((row) => String(row.tipo)));
  return required.filter((tipo) => !existing.has(tipo));
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

async function insertHistory(client: any, current: { empresaId: string | null; usuario: { id: string } }, lavagemId: string, acao: string, observacao?: string | null) {
  await client.from("lava_historico").insert({
    empresa_id: current.empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao,
    status_anterior: null,
    status_novo: null,
    observacao: observacao ?? null
  });
}

function revalidateLavaChecklistPaths(lavagemId: string) {
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/lavagens");
  revalidatePath("/lavagestor/whatsapp");
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

function normalizeMomento(value: string): "entrada" | "checkout" {
  return value === "checkout" ? "checkout" : "entrada";
}

function arrayValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((item) => item.trim()).filter(Boolean);
  return [];
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? relation as Row : null;
}

function vehicleLabel(value: unknown) {
  const relation = relationObject(value) ?? (value as Row | null);
  if (!relation || typeof relation !== "object") return "veiculo";
  const model = [relation.marca, relation.modelo].filter(Boolean).join(" ");
  return [relation.placa, model, relation.cor].filter(Boolean).join(" - ") || "veiculo";
}

function extensionFromFile(file: File) {
  const name = file.name || "";
  const match = name.match(/\.[a-zA-Z0-9]+$/);
  if (match) return match[0].toLowerCase();
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return ".jpg";
}
