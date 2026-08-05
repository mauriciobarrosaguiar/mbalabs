"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { booleanValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveLavaConvenio(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");
  const naoPaga = booleanValue(formData, "nao_paga");
  const percentual = naoPaga ? 100 : Math.max(0, Math.min(numberValue(formData, "percentual_desconto"), 100));

  if (!nome) {
    redirect(`/lavagestor/convenios?error=${messageParam("Informe o nome do convênio.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    nome,
    descricao: nullableTextValue(formData, "descricao"),
    percentual_desconto: percentual,
    nao_paga: naoPaga,
    ativo: booleanValue(formData, "ativo"),
    updated_at: new Date().toISOString()
  };

  const result = id
    ? await client.from("lava_convenios").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await client.from("lava_convenios").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/convenios?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar convênio" : "criar convênio", detalhes: { nome, percentual, naoPaga } });
  revalidatePath("/lavagestor/convenios");
  revalidatePath("/lavagestor/operacao/entrada");
  redirect(`/lavagestor/convenios?ok=${messageParam("Convênio salvo com sucesso.")}`);
}

export async function deleteLavaConvenio(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const id = textValue(formData, "id");

  if (!id) {
    redirect(`/lavagestor/convenios?error=${messageParam("Convênio não informado.")}`);
  }

  const { error } = await client.from("lava_convenios").delete().eq("id", id).eq("empresa_id", current.empresaId);

  if (error) {
    const { error: inactiveError } = await client
      .from("lava_convenios")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", current.empresaId);

    if (inactiveError) {
      redirect(`/lavagestor/convenios?error=${messageParam(inactiveError.message)}`);
    }
  }

  await logAction({ appSlug: "lavagestor", acao: "excluir convênio", detalhes: { id } });
  revalidatePath("/lavagestor/convenios");
  revalidatePath("/lavagestor/operacao/entrada");
  redirect(`/lavagestor/convenios?ok=${messageParam("Convênio excluído.")}`);
}
