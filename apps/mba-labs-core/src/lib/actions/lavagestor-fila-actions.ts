"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { messageParam, textValue } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

type Row = Record<string, unknown>;

export async function alterarFuncionarioLavagem(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/fila");
  const returnTo = safeReturn(textValue(formData, "return_to") || "/lavagestor/fila");
  if (!current.empresaId) redirect(`${returnTo}?error=${messageParam("Selecione uma empresa.")}`);

  const lavagemId = textValue(formData, "lavagem_id");
  const funcionarioId = textValue(formData, "funcionario_id");
  if (!lavagemId || !funcionarioId) redirect(`${returnTo}?error=${messageParam("Selecione a lavagem e o funcionário.")}`);

  const client = (await getSupabaseServer()) as any;
  const [lavagemResult, funcionarioResult] = await Promise.all([
    client.from("lava_lavagens").select("id,funcionario_id,status").eq("id", lavagemId).eq("empresa_id", current.empresaId).maybeSingle(),
    client.from("lava_funcionarios").select("id,nome,ativo").eq("id", funcionarioId).eq("empresa_id", current.empresaId).maybeSingle()
  ]);

  const lavagem = lavagemResult.data as Row | null;
  const funcionario = funcionarioResult.data as Row | null;
  if (lavagemResult.error || !lavagem) redirect(`${returnTo}?error=${messageParam(lavagemResult.error?.message ?? "Lavagem não encontrada.")}`);
  if (["entregue", "cancelado"].includes(String(lavagem.status))) redirect(`${returnTo}?error=${messageParam("Não é possível alterar funcionário de lavagem entregue ou cancelada.")}`);
  if (funcionarioResult.error || !funcionario || funcionario.ativo === false) redirect(`${returnTo}?error=${messageParam(funcionarioResult.error?.message ?? "Funcionário ativo não encontrado.")}`);

  const oldFuncionario = String(lavagem.funcionario_id ?? "");
  const now = new Date().toISOString();
  const { error } = await client.from("lava_lavagens").update({ funcionario_id: funcionarioId, updated_at: now }).eq("id", lavagemId).eq("empresa_id", current.empresaId);
  if (error) redirect(`${returnTo}?error=${messageParam(error.message)}`);

  await client.from("lava_lavagem_servicos").update({ funcionario_id: funcionarioId }).eq("empresa_id", current.empresaId).eq("lavagem_id", lavagemId);
  await client.from("lava_comissoes").update({ funcionario_id: funcionarioId }).eq("empresa_id", current.empresaId).eq("lavagem_id", lavagemId);
  await client.from("lava_historico").insert({
    empresa_id: current.empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao: "alterar_funcionario",
    status_anterior: oldFuncionario || null,
    status_novo: funcionarioId,
    observacao: `Funcionário alterado para ${String(funcionario.nome ?? "funcionário")}.`
  });

  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/fila");
  revalidatePath("/lavagestor/funcionarios");
  redirect(`${returnTo}?ok=${messageParam(`Funcionário alterado para ${String(funcionario.nome ?? "funcionário")}.`)}`);
}

function safeReturn(value: string) {
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : "/lavagestor/fila";
}
