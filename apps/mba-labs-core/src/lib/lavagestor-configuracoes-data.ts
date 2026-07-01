import { requireAppAccess } from "./core-data";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export type LavaConfiguracoesEmpresa = {
  empresa_id: string | null;
  nome_exibicao: string;
  nome_fantasia: string;
  documento: string;
  whatsapp: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  chave_pix: string;
  logo_url: string;
  cor_principal: string;
  percentual_comissao_padrao: number;
  forma_pagamento_padrao: string;
  permitir_fiado: boolean;
  permitir_desconto: boolean;
  bloquear_entrega_sem_pagamento: boolean;
  exigir_checklist_antes_finalizar: boolean;
  exigir_checklist_antes_entregar: boolean;
  exigir_foto_entrada: boolean;
  fotos_entrada_obrigatorias: string[];
  permitir_concluir_checklist_sem_foto: boolean;
  exigir_foto_checkout_antes_entrega: boolean;
  permitir_recibo_sem_checklist: boolean;
  mensagem_veiculo_pronto: string;
  mensagem_recibo: string;
  mensagem_pos_venda_agradecimento: string;
  mensagem_pesquisa_satisfacao: string;
  mensagem_retorno: string;
  mensagem_cobranca_fiado: string;
  mensagem_promocao: string;
  motivos_cancelamento: string[];
  tipos_entrega: string[];
  checklist_itens_padrao: string[];
  checklist_tipos_foto: string[];
};

export async function getLavaConfiguracoesEmpresa() {
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;

  if (!empresaId) {
    return { config: defaultConfig(null, "Empresa conectada"), error: "Empresa não identificada." };
  }

  const [empresaResult, configResult] = await Promise.all([
    client.from("core_empresas").select("id,nome,nome_fantasia,razao_social,cnpj,telefone,whatsapp,cidade,estado").eq("id", empresaId).maybeSingle(),
    client.from("lava_configuracoes").select("*").eq("empresa_id", empresaId).maybeSingle()
  ]);

  const empresa = (empresaResult.data ?? {}) as Row;
  const config = (configResult.data ?? {}) as Row;
  const nomeBase = String(config.nome_exibicao ?? empresa.nome_fantasia ?? empresa.nome ?? empresa.razao_social ?? "Empresa conectada");

  return {
    config: {
      ...defaultConfig(empresaId, nomeBase),
      nome_exibicao: String(config.nome_exibicao ?? nomeBase),
      nome_fantasia: String(config.nome_fantasia ?? empresa.nome_fantasia ?? empresa.nome ?? ""),
      documento: String(config.documento ?? empresa.cnpj ?? ""),
      whatsapp: String(config.whatsapp ?? empresa.whatsapp ?? empresa.telefone ?? ""),
      telefone: String(config.telefone ?? empresa.telefone ?? ""),
      endereco: String(config.endereco ?? ""),
      cidade: String(config.cidade ?? empresa.cidade ?? ""),
      estado: String(config.estado ?? empresa.estado ?? ""),
      chave_pix: String(config.chave_pix ?? ""),
      logo_url: String(config.logo_url ?? ""),
      cor_principal: String(config.cor_principal ?? "#059669"),
      percentual_comissao_padrao: numberValue(config.percentual_comissao_padrao, 35),
      forma_pagamento_padrao: String(config.forma_pagamento_padrao ?? "pix"),
      permitir_fiado: boolValue(config.permitir_fiado, true),
      permitir_desconto: boolValue(config.permitir_desconto, true),
      bloquear_entrega_sem_pagamento: boolValue(config.bloquear_entrega_sem_pagamento, true),
      exigir_checklist_antes_finalizar: boolValue(config.exigir_checklist_antes_finalizar, false),
      exigir_checklist_antes_entregar: boolValue(config.exigir_checklist_antes_entregar, false),
      exigir_foto_entrada: boolValue(config.exigir_foto_entrada, true),
      fotos_entrada_obrigatorias: arrayValue(config.fotos_entrada_obrigatorias, []),
      permitir_concluir_checklist_sem_foto: boolValue(config.permitir_concluir_checklist_sem_foto, false),
      exigir_foto_checkout_antes_entrega: boolValue(config.exigir_foto_checkout_antes_entrega, false),
      permitir_recibo_sem_checklist: boolValue(config.permitir_recibo_sem_checklist, true),
      mensagem_veiculo_pronto: String(config.mensagem_veiculo_pronto ?? defaultReadyMessage()),
      mensagem_recibo: String(config.mensagem_recibo ?? defaultReceiptMessage()),
      mensagem_pos_venda_agradecimento: String(config.mensagem_pos_venda_agradecimento ?? defaultAfterSaleThanks()),
      mensagem_pesquisa_satisfacao: String(config.mensagem_pesquisa_satisfacao ?? defaultSatisfactionMessage()),
      mensagem_retorno: String(config.mensagem_retorno ?? defaultReturnMessage()),
      mensagem_cobranca_fiado: String(config.mensagem_cobranca_fiado ?? defaultDebtMessage()),
      mensagem_promocao: String(config.mensagem_promocao ?? defaultPromoMessage()),
      motivos_cancelamento: arrayValue(config.motivos_cancelamento, defaultCancelReasons()),
      tipos_entrega: arrayValue(config.tipos_entrega, ["Cliente retira", "Levar ao cliente"]),
      checklist_itens_padrao: arrayValue(config.checklist_itens_padrao, defaultChecklistItems()),
      checklist_tipos_foto: arrayValue(config.checklist_tipos_foto, defaultChecklistPhotoTypes())
    },
    error: empresaResult.error?.message ?? configResult.error?.message ?? null
  };
}

function defaultConfig(empresaId: string | null, nome: string): LavaConfiguracoesEmpresa {
  return {
    empresa_id: empresaId,
    nome_exibicao: nome,
    nome_fantasia: nome,
    documento: "",
    whatsapp: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    chave_pix: "",
    logo_url: "",
    cor_principal: "#059669",
    percentual_comissao_padrao: 35,
    forma_pagamento_padrao: "pix",
    permitir_fiado: true,
    permitir_desconto: true,
    bloquear_entrega_sem_pagamento: true,
    exigir_checklist_antes_finalizar: false,
    exigir_checklist_antes_entregar: false,
    exigir_foto_entrada: true,
    fotos_entrada_obrigatorias: [],
    permitir_concluir_checklist_sem_foto: false,
    exigir_foto_checkout_antes_entrega: false,
    permitir_recibo_sem_checklist: true,
    mensagem_veiculo_pronto: defaultReadyMessage(),
    mensagem_recibo: defaultReceiptMessage(),
    mensagem_pos_venda_agradecimento: defaultAfterSaleThanks(),
    mensagem_pesquisa_satisfacao: defaultSatisfactionMessage(),
    mensagem_retorno: defaultReturnMessage(),
    mensagem_cobranca_fiado: defaultDebtMessage(),
    mensagem_promocao: defaultPromoMessage(),
    motivos_cancelamento: defaultCancelReasons(),
    tipos_entrega: ["Cliente retira", "Levar ao cliente"],
    checklist_itens_padrao: defaultChecklistItems(),
    checklist_tipos_foto: defaultChecklistPhotoTypes()
  };
}

function defaultReadyMessage() {
  return "Olá, {cliente}! Seu veículo/item {veiculo} está pronto. Total: {total}. {entrega} {fotos}";
}

function defaultReceiptMessage() {
  return "Olá, {cliente}! Segue o recibo da lavagem {recibo}. Veículo/item: {veiculo}. Total pago: {total}. Obrigado pela preferência!";
}

function defaultAfterSaleThanks() {
  return "Olá, {cliente}! Obrigado por escolher a {empresa}. Seu veículo {veiculo} foi entregue. Se puder, avalie nosso serviço.";
}

function defaultSatisfactionMessage() {
  return "Olá, {cliente}! De 0 a 10, qual nota você dá para o serviço realizado no seu veículo {veiculo}?";
}

function defaultReturnMessage() {
  return "Olá, {cliente}! Já faz um tempo desde a última lavagem do seu veículo {veiculo}. Podemos agendar uma nova lavagem?";
}

function defaultDebtMessage() {
  return "Olá, {cliente}! Consta um valor em aberto de {valor}. Podemos combinar o pagamento?";
}

function defaultPromoMessage() {
  return "Olá, {cliente}! Temos uma condição especial para uma nova lavagem do seu veículo {veiculo}.";
}

function defaultCancelReasons() {
  return ["Cliente desistiu", "Serviço lançado errado", "Veículo não deixou no lava-jato", "Pagamento não aprovado", "Outro motivo"];
}

function defaultChecklistItems() {
  return ["Pintura", "Riscos", "Amassados", "Vidros", "Retrovisores", "Pneus", "Faróis", "Interior", "Objetos do cliente", "KM"];
}

function defaultChecklistPhotoTypes() {
  return ["frente", "traseira", "lateral_esquerda", "lateral_direita", "interior", "painel_km", "avaria", "antes", "depois", "outras"];
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function arrayValue(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((item) => item.trim()).filter(Boolean);
  return fallback;
}
