"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { messageParam, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function descontarValeIntegral(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const id = textValue(formData, "id");

  if (!id) {
    redirect(`/lavagestor/vales?error=${messageParam("Vale não informado.")}`);
  }

  const { data: vale, error } = await client
    .from("lava_vales")
    .select("id,valor,valor_descontado,status")
    .eq("id", id)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !vale) {
    redirect(`/lavagestor/vales?error=${messageParam(error?.message ?? "Vale não encontrado.")}`);
  }

  const valorOriginal = moneyNumber(vale.valor);
  const valorJaDescontado = moneyNumber(vale.valor_descontado);
  const saldoAntes = roundMoney(Math.max(valorOriginal - valorJaDescontado, 0));

  if (saldoAntes <= 0) {
    const { error: statusError } = await client
      .from("lava_vales")
      .update({ status: "descontado", valor_descontado: valorOriginal })
      .eq("id", id)
      .eq("empresa_id", current.empresaId);

    if (statusError) {
      redirect(`/lavagestor/vales?error=${messageParam(statusError.message)}`);
    }

    revalidateValePages();
    redirect(`/lavagestor/vales?ok=${messageParam("Vale já estava totalmente descontado.")}`);
  }

  const saldoDepois = 0;
  const now = new Date().toISOString();

  const { error: movimentoError } = await client.from("lava_vale_movimentos").insert({
    empresa_id: current.empresaId,
    vale_id: id,
    valor_descontado: saldoAntes,
    saldo_antes: saldoAntes,
    saldo_depois: saldoDepois,
    tipo: "desconto",
    observacao: "Desconto integral lançado pela tela de vales.",
    created_at: now
  });

  if (movimentoError) {
    redirect(`/lavagestor/vales?error=${messageParam(movimentoError.message)}`);
  }

  const { error: updateError } = await client
    .from("lava_vales")
    .update({
      valor_descontado: valorOriginal,
      status: "descontado"
    })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (updateError) {
    redirect(`/lavagestor/vales?error=${messageParam(updateError.message)}`);
  }

  await logAction({
    appSlug: "lavagestor",
    acao: "descontar vale integral",
    detalhes: { id, valor_descontado: saldoAntes, saldo_antes: saldoAntes, saldo_depois: saldoDepois }
  });

  revalidateValePages();
  redirect(`/lavagestor/vales?ok=${messageParam(`Vale descontado integralmente. Valor abatido: ${formatMoney(saldoAntes)}.`)}`);
}

function revalidateValePages() {
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/vales");
  revalidatePath("/lavagestor/comissoes");
  revalidatePath("/lavagestor/relatorios");
}

function moneyNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
