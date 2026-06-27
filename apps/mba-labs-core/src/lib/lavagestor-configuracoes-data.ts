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
  mensagem_veiculo_pronto: string;
  mensagem_recibo: string;
  motivos_cancelamento: string[];
  tipos_entrega: string[];
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
      mensagem_veiculo_pronto: String(config.mensagem_veiculo_pronto ?? defaultReadyMessage()),
      mensagem_recibo: String(config.mensagem_recibo ?? defaultReceiptMessage()),
      motivos_cancelamento: arrayValue(config.motivos_cancelamento, defaultCancelReasons()),
      tipos_entrega: arrayValue(config.tipos_entrega, ["Cliente retira", "Levar ao cliente"])
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
    mensagem_veiculo_pronto: defaultReadyMessage(),
    mensagem_recibo: defaultReceiptMessage(),
    motivos_cancelamento: defaultCancelReasons(),
    tipos_entrega: ["Cliente retira", "Levar ao cliente"]
  };
}

function defaultReadyMessage() {
  return "Olá, {cliente}! Seu veículo/item {veiculo} está pronto. Total: {total}. {entrega}";
}

function defaultReceiptMessage() {
  return "Olá, {cliente}! Segue o recibo da lavagem {recibo}. Veículo/item: {veiculo}. Total pago: {total}. Obrigado pela preferência!";
}

function defaultCancelReasons() {
  return ["Cliente desistiu", "Serviço lançado errado", "Veículo não deixou no lava-jato", "Pagamento não aprovado", "Outro motivo"];
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
