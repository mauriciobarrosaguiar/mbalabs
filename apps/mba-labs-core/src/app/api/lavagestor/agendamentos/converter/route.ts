import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { logAction } from "@/lib/core-data";
import { messageParam } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url), { status: 303 });
  const returnTo = safeReturn(String(formData.get("return_to") ?? ""));

  try {
    const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
    if (!current.empresaId) {
      return redirectTo(`${returnTo}?error=${messageParam("Selecione uma empresa para usar este módulo.")}`);
    }

    const client = (await getSupabaseServer()) as any;
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      return redirectTo(`${returnTo}?error=${messageParam("Agendamento inválido.")}`);
    }

    const { data: agendamento, error } = await client
      .from("lava_agendamentos")
      .select("id,cliente_id,veiculo_id,servico_id,funcionario_id,observacao,titulo,lavagem_id,status")
      .eq("id", id)
      .eq("empresa_id", current.empresaId)
      .maybeSingle();

    if (error || !agendamento) {
      return redirectTo(`${returnTo}?error=${messageParam(error?.message ?? "Agendamento não encontrado.")}`);
    }

    if (String(agendamento.status) === "cancelado") {
      return redirectTo(`${returnTo}?error=${messageParam("Agendamento cancelado não pode ser convertido em lavagem.")}`);
    }

    if (agendamento.lavagem_id) {
      return redirectTo(`/lavagestor/fila?ok=${messageParam("Agendamento já estava convertido.")}`);
    }

    if (!agendamento.cliente_id || !agendamento.veiculo_id || !agendamento.servico_id || !agendamento.funcionario_id) {
      return redirectTo(`${returnTo}?error=${messageParam("Agendamento precisa de cliente, veículo, serviço e funcionário para converter.")}`);
    }

    const [servicoResult, funcionarioResult] = await Promise.all([
      client
        .from("lava_servicos")
        .select("id,nome,preco,percentual_comissao")
        .eq("id", agendamento.servico_id)
        .eq("empresa_id", current.empresaId)
        .maybeSingle(),
      client
        .from("lava_funcionarios")
        .select("id,nome,percentual_comissao")
        .eq("id", agendamento.funcionario_id)
        .eq("empresa_id", current.empresaId)
        .maybeSingle()
    ]);

    const servico = servicoResult.data as Row | null;
    const funcionario = funcionarioResult.data as Row | null;
    if (servicoResult.error || funcionarioResult.error || !servico || !funcionario) {
      const detail = servicoResult.error?.message || funcionarioResult.error?.message || "Serviço ou funcionário não encontrado.";
      return redirectTo(`${returnTo}?error=${messageParam(detail)}`);
    }

    const valor = moneyNumber(servico.preco);
    const percentual = servico.percentual_comissao === null || servico.percentual_comissao === undefined
      ? moneyNumber(funcionario.percentual_comissao)
      : moneyNumber(servico.percentual_comissao);
    const comissao = roundMoney((valor * percentual) / 100);
    const now = new Date().toISOString();

    const { data: lavagem, error: insertError } = await client
      .from("lava_lavagens")
      .insert({
        empresa_id: current.empresaId,
        cliente_id: agendamento.cliente_id,
        veiculo_id: agendamento.veiculo_id,
        funcionario_id: agendamento.funcionario_id,
        servico_id: agendamento.servico_id,
        descricao_extra: null,
        valor,
        valor_total: valor,
        valor_desconto: 0,
        valor_final: valor,
        valor_recebido: 0,
        valor_pendente: valor,
        status_pagamento: "aberto",
        forma_pagamento: null,
        comissao,
        status: "na_fila",
        data_entrada: now,
        data_lavagem: now,
        observacoes: agendamento.observacao ?? agendamento.titulo ?? "Convertido de agendamento."
      })
      .select("id")
      .single();

    if (insertError || !lavagem?.id) {
      return redirectTo(`${returnTo}?error=${messageParam(insertError?.message ?? "Não foi possível criar a lavagem.")}`);
    }

    const { error: serviceError } = await client.from("lava_lavagem_servicos").insert({
      empresa_id: current.empresaId,
      lavagem_id: lavagem.id,
      servico_id: agendamento.servico_id,
      funcionario_id: agendamento.funcionario_id,
      descricao: servico.nome ?? "Serviço",
      valor,
      tipo_comissao: percentual > 0 ? "percentual" : "sem_comissao",
      percentual_comissao: percentual,
      valor_comissao: comissao
    });

    if (serviceError) {
      return redirectTo(`${returnTo}?error=${messageParam(serviceError.message)}`);
    }

    if (comissao > 0) {
      await client.from("lava_comissoes").insert({
        empresa_id: current.empresaId,
        funcionario_id: agendamento.funcionario_id,
        lavagem_id: lavagem.id,
        valor: comissao,
        status: "pendente"
      });
    }

    await client
      .from("lava_agendamentos")
      .update({ status: "convertido", lavagem_id: lavagem.id, updated_at: now })
      .eq("id", id)
      .eq("empresa_id", current.empresaId);

    await Promise.all([
      client
        .from("lava_automacao_fila")
        .update({ status: "cancelado", erro: null, updated_at: now })
        .eq("empresa_id", current.empresaId)
        .eq("agendamento_id", id)
        .neq("status", "enviado_manual"),
      client
        .from("lava_whatsapp_envios")
        .update({ status: "cancelado", erro: null, updated_at: now })
        .eq("empresa_id", current.empresaId)
        .eq("agendamento_id", id)
        .neq("status", "enviado")
    ]);

    await client.from("lava_historico").insert({
      empresa_id: current.empresaId,
      lavagem_id: lavagem.id,
      usuario_id: current.usuario.id,
      acao: "agendamento_convertido",
      status_anterior: null,
      status_novo: "na_fila",
      observacao: "Lavagem criada a partir de agendamento."
    });

    await logAction({ appSlug: "lavagestor", acao: "converter agendamento", detalhes: { agendamento_id: id, lavagem_id: lavagem.id } }).catch(() => null);
    revalidatePath("/lavagestor");
    revalidatePath("/lavagestor/fila");
    revalidatePath("/lavagestor/agendamentos");
    revalidatePath("/lavagestor/checklists");
    return redirectTo(`/lavagestor/fila?ok=${messageParam("Agendamento convertido em lavagem.")}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível converter o agendamento.";
    return redirectTo(`${returnTo}?error=${messageParam(message)}`);
  }
}

function safeReturn(value: string) {
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : "/lavagestor/agendamentos";
}

function moneyNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "0").replace(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
