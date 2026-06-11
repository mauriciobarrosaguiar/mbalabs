"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type AdminField,
  type AdminResource,
  getAdminResource,
  getCurrentUserProfile,
  logAction
} from "@/lib/core-data";
import { booleanValue, dateValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveAdminResource(formData: FormData) {
  const current = await getCurrentUserProfile();
  if (!["admin_master", "admin_empresa"].includes(current.tipo)) {
    redirect("/dashboard");
  }

  const resource = textValue(formData, "resource") as AdminResource;
  const id = textValue(formData, "id");
  const config = getAdminResource(resource);

  if (!config || config.readOnly) {
    redirect(`/admin/${resource}?error=${messageParam("Recurso não pode ser alterado.")}`);
  }

  const payload = buildPayload(config.fields, formData);
  if (config.companyScoped && !current.isAdminMaster && "empresa_id" in payload) {
    payload.empresa_id = current.empresaId;
  }

  const supabase = await getSupabaseServer();
  let query = id
    ? (supabase as any).from(config.table).update(payload).eq("id", id)
    : (supabase as any).from(config.table).insert(payload);

  if (id && config.companyScoped && !current.isAdminMaster) {
    query = query.eq("empresa_id", current.empresaId);
  }

  const { error } = await query;

  if (error) {
    redirect(`/admin/${resource}?error=${messageParam(error.message)}`);
  }

  await logAction({ acao: id ? `editar ${resource}` : `criar ${resource}`, detalhes: { id: id || null } });
  revalidatePath(`/admin/${resource}`);
  redirect(`/admin/${resource}?ok=${messageParam("Registro salvo com sucesso.")}`);
}

export async function deleteAdminResource(formData: FormData) {
  const current = await getCurrentUserProfile();
  if (!["admin_master", "admin_empresa"].includes(current.tipo)) {
    redirect("/dashboard");
  }

  const resource = textValue(formData, "resource") as AdminResource;
  const id = textValue(formData, "id");
  const config = getAdminResource(resource);

  if (!config || config.readOnly) {
    redirect(`/admin/${resource}?error=${messageParam("Recurso não pode ser alterado.")}`);
  }

  const supabase = await getSupabaseServer();
  const updatePayload = config.inactiveField ? { [config.inactiveField]: config.inactiveValue } : null;
  let query = updatePayload
    ? (supabase as any).from(config.table).update(updatePayload).eq("id", id)
    : (supabase as any).from(config.table).delete().eq("id", id);

  if (config.companyScoped && !current.isAdminMaster) {
    query = query.eq("empresa_id", current.empresaId);
  }

  const { error } = await query;

  if (error) {
    redirect(`/admin/${resource}?error=${messageParam(error.message)}`);
  }

  await logAction({ acao: `inativar ${resource}`, detalhes: { id } });
  revalidatePath(`/admin/${resource}`);
  redirect(`/admin/${resource}?ok=${messageParam("Registro atualizado.")}`);
}

function buildPayload(fields: AdminField[], formData: FormData) {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.required && !textValue(formData, field.name) && field.type !== "boolean") {
      redirect(`/admin/${textValue(formData, "resource")}?error=${messageParam(`Informe o campo ${field.label}.`)}`);
    }

    if (field.type === "boolean") {
      payload[field.name] = booleanValue(formData, field.name);
      continue;
    }

    if (field.type === "number") {
      if (!textValue(formData, field.name) && !field.required) {
        continue;
      }
      payload[field.name] = numberValue(formData, field.name);
      continue;
    }

    if (field.type === "date") {
      payload[field.name] = dateValue(formData, field.name);
      continue;
    }

    payload[field.name] = field.required ? textValue(formData, field.name) : nullableTextValue(formData, field.name);
  }

  return payload;
}
