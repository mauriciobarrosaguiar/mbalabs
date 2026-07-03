import { requireAppAccess } from "./core-data";
import { getSupabaseServer } from "./supabase";
import { LAVA_PAYMENT_METHOD_LABELS, LAVA_PAYMENT_STATUS_LABELS, LAVA_STATUS_LABELS, normalizeLavaStatus } from "./lavagestor-data";

type Row = Record<string, unknown>;

type ReportFilters = { inicio?: string; fim?: string };

export async function getLavaRelatorio(filters: ReportFilters = {}) {
  const current = await requireAppAccess("lavagestor", "/lavagestor/relatorios");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;
  const period = resolvePeriod(filters.inicio, filters.fim);

  const [lavagensResult, comissoesResult, valesResult, movimentosResult, empresaResult] = await Promise.all([
    client
      .from("lava_lavagens")
      .select("id,valor,valor_total,valor_desconto,valor_final,valor_recebido,valor_pendente,comissao,status,status_pagamento,forma_pagamento,data_lavagem,data_entrada,data_pagamento,data_entrega,lava_clientes(nome),lava_veiculos(placa,marca,modelo,cor),lava_funcionarios(nome),lava_servicos(nome)")
      .eq("empresa_id", empresaId)
      .order("data_entrada", { ascending: false })
      .limit(700),
    client
      .from("lava_comissoes")
      .select("id,funcionario_id,lavagem_id,valor,status,pago_em,created_at,lava_funcionarios(nome)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(700),
    client
      .from("lava_vales")
      .select("id,funcionario_id,valor,valor_descontado,descricao,data_vale,status,created_at,lava_funcionarios(nome)")
      .eq("empresa_id", empresaId)
      .order("data_vale", { ascending: false })
      .limit(700),
    client
      .from("lava_vale_movimentos")
      .select("id,vale_id,funcionario_id,valor_descontado,saldo_antes,saldo_depois,tipo,observacao,created_at,lava_funcionarios(nome)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(700),
    empresaId ? client.from("core_empresas").select("nome,nome_fantasia").eq("id", empresaId).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);

  const lavagens: Row[] = ((lavagensResult.data ?? []) as Row[])
    .map(mapLavagem)
    .filter((row) => inPeriod(row.data_ref, period.start, period.endExclusive));
  const comissoes: Row[] = ((comissoesResult.data ?? []) as Row[])
    .map((row): Row => ({ ...row, funcionario: relationName(row.lava_funcionarios), valor: moneyNumber(row.valor) }))
    .filter((row) => inPeriod(row.pago_em ?? row.created_at, period.start, period.endExclusive));
  const movimentos: Row[] = movimentosResult.error
    ? []
    : ((movimentosResult.data ?? []) as Row[]).map((row): Row => ({
        ...row,
        funcionario: relationName(row.lava_funcionarios),
        valor_descontado: moneyNumber(row.valor_descontado),
        saldo_antes: moneyNumber(row.saldo_antes),
        saldo_depois: moneyNumber(row.saldo_depois)
      }));
  const valesAll: Row[] = ((valesResult.data ?? []) as Row[]).map((row): Row => {
    const valorOriginal = moneyNumber(row.valor);
    const valorDescontado = moneyNumber(row.valor_descontado);
    const saldoRestante = Math.max(valorOriginal - valorDescontado, 0);
    const valeId = String(row.id ?? "");
    return {
      ...row,
      funcionario: relationName(row.lava_funcionarios),
      valor: valorOriginal,
      valor_original: valorOriginal,
      valor_descontado: valorDescontado,
      saldo_restante: saldoRestante,
      movimentos: movimentos.filter((movimento) => String(movimento.vale_id ?? "") === valeId)
    };
  });
  const vales: Row[] = valesAll.filter((row) => inPeriod(row.data_vale ?? row.created_at, period.start, period.endExclusive) || moneyNumber(row.saldo_restante) > 0);

  const activeLavagens = lavagens.filter((row) => String(row.status ?? "") !== "cancelado");
  const paidLavagens = activeLavagens.filter((row) => String(row.status_pagamento ?? "") === "pago");
  const openLavagens = activeLavagens.filter((row) => ["aberto", "parcial", "fiado", ""].includes(String(row.status_pagamento ?? "aberto")));
  const pendingComissoes = comissoes.filter((row) => String(row.status ?? "pendente") === "pendente");
  const paidComissoes = comissoes.filter((row) => String(row.status ?? "") === "pago");
  const canceledComissoes = comissoes.filter((row) => String(row.status ?? "") === "cancelado");
  const openVales = vales.filter((row) => ["aberto", "parcial"].includes(String(row.status ?? "aberto")) && moneyNumber(row.saldo_restante) > 0);
  const closedVales = vales.filter((row) => ["descontado", "cancelado"].includes(String(row.status ?? "")) || moneyNumber(row.saldo_restante) <= 0);
  const empresa = (empresaResult.data ?? {}) as Row;

  const recebido = sum(activeLavagens, "valor_recebido");
  const comissoesPagas = sum(paidComissoes, "valor");
  const valesBaixados = sum(vales, "valor_descontado");
  const valesAbertos = sum(openVales, "saldo_restante");
  const caixaReal = recebido - comissoesPagas - valesBaixados;

  return {
    companyName: String(empresa.nome_fantasia ?? empresa.nome ?? "Empresa conectada"),
    generatedAt: new Date().toISOString(),
    filters: { inicio: period.inicio, fim: period.fim },
    cards: {
      lavagens: activeLavagens.length,
      lavagensPagas: paidLavagens.length,
      lavagensAbertas: openLavagens.length,
      entradaBruta: sum(activeLavagens, "valor_total", "valor"),
      descontos: sum(activeLavagens, "valor_desconto"),
      entradaLiquida: sum(activeLavagens, "valor_final", "valor"),
      recebido,
      pendente: sum(activeLavagens, "valor_pendente"),
      comissoesPendentes: sum(pendingComissoes, "valor"),
      comissoesPagas,
      comissoesCanceladas: sum(canceledComissoes, "valor"),
      valesAbertos,
      valesBaixados,
      caixaReal,
      saldoPrevistoAposVales: caixaReal - valesAbertos
    },
    alertas: buildAlertas(openLavagens, activeLavagens, openVales),
    porPagamento: groupBy(activeLavagens, (row) => String(row.forma_pagamento || "não informado"), LAVA_PAYMENT_METHOD_LABELS),
    porFuncionario: groupFuncionario(activeLavagens, comissoes, vales),
    porStatus: groupBy(activeLavagens, (row) => String(row.status || "na_fila"), LAVA_STATUS_LABELS),
    porPagamentoStatus: groupBy(activeLavagens, (row) => String(row.status_pagamento || "aberto"), LAVA_PAYMENT_STATUS_LABELS),
    lavagens: activeLavagens.slice(0, 120),
    comissoesResumo: groupComissoes(comissoes),
    comissoes: comissoes.slice(0, 120),
    vales: vales.slice(0, 120),
    valeMovimentos: movimentos.slice(0, 120),
    error: lavagensResult.error?.message ?? comissoesResult.error?.message ?? valesResult.error?.message ?? empresaResult.error?.message ?? null
  };
}

function mapLavagem(row: Row): Row {
  const status = normalizeLavaStatus(row.status);
  const statusPagamento = String(row.status_pagamento ?? "aberto");
  return {
    ...row,
    cliente: relationName(row.lava_clientes),
    veiculo: vehicleLabel(row.lava_veiculos),
    placa: vehicleField(row.lava_veiculos, "placa"),
    funcionario: relationName(row.lava_funcionarios),
    servico: relationName(row.lava_servicos),
    status,
    status_label: LAVA_STATUS_LABELS[status] ?? status,
    status_pagamento: statusPagamento,
    status_pagamento_label: LAVA_PAYMENT_STATUS_LABELS[statusPagamento] ?? statusPagamento,
    data_ref: row.data_entrada ?? row.data_lavagem,
    valor: moneyNumber(row.valor),
    valor_total: moneyNumber(row.valor_total ?? row.valor),
    valor_desconto: moneyNumber(row.valor_desconto),
    valor_final: moneyNumber(row.valor_final ?? row.valor),
    valor_recebido: moneyNumber(row.valor_recebido),
    valor_pendente: moneyNumber(row.valor_pendente),
    comissao: moneyNumber(row.comissao)
  };
}

function buildAlertas(openLavagens: Row[], lavagens: Row[], openVales: Row[]) {
  const alerts: Row[] = [];
  const pendente = sum(openLavagens, "valor_pendente");
  const semForma = lavagens.filter((row) => !row.forma_pagamento && String(row.status_pagamento ?? "") === "pago").length;
  const valesAbertos = sum(openVales, "saldo_restante");
  if (pendente > 0) alerts.push({ prioridade: "Alta", alerta: `${formatMoneyLocal(pendente)} em aberto`, acao: `Cobrar ou baixar ${openLavagens.length} lavagem(ns) sem pagamento.`, impacto: "Melhora o caixa" });
  if (semForma > 0) alerts.push({ prioridade: "Média", alerta: `${semForma} pagamento(s) sem forma`, acao: "Informar Pix, cartão, dinheiro ou fiado ao registrar pagamento.", impacto: "Fecha melhor" });
  if (valesAbertos > 0) alerts.push({ prioridade: "Média", alerta: `Vale aberto de ${formatMoneyLocal(valesAbertos)}`, acao: "Abater os vales antes de pagar novas comissões.", impacto: "Evita duplicidade" });
  return alerts;
}

function groupComissoes(comissoes: Row[]) {
  const map = new Map<string, Row>();
  for (const row of comissoes) {
    const key = String(row.funcionario || "Sem funcionário");
    const current = map.get(key) ?? { funcionario: key, pagas: 0, pendentes: 0, canceladas: 0, total_valido: 0 };
    const value = moneyNumber(row.valor);
    const status = String(row.status ?? "pendente");
    if (status === "pago") current.pagas = moneyNumber(current.pagas) + value;
    if (status === "pendente") current.pendentes = moneyNumber(current.pendentes) + value;
    if (status === "cancelado") current.canceladas = moneyNumber(current.canceladas) + value;
    current.total_valido = moneyNumber(current.pagas) + moneyNumber(current.pendentes);
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => String(a.funcionario).localeCompare(String(b.funcionario)));
}

function groupFuncionario(lavagens: Row[], comissoes: Row[], vales: Row[]) {
  const names = new Set<string>();
  lavagens.forEach((row) => names.add(String(row.funcionario || "Sem funcionário")));
  comissoes.forEach((row) => names.add(String(row.funcionario || "Sem funcionário")));
  vales.forEach((row) => names.add(String(row.funcionario || "Sem funcionário")));
  return Array.from(names).sort().map((nome) => {
    const lavagensFuncionario = lavagens.filter((row) => String(row.funcionario || "Sem funcionário") === nome);
    const comissoesFuncionario = comissoes.filter((row) => String(row.funcionario || "Sem funcionário") === nome);
    const valesFuncionario = vales.filter((row) => String(row.funcionario || "Sem funcionário") === nome);
    const comissoesPendentes = sum(comissoesFuncionario.filter((row) => String(row.status ?? "") === "pendente"), "valor");
    const valesAbertos = sum(valesFuncionario.filter((row) => ["aberto", "parcial"].includes(String(row.status ?? "aberto"))), "saldo_restante");
    return {
      label: nome,
      quantidade: lavagensFuncionario.length,
      valor: sum(lavagensFuncionario, "valor_final", "valor"),
      recebido: sum(lavagensFuncionario, "valor_recebido"),
      pendente: sum(lavagensFuncionario, "valor_pendente"),
      comissoes_pagas: sum(comissoesFuncionario.filter((row) => String(row.status ?? "") === "pago"), "valor"),
      comissoes_pendentes: comissoesPendentes,
      vales_abertos: valesAbertos,
      saldo_a_pagar: comissoesPendentes - valesAbertos
    };
  });
}

function resolvePeriod(inicio?: string, fim?: string) {
  const now = new Date();
  const startDefault = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDefault = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const start = inicio ? new Date(`${inicio}T00:00:00`) : startDefault;
  const end = fim ? new Date(`${fim}T00:00:00`) : endDefault;
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { inicio: toDateInput(start), fim: toDateInput(end), start, endExclusive };
}

function inPeriod(value: unknown, start: Date, endExclusive: Date) {
  if (!value) return false;
  const date = new Date(String(value));
  return !Number.isNaN(date.getTime()) && date >= start && date < endExclusive;
}

function sum(rows: Row[], primary: string, fallback?: string) {
  return rows.reduce((total, row) => total + moneyNumber(row[primary] ?? (fallback ? row[fallback] : 0)), 0);
}

function groupBy(rows: Row[], valueGetter: (row: Row) => string, labels: Record<string, string> = {}) {
  const map = new Map<string, { label: string; quantidade: number; valor: number; recebido: number; pendente: number }>();
  for (const row of rows) {
    const raw = valueGetter(row);
    const label = labels[raw] ?? raw;
    const current = map.get(label) ?? { label, quantidade: 0, valor: 0, recebido: 0, pendente: 0 };
    current.quantidade += 1;
    current.valor += moneyNumber(row.valor_final ?? row.valor);
    current.recebido += moneyNumber(row.valor_recebido);
    current.pendente += moneyNumber(row.valor_pendente);
    map.set(label, current);
  }
  return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) return String((relation as { nome?: unknown }).nome ?? "");
  return "";
}

function vehicleField(value: unknown, key: "placa" | "marca" | "modelo" | "cor") {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return "";
  return String((relation as Record<string, unknown>)[key] ?? "");
}

function vehicleLabel(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return "-";
  const row = relation as { placa?: unknown; marca?: unknown; modelo?: unknown; cor?: unknown };
  return [row.placa, [row.marca, row.modelo].filter(Boolean).join(" "), row.cor].filter(Boolean).join(" - ") || "-";
}

function moneyNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoneyLocal(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
