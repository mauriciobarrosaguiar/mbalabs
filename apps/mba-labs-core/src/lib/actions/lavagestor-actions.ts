"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserProfile, logAction } from "@/lib/core-data";
import { booleanValue, dateValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveCliente(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");

  if (!nome) {
    redirect(`/lavagestor/clientes?error=${messageParam("Informe o nome do cliente.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    nome,
    telefone: nullableTextValue(formData, "telefone"),
    email: nullableTextValue(formData, "email"),
    documento: nullableTextValue(formData, "documento"),
    observacao: nullableTextValue(formData, "observacao")
  };

  const result = id
    ? await (supabase as any).from("lava_clientes").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_clientes").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/clientes?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar cliente" : "criar cliente", detalhes: { nome } });
  revalidatePath("/lavagestor/clientes");
  redirect(`/lavagestor/clientes?ok=${messageParam("Cliente salvo com sucesso.")}`);
}

export async function deleteCliente(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any).from("lava_clientes").delete().eq("id", id).eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/clientes?error=${messageParam("Não foi possível excluir. Verifique se o cliente possui veículos ou lavagens.")}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "excluir cliente", detalhes: { id } });
  revalidatePath("/lavagestor/clientes");
  redirect(`/lavagestor/clientes?ok=${messageParam("Cliente excluído.")}`);
}

export async function saveVeiculo(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const clienteId = textValue(formData, "cliente_id");

  if (!clienteId) {
    redirect(`/lavagestor/veiculos?error=${messageParam("Selecione o cliente.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    cliente_id: clienteId,
    placa: nullableTextValue(formData, "placa"),
    modelo: nullableTextValue(formData, "modelo"),
    marca: nullableTextValue(formData, "marca"),
    cor: nullableTextValue(formData, "cor"),
    tipo: nullableTextValue(formData, "tipo"),
    observacao: nullableTextValue(formData, "observacao")
  };

  const result = id
    ? await (supabase as any).from("lava_veiculos").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_veiculos").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/veiculos?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar veículo" : "criar veículo", detalhes: { placa: payload.placa } });
  revalidatePath("/lavagestor/veiculos");
  redirect(`/lavagestor/veiculos?ok=${messageParam("Veículo salvo com sucesso.")}`);
}

export async function deleteVeiculo(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any).from("lava_veiculos").delete().eq("id", id).eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/veiculos?error=${messageParam("Não foi possível excluir. Verifique se o veículo possui lavagens.")}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "excluir veículo", detalhes: { id } });
  revalidatePath("/lavagestor/veiculos");
  redirect(`/lavagestor/veiculos?ok=${messageParam("Veículo excluído.")}`);
}

export async function saveFuncionario(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");

  if (!nome) {
    redirect(`/lavagestor/funcionarios?error=${messageParam("Informe o nome do funcionário.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    nome,
    telefone: nullableTextValue(formData, "telefone"),
    percentual_comissao: numberValue(formData, "percentual_comissao"),
    ativo: booleanValue(formData, "ativo")
  };

  const result = id
    ? await (supabase as any).from("lava_funcionarios").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_funcionarios").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/funcionarios?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar funcionário" : "criar funcionário", detalhes: { nome } });
  revalidatePath("/lavagestor/funcionarios");
  redirect(`/lavagestor/funcionarios?ok=${messageParam("Funcionário salvo com sucesso.")}`);
}

export async function inactivateFuncionario(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any)
    .from("lava_funcionarios")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/funcionarios?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "inativar funcionário", detalhes: { id } });
  revalidatePath("/lavagestor/funcionarios");
  redirect(`/lavagestor/funcionarios?ok=${messageParam("Funcionário inativado.")}`);
}

export async function saveServico(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");

  if (!nome) {
    redirect(`/lavagestor/servicos?error=${messageParam("Informe o nome do serviço.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    nome,
    descricao: nullableTextValue(formData, "descricao"),
    preco: numberValue(formData, "preco"),
    percentual_comissao: nullableTextValue(formData, "percentual_comissao") === null ? null : numberValue(formData, "percentual_comissao"),
    ativo: booleanValue(formData, "ativo")
  };

  const result = id
    ? await (supabase as any).from("lava_servicos").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_servicos").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/servicos?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: id ? "editar serviço" : "criar serviço", detalhes: { nome } });
  revalidatePath("/lavagestor/servicos");
  redirect(`/lavagestor/servicos?ok=${messageParam("Serviço salvo com sucesso.")}`);
}

export async function inactivateServico(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any)
    .from("lava_servicos")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/servicos?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "inativar serviço", detalhes: { id } });
  revalidatePath("/lavagestor/servicos");
  redirect(`/lavagestor/servicos?ok=${messageParam("Serviço inativado.")}`);
}

export async function createLavagem(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const clienteId = textValue(formData, "cliente_id");
  const funcionarioId = textValue(formData, "funcionario_id");
  const servicoId = textValue(formData, "servico_id");
  const valor = numberValue(formData, "valor");

  if (!clienteId || !funcionarioId || !servicoId || valor <= 0) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam("Informe cliente, funcionário, serviço e valor.")}`);
  }

  const [funcionarioResult, servicoResult] = await Promise.all([
    client
      .from("lava_funcionarios")
      .select("id,nome,percentual_comissao")
      .eq("id", funcionarioId)
      .eq("empresa_id", current.empresaId)
      .maybeSingle(),
    client
      .from("lava_servicos")
      .select("id,nome,percentual_comissao")
      .eq("id", servicoId)
      .eq("empresa_id", current.empresaId)
      .maybeSingle()
  ]);

  const funcionarioPercent = Number(funcionarioResult.data?.percentual_comissao ?? 0);
  const servicePercent = servicoResult.data?.percentual_comissao;
  const percent = servicePercent === null || servicePercent === undefined ? funcionarioPercent : Number(servicePercent);
  const comissao = Math.round(((valor * percent) / 100) * 100) / 100;

  const { data: lavagem, error } = await client
    .from("lava_lavagens")
    .insert({
      empresa_id: current.empresaId,
      cliente_id: clienteId,
      veiculo_id: nullableTextValue(formData, "veiculo_id"),
      funcionario_id: funcionarioId,
      servico_id: servicoId,
      descricao_extra: nullableTextValue(formData, "descricao_extra"),
      valor,
      comissao,
      status: "finalizada"
    })
    .select("id")
    .single();

  if (error || !lavagem?.id) {
    redirect(`/lavagestor/nova-lavagem?error=${messageParam(error?.message ?? "Não foi possível salvar a lavagem.")}`);
  }

  const { error: comissaoError } = await client.from("lava_comissoes").insert({
    empresa_id: current.empresaId,
    funcionario_id: funcionarioId,
    lavagem_id: lavagem.id,
    valor: comissao,
    status: "pendente"
  });

  if (comissaoError) {
    redirect(`/lavagestor/lavagens?error=${messageParam(comissaoError.message)}`);
  }

  await logAction({
    appSlug: "lavagestor",
    acao: "criar lavagem",
    detalhes: { lavagem_id: lavagem.id, valor, comissao, percentual: percent }
  });
  revalidatePath("/lavagestor");
  redirect(`/lavagestor/lavagens?ok=${messageParam("Lavagem salva e comissão calculada.")}`);
}

export async function markComissaoPaga(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const { error } = await (supabase as any)
    .from("lava_comissoes")
    .update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/comissoes?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "marcar comissão como paga", detalhes: { id } });
  revalidatePath("/lavagestor/comissoes");
  redirect(`/lavagestor/comissoes?ok=${messageParam("Comissão marcada como paga.")}`);
}

export async function saveVale(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const funcionarioId = textValue(formData, "funcionario_id");
  const valor = numberValue(formData, "valor");

  if (!funcionarioId || valor <= 0) {
    redirect(`/lavagestor/vales?error=${messageParam("Selecione o funcionário e informe o valor.")}`);
  }

  const { error } = await (supabase as any).from("lava_vales").insert({
    empresa_id: current.empresaId,
    funcionario_id: funcionarioId,
    valor,
    descricao: nullableTextValue(formData, "descricao"),
    data_vale: dateValue(formData, "data_vale"),
    status: "aberto"
  });

  if (error) {
    redirect(`/lavagestor/vales?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "criar vale", detalhes: { funcionario_id: funcionarioId, valor } });
  revalidatePath("/lavagestor/vales");
  redirect(`/lavagestor/vales?ok=${messageParam("Vale salvo com sucesso.")}`);
}

export async function updateValeStatus(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");

  const { error } = await (supabase as any)
    .from("lava_vales")
    .update({ status })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/lavagestor/vales?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: `atualizar vale para ${status}`, detalhes: { id } });
  revalidatePath("/lavagestor/vales");
  redirect(`/lavagestor/vales?ok=${messageParam("Vale atualizado.")}`);
}
