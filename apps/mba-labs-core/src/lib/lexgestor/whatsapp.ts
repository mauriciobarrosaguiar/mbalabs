export function abrirWhatsAppCliente(telefone: string, mensagem?: string) {
  const digits = telefone.replace(/\D/g, "");
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/55${digits}${texto}`;
}

export async function salvarMensagemManual(params: {
  clienteId: string;
  casoId?: string;
  conteudo: string;
}) {
  return {
    status: "em_preparacao",
    origem: "manual",
    ...params,
  };
}

export async function salvarPrintConversa(params: {
  clienteId: string;
  casoId?: string;
  dropboxPath?: string;
}) {
  return {
    status: "em_preparacao",
    tipo: "print_whatsapp",
    ...params,
  };
}

export function prepararWebhookWhatsAppCloudApi() {
  return {
    status: "nao_integrado",
    mensagem: "Webhook preparado conceitualmente. Nenhuma API real foi integrada nesta etapa.",
  };
}
