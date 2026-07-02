import { requireAppAccess } from "./core-data";
import { withSignedPhotoUrls } from "./lavagestor-checklists-data";
import { getSupabaseServer } from "./supabase";

const LAVA_STATUS_LABELS: Record<string, string> = {
  na_fila: "Na fila",
  em_lavagem: "Em lavagem",
  aguardando_finalizacao: "Aguardando finalização",
  finalizado: "Finalizado",
  cliente_avisado: "Cliente avisado",
  pago: "Pago",
  entregue: "Entregue",
  cancelado: "Cancelado"
};

const LAVA_PAYMENT_STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  parcial: "Parcial",
  pago: "Pago",
  fiado: "Fiado",
  cancelado: "Cancelado"
};

export async function listLavaFila() {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("lava_lavagens")
    .select(
      "id,cliente_id,veiculo_id,funcionario_id,servico_id,descricao_extra,observacoes,valor,valor_total,valor_desconto,valor_final,valor_recebido,valor_pendente,comissao,status,status_pagamento,forma_pagamento,data_lavagem,data_entrada,entrega_tipo,endereco_entrega,lava_clientes(nome,telefone),lava_veiculos(placa,marca,modelo,cor),lava_funcionarios(nome),lava_servicos(nome)"
    )
    .eq("empresa_id", current.empresaId)
    .order("data_lavagem", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => {
      const servico = relationName(row.lava_servicos);
      const extra = String(row.descricao_extra ?? "").trim();
      const servicosResumo = [servico, extra].filter(Boolean).join(" + ");
      const status = normalizeLavaStatus(row.status);
      const entregaTipo = String(row.entrega_tipo ?? "retirar");

      return {
        ...row,
        cliente: relationName(row.lava_clientes),
        whatsapp: relationPhone(row.lava_clientes),
        veiculo: vehicleLabel(row.lava_veiculos),
        funcionario: relationName(row.lava_funcionarios),
        servico: servico || extra || "-",
        servicos_resumo: servicosResumo || "-",
        status,
        status_label: LAVA_STATUS_LABELS[status] ?? String(row.status ?? "-"),
        status_pagamento_label:
          LAVA_PAYMENT_STATUS_LABELS[String(row.status_pagamento ?? "aberto")] ?? String(row.status_pagamento ?? "Aberto"),
        entrega_tipo: entregaTipo,
        entrega_label: entregaTipo === "levar" ? "Levar ao cliente" : "Cliente retira"
      };
    })
    .filter((row) => !["entregue", "cancelado"].includes(String(row.status)));

  const lavagemIds = rows.map((row) => String(row.id ?? "")).filter(Boolean);
  const [checklistsResult, fotosResult] = lavagemIds.length
    ? await Promise.all([
        (supabase as any).from("lava_checklists").select("id,lavagem_id,status,riscos,amassados,vidro_trincado,objetos_cliente").eq("empresa_id", current.empresaId).in("lavagem_id", lavagemIds),
        (supabase as any).from("lava_checklist_fotos").select("id,lavagem_id,tipo,momento,storage_path,legenda,created_at").eq("empresa_id", current.empresaId).in("lavagem_id", lavagemIds).order("created_at", { ascending: false })
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const fotos = await withSignedPhotoUrls(supabase as any, fotosResult.data ?? []);
  const checklistByLavagem = new Map(((checklistsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.lavagem_id), row]));
  const fotosByLavagem = new Map<string, { entrada?: Record<string, unknown>; checkout?: Record<string, unknown>; entradaCount: number; checkoutCount: number }>();
  for (const foto of fotos) {
    const lavagemId = String(foto.lavagem_id ?? "");
    const bucket = fotosByLavagem.get(lavagemId) ?? { entradaCount: 0, checkoutCount: 0 };
    if (String(foto.momento ?? "entrada") === "checkout") {
      bucket.checkoutCount += 1;
      if (!bucket.checkout) bucket.checkout = foto;
    } else {
      bucket.entradaCount += 1;
      if (!bucket.entrada) bucket.entrada = foto;
    }
    fotosByLavagem.set(lavagemId, bucket);
  }

  return {
    rows: rows.map((row) => {
      const checklist = checklistByLavagem.get(String(row.id));
      const foto = fotosByLavagem.get(String(row.id));
      return {
        ...row,
        checklist_id: checklist?.id ?? null,
        checklist_status: checklist ? String(checklist.status ?? "rascunho") : "pendente",
        checklist_label: checklist ? (checklist.status === "concluido" ? "Checklist ok" : "Checklist rascunho") : "Checklist pendente",
        checklist_foto_url: foto?.entrada?.signed_url ?? foto?.checkout?.signed_url ?? "",
        foto_entrada_id: foto?.entrada?.id ?? "",
        foto_checkout_id: foto?.checkout?.id ?? "",
        foto_entrada_url: foto?.entrada?.signed_url ?? "",
        foto_checkout_url: foto?.checkout?.signed_url ?? "",
        foto_entrada_preview_url: foto?.entrada?.preview_url ?? "",
        foto_checkout_preview_url: foto?.checkout?.preview_url ?? "",
        foto_entrada_sync_rows: foto?.entrada?.sync_rows ?? [],
        foto_checkout_sync_rows: foto?.checkout?.sync_rows ?? [],
        fotos_entrada_count: foto?.entradaCount ?? 0,
        fotos_checkout_count: foto?.checkoutCount ?? 0,
        checkout_label: (foto?.checkoutCount ?? 0) > 0 ? "Checkout ok" : "Checkout pendente"
      };
    }),
    error: error?.message ?? checklistsResult.error?.message ?? fotosResult.error?.message ?? null
  };
}

function normalizeLavaStatus(status: unknown) {
  const value = String(status ?? "na_fila");
  if (value === "aberta") return "na_fila";
  if (value === "em_andamento") return "em_lavagem";
  if (value === "finalizada") return "finalizado";
  if (value === "cancelada") return "cancelado";
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
