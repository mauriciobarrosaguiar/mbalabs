import { requireLavaGestorAccess } from "./lavagestor-permissions";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export function normalizePlate(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
}

export async function searchVehicleByPlate(plate: string) {
  const { current } = await requireLavaGestorAccess("/lavagestor/placa");
  const client = (await getSupabaseServer()) as any;
  const normalized = normalizePlate(plate);
  if (!normalized) return { vehicle: null, error: null };

  const { data, error } = await client
    .from("lava_veiculos")
    .select("id,cliente_id,placa,marca,modelo,cor,tipo,lava_clientes(nome,telefone)")
    .eq("empresa_id", current.empresaId)
    .ilike("placa", `%${normalized}%`)
    .limit(1)
    .maybeSingle();

  return {
    vehicle: data ? ({ ...(data as Row), veiculo: vehicleLabel(data), cliente: relationName((data as Row).lava_clientes) } as Row) : null,
    error: error?.message ?? null
  };
}

export async function createPlateReading(input: {
  empresaId: string | null;
  usuarioId: string;
  storagePath?: string | null;
  placaDetectada?: string | null;
  placaConfirmada?: string | null;
  veiculoId?: string | null;
  status?: string;
}) {
  const client = (await getSupabaseServer()) as any;
  const { data, error } = await client
    .from("lava_placa_leituras")
    .insert({
      empresa_id: input.empresaId,
      usuario_id: input.usuarioId,
      storage_path: input.storagePath ?? null,
      placa_detectada: input.placaDetectada ? normalizePlate(input.placaDetectada) : null,
      placa_confirmada: input.placaConfirmada ? normalizePlate(input.placaConfirmada) : null,
      veiculo_id: input.veiculoId ?? null,
      provider: "manual",
      status: input.status ?? "manual",
      erro: null
    })
    .select("id")
    .single();

  return { id: data?.id ? String(data.id) : "", error: error?.message ?? null };
}

export async function processPlateImage() {
  return {
    provider: "manual",
    status: "manual",
    message: "Reconhecimento automatico ainda nao configurado. Digite a placa manualmente."
  };
}

export async function confirmPlateReading(readingId: string, plate: string) {
  const { current } = await requireLavaGestorAccess("/lavagestor/placa");
  const client = (await getSupabaseServer()) as any;
  const normalized = normalizePlate(plate);
  const found = await searchVehicleByPlate(normalized);
  const { error } = await client
    .from("lava_placa_leituras")
    .update({
      placa_confirmada: normalized,
      veiculo_id: found.vehicle?.["id"] ?? null,
      status: "confirmada",
      updated_at: new Date().toISOString()
    })
    .eq("id", readingId)
    .eq("empresa_id", current.empresaId);

  return { vehicle: found.vehicle, error: error?.message ?? found.error ?? null };
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Row) : null;
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  return relation ? String(relation.nome ?? "") : "";
}

function vehicleLabel(value: unknown) {
  const relation = relationObject(value) ?? (value as Row | null);
  if (!relation || typeof relation !== "object") return "-";
  const model = [relation.marca, relation.modelo].filter(Boolean).join(" ");
  return [relation.placa, model, relation.cor].filter(Boolean).join(" - ") || String(relation.tipo ?? "Item");
}
