"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { calcularLavaCaixa, resolveLavaCaixaPeriod, roundMoney } from "@/lib/lavagestor-caixa-data";
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

export async function fecharLavaCaixa(formData: FormData) {
  await requireLavaGestorFinanceAccess("/lavagestor/financeiro");
  const current = await requireAppAccess("lavagestor", "/lavagestor/financeiro");
  const returnTo = returnPath(formData);

  if (!current.empresaId) {
    redirect(`${returnTo}&error=${messageParam("Selecione uma empresa para fechar o caixa.")}`);
  }

  const period = resolveLavaCaixaPeriod({
    tipo: textValue(formData, "tipo"),
    data: textValue(formData, "data"),
    mes: textValue(formData, "mes")
  });
  const client = (await getSupabaseServer()) as any;
  const resumo = await calcularLavaCaixa(client, current, period);
  const cards = resumo.cards;
  const valorInformado = numberValue(formData, "valor_informado");
  const diferenca = roundMoney(valorInformado - cards.caixaReal);
  const now = new Date().toISOString();

  const { error } = await client.from("lava_caixa_fechamentos").upsert({
    empresa_id: current.empresaId,
    periodo_tipo: period.tipo,
    periodo_inicio: period.inicio,
    periodo_fim: period.fim,
    status: "fechado",
    total_recebido: cards.totalRecebido,
    total_dinheiro: cards.totalDinheiro,
    total_pix: cards.totalPix,
    total_cartao: cards.totalCartao,
    total_outros: cards.totalOutros,
    total_fiado: cards.totalFiado,
    total_pendente: cards.totalPendente,
    total_comissoes_pagas: cards.totalComissoesPagas,
    total_vales_baixados: cards.totalValesBaixados,
    caixa_real: cards.caixaReal,
    valor_informado: valorInformado,
    diferenca,
    observacoes: nullableTextValue(formData, "observacoes"),
    fechado_por: current.usuario.id,
    fechado_em: now,
    reaberto_por: null,
    reaberto_em: null,
    updated_at: now
  }, { onConflict: "empresa_id,periodo_tipo,periodo_inicio,periodo_fim" });

  if (error) {
    redirect(`${returnTo}&error=${messageParam(error.message)}`);
  }

  await logAction({
    appSlug: "lavagestor",
    acao: "fechar caixa",
    detalhes: {
      periodo_tipo: period.tipo,
      periodo_inicio: period.inicio,
      periodo_fim: period.fim,
      caixa_real: cards.caixaReal,
      valor_informado: valorInformado,
      diferenca
    }
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/financeiro");
  revalidatePath("/lavagestor/relatorios");
  redirect(`${returnTo}&ok=${messageParam(`Caixa ${period.tipo === "mes" ? "mensal" : "do dia"} fechado.`)}`);
}

export async function reabrirLavaCaixa(formData: FormData) {
  await requireLavaGestorFinanceAccess("/lavagestor/financeiro");
  const current = await requireAppAccess("lavagestor", "/lavagestor/financeiro");
  const returnTo = returnPath(formData);
  const id = textValue(formData, "id");

  if (!id || !current.empresaId) {
    redirect(`${returnTo}&error=${messageParam("Fechamento não encontrado.")}`);
  }

  const { error } = await ((await getSupabaseServer()) as any)
    .from("lava_caixa_fechamentos")
    .update({
      status: "reaberto",
      reaberto_por: current.usuario.id,
      reaberto_em: new Date().toISOString()
    })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`${returnTo}&error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "reabrir caixa", detalhes: { id } });
  revalidatePath("/lavagestor/financeiro");
  redirect(`${returnTo}&ok=${messageParam("Caixa reaberto para conferência.")}`);
}

function returnPath(formData: FormData) {
  const path = textValue(formData, "return_to");
  return path.startsWith("/lavagestor/financeiro?") ? path : "/lavagestor/financeiro?tipo=dia";
}
