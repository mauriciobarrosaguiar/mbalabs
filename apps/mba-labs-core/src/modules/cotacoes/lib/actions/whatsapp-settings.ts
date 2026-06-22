"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/modules/cotacoes/lib/auth/session";
import {
  saveWhatsappGlobalConfig,
  sendWhatsappGlobalTestMessage,
  testWhatsappGlobalConfig,
  type WhatsappProvider,
} from "@/modules/cotacoes/lib/whatsapp/mba-cotacoes";

const settingsPath = "/cotacoes/configuracoes/whatsapp";
const providers = new Set(["evolution_api", "zapi", "meta_cloud_api", "outro"]);

export async function saveWhatsappSettingsAction(formData: FormData) {
  await requireSuperAdmin(settingsPath);
  const provider = field(formData, "provider") as WhatsappProvider;

  if (!providers.has(provider)) {
    go("erro", "Provider inválido.");
  }

  try {
    await saveWhatsappGlobalConfig({
      provider,
      api_url: field(formData, "api_url"),
      api_token: field(formData, "api_token"),
      phone_number_id: field(formData, "phone_number_id"),
      numero_oficial: field(formData, "numero_oficial"),
      nome_exibicao: field(formData, "nome_exibicao") || "MBA Cotações",
      status_conexao: field(formData, "status_conexao") || "configurado",
      ativo: formData.get("ativo") === "on",
    });
    revalidatePath(settingsPath);
  } catch (error) {
    go("erro", errorMessage(error, "Não foi possível salvar a configuração."));
  }

  go("sucesso", "Configuração do WhatsApp MBA Cotações salva.");
}

export async function testWhatsappConnectionAction() {
  await requireSuperAdmin(settingsPath);

  try {
    await testWhatsappGlobalConfig();
    revalidatePath(settingsPath);
  } catch (error) {
    go("erro", errorMessage(error, "Não foi possível testar a conexão."));
  }

  go("sucesso", "Configuração validada. Envie uma mensagem teste para confirmar o provider.");
}

export async function sendWhatsappTestMessageAction(formData: FormData) {
  await requireSuperAdmin(settingsPath);

  try {
    await sendWhatsappGlobalTestMessage(
      field(formData, "telefone_teste"),
      field(formData, "mensagem_teste") || "Mensagem de teste do MBA Cotações.",
    );
    revalidatePath(settingsPath);
  } catch (error) {
    go("erro", errorMessage(error, "Não foi possível enviar a mensagem teste."));
  }

  go("sucesso", "Mensagem teste enviada pelo WhatsApp oficial do MBA Cotações.");
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function go(status: "sucesso" | "erro", message: string): never {
  const params = new URLSearchParams({ status, mensagem: message });
  redirect(`${settingsPath}?${params.toString()}`);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}
