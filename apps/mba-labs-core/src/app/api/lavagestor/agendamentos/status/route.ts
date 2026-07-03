import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { logAction } from "@/lib/core-data";
import { messageParam } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const returnTo = safeReturn(String(formData.get("return_to") ?? ""));
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url), { status: 303 });

  const { current } = await requireLavaGestorAccess("/lavagestor/agendamentos");
  if (!current.empresaId) {
    return redirectTo(`${returnTo}?error=${messageParam("Selecione uma empresa para usar este módulo.")}`);
  }

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) {
    return redirectTo(`${returnTo}?error=${messageParam("Agendamento ou status inválido.")}`);
  }

  const client = (await getSupabaseServer()) as any;
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString()
  };

  if (status === "cancelado") {
    updates.confirmacao_status = "cancelado";
    updates.confirmacao_erro = null;
  }

  const { error } = await client
    .from("lava_agendamentos")
    .update(updates)
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    return redirectTo(`${returnTo}?error=${messageParam(error.message)}`);
  }

  if (status === "cancelado") {
    await Promise.all([
      client
        .from("lava_automacao_fila")
        .update({ status: "cancelado", erro: null })
        .eq("empresa_id", current.empresaId)
        .eq("agendamento_id", id)
        .in("status", ["pendente", "pronto", "aguardando_aprovacao", "erro"]),
      client
        .from("lava_whatsapp_envios")
        .update({ status: "cancelado", erro: null })
        .eq("empresa_id", current.empresaId)
        .eq("agendamento_id", id)
        .in("status", ["pendente", "pronto", "aguardando_aprovacao", "erro"])
    ]);
  }

  await logAction({ appSlug: "lavagestor", acao: "status agendamento", detalhes: { id, status } }).catch(() => null);
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/agendamentos");
  revalidatePath("/lavagestor/automacoes");
  revalidatePath("/lavagestor/whatsapp");
  return redirectTo(`${returnTo}?ok=${messageParam("Agendamento atualizado.")}`);
}

function safeReturn(value: string) {
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : "/lavagestor/agendamentos";
}
