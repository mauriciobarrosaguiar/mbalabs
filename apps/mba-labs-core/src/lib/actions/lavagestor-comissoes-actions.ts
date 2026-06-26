"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { messageParam, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function pagarComissoesFuncionario(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const funcionarioId = textValue(formData, "funcionario_id");
  const abaterVales = textValue(formData, "abater_vales") === "sim";
  const now = new Date().toISOString();

  if (!funcionarioId) {
    redirect(`/lavagestor/comissoes?error=${messageParam("Selecione o funcionário para pagar as comissões.")}`);
  }

  const { data: comissoesPendentes, error: comissoesError } = await client
    .from("lava_comissoes")
    .select("id,valor")
    .eq("empresa_id", current.empresaId)
    .eq("funcionario_id", funcionarioId)
    .eq("status", "pendente");

  if (comissoesError) {
    redirect(`/lavagestor/comissoes?error=${messageParam(comissoesError.message)}`);
  }

  const comissoes = (comissoesPendentes ?? []) as Array<Record<string, unknown>>;
  if (comissoes.length === 0) {
    redirect(`/lavagestor/comissoes?error=${messageParam("Este funcionário não possui comissões pendentes.")}`);
  }

  const totalComissoes = sumMoney(comissoes, "valor");
  let totalVales = 0;
  let valesIds: string[] = [];

  if (abaterVales) {
    const { data: valesAbertos, error: valesError } = await client
      .from("lava_vales")
      .select("id,valor")
      .eq("empresa_id", current.empresaId)
      .eq("funcionario_id", funcionarioId)
      .eq("status", "aberto");

    if (valesError) {
      redirect(`/lavagestor/comissoes?error=${messageParam(valesError.message)}`);
    }

    const vales = (valesAbertos ?? []) as Array<Record<string, unknown>>;
    totalVales = sumMoney(vales, "valor");
    valesIds = vales.map((row) => String(row.id));
  }

  const comissoesIds = comissoes.map((row) => String(row.id));
  const { error: pagarError } = await client
    .from("lava_comissoes")
    .update({ status: "pago", pago_em: now })
    .eq("empresa_id", current.empresaId)
    .in("id", comissoesIds);

  if (pagarError) {
    redirect(`/lavagestor/comissoes?error=${messageParam(pagarError.message)}`);
  }

  if (abaterVales && valesIds.length > 0) {
    const { error: valesUpdateError } = await client
      .from("lava_vales")
      .update({ status: "descontado" })
      .eq("empresa_id", current.empresaId)
      .in("id", valesIds);

    if (valesUpdateError) {
      redirect(`/lavagestor/comissoes?error=${messageParam(valesUpdateError.message)}`);
    }
  }

  const liquidoPago = Math.max(totalComissoes - totalVales, 0);
  await logAction({
    appSlug: "lavagestor",
    acao: abaterVales ? "pagar comissões com abatimento de vales" : "pagar comissões sem abater vales",
    detalhes: {
      funcionario_id: funcionarioId,
      total_comissoes: totalComissoes,
      total_vales_abatidos: abaterVales ? totalVales : 0,
      liquido_pago: liquidoPago,
      quantidade_comissoes: comissoesIds.length,
      quantidade_vales: valesIds.length
    }
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/comissoes");
  revalidatePath("/lavagestor/vales");
  const msg = abaterVales
    ? `Comissões pagas. Vales abatidos: ${formatMoney(totalVales)}. Líquido a pagar: ${formatMoney(liquidoPago)}.`
    : `Comissões pagas. Vales ficaram abertos para o próximo pagamento.`;
  redirect(`/lavagestor/comissoes?ok=${messageParam(msg)}`);
}

function sumMoney(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
