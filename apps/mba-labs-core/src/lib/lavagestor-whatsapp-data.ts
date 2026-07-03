import { redirect } from "next/navigation";
import { requireLavaGestorAccess, canOperateCounter } from "./lavagestor-permissions";
import { getWhatsappIntegration } from "./lavagestor-whatsapp";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export type LavaWhatsappRow = Row & {
  id: string;
  cliente: string;
  status_label: string;
  evento_label: string;
  provider_label: string;
  telefone?: string | null;
  mensagem?: string | null;
  mensagem_gerada_por?: string | null;
  status?: string | null;
  erro?: string | null;
  agendado_para?: string | null;
  enviado_em?: string | null;
  created_at?: string | null;
};

export type LavaWhatsappFilters = {
  status?: string;
  evento?: string;
  provider?: string;
  q?: string;
};

export async function getLavaWhatsappPageData(filters: LavaWhatsappFilters = {}) {
  const { current, perfil } = await requireLavaGestorAccess("/lavagestor/whatsapp");
  if (!canOperateCounter(perfil)) {
    redirect("/lavagestor?error=Seu perfil nao pode acessar a fila de WhatsApp.");
  }

  const client = (await getSupabaseServer()) as any;
  const empresaId = current.empresaId;
  const integration = await getWhatsappIntegration(current);
  if (!empresaId) {
    return { rows: [], stats: emptyStats(), filters, integration, error: "Empresa nao identificada." };
  }

  let query = client
    .from("lava_whatsapp_envios")
    .select("id,empresa_id,cliente_id,lavagem_id,agendamento_id,automacao_id,evento,telefone,mensagem,mensagem_gerada_por,provider,status,precisa_aprovacao,external_id,erro,tentativas,agendado_para,enviado_em,created_at,lava_clientes(nome)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(150);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.evento) query = query.eq("evento", filters.evento);
  if (filters.provider) query = query.eq("provider", filters.provider);

  const [rowsResult, countsResult] = await Promise.all([
    query,
    client
      .from("lava_whatsapp_envios")
      .select("status,enviado_em,created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  let rows: LavaWhatsappRow[] = ((rowsResult.data ?? []) as Row[]).map(normalizeRow);
  if (filters.q) {
    const term = filters.q.toLowerCase();
    rows = rows.filter((row) =>
      [row.cliente, row.telefone, row.mensagem, row.evento, row.status]
        .some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }

  return {
    rows,
    stats: buildStats((countsResult.data ?? []) as Row[]),
    filters,
    integration,
    error: rowsResult.error?.message ?? countsResult.error?.message ?? null
  };
}

export const WHATSAPP_STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "pendente", label: "Pendente" },
  { value: "pronto", label: "Manual pronto" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovacao" },
  { value: "aprovado", label: "Aprovado" },
  { value: "enviando", label: "Enviando" },
  { value: "enviado", label: "Enviado" },
  { value: "enviado_manual", label: "Enviado manual" },
  { value: "erro", label: "Com erro" },
  { value: "cancelado", label: "Cancelado" }
];

export const WHATSAPP_EVENT_OPTIONS = [
  { value: "", label: "Todos os eventos" },
  { value: "confirmacao_agendamento", label: "Confirmacao de agendamento" },
  { value: "lembrete_agendamento", label: "Lembrete de agendamento" },
  { value: "lavagem_recebida", label: "Veiculo recebido" },
  { value: "checklist_concluido", label: "Checklist concluido" },
  { value: "veiculo_pronto", label: "Veiculo pronto" },
  { value: "pagamento_recebido", label: "Pagamento recebido" },
  { value: "pos_venda", label: "Pos-venda" },
  { value: "cobranca_fiado", label: "Cobranca de fiado" },
  { value: "cliente_sem_retorno", label: "Cliente sem retorno" },
  { value: "promocao", label: "Promocao" }
];

export const WHATSAPP_PROVIDER_OPTIONS = [
  { value: "", label: "Todos os provedores" },
  { value: "manual", label: "Manual / wa.me" },
  { value: "evolution", label: "Evolution API" },
  { value: "whatsapp_cloud_api", label: "WhatsApp Cloud API" }
];

function normalizeRow(row: Row): LavaWhatsappRow {
  return {
    ...row,
    id: String(row.id ?? ""),
    cliente: relationName(row.lava_clientes),
    status_label: statusLabel(String(row.status ?? "")),
    evento_label: eventLabel(String(row.evento ?? "")),
    provider_label: providerLabel(String(row.provider ?? "manual"))
  } as LavaWhatsappRow;
}

function buildStats(rows: Row[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stats = emptyStats();
  for (const row of rows) {
    const status = String(row.status ?? "");
    if (status === "pendente" || status === "pronto" || status === "aprovado") stats.pendentes += 1;
    if (status === "aguardando_aprovacao") stats.aprovacao += 1;
    if (status === "erro") stats.erro += 1;
    if (status === "cancelado") stats.cancelados += 1;
    const sentAt = row.enviado_em ? new Date(String(row.enviado_em)) : null;
    if (status.startsWith("enviado") && sentAt && sentAt >= today) stats.enviadosHoje += 1;
  }
  return stats;
}

function emptyStats() {
  return { pendentes: 0, aprovacao: 0, enviadosHoje: 0, erro: 0, cancelados: 0 };
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) return String((relation as { nome?: unknown }).nome ?? "");
  return "";
}

function statusLabel(status: string) {
  return (WHATSAPP_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status) || "-";
}

function eventLabel(evento: string) {
  return (WHATSAPP_EVENT_OPTIONS.find((item) => item.value === evento)?.label ?? evento) || "Manual";
}

function providerLabel(provider: string) {
  return (WHATSAPP_PROVIDER_OPTIONS.find((item) => item.value === provider)?.label ?? provider) || "Manual / wa.me";
}
