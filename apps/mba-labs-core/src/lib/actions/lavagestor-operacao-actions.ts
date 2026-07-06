"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messageParam, textValue } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

type SaidaTipo = "pago" | "convenio" | "fiado" | "faturar" | "cancelado" | "finalizado";

export async function registrarSaidaOperacao(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/operacao/saida");
  const empresaId = current.empresaId;
  const returnTo = safeReturn(textValue(formData, "return_to") || "/lavagestor/operacao/fila");

  if (!empresaId) {
    redirect(`${returnTo}?error=${messageParam("Empresa não encontrada.")}`);
  }

  const lavagemId = textValue(formData, "lavagem_id");
  const tipo = normalizeTipoSaida(textValue(formData, "tipo_saida"));

  if (!lavagemId || !tipo) {
    redirect(`${returnTo}?error=${messageParam("Selecione a lavagem e o tipo de saída.")}`);
  }

  const client = (await getSupabaseServer()) as any;

  const { data: lavagem, error: lavagemError } = await client
    .from("lava_lavagens")
    .select("id,valor,valor_final,valor_recebido,valor_pendente,status,status_pagamento")
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (lavagemError || !lavagem?.id) {
    redirect(`${returnTo}?error=${messageParam(lavagemError?.message ?? "Lavagem não encontrada.")}`);
  }

  if (["entregue", "cancelado"].includes(String(lavagem.status ?? ""))) {
    redirect(`${returnTo}?error=${messageParam("Essa lavagem já foi encerrada.")}`);
  }

  const valorFinal = Number(lavagem.valor_final ?? lavagem.valor ?? 0);
  const payload = buildPayload(tipo, valorFinal);

  const { error: updateError } = await client
    .from("lava_lavagens")
    .update(payload)
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId);

  if (updateError) {
    redirect(`${returnTo}?error=${messageParam(updateError.message)}`);
  }

  await client.from("lava_historico").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao: tipo === "finalizado" ? "finalizar_lavagem_operacao" : "saida_lavagem_operacao",
    status_anterior: String(lavagem.status ?? ""),
    status_novo: String(payload.status ?? ""),
    observacao: `Saída rápida registrada como ${labelTipo(tipo)}.`
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/operacao");
  revalidatePath("/lavagestor/operacao/fila");
  revalidatePath("/lavagestor/operacao/saida");

  redirect(`${returnTo}?ok=${messageParam(labelSuccess(tipo))}`);
}

function buildPayload(tipo: SaidaTipo, valorFinal: number) {
  if (tipo === "finalizado") {
    return {
      status: "finalizado"
    };
  }

  if (tipo === "cancelado") {
    return {
      status: "cancelado",
      status_pagamento: "cancelado",
      forma_pagamento: "cancelado",
      valor_recebido: 0,
      valor_pendente: 0
    };
  }

  if (tipo === "pago") {
    return {
      status: "entregue",
      status_pagamento: "pago",
      forma_pagamento: "pago",
      valor_recebido: valorFinal,
      valor_pendente: 0
    };
  }

  if (tipo === "fiado") {
    return {
      status: "entregue",
      status_pagamento: "fiado",
      forma_pagamento: "fiado",
      valor_recebido: 0,
      valor_pendente: valorFinal
    };
  }

  if (tipo === "convenio") {
    return {
      status: "entregue",
      status_pagamento: "aberto",
      forma_pagamento: "convenio",
      valor_recebido: 0,
      valor_pendente: valorFinal
    };
  }

  return {
    status: "entregue",
    status_pagamento: "aberto",
    forma_pagamento: "a_faturar",
    valor_recebido: 0,
    valor_pendente: valorFinal
  };
}

function normalizeTipoSaida(value: string): SaidaTipo | null {
  const normalized = value.trim().toLowerCase();

  if (["pago", "convenio", "fiado", "faturar", "cancelado", "finalizado"].includes(normalized)) {
    return normalized as SaidaTipo;
  }

  return null;
}

function labelTipo(tipo: SaidaTipo) {
  const labels: Record<SaidaTipo, string> = {
    pago: "Pago",
    convenio: "Convênio",
    fiado: "Fiado",
    faturar: "À faturar",
    cancelado: "Cancelado",
    finalizado: "Finalizado"
  };

  return labels[tipo];
}

function labelSuccess(tipo: SaidaTipo) {
  if (tipo === "finalizado") return "Lavagem finalizada e aguardando saída.";
  if (tipo === "cancelado") return "Lavagem cancelada.";
  return `Saída registrada como ${labelTipo(tipo)}.`;
}

function safeReturn(value: string) {
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : "/lavagestor/operacao/fila";
}
