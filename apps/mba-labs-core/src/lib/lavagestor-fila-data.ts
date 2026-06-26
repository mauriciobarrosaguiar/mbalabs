import { requireAppAccess } from "./core-data";
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

  return { rows, error: error?.message ?? null };
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
