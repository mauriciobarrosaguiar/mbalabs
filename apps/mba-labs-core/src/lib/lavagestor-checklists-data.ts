import { requireLavaGestorAccess } from "./lavagestor-permissions";
import { getSupabaseServer } from "./supabase";

export const LAVA_CHECKLIST_BUCKET = "lava-checklists";

export const LAVA_CHECKLIST_PHOTO_TYPES = [
  { value: "frente", label: "Frente" },
  { value: "traseira", label: "Traseira" },
  { value: "lateral_esquerda", label: "Lateral esquerda" },
  { value: "lateral_direita", label: "Lateral direita" },
  { value: "interior", label: "Interior" },
  { value: "painel_km", label: "Painel / KM" },
  { value: "avaria", label: "Avaria" },
  { value: "antes", label: "Antes" },
  { value: "depois", label: "Depois" },
  { value: "outras", label: "Outras" }
];

type Row = Record<string, unknown>;

export async function getLavaChecklistPageData(lavagemId: string) {
  const { current } = await requireLavaGestorAccess(`/lavagestor/checklists/${lavagemId}`);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;

  const lavagemResult = await client
    .from("lava_lavagens")
    .select("id,empresa_id,cliente_id,veiculo_id,funcionario_id,servico_id,status,status_pagamento,observacoes,data_entrada,data_lavagem,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor,tipo),lava_funcionarios(nome),lava_servicos(nome)")
    .eq("id", lavagemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (lavagemResult.error || !lavagemResult.data) {
    return { lavagem: null, checklist: null, servicos: [], fotos: [], error: lavagemResult.error?.message ?? "Lavagem nao encontrada." };
  }

  const checklist = await ensureChecklistForLavagem(client, current, lavagemResult.data as Row);
  const [servicosResult, checklistServicosResult, fotosResult] = await Promise.all([
    client
      .from("lava_lavagem_servicos")
      .select("id,descricao,valor,created_at")
      .eq("empresa_id", empresaId)
      .eq("lavagem_id", lavagemId)
      .order("created_at", { ascending: true }),
    client
      .from("lava_checklist_servicos")
      .select("id,lavagem_servico_id,descricao,conferido,observacao")
      .eq("empresa_id", empresaId)
      .eq("checklist_id", checklist.id)
      .order("created_at", { ascending: true }),
    client
      .from("lava_checklist_fotos")
      .select("id,tipo,storage_path,public_url,legenda,created_at")
      .eq("empresa_id", empresaId)
      .eq("checklist_id", checklist.id)
      .order("created_at", { ascending: false })
  ]);

  const servicos = await syncChecklistServicos(client, empresaId, checklist, servicosResult.data ?? [], checklistServicosResult.data ?? []);
  const fotos = await withSignedPhotoUrls(client, fotosResult.data ?? []);

  return {
    lavagem: normalizeLavagem(lavagemResult.data as Row),
    checklist,
    servicos,
    fotos,
    error: servicosResult.error?.message ?? checklistServicosResult.error?.message ?? fotosResult.error?.message ?? null
  };
}

export async function getChecklistSummaryForLavagens(lavagemIds: string[]) {
  const ids = lavagemIds.filter(Boolean);
  if (ids.length === 0) return new Map<string, Row>();

  const { current } = await requireLavaGestorAccess("/lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const { data } = await client
    .from("lava_checklists")
    .select("id,lavagem_id,status,riscos,amassados,vidro_trincado,objetos_cliente,observacao_avarias")
    .eq("empresa_id", current.empresaId)
    .in("lavagem_id", ids);

  const map = new Map<string, Row>();
  for (const row of (data ?? []) as Row[]) {
    map.set(String(row.lavagem_id), row);
  }
  return map;
}

export async function getChecklistPhotosForLavagens(lavagemIds: string[]) {
  const ids = lavagemIds.filter(Boolean);
  if (ids.length === 0) return new Map<string, Row[]>();

  const { current } = await requireLavaGestorAccess("/lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const { data } = await client
    .from("lava_checklist_fotos")
    .select("id,lavagem_id,tipo,storage_path,legenda,created_at")
    .eq("empresa_id", current.empresaId)
    .in("lavagem_id", ids)
    .order("created_at", { ascending: false });

  const photos = await withSignedPhotoUrls(client, data ?? []);
  const map = new Map<string, Row[]>();
  for (const photo of photos) {
    const lavagemId = String(photo.lavagem_id ?? "");
    map.set(lavagemId, [...(map.get(lavagemId) ?? []), photo]);
  }
  return map;
}

export async function ensureChecklistForLavagem(client: any, current: { empresaId: string | null; usuario: { id: string } }, lavagem: Row) {
  const empresaId = current.empresaId;
  const lavagemId = String(lavagem.id);
  const existing = await client
    .from("lava_checklists")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("lavagem_id", lavagemId)
    .maybeSingle();

  if (existing.data) {
    return existing.data as Row;
  }

  const { data, error } = await client
    .from("lava_checklists")
    .insert({
      empresa_id: empresaId,
      lavagem_id: lavagemId,
      cliente_id: lavagem.cliente_id ?? null,
      veiculo_id: lavagem.veiculo_id ?? null,
      usuario_id: current.usuario.id,
      status: "rascunho"
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nao foi possivel criar o checklist.");
  }

  return data as Row;
}

export async function withSignedPhotoUrls(client: any, photos: unknown[]): Promise<Row[]> {
  const rows = photos as Row[];
  return Promise.all(
    rows.map(async (row) => {
      const path = String(row.storage_path ?? "");
      if (!path) return { ...row, signed_url: "" } as Row;
      const { data } = await client.storage.from(LAVA_CHECKLIST_BUCKET).createSignedUrl(path, 60 * 60);
      return { ...row, signed_url: data?.signedUrl ?? row.public_url ?? "" } as Row;
    })
  );
}

async function syncChecklistServicos(client: any, empresaId: string | null, checklist: Row, lavagemServicos: Row[], existingRows: Row[]) {
  const checklistId = String(checklist.id);
  const lavagemId = String(checklist.lavagem_id);
  const existingByService = new Map(existingRows.map((row) => [String(row.lavagem_servico_id ?? row.descricao), row]));
  const missing = lavagemServicos.filter((servico) => !existingByService.has(String(servico.id)));

  if (missing.length > 0) {
    await client.from("lava_checklist_servicos").insert(
      missing.map((servico) => ({
        empresa_id: empresaId,
        checklist_id: checklistId,
        lavagem_id: lavagemId,
        lavagem_servico_id: servico.id,
        descricao: String(servico.descricao ?? "Servico"),
        conferido: true
      }))
    );
  }

  const result = await client
    .from("lava_checklist_servicos")
    .select("id,lavagem_servico_id,descricao,conferido,observacao")
    .eq("empresa_id", empresaId)
    .eq("checklist_id", checklistId)
    .order("created_at", { ascending: true });

  return (result.data ?? []) as Row[];
}

function normalizeLavagem(row: Row): Row {
  return {
    ...row,
    cliente: relationName(row.lava_clientes),
    whatsapp: relationPhone(row.lava_clientes),
    veiculo: vehicleLabel(row.lava_veiculos),
    funcionario: relationName(row.lava_funcionarios),
    servico: relationName(row.lava_servicos)
  };
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) return String((relation as { nome?: unknown }).nome ?? "");
  return "";
}

function relationPhone(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "telefone" in relation) return String((relation as { telefone?: unknown }).telefone ?? "");
  return "";
}

function vehicleLabel(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return "-";
  const row = relation as { placa?: unknown; marca?: unknown; modelo?: unknown; cor?: unknown; tipo?: unknown };
  const model = [row.marca, row.modelo].filter(Boolean).join(" ");
  return [row.placa, model, row.cor].filter(Boolean).join(" - ") || String(row.tipo ?? "Item");
}
