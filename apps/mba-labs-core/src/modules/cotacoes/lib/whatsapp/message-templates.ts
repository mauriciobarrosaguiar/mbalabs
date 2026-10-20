type MessageInput = {
  contactName: string;
  companyName: string;
  quotationName?: string | null;
  link: string;
};

function operationalTestNotice(quotationName: MessageInput["quotationName"]) {
  if (!/^TESTE OPERACIONAL MBA LABS\b/i.test(quotationName?.trim() ?? "")) return "";
  return "TESTE OPERACIONAL MBA LABS — NÃO FATURAR.\nCotação de homologação. Não faturar, separar mercadorias ou realizar entrega.\n\n";
}

export function buildQuotationWhatsappMessage(input: MessageInput) {
  return `${operationalTestNotice(input.quotationName)}Olá ${input.contactName}, a farmácia ${input.companyName} enviou uma nova cotação pelo MBA Cotações.\n\nPara responder, acesse:\n${input.link}`;
}

export function buildWinnerOrderWhatsappMessage(input: MessageInput) {
  return `${operationalTestNotice(input.quotationName)}Olá ${input.contactName}, a cotação da farmácia ${input.companyName} foi finalizada pelo MBA Cotações.\n\nVocê possui itens vencedores.\n\nAcesse:\n${input.link}`;
}
