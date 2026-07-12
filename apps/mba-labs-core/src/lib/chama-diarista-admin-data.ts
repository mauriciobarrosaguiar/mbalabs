import { requireAppAccess } from "@/lib/core-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CountResult = {
  label: string;
  value: number;
  error?: string;
};

type LatestRequest = {
  id: string;
  status: string;
  service_kind: string;
  requested_date: string | null;
  requested_period: string | null;
  city_name: string | null;
  neighborhood_name: string | null;
  estimated_price_cents: number | null;
  created_at: string;
};

export async function getChamaDiaristaAdminData() {
  const current = await requireAppAccess("chama-diarista", "/chama-diarista");

  try {
    const client = getSupabaseAdmin();
    const [
      clients,
      professionals,
      approvedProfessionals,
      pendingProfessionals,
      requests,
      pendingRequests,
      scheduledRequests,
      completedRequests,
      services,
      cities,
      paidPayments,
      pendingPayments,
      latestRequests
    ] = await Promise.all([
      countRows(client, "cd_clients", "Clientes"),
      countRows(client, "cd_professionals", "Diaristas"),
      countRows(client, "cd_professionals", "Diaristas aprovadas", { status: "approved" }),
      countRows(client, "cd_professionals", "Diaristas em analise", { status: "pending_review" }),
      countRows(client, "cd_service_requests", "Solicitacoes"),
      countRows(client, "cd_service_requests", "Solicitacoes pendentes", { status: "pending" }),
      countRows(client, "cd_service_requests", "Servicos agendados", { status: "scheduled" }),
      countRows(client, "cd_service_requests", "Servicos concluidos", { status: "completed" }),
      countRows(client, "cd_services", "Servicos ativos", { active: true }),
      countRows(client, "cd_cities", "Cidades ativas", { active: true }),
      countRows(client, "cd_payments", "Pagamentos pagos", { status: "paid" }),
      countRows(client, "cd_payments", "Pagamentos pendentes", { status: "pending" }),
      client
        .from("cd_service_requests")
        .select("id,status,service_kind,requested_date,requested_period,city_name,neighborhood_name,estimated_price_cents,created_at")
        .order("created_at", { ascending: false })
        .limit(8)
    ]);

    const metrics = [
      clients,
      professionals,
      approvedProfessionals,
      pendingProfessionals,
      requests,
      pendingRequests,
      scheduledRequests,
      completedRequests,
      services,
      cities,
      paidPayments,
      pendingPayments
    ];

    return {
      current,
      metrics,
      latestRequests: (latestRequests.data ?? []) as LatestRequest[],
      error: [latestRequests.error?.message, ...metrics.map((item) => item.error)].filter(Boolean).join(" | ") || null
    };
  } catch (error) {
    return {
      current,
      metrics: [] as CountResult[],
      latestRequests: [] as LatestRequest[],
      error: error instanceof Error ? error.message : "Nao foi possivel conectar ao painel ChamaDiarista."
    };
  }
}

async function countRows(
  client: any,
  table: string,
  label: string,
  filters: Record<string, string | boolean> = {}
): Promise<CountResult> {
  let query = client.from(table).select("*", { count: "exact", head: true });

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const { count, error } = await query;

  return {
    label,
    value: count ?? 0,
    error: error?.message
  };
}
