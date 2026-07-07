"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messageParam, textValue } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

export async function finalizarServicoOperacao(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/operacao/fila");
  const empresaId = current.empresaId;
  const returnTo = "/lavagestor/operacao/fila";
  const lavagemId = textValue(formData, "lavagem_id");

  if (!empresaId || !lavagemId) {
    redirect(`${returnTo}?error=${messageParam("Lavagem nao encontrada.")}`);
  }

  const client = (await getSupabaseServer()) as any;
  const { data: lavagem, error: leituraError } = await client
    .from("lava_lavagens")
    .select("id,status")
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (leituraError || !lavagem?.id) {
    redirect(`${returnTo}?error=${messageParam(leituraError?.message ?? "Lavagem nao encontrada.")}`);
  }

  if (["entregue", "cancelado"].includes(String(lavagem.status ?? ""))) {
    redirect(`${returnTo}?error=${messageParam("Essa lavagem ja foi encerrada.")}`);
  }

  const { error } = await client
    .from("lava_lavagens")
    .update({ status: "finalizado" })
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId);

  if (error) {
    redirect(`${returnTo}?error=${messageParam(error.message)}`);
  }

  await client.from("lava_historico").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao: "finalizar_servico_operacao",
    status_anterior: String(lavagem.status ?? ""),
    status_novo: "finalizado",
    observacao: "Servico finalizado e aguardando saida."
  });

  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/operacao/fila");
  revalidatePath("/lavagestor/operacao/saida");

  redirect(`${returnTo}?ok=${messageParam("Servico finalizado. Agora registre a saida.")}`);
}
