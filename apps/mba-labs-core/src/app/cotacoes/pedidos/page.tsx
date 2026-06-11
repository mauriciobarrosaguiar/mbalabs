import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { BackButton, DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { listCotPedidos } from "@/lib/cotacoes-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function CotacoesPedidosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { rows, error } = await listCotPedidos();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="MBA Cotações"
          title="Pedidos Gerados"
          description="Lista inicial de pedidos gerados a partir das cotações."
          actions={<BackButton href="/cotacoes" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <DataTable
          columns={[
            { key: "cotacao", label: "Cotação" },
            { key: "vendedor", label: "Vendedor" },
            { key: "status", label: "Status" },
            { key: "total", label: "Total" },
            { key: "created_at", label: "Data" }
          ]}
          rows={rows.map((row) => ({ ...row, total: formatMoney(row.total), created_at: formatDate(row.created_at) }))}
          actions={(row) => (
            <Link className="button-secondary" href={`/cotacoes/${row.cotacao_id}`}>
              Ver detalhes
            </Link>
          )}
        />
      </section>
    </main>
  );
}
