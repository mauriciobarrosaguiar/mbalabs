import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { DataTable, MessageBanner, PageHeader, StatCard, formatDate, formatMoney } from "@/components/ui-kit";
import { getChamaDiaristaAdminData } from "@/lib/chama-diarista-admin-data";

export const dynamic = "force-dynamic";

export default async function ChamaDiaristaPage() {
  const dashboard = await getChamaDiaristaAdminData();

  return (
    <>
      <AppNav />
      <main className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="ChamaDiarista"
          title="Painel operacional"
          description="Gestao central de clientes, diaristas, solicitacoes, pagamentos, agenda e operacao do ChamaDiarista pelo login MBA Labs."
          actions={
            <Link className="button-secondary" href="/selecionar-app">
              Voltar aos apps
            </Link>
          }
        />

        <MessageBanner error={dashboard.error ?? undefined} />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dashboard.metrics.map((metric) => (
            <StatCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="panel p-5">
            <h2 className="text-xl font-black">Solicitacoes recentes</h2>
            <div className="mt-4">
              <DataTable
                columns={[
                  { key: "created_at", label: "Criado em" },
                  { key: "status", label: "Status" },
                  { key: "service_kind", label: "Servico" },
                  { key: "requested_date", label: "Data" },
                  { key: "requested_period", label: "Periodo" },
                  { key: "local", label: "Local" },
                  { key: "estimated_price_cents", label: "Valor estimado" }
                ]}
                emptyMessage="Nenhuma solicitacao encontrada."
                rows={dashboard.latestRequests.map((request) => ({
                  ...request,
                  created_at: formatDate(request.created_at),
                  requested_date: formatDate(request.requested_date),
                  local: [request.city_name, request.neighborhood_name].filter(Boolean).join(" - ") || "-",
                  estimated_price_cents: formatMoney((request.estimated_price_cents ?? 0) / 100)
                }))}
              />
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <section className="panel grid gap-3 p-5">
              <p className="eyebrow">Acesso</p>
              <h2 className="text-xl font-black">Login pelo MBA Labs</h2>
              <p className="text-sm leading-6 text-slate-300">
                Usuario ativo: {dashboard.current.usuario.nome}. O acesso desta rota passa pela sessao central do portal.
              </p>
            </section>

            <section className="panel grid gap-3 p-5">
              <p className="eyebrow">Base Supabase</p>
              <h2 className="text-xl font-black">Mesmo projeto MBA Labs</h2>
              <p className="text-sm leading-6 text-slate-300">
                O painel consulta as tabelas cd_* no projeto Supabase compartilhado, mantendo a chave de servico apenas no servidor.
              </p>
            </section>
          </aside>
        </section>
      </main>
    </>
  );
}
