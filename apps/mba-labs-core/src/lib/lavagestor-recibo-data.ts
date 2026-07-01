import { requireAppAccess } from "./core-data";
import { withSignedPhotoUrls } from "./lavagestor-checklists-data";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export async function getLavaRecibo(lavagemId: string) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const [lavagemResult, empresaResult, configResult, servicosResult, pagamentosResult, checklistResult, fotosResult] = await Promise.all([
    client
      .from("lava_lavagens")
      .select("id,empresa_id,cliente_id,veiculo_id,funcionario_id,servico_id,descricao_extra,observacoes,valor,valor_total,valor_desconto,valor_final,valor_recebido,valor_pendente,comissao,status,status_pagamento,forma_pagamento,data_entrada,data_inicio,data_finalizacao,data_cliente_avisado,data_pagamento,data_entrega,entrega_tipo,endereco_entrega,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor,tipo),lava_funcionarios(nome),lava_servicos(nome)")
      .eq("id", lavagemId)
      .eq("empresa_id", current.empresaId)
      .maybeSingle(),
    current.empresaId
      ? client
          .from("core_empresas")
          .select("id,nome,nome_fantasia,razao_social,cnpj,telefone,whatsapp,email,cidade,estado")
          .eq("id", current.empresaId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    current.empresaId
      ? client
          .from("lava_configuracoes")
          .select("nome_exibicao,nome_fantasia,documento,whatsapp,telefone,endereco,cidade,estado,chave_pix,logo_url,cor_principal,mensagem_recibo,permitir_recibo_sem_checklist")
          .eq("empresa_id", current.empresaId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from("lava_lavagem_servicos")
      .select("id,descricao,valor,percentual_comissao,valor_comissao,created_at")
      .eq("lavagem_id", lavagemId)
      .eq("empresa_id", current.empresaId)
      .order("created_at", { ascending: true }),
    client
      .from("lava_pagamentos")
      .select("id,valor,forma_pagamento,data_pagamento,observacoes")
      .eq("lavagem_id", lavagemId)
      .eq("empresa_id", current.empresaId)
      .order("data_pagamento", { ascending: true }),
    client
      .from("lava_checklists")
      .select("*")
      .eq("lavagem_id", lavagemId)
      .eq("empresa_id", current.empresaId)
      .maybeSingle(),
    client
      .from("lava_checklist_fotos")
      .select("id,tipo,storage_path,legenda,created_at")
      .eq("lavagem_id", lavagemId)
      .eq("empresa_id", current.empresaId)
      .order("created_at", { ascending: false })
      .limit(6)
  ]);

  if (lavagemResult.error || !lavagemResult.data) {
    return { recibo: null, error: lavagemResult.error?.message ?? "Lavagem não encontrada." };
  }

  const lavagem = lavagemResult.data as Row;
  const empresa = (empresaResult.data ?? {}) as Row;
  const config = (configResult.data ?? {}) as Row;
  const servicos = ((servicosResult.data ?? []) as Row[]).map((row) => ({
    id: String(row.id),
    descricao: String(row.descricao ?? "Serviço"),
    valor: Number(row.valor ?? 0),
    percentual_comissao: row.percentual_comissao,
    valor_comissao: Number(row.valor_comissao ?? 0)
  }));
  const pagamentos = ((pagamentosResult.data ?? []) as Row[]).map((row) => ({
    id: String(row.id),
    valor: Number(row.valor ?? 0),
    forma_pagamento: String(row.forma_pagamento ?? "-"),
    data_pagamento: row.data_pagamento,
    observacoes: row.observacoes
  }));

  const servicoPrincipal = relationName(lavagem.lava_servicos);
  const fallbackService = servicoPrincipal || String(lavagem.descricao_extra ?? "").trim();
  const empresaNome = String(config.nome_exibicao ?? config.nome_fantasia ?? empresa.nome_fantasia ?? empresa.nome ?? "LavaGestor");
  const empresaDocumento = String(config.documento ?? empresa.cnpj ?? "");
  const empresaTelefone = String(config.whatsapp ?? config.telefone ?? empresa.whatsapp ?? empresa.telefone ?? "");
  const empresaCidadeUf = [config.cidade ?? empresa.cidade, config.estado ?? empresa.estado].filter(Boolean).join(" - ");
  const checklist = (checklistResult.data ?? null) as Row | null;
  const checklistFotos = await withSignedPhotoUrls(client, fotosResult.data ?? []);

  return {
    recibo: {
      id: String(lavagem.id),
      numero: String(lavagem.id).slice(0, 8).toUpperCase(),
      empresa: {
        nome: empresaNome,
        razao_social: String(config.nome_fantasia ?? empresa.razao_social ?? ""),
        cnpj: empresaDocumento,
        telefone: empresaTelefone,
        email: String(empresa.email ?? ""),
        cidade_uf: empresaCidadeUf,
        endereco: String(config.endereco ?? ""),
        logo_url: String(config.logo_url ?? ""),
        cor_principal: String(config.cor_principal ?? "#059669"),
        mensagem_recibo: String(config.mensagem_recibo ?? defaultReceiptMessage()),
        permitir_recibo_sem_checklist: config.permitir_recibo_sem_checklist !== false
      },
      cliente: relationName(lavagem.lava_clientes) || "Cliente",
      whatsapp: relationPhone(lavagem.lava_clientes),
      veiculo: vehicleLabel(lavagem.lava_veiculos),
      funcionario: relationName(lavagem.lava_funcionarios) || "-",
      servicos: servicos.length > 0 ? servicos : fallbackService ? [{ id: "principal", descricao: fallbackService, valor: Number(lavagem.valor_final ?? lavagem.valor ?? 0), percentual_comissao: null, valor_comissao: Number(lavagem.comissao ?? 0) }] : [],
      pagamentos,
      status: String(lavagem.status ?? ""),
      status_pagamento: String(lavagem.status_pagamento ?? "aberto"),
      forma_pagamento: String(lavagem.forma_pagamento ?? ""),
      valor_total: Number(lavagem.valor_total ?? lavagem.valor ?? 0),
      valor_desconto: Number(lavagem.valor_desconto ?? 0),
      valor_final: Number(lavagem.valor_final ?? lavagem.valor ?? 0),
      valor_recebido: Number(lavagem.valor_recebido ?? 0),
      valor_pendente: Number(lavagem.valor_pendente ?? 0),
      data_entrada: lavagem.data_entrada ?? lavagem.data_lavagem,
      data_finalizacao: lavagem.data_finalizacao,
      data_pagamento: lavagem.data_pagamento,
      data_entrega: lavagem.data_entrega,
      entrega_tipo: String(lavagem.entrega_tipo ?? "retirar"),
      endereco_entrega: String(lavagem.endereco_entrega ?? ""),
      observacoes: String(lavagem.observacoes ?? ""),
      checklist,
      checklist_fotos: checklistFotos,
      checklist_avarias: summarizeAvarias(checklist)
    },
    error: empresaResult.error?.message ?? configResult.error?.message ?? servicosResult.error?.message ?? pagamentosResult.error?.message ?? checklistResult.error?.message ?? fotosResult.error?.message ?? null
  };
}

function summarizeAvarias(checklist: Row | null) {
  if (!checklist) return [];
  const avarias = [
    checklist.riscos ? "Riscos" : "",
    checklist.amassados ? "Amassados" : "",
    checklist.vidro_trincado ? "Vidro trincado" : "",
    checklist.objetos_cliente ? "Objetos do cliente" : ""
  ].filter(Boolean);
  if (checklist.observacao_avarias) avarias.push(String(checklist.observacao_avarias));
  return avarias;
}

function defaultReceiptMessage() {
  return "Olá, {cliente}! Segue o recibo da lavagem {recibo}. Veículo/item: {veiculo}. Total pago: {total}. Obrigado pela preferência!";
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) {
    return String((relation as { nome?: unknown }).nome ?? "");
  }
  return "";
}

function relationPhone(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "telefone" in relation) {
    return String((relation as { telefone?: unknown }).telefone ?? "");
  }
  return "";
}

function vehicleLabel(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return "-";
  const veiculo = relation as { placa?: unknown; marca?: unknown; modelo?: unknown; cor?: unknown; tipo?: unknown };
  const model = [veiculo.marca, veiculo.modelo].filter(Boolean).join(" ");
  return [veiculo.placa, model, veiculo.cor].filter(Boolean).join(" - ") || String(veiculo.tipo ?? "Item");
}
