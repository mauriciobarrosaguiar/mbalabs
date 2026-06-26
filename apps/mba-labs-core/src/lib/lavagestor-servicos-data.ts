import { requireAppAccess } from "./core-data";
import { includesSearch } from "./form-utils";
import { getSupabaseServer } from "./supabase";

export const LAVA_SERVICE_TYPE_OPTIONS = [
  { label: "Lavagem", value: "lavagem" },
  { label: "Higienização", value: "higienizacao" },
  { label: "Polimento", value: "polimento" },
  { label: "Estética", value: "estetica" },
  { label: "Adicional", value: "adicional" },
  { label: "Outro", value: "outro" }
];

export const LAVA_SERVICE_APPLICATION_OPTIONS = [
  { label: "Carro", value: "carro" },
  { label: "Moto", value: "moto" },
  { label: "Caminhonete", value: "caminhonete" },
  { label: "Caminhão", value: "caminhao" },
  { label: "Sofá", value: "sofa" },
  { label: "Tapete", value: "tapete" },
  { label: "Máquina", value: "maquina" },
  { label: "Todos", value: "todos" },
  { label: "Outro", value: "outro" }
];

export const LAVA_SERVICE_CATEGORY_OPTIONS = [
  { label: "Serviço principal", value: "principal" },
  { label: "Serviço adicional", value: "adicional" },
  { label: "Pacote", value: "pacote" }
];

export type LavaServicoAvancadoRow = Record<string, unknown>;

export async function listLavaServicosAvancados(search = ""): Promise<{ rows: LavaServicoAvancadoRow[]; error: string | null }> {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_servicos")
    .select("id,nome,descricao,preco,percentual_comissao,ativo,tipo,aplicacao,categoria,adicional,tempo_estimado_min,ordem,created_at")
    .eq("empresa_id", current.empresaId)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true })
    .limit(300);

  const rows = ((data ?? []) as LavaServicoAvancadoRow[])
    .map((row): LavaServicoAvancadoRow => normalizeServico(row))
    .filter((row) => includesSearch(row, ["nome", "descricao", "tipo_label", "aplicacao_label", "categoria_label"], search));

  return { rows, error: error?.message ?? null };
}

export function serviceTypeLabel(value: unknown) {
  return optionLabel(LAVA_SERVICE_TYPE_OPTIONS, value) || "Lavagem";
}

export function serviceApplicationLabel(value: unknown) {
  return optionLabel(LAVA_SERVICE_APPLICATION_OPTIONS, value) || "Carro";
}

export function serviceCategoryLabel(value: unknown) {
  return optionLabel(LAVA_SERVICE_CATEGORY_OPTIONS, value) || "Serviço principal";
}

function normalizeServico(row: LavaServicoAvancadoRow): LavaServicoAvancadoRow {
  const tipo = String(row.tipo ?? "lavagem");
  const aplicacao = String(row.aplicacao ?? "carro");
  const categoria = String(row.categoria ?? (row.adicional ? "adicional" : "principal"));
  const adicional = Boolean(row.adicional ?? categoria === "adicional");

  return {
    ...row,
    tipo,
    aplicacao,
    categoria,
    adicional,
    tipo_label: serviceTypeLabel(tipo),
    aplicacao_label: serviceApplicationLabel(aplicacao),
    categoria_label: serviceCategoryLabel(categoria),
    adicional_label: adicional ? "Sim" : "Não"
  };
}

function optionLabel(options: Array<{ label: string; value: string }>, value: unknown) {
  const match = options.find((option) => option.value === String(value ?? ""));
  return match?.label ?? "";
}
