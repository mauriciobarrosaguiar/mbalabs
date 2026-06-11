import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { BackButton, DataTable, MessageBanner, PageHeader, formatDate } from "@/components/ui-kit";
import { listCotacoes } from "@/lib/cotacoes-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function CotacoesAbertasPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { rows, error } = await listCotacoes("aberta");

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="MBA Cotações"
          title="Cotações Abertas"
          description="Acompanhe as cotações ainda em negociação."
          actions={<BackButton href="/cotacoes" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <DataTable
          columns={[
            { key: "titulo", label: "Título" },
            { key: "status", label: "Status" },
            { key: "observacao", label: "Observação" },
            { key: "created_at", label: "Criada em" }
          ]}
          rows={rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) }))}
          actions={(row) => (
            <Link className="button-secondary" href={`/cotacoes/${row.id}`}>
              Ver detalhes
            </Link>
          )}
        />
      </section>
    </main>
  );
}
