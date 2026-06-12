import { requireAppAccess } from "./core-data";
import { includesSearch } from "./form-utils";
import { getSupabaseServer } from "./supabase";

export async function getLavaDashboard() {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const [clientes, veiculos, funcionarios, servicos, lavagens, comissoes, vales] = await Promise.all([
    countByEmpresa(client, "lava_clientes", current.empresaId),
    countByEmpresa(client, "lava_veiculos", current.empresaId),
    countByEmpresa(client, "lava_funcionarios", current.empresaId, { ativo: true }),
    countByEmpresa(client, "lava_servicos", current.empresaId, { ativo: true }),
    countByEmpresa(client, "lava_lavagens", current.empresaId),
    countByEmpresa(client, "lava_comissoes", current.empresaId, { status: "pendente" }),
    countByEmpresa(client, "lava_vales", current.empresaId, { status: "aberto" })
  ]);

  return { clientes, veiculos, funcionarios, servicos, lavagens, comissoes, vales };
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
      "id,cliente_id,veiculo_id,funcionario_id,servico_id,valor,comissao,status,data_lavagem,lava_clientes(nome),lava_veiculos(placa,modelo),lava_funcionarios(nome),lava_servicos(nome)"
    )
    .eq("empresa_id", current.empresaId)
    .order("data_lavagem", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      cliente: relationName(row.lava_clientes),
      veiculo: vehicleLabel(row.lava_veiculos),
      funcionario: relationName(row.lava_funcionarios),
      servico: relationName(row.lava_servicos)
    }))
    .filter((row) => {
      const matchesDate = filters.data ? String(row.data_lavagem ?? "").startsWith(filters.data) : true;
      const matchesFuncionario = filters.funcionario ? row.funcionario_id === filters.funcionario : true;
      const matchesStatus = filters.status ? row.status === filters.status : true;
      return matchesDate && matchesFuncionario && matchesStatus;
    });

  return { rows, error: error?.message ?? null };
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
  empresaId: string,
  filters: Record<string, unknown> = {}
) {
  let query = client.from(table).select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const { count } = await query;
  return count ?? 0;
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) {
    return String((relation as { nome?: unknown }).nome ?? "");
  }

  return "";
}

function vehicleLabel(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") {
    return "-";
  }

  const veiculo = relation as { placa?: unknown; modelo?: unknown };
  return [veiculo.placa, veiculo.modelo].filter(Boolean).join(" - ") || "-";
}
