import { requireAppAccess, type CurrentUserProfile } from "./core-data";
import { requireLavaGestorFinanceAccess } from "./lavagestor-permissions";
import { getSupabaseServer } from "./supabase";

export type LavaCaixaTipo = "dia" | "mes";
type Row = Record<string, unknown>;

export type LavaCaixaPeriod = {
  tipo: LavaCaixaTipo;
  data: string;
  mes: string;
  inicio: string;
  fim: string;
  label: string;
  start: Date;
  endExclusive: Date;
};

export async function getLavaCaixa(filters: { tipo?: string; data?: string; mes?: string } = {}) {
  await requireLavaGestorFinanceAccess("/lavagestor/financeiro");
  const current = await requireAppAccess("lavagestor", "/lavagestor/financeiro");
  const client = (await getSupabaseServer()) as any;
  const period = resolveLavaCaixaPeriod(filters);

  const [resumo, empresaResult, fechamentoResult, historicoResult] = await Promise.all([
    calcularLavaCaixa(client, current, period),
    current.empresaId ? client.from("core_empresas").select("nome,nome_fantasia").eq("id", current.empresaId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    current.empresaId
      ? client
          .from("lava_caixa_fechamentos")
          .select("*")
          .eq("empresa_id", current.empresaId)
          .eq("periodo_tipo", period.tipo)
          .eq("periodo_inicio", period.inicio)
          .eq("periodo_fim", period.fim)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    current.empresaId
      ? client
          .from("lava_caixa_fechamentos")
          .select("*")
          .eq("empresa_id", current.empresaId)
          .order("periodo_inicio", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [], error: null })
  ]);

  const empresa = (empresaResult.data ?? {}) as Row;
  return {
    current,
    companyName: String(empresa.nome_fantasia ?? empresa.nome ?? "Empresa conectada"),
    period,
    resumo,
    fechamento: (fechamentoResult.data ?? null) as Row | null,
    historico: (historicoResult.data ?? []) as Row[],
    error:
      resumo.error ??
      empresaResult.error?.message ??
      friendlyMissingTableError(fechamentoResult.error?.message) ??
      friendlyMissingTableError(historicoResult.error?.message) ??
      null
  };
}

export async function calcularLavaCaixa(client: any, current: CurrentUserProfile, period: LavaCaixaPeriod) {
  const empresaId = current.empresaId;
  const startIso = period.start.toISOString();
  const endIso = period.endExclusive.toISOString();

  const [pagamentosResult, lavagensResult, comissoesResult, valeMovimentosResult] = await Promise.all([
    scopedByEmpresa(
      client
        .from("lava_pagamentos")
        .select("id,lavagem_id,valor,forma_pagamento,data_pagamento,observacoes,lava_lavagens(id,status,status_pagamento,valor_final,valor_pendente,lava_clientes(nome),lava_veiculos(placa,marca,modelo,cor))")
        .gte("data_pagamento", startIso)
        .lt("data_pagamento", endIso)
        .order("data_pagamento", { ascending: false })
        .limit(700),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("lava_lavagens")
        .select("id,status,status_pagamento,valor_final,valor_pendente,data_entrada,data_lavagem,lava_clientes(nome),lava_veiculos(placa,marca,modelo,cor)")
        .gte("data_entrada", startIso)
        .lt("data_entrada", endIso)
        .order("data_entrada", { ascending: false })
        .limit(700),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("lava_comissoes")
        .select("id,funcionario_id,valor,status,pago_em,lava_funcionarios(nome)")
        .eq("status", "pago")
        .gte("pago_em", startIso)
        .lt("pago_em", endIso)
        .order("pago_em", { ascending: false })
        .limit(700),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("lava_vale_movimentos")
        .select("id,valor_descontado,tipo,created_at,lava_funcionarios(nome)")
        .eq("tipo", "desconto")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(700),
      empresaId
    )
  ]);

  const pagamentos = ((pagamentosResult.data ?? []) as Row[]).map(mapPagamento);
  const lavagens = ((lavagensResult.data ?? []) as Row[]).filter((row) => String(row.status ?? "") !== "cancelado");
  const comissoes = ((comissoesResult.data ?? []) as Row[]).map((row) => ({ ...row, valor: moneyNumber(row.valor), funcionario: relationName(row.lava_funcionarios) }));
  const valeMovimentos = ((valeMovimentosResult.data ?? []) as Row[]).map((row) => ({ ...row, valor_descontado: moneyNumber(row.valor_descontado), funcionario: relationName(row.lava_funcionarios) }));
  const porForma = groupPagamento(pagamentos);
  const totalRecebido = sum(pagamentos, "valor");
  const totalComissoesPagas = sum(comissoes, "valor");
  const totalValesBaixados = sum(valeMovimentos, "valor_descontado");
  const totalFiado = sum(lavagens.filter((row) => String(row.status_pagamento ?? "") === "fiado"), "valor_pendente");
  const totalPendente = sum(lavagens.filter((row) => ["aberto", "parcial", "fiado"].includes(String(row.status_pagamento ?? "aberto"))), "valor_pendente");
  const caixaReal = roundMoney(totalRecebido - totalComissoesPagas - totalValesBaixados);

  return {
    cards: {
      totalRecebido,
      totalDinheiro: porForma.dinheiro,
      totalPix: porForma.pix,
      totalCartao: porForma.cartao,
      totalOutros: porForma.outros,
      totalFiado,
      totalPendente,
      totalComissoesPagas,
      totalValesBaixados,
      caixaReal,
      pagamentos: pagamentos.length,
      lavagens: lavagens.length,
      comissoesPagas: comissoes.length,
      valesBaixados: valeMovimentos.length
    },
    porForma: [
      { key: "dinheiro", label: "Dinheiro", total: porForma.dinheiro },
      { key: "pix", label: "Pix", total: porForma.pix },
      { key: "cartao", label: "Cartão", total: porForma.cartao },
      { key: "outros", label: "Outros", total: porForma.outros }
    ],
    pagamentos: pagamentos.slice(0, 40),
    comissoes: comissoes.slice(0, 20),
    valeMovimentos: valeMovimentos.slice(0, 20),
    error: pagamentosResult.error?.message ?? lavagensResult.error?.message ?? comissoesResult.error?.message ?? valeMovimentosResult.error?.message ?? null
  };
}

export function resolveLavaCaixaPeriod(filters: { tipo?: string; data?: string; mes?: string } = {}): LavaCaixaPeriod {
  const tipo: LavaCaixaTipo = filters.tipo === "mes" ? "mes" : "dia";
  const now = new Date();

  if (tipo === "mes") {
    const mes = /^\d{4}-\d{2}$/.test(String(filters.mes ?? "")) ? String(filters.mes) : toMonthInput(now);
    const [year, month] = mes.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const endExclusive = new Date(year, month, 1);
    return {
      tipo,
      data: toDateInput(start),
      mes,
      inicio: toDateInput(start),
      fim: toDateInput(end),
      label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      start,
      endExclusive
    };
  }

  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(filters.data ?? "")) ? String(filters.data) : toDateInput(now);
  const start = new Date(`${data}T00:00:00`);
  const endExclusive = new Date(start);
  endExclusive.setDate(start.getDate() + 1);
  return {
    tipo,
    data,
    mes: data.slice(0, 7),
    inicio: data,
    fim: data,
    label: start.toLocaleDateString("pt-BR", { dateStyle: "full" }),
    start,
    endExclusive
  };
}

function mapPagamento(row: Row): Row {
  const lavagem = relationObject(row.lava_lavagens);
  return {
    ...row,
    valor: moneyNumber(row.valor),
    forma_pagamento: normalizeForma(row.forma_pagamento),
    forma_label: formaLabel(normalizeForma(row.forma_pagamento)),
    cliente: relationName(lavagem?.lava_clientes),
    veiculo: vehicleLabel(lavagem?.lava_veiculos),
    status_pagamento: String(lavagem?.status_pagamento ?? "")
  };
}

function groupPagamento(rows: Row[]) {
  return rows.reduce<Record<"dinheiro" | "pix" | "cartao" | "outros", number>>(
    (totals, row) => {
      const forma = normalizeForma(row.forma_pagamento);
      totals[forma] += moneyNumber(row.valor);
      return totals;
    },
    { dinheiro: 0, pix: 0, cartao: 0, outros: 0 }
  );
}

function normalizeForma(value: unknown): "dinheiro" | "pix" | "cartao" | "outros" {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("dinheiro")) return "dinheiro";
  if (raw.includes("pix")) return "pix";
  if (raw.includes("cartao") || raw.includes("cartão")) return "cartao";
  return "outros";
}

export function formaLabel(value: unknown) {
  const forma = normalizeForma(value);
  if (forma === "dinheiro") return "Dinheiro";
  if (forma === "pix") return "Pix";
  if (forma === "cartao") return "Cartão";
  return "Outros";
}

function scopedByEmpresa(query: any, empresaId: string | null) {
  return empresaId ? query.eq("empresa_id", empresaId) : query;
}

function relationObject(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] ?? null) as Row | null;
  return value && typeof value === "object" ? value as Row : null;
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  return relation ? String(relation.nome ?? "") : "";
}

function vehicleLabel(value: unknown) {
  const relation = relationObject(value);
  if (!relation) return "-";
  const model = [relation.marca, relation.modelo].filter(Boolean).join(" ");
  return [relation.placa, model, relation.cor].filter(Boolean).join(" - ") || "-";
}

function sum(rows: Row[], key: string) {
  return roundMoney(rows.reduce((total, row) => total + moneyNumber(row[key]), 0));
}

export function moneyNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function friendlyMissingTableError(message?: string) {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("lava_caixa_fechamentos") || lower.includes("could not find the table")) {
    return "A tabela de fechamento de caixa ainda não foi aplicada no Supabase. Rode a migration lava_caixa_fechamentos.";
  }
  return message;
}
