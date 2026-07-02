import { formatMoney } from "@/components/ui-kit";
import { firstParam } from "./form-utils";
import { getLavaConfiguracoesEmpresa } from "./lavagestor-configuracoes-data";
import { getLavaDashboard, normalizeLavaStatus } from "./lavagestor-data";
import { requireLavaGestorAccess } from "./lavagestor-permissions";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export const LAVA_AGENDAMENTO_STATUS = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "aguardando", label: "Aguardando" },
  { value: "compareceu", label: "Compareceu" },
  { value: "convertido", label: "Convertido" },
  { value: "cancelado", label: "Cancelado" },
  { value: "nao_compareceu", label: "Nao compareceu" }
];

export const LAVA_AUTOMACAO_TIPOS = [
  { value: "agradecimento", label: "Agradecimento" },
  { value: "pesquisa_satisfacao", label: "Pesquisa de satisfacao" },
  { value: "lembrete_retorno", label: "Lembrete de retorno" },
  { value: "cobranca_fiado", label: "Cobranca de fiado" },
  { value: "cliente_inativo", label: "Cliente inativo" },
  { value: "promocao", label: "Promocao" }
];

export const LAVA_ESTOQUE_MOVIMENTOS = [
  { value: "entrada", label: "Entrada" },
  { value: "saida_manual", label: "Saida manual" },
  { value: "ajuste", label: "Ajuste" },
  { value: "perda", label: "Perda" }
];

export async function getLavaPhase3Lookups(nextPath = "/lavagestor") {
  const { current } = await requireLavaGestorAccess(nextPath);
  const client = (await getSupabaseServer()) as any;
  const empresaId = current.empresaId;
  const [clientes, veiculos, servicos, funcionarios, lavagens] = await Promise.all([
    scopeEmpresa(client.from("lava_clientes").select("id,nome,telefone,email").order("nome").limit(500), empresaId),
    scopeEmpresa(client.from("lava_veiculos").select("id,cliente_id,placa,marca,modelo,cor,tipo").order("created_at", { ascending: false }).limit(500), empresaId),
    scopeEmpresa(client.from("lava_servicos").select("id,nome,preco,percentual_comissao,ativo,aplicacao,categoria").eq("ativo", true).order("nome").limit(500), empresaId),
    scopeEmpresa(client.from("lava_funcionarios").select("id,nome,percentual_comissao,ativo").eq("ativo", true).order("nome").limit(500), empresaId),
    scopeEmpresa(
      client
        .from("lava_lavagens")
        .select("id,cliente_id,veiculo_id,servico_id,valor,valor_final,valor_pendente,status,status_pagamento,data_lavagem,lava_clientes(nome),lava_veiculos(placa,marca,modelo,cor),lava_servicos(nome)")
        .order("data_lavagem", { ascending: false })
        .limit(300),
      empresaId
    )
  ]);

  return {
    current,
    clientes: (clientes.data ?? []) as Row[],
    veiculos: ((veiculos.data ?? []) as Row[]).map((row): Row => ({ ...row, veiculo: vehicleLabel(row) })),
    servicos: (servicos.data ?? []) as Row[],
    funcionarios: (funcionarios.data ?? []) as Row[],
    lavagens: ((lavagens.data ?? []) as Row[]).map((row): Row => ({
      ...row,
      cliente: relationName(row.lava_clientes),
      veiculo: vehicleLabel(row.lava_veiculos),
      servico: relationName(row.lava_servicos),
      valor: moneyNumber(row.valor_final ?? row.valor)
    })),
    error: firstError(clientes, veiculos, servicos, funcionarios, lavagens)
  };
}

export async function getLavaIAmobData() {
  const [{ config }, dashboard] = await Promise.all([getLavaConfiguracoesEmpresa("/lavagestor/iamob"), getLavaDashboard()]);
  const { current } = dashboard;
  const client = (await getSupabaseServer()) as any;
  const empresaId = current.empresaId;
  const todayStart = startOfDay(new Date()).toISOString();
  const tomorrowStart = addDays(startOfDay(new Date()), 1).toISOString();
  const thirtyDaysAgo = addDays(startOfDay(new Date()), -30).toISOString();

  const [agendamentos, produtos, cobrancas, automacoes, lavagens, logs, fotos] = await Promise.all([
    scopeEmpresa(client.from("lava_agendamentos").select("id,status,data_inicio").gte("data_inicio", todayStart).lt("data_inicio", tomorrowStart), empresaId),
    scopeEmpresa(client.from("lava_estoque_produtos").select("id,nome,estoque_atual,estoque_minimo,ativo").eq("ativo", true).limit(100), empresaId),
    scopeEmpresa(client.from("lava_cobrancas").select("id,status,valor").in("status", ["pendente", "erro"]).limit(100), empresaId),
    scopeEmpresa(client.from("lava_automacao_fila").select("id,status").in("status", ["pendente", "pronto"]).limit(100), empresaId),
    scopeEmpresa(
      client
        .from("lava_lavagens")
        .select("id,cliente_id,veiculo_id,servico_id,valor,valor_final,valor_pendente,status,status_pagamento,data_lavagem,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor),lava_servicos(nome)")
        .order("data_lavagem", { ascending: false })
        .limit(500),
      empresaId
    ),
    scopeEmpresa(client.from("lava_iamob_logs").select("*").order("created_at", { ascending: false }).limit(12), empresaId),
    scopeEmpresa(client.from("lava_checklist_fotos").select("id,lavagem_id,tipo,momento,storage_path,created_at").eq("momento", "entrada").order("created_at", { ascending: false }).limit(12), empresaId)
  ]);

  const produtoRows = (produtos.data ?? []) as Row[];
  const lowStock = produtoRows.filter((row) => Number(row.estoque_atual ?? 0) <= Number(row.estoque_minimo ?? 0));
  const washRows = ((lavagens.data ?? []) as Row[]).filter((row) => normalizeLavaStatus(row.status) !== "cancelado");
  const staleClients = buildStaleClients(washRows, thirtyDaysAgo);
  const recurringClients = buildRecurringClients(washRows);
  const serviceStats = countByRelationName(washRows, "lava_servicos");
  const weakServices = serviceStats.filter((item) => item.count <= 1).slice(0, 5);
  const bestServices = serviceStats.slice(0, 5);
  const openPayments = washRows.filter((row) => moneyNumber(row.valor_pendente) > 0 || ["aberto", "fiado", "parcial"].includes(String(row.status_pagamento)));
  const withoutCheckout = washRows.filter((row) => ["em_lavagem", "aguardando_finalizacao"].includes(normalizeLavaStatus(row.status)));
  const sample = washRows[0];
  const variables = {
    cliente: relationName(sample?.lava_clientes) || "cliente",
    empresa: config.nome_exibicao,
    veiculo: vehicleLabel(sample?.lava_veiculos),
    placa: vehicleField(sample?.lava_veiculos, "placa"),
    servico: relationName(sample?.lava_servicos) || "servico",
    valor: formatMoney(sample?.valor_final ?? sample?.valor ?? 0),
    data: formatDateShort(sample?.data_lavagem)
  };

  return {
    config,
    current,
    summary: {
      lavagensHoje: dashboard.lavagensHoje,
      faturamentoRecebido: dashboard.entradaHoje,
      pendencias: dashboard.pagamentosEmAberto,
      clientesAtendidos: dashboard.clientesAtendidosMes,
      agendamentosHoje: (agendamentos.data ?? []).length,
      estoqueBaixo: lowStock.length,
      cobrancasPendentes: (cobrancas.data ?? []).length,
      automacoesPendentes: (automacoes.data ?? []).length
    },
    recomendacoes: [
      ...staleClients.slice(0, 4).map((item) => ({ title: `${item.cliente} sem retorno`, detail: `Ultima lavagem em ${formatDateShort(item.data_lavagem)}. Sugira um lembrete pelo WhatsApp.`, href: "/lavagestor/pos-venda?f=sem_retorno_30" })),
      ...recurringClients.slice(0, 4).map((item) => ({ title: `${item.cliente} e recorrente`, detail: `${item.count} lavagens registradas. Boa oportunidade para pacote ou plano mensal.`, href: "/lavagestor/clientes" })),
      ...lowStock.slice(0, 4).map((item) => ({ title: `${item.nome} com estoque baixo`, detail: `Atual: ${item.estoque_atual ?? 0}. Minimo: ${item.estoque_minimo ?? 0}.`, href: "/lavagestor/estoque" })),
      openPayments.length ? { title: "Pagamentos em aberto", detail: `${openPayments.length} lavagem(ns) precisam de cobranca ou baixa.`, href: "/lavagestor/pagamentos" } : null,
      withoutCheckout.length ? { title: "Lavagens sem checkout", detail: `${withoutCheckout.length} lavagem(ns) precisam de finalizacao ou foto de checkout.`, href: "/lavagestor/fila" } : null,
      weakServices.length ? { title: "Servicos com baixa venda", detail: weakServices.map((item) => item.label).join(", "), href: "/lavagestor/servicos" } : null
    ].filter(Boolean) as Array<{ title: string; detail: string; href: string }>,
    mensagens: buildIAmobMessages(variables),
    atendimento: recurringClients.slice(0, 8),
    servicosMaisVendidos: bestServices,
    fotos: (fotos.data ?? []) as Row[],
    logs: (logs.data ?? []) as Row[],
    error: firstError(agendamentos, produtos, cobrancas, automacoes, lavagens, logs, fotos)
  };
}

export async function getLavaAgendamentosData(params: Record<string, string | string[] | undefined>) {
  const lookups = await getLavaPhase3Lookups("/lavagestor/agendamentos");
  const client = (await getSupabaseServer()) as any;
  const empresaId = lookups.current.empresaId;
  const periodo = firstParam(params.periodo) ?? "semana";
  const range = resolveAgendaRange(periodo);
  let query = scopeEmpresa(
    client
      .from("lava_agendamentos")
      .select("id,cliente_id,veiculo_id,servico_id,funcionario_id,titulo,data_inicio,data_fim,duracao_min,status,observacao,origem,lavagem_id,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor),lava_servicos(nome,preco),lava_funcionarios(nome)")
      .gte("data_inicio", range.start.toISOString())
      .lt("data_inicio", range.end.toISOString())
      .order("data_inicio", { ascending: true })
      .limit(300),
    empresaId
  );
  const status = firstParam(params.status);
  const funcionario = firstParam(params.funcionario);
  const servico = firstParam(params.servico);
  if (status) query = query.eq("status", status);
  if (funcionario) query = query.eq("funcionario_id", funcionario);
  if (servico) query = query.eq("servico_id", servico);
  const result = await query;
  const rows: Row[] = ((result.data ?? []) as Row[]).map(mapAgendamento);

  return {
    ...lookups,
    rows,
    range,
    filter: { periodo, status: status ?? "", funcionario: funcionario ?? "", servico: servico ?? "" },
    summary: {
      hoje: rows.filter((row) => sameDay(row.data_inicio, new Date())).length,
      confirmados: rows.filter((row) => row.status === "confirmado").length,
      pendentes: rows.filter((row) => ["agendado", "aguardando"].includes(String(row.status))).length,
      cancelados: rows.filter((row) => row.status === "cancelado").length,
      proximos7: rows.filter((row) => dateWithinDays(row.data_inicio, 7)).length
    },
    error: lookups.error ?? result.error?.message ?? null
  };
}

export async function getLavaEstoqueData() {
  const lookups = await getLavaPhase3Lookups("/lavagestor/estoque");
  const client = (await getSupabaseServer()) as any;
  const empresaId = lookups.current.empresaId;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [produtos, movimentos, insumos] = await Promise.all([
    scopeEmpresa(client.from("lava_estoque_produtos").select("*").order("nome").limit(500), empresaId),
    scopeEmpresa(client.from("lava_estoque_movimentos").select("*,lava_estoque_produtos(nome),lava_servicos(nome)").order("created_at", { ascending: false }).limit(200), empresaId),
    scopeEmpresa(client.from("lava_servico_insumos").select("*,lava_estoque_produtos(nome,unidade),lava_servicos(nome)").order("created_at", { ascending: false }).limit(300), empresaId)
  ]);
  const productRows = (produtos.data ?? []) as Row[];
  const movimentoRows: Row[] = ((movimentos.data ?? []) as Row[]).map((row): Row => ({
    ...row,
    produto: relationName(row.lava_estoque_produtos),
    servico: relationName(row.lava_servicos)
  }));
  const consumoMes = movimentoRows
    .filter((row) => String(row.created_at ?? "") >= monthStart && ["saida_manual", "baixa_servico", "perda"].includes(String(row.tipo)))
    .reduce((sum, row) => sum + Math.abs(moneyNumber(row.quantidade)) * moneyNumber(row.custo_unitario), 0);

  return {
    ...lookups,
    produtos: productRows,
    movimentos: movimentoRows,
    insumos: ((insumos.data ?? []) as Row[]).map((row): Row => ({
      ...row,
      produto: relationName(row.lava_estoque_produtos),
      unidade: relationObject(row.lava_estoque_produtos)?.unidade ?? "",
      servico: relationName(row.lava_servicos)
    })),
    summary: {
      totalProdutos: productRows.length,
      estoqueBaixo: productRows.filter((row) => Number(row.estoque_atual ?? 0) <= Number(row.estoque_minimo ?? 0)).length,
      valorEstoque: productRows.reduce((sum, row) => sum + moneyNumber(row.estoque_atual) * moneyNumber(row.custo_unitario), 0),
      consumoMes
    },
    error: lookups.error ?? firstError(produtos, movimentos, insumos)
  };
}

export async function getLavaPlacaData() {
  const lookups = await getLavaPhase3Lookups("/lavagestor/placa");
  const client = (await getSupabaseServer()) as any;
  const result = await scopeEmpresa(
    client.from("lava_placa_leituras").select("*,lava_veiculos(placa,marca,modelo,cor,lava_clientes(nome,telefone))").order("created_at", { ascending: false }).limit(100),
    lookups.current.empresaId
  );
  return {
    ...lookups,
    rows: ((result.data ?? []) as Row[]).map((row): Row => ({
      ...row,
      veiculo: vehicleLabel(row.lava_veiculos),
      cliente: relationName(relationObject(row.lava_veiculos)?.lava_clientes),
      whatsapp: relationPhone(relationObject(row.lava_veiculos)?.lava_clientes)
    })),
    error: lookups.error ?? result.error?.message ?? null
  };
}

export async function getLavaPagamentosIntegradosData() {
  const lookups = await getLavaPhase3Lookups("/lavagestor/pagamentos-integrados");
  const client = (await getSupabaseServer()) as any;
  const [integracoes, cobrancas] = await Promise.all([
    scopeEmpresa(client.from("lava_pagamento_integracoes").select("*").order("provider"), lookups.current.empresaId),
    scopeEmpresa(client.from("lava_cobrancas").select("*,lava_clientes(nome),lava_lavagens(id,lava_veiculos(placa,marca,modelo))").order("created_at", { ascending: false }).limit(200), lookups.current.empresaId)
  ]);
  const rows: Row[] = ((cobrancas.data ?? []) as Row[]).map((row): Row => ({
    ...row,
    cliente: relationName(row.lava_clientes),
    veiculo: vehicleLabel(relationObject(row.lava_lavagens)?.lava_veiculos)
  }));
  return {
    ...lookups,
    integracoes: (integracoes.data ?? []) as Row[],
    cobrancas: rows,
    summary: {
      pendentes: rows.filter((row) => row.status === "pendente").length,
      pagas: rows.filter((row) => row.status === "pago").length,
      vencidas: rows.filter((row) => row.status === "vencido").length,
      totalPendente: rows.filter((row) => row.status === "pendente").reduce((sum, row) => sum + moneyNumber(row.valor), 0)
    },
    error: lookups.error ?? firstError(integracoes, cobrancas)
  };
}

export async function getLavaNotasFiscaisData() {
  const lookups = await getLavaPhase3Lookups("/lavagestor/notas-fiscais");
  const client = (await getSupabaseServer()) as any;
  const [config, notas] = await Promise.all([
    scopeEmpresa(client.from("lava_nf_configuracoes").select("*").limit(1), lookups.current.empresaId),
    scopeEmpresa(client.from("lava_notas_fiscais").select("*,lava_clientes(nome),lava_lavagens(id,lava_veiculos(placa,marca,modelo))").order("created_at", { ascending: false }).limit(200), lookups.current.empresaId)
  ]);
  const rows: Row[] = ((notas.data ?? []) as Row[]).map((row): Row => ({
    ...row,
    cliente: relationName(row.lava_clientes),
    veiculo: vehicleLabel(relationObject(row.lava_lavagens)?.lava_veiculos)
  }));
  return {
    ...lookups,
    nfConfig: ((config.data ?? []) as Row[])[0] ?? null,
    notas: rows,
    summary: {
      rascunho: rows.filter((row) => row.status === "rascunho").length,
      emitidas: rows.filter((row) => row.status === "emitida").length,
      canceladas: rows.filter((row) => row.status === "cancelada").length,
      erro: rows.filter((row) => row.status === "erro").length
    },
    error: lookups.error ?? firstError(config, notas)
  };
}

export async function getLavaAutomacoesData() {
  const lookups = await getLavaPhase3Lookups("/lavagestor/automacoes");
  const client = (await getSupabaseServer()) as any;
  const [automacoes, fila] = await Promise.all([
    scopeEmpresa(client.from("lava_automacoes").select("*").order("created_at", { ascending: false }).limit(200), lookups.current.empresaId),
    scopeEmpresa(client.from("lava_automacao_fila").select("*,lava_clientes(nome,telefone),lava_lavagens(id,lava_veiculos(placa,marca,modelo))").order("created_at", { ascending: false }).limit(250), lookups.current.empresaId)
  ]);
  const filaRows: Row[] = ((fila.data ?? []) as Row[]).map((row): Row => ({
    ...row,
    cliente: relationName(row.lava_clientes),
    whatsapp: relationPhone(row.lava_clientes),
    veiculo: vehicleLabel(relationObject(row.lava_lavagens)?.lava_veiculos),
    whatsapp_url: whatsappUrl(relationPhone(row.lava_clientes), String(row.mensagem ?? ""))
  }));
  return {
    ...lookups,
    automacoes: (automacoes.data ?? []) as Row[],
    fila: filaRows,
    summary: {
      ativas: ((automacoes.data ?? []) as Row[]).filter((row) => row.ativo !== false).length,
      pendentes: filaRows.filter((row) => ["pendente", "pronto"].includes(String(row.status))).length,
      enviados: filaRows.filter((row) => row.status === "enviado_manual").length,
      cancelados: filaRows.filter((row) => row.status === "cancelado").length
    },
    error: lookups.error ?? firstError(automacoes, fila)
  };
}

function scopeEmpresa(query: any, empresaId: string | null) {
  return empresaId ? query.eq("empresa_id", empresaId) : query;
}

function firstError(...results: Array<{ error?: { message?: string } | null }>) {
  return results.map((result) => result.error?.message).find(Boolean) ?? null;
}

function mapAgendamento(row: Row): Row {
  return {
    ...row,
    cliente: relationName(row.lava_clientes),
    whatsapp: relationPhone(row.lava_clientes),
    veiculo: vehicleLabel(row.lava_veiculos),
    servico: relationName(row.lava_servicos),
    funcionario: relationName(row.lava_funcionarios),
    status_label: LAVA_AGENDAMENTO_STATUS.find((item) => item.value === row.status)?.label ?? String(row.status ?? "-")
  };
}

function buildIAmobMessages(variables: Record<string, string>) {
  const templates = [
    { tipo: "veiculo_pronto", label: "Veiculo pronto", text: "Ola, {cliente}! Seu veiculo {veiculo} esta pronto na {empresa}. Valor: {valor}." },
    { tipo: "pos_venda", label: "Pos-venda", text: "Ola, {cliente}! Obrigado por escolher a {empresa}. Como ficou o servico no {veiculo}?" },
    { tipo: "pesquisa", label: "Pesquisa de satisfacao", text: "Ola, {cliente}! De 0 a 10, qual nota voce da para o servico no {veiculo}?" },
    { tipo: "cobranca", label: "Cobranca de fiado", text: "Ola, {cliente}! Consta um valor em aberto de {valor}. Podemos combinar o pagamento?" },
    { tipo: "retorno", label: "Lembrete de retorno", text: "Ola, {cliente}! Ja faz um tempo desde a lavagem do {veiculo}. Podemos agendar um retorno?" },
    { tipo: "promocao", label: "Promocao", text: "Ola, {cliente}! A {empresa} tem uma condicao especial para {servico} nesta semana." }
  ];
  return templates.map((item) => ({ ...item, message: applyTemplate(item.text, variables) }));
}

function buildStaleClients(rows: Row[], thresholdIso: string) {
  const latest = new Map<string, Row>();
  for (const row of rows) {
    const key = String(row.cliente_id ?? "");
    if (!key || latest.has(key)) continue;
    latest.set(key, row);
  }
  return Array.from(latest.values())
    .filter((row) => String(row.data_lavagem ?? "") < thresholdIso)
    .map((row) => ({
      cliente: relationName(row.lava_clientes) || "Cliente",
      cliente_id: String(row.cliente_id ?? ""),
      veiculo: vehicleLabel(row.lava_veiculos),
      data_lavagem: row.data_lavagem
    }));
}

function buildRecurringClients(rows: Row[]) {
  const map = new Map<string, { cliente: string; cliente_id: string; count: number; ticket: number; last?: unknown; veiculo: string }>();
  for (const row of rows) {
    const key = String(row.cliente_id ?? "");
    if (!key) continue;
    const current = map.get(key) ?? {
      cliente: relationName(row.lava_clientes) || "Cliente",
      cliente_id: key,
      count: 0,
      ticket: 0,
      last: row.data_lavagem,
      veiculo: vehicleLabel(row.lava_veiculos)
    };
    current.count += 1;
    current.ticket += moneyNumber(row.valor_final ?? row.valor);
    if (String(row.data_lavagem ?? "") > String(current.last ?? "")) current.last = row.data_lavagem;
    map.set(key, current);
  }
  return Array.from(map.values())
    .filter((item) => item.count > 1)
    .map((item) => ({ ...item, ticket_medio: item.count ? item.ticket / item.count : 0 }))
    .sort((a, b) => b.count - a.count);
}

function countByRelationName(rows: Row[], key: string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = relationName(row[key]) || "Sem servico";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function resolveAgendaRange(periodo: string) {
  const now = startOfDay(new Date());
  if (periodo === "amanha") {
    const start = addDays(now, 1);
    return { start, end: addDays(start, 1), label: "Amanha" };
  }
  if (periodo === "mes") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1), label: "Mes" };
  }
  if (periodo === "hoje") {
    return { start: now, end: addDays(now, 1), label: "Hoje" };
  }
  return { start: now, end: addDays(now, 7), label: "Proximos 7 dias" };
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function sameDay(value: unknown, date: Date) {
  if (!value) return false;
  const target = new Date(String(value));
  return target.getFullYear() === date.getFullYear() && target.getMonth() === date.getMonth() && target.getDate() === date.getDate();
}

function dateWithinDays(value: unknown, days: number) {
  if (!value) return false;
  const date = new Date(String(value)).getTime();
  const now = Date.now();
  return Number.isFinite(date) && date >= now - 86400000 && date <= now + days * 86400000;
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
  const relation = relationObject(value) ?? (value as Row | null);
  if (!relation || typeof relation !== "object") return "-";
  const model = [relation.marca, relation.modelo].filter(Boolean).join(" ");
  return [relation.placa, model, relation.cor].filter(Boolean).join(" - ") || String(relation.tipo ?? "Item");
}

function moneyNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatDateShort(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "";
}

function applyTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

export function whatsappUrl(phone: unknown, message: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
