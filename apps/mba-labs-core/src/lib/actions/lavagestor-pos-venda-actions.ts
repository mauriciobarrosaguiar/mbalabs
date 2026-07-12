"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/core-data";
import { messageParam, nullableTextValue, textValue } from "@/lib/form-utils";
import {
  assertLavaEmpresaAccess,
  requireLavaGestorCounterAccess,
  resolveLavaEmpresaIdFromLavagem
} from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

export async function registrarContatoPosVenda(formData: FormData) {
  const { current } = await requireLavaGestorCounterAccess("/lavagestor/pos-venda");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const tipo = textValue(formData, "tipo");
  const clienteId = textValue(formData, "cliente_id");
  const lavagemId = textValue(formData, "lavagem_id");
  const filter = textValue(formData, "filter") || "7";

  if (!tipo || !clienteId || !lavagemId) {
    redirect(`/lavagestor/pos-venda?f=${encodeURIComponent(filter)}&error=${messageParam("Contato incompleto.")}`);
  }

  const empresaId = await resolveLavaEmpresaIdFromLavagem(client, lavagemId);
  await assertLavaEmpresaAccess(current, empresaId);

  const { error } = await client.from("lava_pos_venda_contatos").insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    tipo,
    mensagem: nullableTextValue(formData, "mensagem"),
    canal: "whatsapp"
  });

  if (error) {
    redirect(`/lavagestor/pos-venda?f=${encodeURIComponent(filter)}&error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "registrar pos-venda", detalhes: { cliente_id: clienteId, lavagem_id: lavagemId, tipo } });
  revalidatePath("/lavagestor/pos-venda");
  redirect(`/lavagestor/pos-venda?f=${encodeURIComponent(filter)}&ok=${messageParam("Contato de pós-venda registrado.")}`);
}
