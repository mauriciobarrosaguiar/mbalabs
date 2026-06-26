"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { messageParam, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function pagarComissoesFuncionario(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const funcionarioId = textValue(formData, "funcionario_id");
  const modo = textValue(formData, "modo_desconto") || textValue(formData, "abater_vales") || "nao";
  const valorParcial = numberValue(formData, "valor_desconto_vale");

  if (!funcionarioId || !current.empresaId) {
    redirect(`/lavagestor/comissoes?error=${messageParam("Selecione o funcionário para fazer o acerto.")}`);
  }

  const { data, error } = await (supabase as any).rpc("lava_registrar_acerto_comissoes", {
    p_empresa_id: current.empresaId,
    p_funcionario_id: funcionarioId,
    p_modo: modo,
    p_valor_parcial: valorParcial
  });

  if (error) {
    redirect(`/lavagestor/comissoes?error=${messageParam(error.message)}`);
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok === false) {
    redirect(`/lavagestor/comissoes?error=${messageParam(String(result.message ?? "Não foi possível salvar o acerto."))}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "acerto de comissões", detalhes: { funcionario_id: funcionarioId, modo, result } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/comissoes");
  revalidatePath("/lavagestor/vales");

  const desconto = formatMoney(Number(result.desconto ?? 0));
  const liquido = formatMoney(Number(result.liquido ?? 0));
  redirect(`/lavagestor/comissoes?ok=${messageParam(`Acerto salvo. Desconto: ${desconto}. Líquido: ${liquido}.`)}`);
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
