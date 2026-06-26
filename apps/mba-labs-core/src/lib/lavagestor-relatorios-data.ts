import { requireAppAccess } from "./core-data";
import { getSupabaseServer } from "./supabase";
import { LAVA_PAYMENT_METHOD_LABELS, LAVA_PAYMENT_STATUS_LABELS, LAVA_STATUS_LABELS, normalizeLavaStatus } from "./lavagestor-data";

type Row = Record<string, unknown>;

type ReportFilters = {
  inicio?: string;
  fim?: string;
};

export async function getLavaRelatorio(filters: ReportFilters = {}) {
  const current = await requireAppAccess("lavagestor", "/lavagestor/relatorios");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;
  const period = resolvePeriod(filters.inicio, filters.fim);

  const [lavagensResult, comissoesResult, valesResult, empresaResult] = await Promise.all([
    client
      .from("lava_lavagens")
      .select("id,valor,valor_total,valor_desconto,valor_final,valor_recebido,valor_pendente,comissao,status,status_pagamento,forma_pagamento,data_lavagem,data_entrada,data_pagamento,data_entrega,lava_clientes(nome),lava_veiculos(placa,marca,modelo,cor),lava_funcionarios(nome),lava_servicos(nome)")
      .eq("empresa_id", empresaId)
      .order("data_entrada", { ascending: false })
      .limit(500),
    client
      .from("lava_comissoes")
      .select("id,funcionario_id,valor,status,pago_em,created_at,lava_funcionarios(nome)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("lava_vales")
      .select("id,funcionario_id,valor,descricao,data_vale,status,created_at,lava_funcionarios(nome)")
      .eq("empresa_id", empresaId)
      .order("data_vale", { ascending: false })
      .limit(500),
    empresaId
      ? client.from("core_empresas").select("nome,nome_fantasia").eq("id", empresaId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const lavagens = ((lavagensResult.data ?? []) as Row[])
    .map(mapLavagem)
    .filter((row) => inPeriod(row.data_ref, period.start, period.endExclusive));
  const comissoes = ((comissoesResult.data ?? []) as Row[])
    .map((row) => ({ ...row, funcionario: relationName(row.lava_funcionarios), valor: Number(row.valor ?? 0) }))
    .filter((row) => inPeriod(row.pago_em ?? row.created_at, period.start, period.endExclusive));
  const vales = ((valesResult.data ?? []) as Row[])
    .map((row) => ({ ...row, funcionario: relationName(row.lava_funcionarios), valor: Number(row.valor ?? 0) }))
    .filter((row) => inPeriod(row.data_vale ?? row.created_at, period.start, period.endExclusive));

  const activeLavagens = lavagens.filter((row) => row.status !== "cancelado");
  const paidLavagens = activeLavagens.filter((row) => row.status_pagamento === "pago");
  const openLavagens = activeLavagens.filter((row) => ["aberto", "parcial", "fiado"].includes(String(row.status_pagamento ?? "aberto")));
  const pendingComissoes = comissoes.filter((row) => String(row.status ?? "pendente") === "pendente");
  const paidComissoes = comissoes.filter((row) => String(row.status ?? "") === "pago");
  const openVales = vales.filter((row) => ["aberto", "parcial"].includes(String(row.status ?? "aberto")));
  const closedVales = vales.filter((row) => ["descontado", "cancelado"].includes(String(row.status ?? "")));
  const empresa = (empresaResult.data ?? {}) as Row;

  return {
    companyName: String(empresa.nome_fantasia ?? empresa.nome ?? "Empresa conectada"),
    filters: { inicio: period.inicio, fim: period.fim },
    cards: {
      lavagens: activeLavagens.length,
      lavagensPagas: paidLavagens.length,
      lavagensAbertas: openLavagens.length,
      entradaBruta: sum(activeLavagens, "valor_total", "valor"),
      descontos: sum(activeLavagens, "valor_desconto"),
      entradaLiquida: sum(activeLavagens, "valor_final", "valor"),
      recebido: sum(activeLavagens, "valor_recebido"),
      pendente: sum(activeLavagens, "valor_pendente"),
      comissoesPendentes: sum(pendingComissoes, "valor"),
      comissoesPagas: sum(paidComissoes, "valor"),
      valesAbertos: sum(openVales, "valor"),
      valesBaixados: sum(closedVales, "valor")
    },
    porPagamento: groupBy(activeLavagens, "forma_pagamento", (row) => String(row.forma_pagamento || "não informado"), LAVA_PAYMENT_METHOD_LABELS),
    porFuncionario: groupBy(activeLavagens, "funcionario", (row) => String(row.funcionario || "Sem funcionário")),
    porStatus: groupBy(activeLavagens, "status", (row) => String(row.status || "na_fila"), LAVA_STATUS_LABELS),
    porPagamentoStatus: groupBy(activeLavagens, "status_pagamento", (row) => String(row.status_pagamento || "aberto"), LAVA_PAYMENT_STATUS_LABELS),
    lavagens: activeLavagens.slice(0, 80),
    comissoes: comissoes.slice(0, 80),
    vales: vales.slice(0, 80),
    error: lavagensResult.error?.message ?? comissoesResult.error?.message ?? valesResult.error?.message ?? empresaResult.error?.message ?? null
  };
}

function mapLavagem(row: Row) {
  const status = normalizeLavaStatus(row.status);
  const statusPagamento = String(row.status_pagamento ?? "aberto");
  return {
    ...row,
    cliente: relationName(row.lava_clientes),
    veiculo: vehicleLabel(row.lava_veiculos),
    funcionario: relationName(row.lava_funcionarios),
    servico: relationName(row.lava_servicos),
    status,
    status_label: LAVA_STATUS_LABELS[status] ?? status,
    status_pagamento: statusPagamento,
    status_pagamento_label: LAVA_PAYMENT_STATUS_LABELS[statusPagamento] ?? statusPagamento,
    data_ref: row.data_entrada ?? row.data_lavagem,
    valor: Number(row.valor ?? 0),
    valor_total: Number(row.valor_total ?? row.valor ?? 0),
    valor_desconto: Number(row.valor_desconto ?? 0),
    valor_final: Number(row.valor_final ?? row.valor ?? 0),
    valor_recebido: Number(row.valor_recebido ?? 0),
    valor_pendente: Number(row.valor_pendente ?? 0),
    comissao: Number(row.comissao ?? 0)
  };
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
  return rows.reduce((total, row) => total + Number(row[primary] ?? (fallback ? row[fallback] : 0) ?? 0), 0);
}

function groupBy(rows: Row[], _key: string, valueGetter: (row: Row) => string, labels: Record<string, string> = {}) {
  const map = new Map<string, { label: string; quantidade: number; valor: number; recebido: number; pendente: number }>();
  for (const row of rows) {
    const raw = valueGetter(row);
    const label = labels[raw] ?? raw;
    const current = map.get(label) ?? { label, quantidade: 0, valor: 0, recebido: 0, pendente: 0 };
    current.quantidade += 1;
    current.valor += Number(row.valor_final ?? row.valor ?? 0);
    current.recebido += Number(row.valor_recebido ?? 0);
    current.pendente += Number(row.valor_pendente ?? 0);
    map.set(label, current);
  }
  return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) return String((relation as { nome?: unknown }).nome ?? "");
  return "";
}

function vehicleLabel(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return "-";
  const row = relation as { placa?: unknown; marca?: unknown; modelo?: unknown; cor?: unknown };
  return [row.placa, [row.marca, row.modelo].filter(Boolean).join(" "), row.cor].filter(Boolean).join(" - ") || "-";
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
