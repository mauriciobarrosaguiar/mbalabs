import { formatMoney } from "@/components/ui-kit";
import { getLavaConfiguracoesEmpresa } from "./lavagestor-configuracoes-data";
import { LAVA_PAYMENT_STATUS_LABELS, LAVA_STATUS_LABELS, normalizeLavaStatus } from "./lavagestor-data";
import { withSignedPhotoUrls } from "./lavagestor-checklists-data";
import { requireLavaGestorAccess } from "./lavagestor-permissions";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export async function quickSearchLava(term = "") {
  const { current } = await requireLavaGestorAccess("/lavagestor/busca");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;
  const search = normalizeSearch(term);
  const digits = onlyDigits(term);

  const [clientesResult, veiculosResult, lavagensResult] = await Promise.all([
    client.from("lava_clientes").select("id,nome,telefone,email,documento").eq("empresa_id", empresaId).order("nome").limit(300),
    client.from("lava_veiculos").select("id,cliente_id,placa,marca,modelo,cor,tipo,lava_clientes(nome,telefone)").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(300),
    client
      .from("lava_lavagens")
      .select("id,cliente_id,veiculo_id,valor_final,valor,status,status_pagamento,data_entrada,data_lavagem,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor,tipo),lava_servicos(nome)")
      .eq("empresa_id", empresaId)
      .order("data_lavagem", { ascending: false })
      .limit(300)
  ]);

  const clientes = ((clientesResult.data ?? []) as Row[]).filter((cliente) => {
    if (!search && !digits) return false;
    return normalizeSearch([cliente.nome, cliente.email, cliente.documento].join(" ")).includes(search) || onlyDigits(cliente.telefone).includes(digits);
  });

  const veiculos = ((veiculosResult.data ?? []) as Row[]).filter((veiculo) => {
    if (!search && !digits) return false;
    return normalizeSearch([veiculo.placa, veiculo.marca, veiculo.modelo, relationName(veiculo.lava_clientes)].join(" ")).includes(search) || onlyDigits(relationPhone(veiculo.lava_clientes)).includes(digits);
  });

  const lavagens = ((lavagensResult.data ?? []) as Row[]).filter((lavagem) => {
    if (!search && !digits) return true;
    const haystack = [relationName(lavagem.lava_clientes), relationPhone(lavagem.lava_clientes), vehicleLabel(lavagem.lava_veiculos), relationName(lavagem.lava_servicos)].join(" ");
    return normalizeSearch(haystack).includes(search) || onlyDigits(haystack).includes(digits);
  });

  const results = new Map<string, Row>();
  for (const veiculo of veiculos) {
    const key = `veiculo:${veiculo.id}`;
    results.set(key, mapSearchResult({ veiculo, lavagem: lavagens.find((row) => row.veiculo_id === veiculo.id) }));
  }
  for (const cliente of clientes) {
    const lavagem = lavagens.find((row) => row.cliente_id === cliente.id);
    const veiculo = veiculos.find((row) => row.cliente_id === cliente.id) ?? relationObject(lavagem?.lava_veiculos);
    const key = veiculo?.id ? `veiculo:${veiculo.id}` : `cliente:${cliente.id}`;
    results.set(key, mapSearchResult({ cliente, veiculo, lavagem }));
  }
  for (const lavagem of lavagens.slice(0, search ? 30 : 12)) {
    const veiculo = relationObject(lavagem.lava_veiculos);
    const key = lavagem.veiculo_id ? `veiculo:${lavagem.veiculo_id}` : `lavagem:${lavagem.id}`;
    results.set(key, mapSearchResult({ veiculo, lavagem }));
  }

  return {
    term,
    rows: Array.from(results.values()).slice(0, 40),
    error: clientesResult.error?.message ?? veiculosResult.error?.message ?? lavagensResult.error?.message ?? null
  };
}

export async function getLavaClienteHistorico(clienteId: string) {
  const { current } = await requireLavaGestorAccess(`/lavagestor/clientes/${clienteId}`);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;
  const [clienteResult, veiculosResult, lavagensResult] = await Promise.all([
    client.from("lava_clientes").select("id,nome,telefone,email,documento,observacao,created_at").eq("empresa_id", empresaId).eq("id", clienteId).maybeSingle(),
    client.from("lava_veiculos").select("id,placa,marca,modelo,cor,tipo,observacao,created_at").eq("empresa_id", empresaId).eq("cliente_id", clienteId).order("created_at", { ascending: false }),
    client
      .from("lava_lavagens")
      .select("id,veiculo_id,valor_final,valor,valor_recebido,valor_pendente,status,status_pagamento,data_entrada,data_lavagem,lava_veiculos(placa,marca,modelo,cor,tipo),lava_funcionarios(nome),lava_servicos(nome)")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", clienteId)
      .order("data_lavagem", { ascending: false })
      .limit(120)
  ]);

  if (clienteResult.error || !clienteResult.data) {
    return { cliente: null, veiculos: [], lavagens: [], fotos: [], stats: emptyStats(), error: clienteResult.error?.message ?? "Cliente nao encontrado." };
  }

  const lavagens = ((lavagensResult.data ?? []) as Row[]).map(mapHistoryLavagem);
  const fotos = await photosForLavagens(client, empresaId, lavagens.map((row) => String(row.id)));
  return {
    cliente: clienteResult.data as Row,
    veiculos: (veiculosResult.data ?? []) as Row[],
    lavagens,
    fotos,
    stats: buildStats(lavagens),
    error: veiculosResult.error?.message ?? lavagensResult.error?.message ?? null
  };
}

export async function getLavaVeiculoHistorico(veiculoId: string) {
  const { current } = await requireLavaGestorAccess(`/lavagestor/veiculos/${veiculoId}`);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;
  const [veiculoResult, lavagensResult] = await Promise.all([
    client.from("lava_veiculos").select("id,cliente_id,placa,marca,modelo,cor,tipo,observacao,created_at,lava_clientes(nome,telefone,email)").eq("empresa_id", empresaId).eq("id", veiculoId).maybeSingle(),
    client
      .from("lava_lavagens")
      .select("id,cliente_id,veiculo_id,valor_final,valor,valor_recebido,valor_pendente,status,status_pagamento,data_entrada,data_lavagem,observacoes,lava_clientes(nome,telefone),lava_funcionarios(nome),lava_servicos(nome)")
      .eq("empresa_id", empresaId)
      .eq("veiculo_id", veiculoId)
      .order("data_lavagem", { ascending: false })
      .limit(120)
  ]);

  if (veiculoResult.error || !veiculoResult.data) {
    return { veiculo: null, lavagens: [], fotos: [], stats: emptyStats(), error: veiculoResult.error?.message ?? "Veiculo nao encontrado." };
  }

  const veiculo = veiculoResult.data as Row;
  const lavagens: Row[] = ((lavagensResult.data ?? []) as Row[]).map((row): Row => ({
    ...mapHistoryLavagem(row),
    cliente: relationName(row.lava_clientes) || relationName(veiculo.lava_clientes),
    whatsapp: relationPhone(row.lava_clientes) || relationPhone(veiculo.lava_clientes)
  }));
  const fotos = await photosForLavagens(client, empresaId, lavagens.map((row) => String(row.id)));

  const normalizedVeiculo: Row = { ...veiculo, cliente: relationName(veiculo.lava_clientes), whatsapp: relationPhone(veiculo.lava_clientes), veiculo: vehicleLabel(veiculo) };
  return { veiculo: normalizedVeiculo, lavagens, fotos, stats: buildStats(lavagens), error: lavagensResult.error?.message ?? null };
}

export async function getLavaTicket(lavagemId: string) {
  const { current } = await requireLavaGestorAccess(`/lavagestor/tickets/${lavagemId}`);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;
  const [{ config }, lavagemResult, servicosResult, checklistResult, fotosResult, pagamentosResult] = await Promise.all([
    getLavaConfiguracoesEmpresa(),
    client
      .from("lava_lavagens")
      .select("id,cliente_id,veiculo_id,funcionario_id,servico_id,descricao_extra,observacoes,valor,valor_total,valor_desconto,valor_final,valor_recebido,valor_pendente,status,status_pagamento,forma_pagamento,data_entrada,data_lavagem,data_pagamento,data_finalizacao,entrega_tipo,endereco_entrega,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor,tipo),lava_funcionarios(nome),lava_servicos(nome)")
      .eq("id", lavagemId)
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    client.from("lava_lavagem_servicos").select("id,descricao,valor").eq("empresa_id", empresaId).eq("lavagem_id", lavagemId).order("created_at", { ascending: true }),
    client.from("lava_checklists").select("*").eq("empresa_id", empresaId).eq("lavagem_id", lavagemId).maybeSingle(),
    client.from("lava_checklist_fotos").select("id,tipo,momento,storage_path,legenda,created_at").eq("empresa_id", empresaId).eq("lavagem_id", lavagemId).eq("momento", "entrada").order("created_at", { ascending: false }).limit(8),
    client.from("lava_pagamentos").select("id,valor,forma_pagamento,data_pagamento").eq("empresa_id", empresaId).eq("lavagem_id", lavagemId).order("data_pagamento", { ascending: true })
  ]);

  if (lavagemResult.error || !lavagemResult.data) {
    return { ticket: null, error: lavagemResult.error?.message ?? "Lavagem nao encontrada." };
  }

  const lavagem = lavagemResult.data as Row;
  const photos = await withSignedPhotoUrls(client, fotosResult.data ?? []);
  const servicos = ((servicosResult.data ?? []) as Row[]).map((row) => ({ descricao: String(row.descricao ?? "Servico"), valor: moneyNumber(row.valor) }));
  const fallbackService = relationName(lavagem.lava_servicos) || String(lavagem.descricao_extra ?? "").trim();
  const pagamentos = ((pagamentosResult.data ?? []) as Row[]).map((row) => ({ ...row, valor: moneyNumber(row.valor) }));
  const ticket = {
    id: String(lavagem.id),
    numero: String(lavagem.id).slice(0, 8).toUpperCase(),
    empresa: {
      nome: config.nome_exibicao,
      documento: config.documento,
      whatsapp: config.whatsapp || config.telefone,
      endereco: [config.endereco, config.cidade, config.estado].filter(Boolean).join(" - "),
      logo_url: config.logo_url,
      cor_principal: config.cor_principal
    },
    cliente: relationName(lavagem.lava_clientes) || "Cliente",
    whatsapp: relationPhone(lavagem.lava_clientes),
    veiculo: vehicleLabel(lavagem.lava_veiculos),
    placa: vehicleField(lavagem.lava_veiculos, "placa"),
    marca: vehicleField(lavagem.lava_veiculos, "marca"),
    modelo: vehicleField(lavagem.lava_veiculos, "modelo"),
    cor: vehicleField(lavagem.lava_veiculos, "cor"),
    funcionario: relationName(lavagem.lava_funcionarios) || "-",
    servicos: servicos.length ? servicos : fallbackService ? [{ descricao: fallbackService, valor: moneyNumber(lavagem.valor_final ?? lavagem.valor) }] : [],
    pagamentos,
    checklist: checklistResult.data as Row | null,
    fotos: photos,
    avarias: summarizeAvarias(checklistResult.data as Row | null),
    valor_total: moneyNumber(lavagem.valor_total ?? lavagem.valor),
    valor_desconto: moneyNumber(lavagem.valor_desconto),
    valor_final: moneyNumber(lavagem.valor_final ?? lavagem.valor),
    valor_recebido: moneyNumber(lavagem.valor_recebido),
    valor_pendente: moneyNumber(lavagem.valor_pendente),
    status: normalizeLavaStatus(lavagem.status),
    status_pagamento: String(lavagem.status_pagamento ?? "aberto"),
    forma_pagamento: String(lavagem.forma_pagamento ?? ""),
    data_entrada: lavagem.data_entrada ?? lavagem.data_lavagem,
    data_pagamento: lavagem.data_pagamento,
    data_finalizacao: lavagem.data_finalizacao,
    entrega_tipo: String(lavagem.entrega_tipo ?? "retirar"),
    endereco_entrega: String(lavagem.endereco_entrega ?? ""),
    observacoes: String(lavagem.observacoes ?? "")
  };

  return {
    ticket,
    error: servicosResult.error?.message ?? checklistResult.error?.message ?? fotosResult.error?.message ?? pagamentosResult.error?.message ?? null
  };
}

export async function getLavaPosVendaData(filter = "7") {
  const { current } = await requireLavaGestorAccess("/lavagestor/pos-venda");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;
  const { config } = await getLavaConfiguracoesEmpresa();
  const [lavagensResult, contatosResult] = await Promise.all([
    client
      .from("lava_lavagens")
      .select("id,cliente_id,veiculo_id,valor_final,valor_pendente,status,status_pagamento,data_entrega,data_pagamento,data_entrada,data_lavagem,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor,tipo),lava_servicos(nome)")
      .eq("empresa_id", empresaId)
      .order("data_lavagem", { ascending: false })
      .limit(500),
    client
      .from("lava_pos_venda_contatos")
      .select("id,cliente_id,lavagem_id,tipo,created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  const contatos = (contatosResult.data ?? []) as Row[];
  const groupedByClient = groupLavagensByClient((lavagensResult.data ?? []) as Row[]);
  const rows = ((lavagensResult.data ?? []) as Row[])
    .map((row) => mapPosVendaRow(row, groupedByClient.get(String(row.cliente_id)) ?? [], contatos, config))
    .filter((row) => posVendaFilter(row, filter))
    .slice(0, 120);

  return { rows, filter, config, error: lavagensResult.error?.message ?? contatosResult.error?.message ?? null };
}

function mapSearchResult({ cliente, veiculo, lavagem }: { cliente?: Row | null; veiculo?: Row | null; lavagem?: Row | null }) {
  const clientRelation = cliente ?? relationObject(veiculo?.lava_clientes) ?? relationObject(lavagem?.lava_clientes);
  const vehicleRelation = veiculo ?? relationObject(lavagem?.lava_veiculos);
  const clienteId = String(cliente?.id ?? veiculo?.cliente_id ?? lavagem?.cliente_id ?? "");
  const veiculoId = String(veiculo?.id ?? lavagem?.veiculo_id ?? "");
  const phone = String(cliente?.telefone ?? relationPhone(veiculo?.lava_clientes) ?? relationPhone(lavagem?.lava_clientes) ?? "");
  return {
    id: `${clienteId}:${veiculoId}:${lavagem?.id ?? ""}`,
    cliente_id: clienteId,
    veiculo_id: veiculoId,
    lavagem_id: lavagem?.id ? String(lavagem.id) : "",
    cliente: String(clientRelation?.nome ?? "Cliente"),
    whatsapp: phone,
    veiculo: vehicleLabel(vehicleRelation),
    placa: String(vehicleRelation?.placa ?? ""),
    ultima_lavagem: lavagem?.data_entrada ?? lavagem?.data_lavagem ?? null,
    ultimo_status: lavagem ? LAVA_STATUS_LABELS[normalizeLavaStatus(lavagem.status)] ?? String(lavagem.status ?? "") : "-",
    ultimo_valor: lavagem ? moneyNumber(lavagem.valor_final ?? lavagem.valor) : 0
  };
}

function mapHistoryLavagem(row: Row): Row {
  const status = normalizeLavaStatus(row.status);
  const payment = String(row.status_pagamento ?? "aberto");
  return {
    ...row,
    veiculo: vehicleLabel(row.lava_veiculos),
    placa: vehicleField(row.lava_veiculos, "placa"),
    funcionario: relationName(row.lava_funcionarios),
    servico: relationName(row.lava_servicos),
    status,
    status_label: LAVA_STATUS_LABELS[status] ?? status,
    status_pagamento_label: LAVA_PAYMENT_STATUS_LABELS[payment] ?? payment,
    valor_final: moneyNumber(row.valor_final ?? row.valor),
    valor_recebido: moneyNumber(row.valor_recebido),
    valor_pendente: moneyNumber(row.valor_pendente),
    data_ref: row.data_entrada ?? row.data_lavagem
  };
}

async function photosForLavagens(client: any, empresaId: string | null, lavagemIds: string[]) {
  if (lavagemIds.length === 0) return [];
  const { data } = await client
    .from("lava_checklist_fotos")
    .select("id,lavagem_id,tipo,momento,storage_path,legenda,created_at")
    .eq("empresa_id", empresaId)
    .in("lavagem_id", lavagemIds)
    .order("created_at", { ascending: false })
    .limit(80);
  return withSignedPhotoUrls(client, data ?? []);
}

function buildStats(lavagens: Row[]) {
  const active = lavagens.filter((row) => String(row.status) !== "cancelado");
  const total = active.reduce((sum, row) => sum + moneyNumber(row.valor_final), 0);
  const recebido = active.reduce((sum, row) => sum + moneyNumber(row.valor_recebido), 0);
  const pendente = active.reduce((sum, row) => sum + moneyNumber(row.valor_pendente), 0);
  return {
    total_lavagens: active.length,
    ultima_lavagem: active[0]?.data_ref ?? null,
    ticket_medio: active.length ? total / active.length : 0,
    total_gasto: total,
    recebido,
    pendente
  };
}

function emptyStats() {
  return { total_lavagens: 0, ultima_lavagem: null, ticket_medio: 0, total_gasto: 0, recebido: 0, pendente: 0 };
}

function groupLavagensByClient(rows: Row[]) {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row.cliente_id ?? "");
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

function mapPosVendaRow(row: Row, clienteLavagens: Row[], contatos: Row[], config: Row) {
  const status = normalizeLavaStatus(row.status);
  const dataRef = row.data_entrega ?? row.data_pagamento ?? row.data_entrada ?? row.data_lavagem;
  const cliente = relationName(row.lava_clientes) || "Cliente";
  const veiculo = vehicleLabel(row.lava_veiculos);
  const placa = vehicleField(row.lava_veiculos, "placa");
  const variables = {
    cliente,
    empresa: String(config.nome_exibicao ?? "lava-jato"),
    veiculo,
    placa,
    valor: formatMoney(row.valor_pendente ?? row.valor_final ?? 0),
    data: formatDateShort(dataRef),
    servico: relationName(row.lava_servicos) || "servico"
  };
  const contact = contatos.find((item) => String(item.lavagem_id) === String(row.id));
  const recorrencia = clienteLavagens.filter((item) => normalizeLavaStatus(item.status) !== "cancelado").length;
  const daysSince = daysFrom(dataRef);

  return {
    id: String(row.id),
    cliente_id: String(row.cliente_id ?? ""),
    lavagem_id: String(row.id),
    cliente,
    whatsapp: relationPhone(row.lava_clientes),
    veiculo,
    placa,
    servico: variables.servico,
    data_ref: dataRef,
    dias: daysSince,
    recorrencia,
    status,
    status_pagamento: String(row.status_pagamento ?? "aberto"),
    valor_pendente: moneyNumber(row.valor_pendente),
    contato_recente: contact?.created_at ?? null,
    mensagens: {
      agradecimento: applyTemplate(String(config.mensagem_pos_venda_agradecimento ?? defaultMessages.agradecimento), variables),
      pesquisa: applyTemplate(String(config.mensagem_pesquisa_satisfacao ?? defaultMessages.pesquisa), variables),
      retorno: applyTemplate(String(config.mensagem_retorno ?? defaultMessages.retorno), variables),
      cobranca: applyTemplate(String(config.mensagem_cobranca_fiado ?? defaultMessages.cobranca), variables),
      promocao: applyTemplate(String(config.mensagem_promocao ?? defaultMessages.promocao), variables)
    }
  };
}

function posVendaFilter(row: Row, filter: string) {
  const days = Number(row.dias ?? 9999);
  if (filter === "hoje") return days === 0;
  if (filter === "7") return days <= 7;
  if (filter === "30") return days <= 30;
  if (filter === "sem_retorno_30") return days >= 30;
  if (filter === "fiado") return ["fiado", "aberto", "parcial"].includes(String(row.status_pagamento)) && moneyNumber(row.valor_pendente) > 0;
  if (filter === "vip") return Number(row.recorrencia ?? 0) >= 3;
  return days <= 7;
}

export function whatsappUrl(phone: unknown, message: string) {
  const digits = onlyDigits(phone);
  if (!digits) return "";
  const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function summarizeAvarias(checklist: Row | null) {
  if (!checklist) return [];
  const items = [
    checklist.riscos ? "Riscos" : "",
    checklist.amassados ? "Amassados" : "",
    checklist.vidro_trincado ? "Vidro trincado" : "",
    checklist.objetos_cliente ? "Objetos do cliente" : ""
  ].filter(Boolean);
  if (checklist.observacao_avarias) items.push(String(checklist.observacao_avarias));
  return items;
}

const defaultMessages = {
  agradecimento: "Ola, {cliente}! Obrigado por escolher a {empresa}. Seu veiculo {veiculo} foi entregue. Se puder, avalie nosso servico.",
  pesquisa: "Ola, {cliente}! De 0 a 10, qual nota voce da para o servico realizado no seu veiculo {veiculo}?",
  retorno: "Ola, {cliente}! Ja faz um tempo desde a ultima lavagem do seu veiculo {veiculo}. Podemos agendar uma nova lavagem?",
  cobranca: "Ola, {cliente}! Consta um valor em aberto de {valor}. Podemos combinar o pagamento?",
  promocao: "Ola, {cliente}! Temos uma condicao especial para uma nova lavagem do seu veiculo {veiculo}."
};

function applyTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Row) : null;
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  return relation ? String(relation.nome ?? "") : "";
}

function relationPhone(value: unknown) {
  const relation = relationObject(value);
  return relation ? String(relation.telefone ?? "") : "";
}

function vehicleField(value: unknown, key: "placa" | "marca" | "modelo" | "cor") {
  const relation = relationObject(value);
  return relation ? String(relation[key] ?? "") : "";
}

function vehicleLabel(value: unknown) {
  const relation = relationObject(value) ?? value as Row;
  if (!relation || typeof relation !== "object") return "-";
  const model = [relation.marca, relation.modelo].filter(Boolean).join(" ");
  return [relation.placa, model, relation.cor].filter(Boolean).join(" - ") || String(relation.tipo ?? "Item");
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function moneyNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function daysFrom(value: unknown) {
  if (!value) return 9999;
  const time = new Date(String(value)).getTime();
  if (!Number.isFinite(time)) return 9999;
  return Math.max(Math.floor((Date.now() - time) / 86400000), 0);
}

function formatDateShort(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "";
}
