import { requireAppAccess } from "./core-data";
import { includesSearch } from "./form-utils";
import { getSupabaseServer } from "./supabase";

export const LAVA_STATUS_LABELS: Record<string, string> = {
  na_fila: "Na fila",
  em_lavagem: "Em lavagem",
  aguardando_finalizacao: "Aguardando finalização",
  finalizado: "Finalizado",
  cliente_avisado: "Cliente avisado",
  pago: "Pago",
  entregue: "Entregue",
  cancelado: "Cancelado"
};

export const LAVA_STATUS_OPTIONS = Object.entries(LAVA_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export const LAVA_PAYMENT_STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  parcial: "Parcial",
  pago: "Pago",
  fiado: "Fiado"
};

export const LAVA_PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  fiado: "Fiado"
};

export function normalizeLavaStatus(status: unknown) {
  const value = String(status ?? "na_fila");
  if (value === "aberta") return "na_fila";
  if (value === "em_andamento") return "em_lavagem";
  if (value === "finalizada") return "finalizado";
  if (value === "cancelada") return "cancelado";
  return value;
}

export async function getLavaDashboard() {
  const current = await requireAppAccess("lavagestor", "/lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const tomorrowStart = addDays(startOfDay(now), 1).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    clientes,
    veiculos,
    funcionarios,
    servicos,
    lavagens,
    comissoes,
    vales,
    lavagensHoje,
    lavagensMes,
    filaAtual,
    ultimasLavagens,
    comissoesPendentes,
    valesAbertos,
    empresa
  ] = await Promise.all([
    countByEmpresa(client, "lava_clientes", empresaId),
    countByEmpresa(client, "lava_veiculos", empresaId),
    countByEmpresa(client, "lava_funcionarios", empresaId, { ativo: true }),
    countByEmpresa(client, "lava_servicos", empresaId, { ativo: true }),
    countByEmpresa(client, "lava_lavagens", empresaId),
    countByEmpresa(client, "lava_comissoes", empresaId, { status: "pendente" }),
    countByEmpresa(client, "lava_vales", empresaId, { status: "aberto" }),
    scopedByEmpresa(
      client
        .from("lava_lavagens")
        .select("id,valor,valor_final,comissao,status,status_pagamento,data_lavagem")
        .gte("data_lavagem", todayStart)
        .lt("data_lavagem", tomorrowStart),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("lava_lavagens")
        .select("id,valor,valor_final,comissao,status,status_pagamento,data_lavagem")
        .gte("data_lavagem", monthStart),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("lava_lavagens")
        .select("id,valor,valor_final,status,status_pagamento")
        .in("status", [
          "aberta",
          "em_andamento",
          "finalizada",
          "na_fila",
          "em_lavagem",
          "aguardando_finalizacao",
          "finalizado",
          "cliente_avisado",
          "pago"
        ]),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("lava_lavagens")
        .select(
          "id,valor,comissao,status,data_lavagem,lava_clientes(nome),lava_veiculos(placa,modelo),lava_funcionarios(nome),lava_servicos(nome)"
        )
        .order("data_lavagem", { ascending: false })
        .limit(8),
      empresaId
    ),
    scopedByEmpresa(client.from("lava_comissoes").select("id,valor,status").eq("status", "pendente"), empresaId),
    scopedByEmpresa(client.from("lava_vales").select("id,valor,status").eq("status", "aberto"), empresaId),
    empresaId
      ? client.from("core_empresas").select("nome,nome_fantasia").eq("id", empresaId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const todayRows = ((lavagensHoje.data ?? []) as Array<Record<string, unknown>>).filter(isActiveLavagem);
  const monthRows = ((lavagensMes.data ?? []) as Array<Record<string, unknown>>).filter(isActiveLavagem);
  const filaRows = ((filaAtual.data ?? []) as Array<Record<string, unknown>>).filter(isActiveLavagem);
  const pendingCommissions = (comissoesPendentes.data ?? []) as Array<Record<string, unknown>>;
  const openVales = (valesAbertos.data ?? []) as Array<Record<string, unknown>>;
  const company = empresa.data as Record<string, unknown> | null;

  return {
    current,
    companyName:
      String(company?.nome_fantasia ?? company?.nome ?? "") ||
      (current.isAdminMaster ? "Todas as empresas" : "Empresa conectada"),
    isGlobalView: !empresaId && current.isAdminMaster,
    clientes,
    veiculos,
    funcionarios,
    servicos,
    lavagens,
    comissoes,
    vales,
    lavagensHoje: todayRows.length,
    entradaHoje: sumLavaValues(todayRows),
    comissaoHoje: sumMoney(todayRows, "comissao"),
    lavagensMes: monthRows.length,
    entradaMes: sumLavaValues(monthRows),
    comissaoMes: sumMoney(monthRows, "comissao"),
    veiculosNaFila: countByStatus(filaRows, ["na_fila"]),
    veiculosEmLavagem: countByStatus(filaRows, ["em_lavagem"]),
    finalizadosAguardandoRetirada: countByStatus(filaRows, ["aguardando_finalizacao", "finalizado", "cliente_avisado", "pago"]),
    pagamentosEmAberto: filaRows.filter((row) => {
      const paymentStatus = String(row.status_pagamento ?? "aberto");
      return paymentStatus === "aberto" || paymentStatus === "parcial" || paymentStatus === "fiado";
    }).length,
    totalComissoesPendentes: sumMoney(pendingCommissions, "valor"),
    totalValesAbertos: sumMoney(openVales, "valor"),
    ultimasLavagens: ((ultimasLavagens.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      cliente: relationName(row.lava_clientes) || "-",
      veiculo: vehicleLabel(row.lava_veiculos),
      funcionario: relationName(row.lava_funcionarios) || "-",
      servico: relationName(row.lava_servicos) || "-",
      valor: row.valor_final ?? row.valor,
      status: normalizeLavaStatus(row.status),
      status_label: LAVA_STATUS_LABELS[normalizeLavaStatus(row.status)] ?? String(row.status ?? "-"),
      data_lavagem: row.data_lavagem
    })),
    error:
      lavagensHoje.error?.message ??
      lavagensMes.error?.message ??
      filaAtual.error?.message ??
      ultimasLavagens.error?.message ??
      comissoesPendentes.error?.message ??
      valesAbertos.error?.message ??
      empresa.error?.message ??
      null
  };
}

export async function listLavaClientes(search = "") {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_clientes")
    .select("id,nome,telefone,email,documento,observacao,created_at")
    .eq("empresa_id", current.empresaId)
    .order("nome", { ascending: true })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) =>
    includesSearch(row, ["nome", "telefone", "email", "documento"], search)
  );

  return { rows, error: error?.message ?? null };
}

export async function listLavaVeiculos(search = "") {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_veiculos")
    .select("id,cliente_id,placa,modelo,marca,cor,tipo,observacao,created_at,lava_clientes(nome)")
    .eq("empresa_id", current.empresaId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => ({ ...row, cliente: relationName(row.lava_clientes) }))
    .filter((row) => includesSearch(row, ["placa", "modelo", "marca", "cliente"], search));

  return { rows, error: error?.message ?? null };
}

export async function listLavaFuncionarios(search = "") {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_funcionarios")
    .select("id,nome,telefone,percentual_comissao,ativo,created_at")
    .eq("empresa_id", current.empresaId)
    .order("nome", { ascending: true })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) =>
    includesSearch(row, ["nome", "telefone"], search)
  );

  return { rows, error: error?.message ?? null };
}

export async function listLavaServicos(search = "") {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_servicos")
    .select("id,nome,descricao,preco,percentual_comissao,ativo,created_at")
    .eq("empresa_id", current.empresaId)
    .order("nome", { ascending: true })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) =>
    includesSearch(row, ["nome", "descricao"], search)
  );

  return { rows, error: error?.message ?? null };
}

export async function getLavaLookups() {
  const [clientes, veiculos, funcionarios, servicos] = await Promise.all([
    listLavaClientes(),
    listLavaVeiculos(),
    listLavaFuncionarios(),
    listLavaServicos()
  ]);

  return {
    clientes: clientes.rows,
    veiculos: veiculos.rows,
    funcionarios: funcionarios.rows.filter((row) => row.ativo !== false),
    servicos: servicos.rows.filter((row) => row.ativo !== false)
  };
}

export async function listLavaLavagens(filters: { data?: string; funcionario?: string; status?: string } = {}) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_lavagens")
    .select(
      "id,cliente_id,veiculo_id,funcionario_id,servico_id,descricao_extra,observacoes,valor,valor_total,valor_desconto,valor_final,valor_recebido,valor_pendente,comissao,status,status_pagamento,forma_pagamento,data_lavagem,data_entrada,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor),lava_funcionarios(nome),lava_servicos(nome)"
    )
    .eq("empresa_id", current.empresaId)
    .order("data_lavagem", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => {
      const servico = relationName(row.lava_servicos);
      const extra = String(row.descricao_extra ?? "").trim();
      const servicosResumo = [servico, extra].filter(Boolean).join(" + ");

      return {
        ...row,
        cliente: relationName(row.lava_clientes),
        whatsapp: relationPhone(row.lava_clientes),
        veiculo: vehicleLabel(row.lava_veiculos),
        funcionario: relationName(row.lava_funcionarios),
        servico: servico || extra || "-",
        servicos_resumo: servicosResumo || "-",
        status: normalizeLavaStatus(row.status),
        status_label: LAVA_STATUS_LABELS[normalizeLavaStatus(row.status)] ?? String(row.status ?? "-"),
        status_pagamento_label:
          LAVA_PAYMENT_STATUS_LABELS[String(row.status_pagamento ?? "aberto")] ?? String(row.status_pagamento ?? "Aberto")
      };
    })
    .filter((row) => {
      const matchesDate = filters.data ? String(row.data_entrada ?? row.data_lavagem ?? "").startsWith(filters.data) : true;
      const matchesFuncionario = filters.funcionario ? row.funcionario_id === filters.funcionario : true;
      const matchesStatus = filters.status ? row.status === filters.status : true;
      return matchesDate && matchesFuncionario && matchesStatus;
    });

  return { rows, error: error?.message ?? null };
}

export async function listLavaFila() {
  const { rows, error } = await listLavaLavagens();
  const activeRows = rows.filter((row) => !["entregue", "cancelado"].includes(String(row.status)));

  return {
    rows: activeRows,
    error
  };
}

export async function listLavaPagamentos() {
  const { rows, error } = await listLavaLavagens();

  return {
    rows: rows.map<Record<string, unknown>>((row) => ({
      ...row,
      valor_final: row.valor_final ?? row.valor,
      valor_pendente: row.valor_pendente ?? Math.max(Number(row.valor_final ?? row.valor ?? 0) - Number(row.valor_recebido ?? 0), 0)
    })),
    error
  };
}

export async function listLavaComissoes(filters: { funcionario?: string; status?: string } = {}) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_comissoes")
    .select("id,funcionario_id,lavagem_id,valor,status,pago_em,created_at,lava_funcionarios(nome)")
    .eq("empresa_id", current.empresaId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      funcionario: relationName(row.lava_funcionarios)
    }))
    .filter((row) => {
      const matchesFuncionario = filters.funcionario ? row.funcionario_id === filters.funcionario : true;
      const matchesStatus = filters.status ? row.status === filters.status : true;
      return matchesFuncionario && matchesStatus;
    });

  return { rows, error: error?.message ?? null };
}

export async function listLavaVales(search = "") {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_vales")
    .select("id,funcionario_id,valor,descricao,data_vale,status,created_at,lava_funcionarios(nome)")
    .eq("empresa_id", current.empresaId)
    .order("data_vale", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => ({ ...row, funcionario: relationName(row.lava_funcionarios) }))
    .filter((row) => includesSearch(row, ["funcionario", "descricao", "status"], search));

  return { rows, error: error?.message ?? null };
}

async function countByEmpresa(
  client: any,
  table: string,
  empresaId: string | null,
  filters: Record<string, unknown> = {}
) {
  let query = scopedByEmpresa(client.from(table).select("id", { count: "exact", head: true }), empresaId);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const { count } = await query;
  return count ?? 0;
}

function scopedByEmpresa(query: any, empresaId: string | null) {
  return empresaId ? query.eq("empresa_id", empresaId) : query;
}

function sumMoney(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function sumLavaValues(rows: Array<Record<string, unknown>>) {
  return rows.reduce((total, row) => total + Number(row.valor_final ?? row.valor ?? 0), 0);
}

function countByStatus(rows: Array<Record<string, unknown>>, statuses: string[]) {
  return rows.filter((row) => statuses.includes(normalizeLavaStatus(row.status))).length;
}

function isActiveLavagem(row: Record<string, unknown>) {
  return normalizeLavaStatus(row.status) !== "cancelado";
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
  if (!relation || typeof relation !== "object") {
    return "-";
  }

  const veiculo = relation as { placa?: unknown; marca?: unknown; modelo?: unknown; cor?: unknown };
  const model = [veiculo.marca, veiculo.modelo].filter(Boolean).join(" ");
  return [veiculo.placa, model, veiculo.cor].filter(Boolean).join(" - ") || "-";
}
