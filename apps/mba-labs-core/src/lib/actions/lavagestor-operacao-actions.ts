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
    redirect(`${returnTo}?error=${messageParam("Empresa nao encontrada.")}`);
  }

  const lavagemId = textValue(formData, "lavagem_id");
  const tipo = normalizeTipoSaida(textValue(formData, "tipo_saida"));
  const funcionarioId = textValue(formData, "funcionario_id");

  if (!lavagemId || !tipo) {
    redirect(`${returnTo}?error=${messageParam("Selecione a lavagem e o tipo de saida.")}`);
  }

  if (tipo !== "cancelado" && !funcionarioId) {
    redirect(`${returnTo}?error=${messageParam("Selecione o lavador antes de registrar a saida.")}`);
  }

  const client = (await getSupabaseServer()) as any;

  const { data: lavagem, error: lavagemError } = await client
    .from("lava_lavagens")
    .select("id,servico_id,funcionario_id,valor,valor_final,valor_recebido,valor_pendente,status,status_pagamento")
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (lavagemError || !lavagem?.id) {
    redirect(`${returnTo}?error=${messageParam(lavagemError?.message ?? "Lavagem nao encontrada.")}`);
  }

  if (["entregue", "cancelado"].includes(String(lavagem.status ?? ""))) {
    redirect(`${returnTo}?error=${messageParam("Essa lavagem ja foi encerrada.")}`);
  }

  const valorFinal = Number(lavagem.valor_final ?? lavagem.valor ?? 0);
  const payload = buildPayload(tipo, valorFinal, funcionarioId || String(lavagem.funcionario_id ?? ""));

  const { error: updateError } = await client
    .from("lava_lavagens")
    .update(payload)
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId);

  if (updateError) {
    redirect(`${returnTo}?error=${messageParam(updateError.message)}`);
  }

  if (funcionarioId && tipo !== "cancelado") {
    await registrarLavadorEComissao(client, empresaId, lavagemId, funcionarioId, valorFinal, String(lavagem.servico_id ?? ""));
  }

  await client.from("lava_historico").insert({
    empresa_id: empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao: tipo === "finalizado" ? "finalizar_lavagem_operacao" : "saida_lavagem_operacao",
    status_anterior: String(lavagem.status ?? ""),
    status_novo: String(payload.status ?? ""),
    observacao: `Saida rapida registrada como ${labelTipo(tipo)}${funcionarioId ? " com lavador definido" : ""}.`
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/operacao");
  revalidatePath("/lavagestor/operacao/fila");
  revalidatePath("/lavagestor/operacao/saida");

  redirect(`${returnTo}?ok=${messageParam(labelSuccess(tipo))}`);
}

function buildPayload(tipo: SaidaTipo, valorFinal: number, funcionarioId: string) {
  const base = funcionarioId ? { funcionario_id: funcionarioId } : {};

  if (tipo === "finalizado") {
    return {
      ...base,
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
      ...base,
      status: "entregue",
      status_pagamento: "pago",
      forma_pagamento: "pago",
      valor_recebido: valorFinal,
      valor_pendente: 0
    };
  }

  if (tipo === "fiado") {
    return {
      ...base,
      status: "entregue",
      status_pagamento: "fiado",
      forma_pagamento: "fiado",
      valor_recebido: 0,
      valor_pendente: valorFinal
    };
  }

  if (tipo === "convenio") {
    return {
      ...base,
      status: "entregue",
      status_pagamento: "aberto",
      forma_pagamento: "convenio",
      valor_recebido: 0,
      valor_pendente: valorFinal
    };
  }

  return {
    ...base,
    status: "entregue",
    status_pagamento: "aberto",
    forma_pagamento: "a_faturar",
    valor_recebido: 0,
    valor_pendente: valorFinal
  };
}

async function registrarLavadorEComissao(client: any, empresaId: string | null, lavagemId: string, funcionarioId: string, valorFinal: number, servicoId: string) {
  await client
    .from("lava_lavagem_servicos")
    .update({ funcionario_id: funcionarioId })
    .eq("empresa_id", empresaId)
    .eq("lavagem_id", lavagemId);

  const { data: existente } = await client
    .from("lava_comissoes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("lavagem_id", lavagemId)
    .limit(1);

  if ((existente ?? []).length > 0) return;

  const [{ data: funcionario }, { data: servico }, { data: config }] = await Promise.all([
    client.from("lava_funcionarios").select("percentual_comissao").eq("empresa_id", empresaId).eq("id", funcionarioId).maybeSingle(),
    servicoId ? client.from("lava_servicos").select("percentual_comissao").eq("empresa_id", empresaId).eq("id", servicoId).maybeSingle() : Promise.resolve({ data: null }),
    client.from("lava_configuracoes").select("percentual_comissao_padrao").eq("empresa_id", empresaId).maybeSingle()
  ]);

  const percentual = Number(servico?.percentual_comissao ?? funcionario?.percentual_comissao ?? config?.percentual_comissao_padrao ?? 35);
  const valor = Math.round(((valorFinal * percentual) / 100) * 100) / 100;

  if (valor <= 0) return;

  await client.from("lava_comissoes").insert({
    empresa_id: empresaId,
    funcionario_id: funcionarioId,
    lavagem_id: lavagemId,
    valor,
    status: "pendente"
  });
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
    convenio: "Convenio",
    fiado: "Fiado",
    faturar: "A faturar",
    cancelado: "Cancelado",
    finalizado: "Finalizado"
  };

  return labels[tipo];
}

function labelSuccess(tipo: SaidaTipo) {
  if (tipo === "finalizado") return "Lavagem finalizada e aguardando saida.";
  if (tipo === "cancelado") return "Lavagem cancelada.";
  return `Saida registrada como ${labelTipo(tipo)}.`;
}

function safeReturn(value: string) {
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : "/lavagestor/operacao/fila";
}
