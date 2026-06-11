import { AppNav } from "@/components/AppNav";
import {
  BackButton,
  DataTable,
  MessageBanner,
  PageHeader,
  StatCard,
  SubmitButton,
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import { markComissaoPaga } from "@/lib/actions/lavagestor-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaLookups, listLavaComissoes } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function ComissoesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    funcionario: firstParam(params.funcionario),
    status: firstParam(params.status)
  };
  const [{ rows, error }, lookups] = await Promise.all([listLavaComissoes(filters), getLavaLookups()]);
  const totalPendente = rows
    .filter((row) => row.status === "pendente")
    .reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
  const totalPago = rows.filter((row) => row.status === "pago").reduce((sum, row) => sum + Number(row.valor ?? 0), 0);

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="LavaGestor"
          title="Comissões"
          description="Acompanhe comissões pendentes e pagas por funcionário."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Total pendente" value={formatMoney(totalPendente)} />
          <StatCard label="Total pago" value={formatMoney(totalPago)} />
        </div>

        <form className="panel grid gap-3 p-4 md:grid-cols-3" action="">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Funcionário</span>
            <select className="input" name="funcionario" defaultValue={filters.funcionario ?? ""}>
              <option value="">Todos</option>
              {lookups.funcionarios.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.nome)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold">Status</span>
            <select className="input" name="status" defaultValue={filters.status ?? ""}>
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
          <button className="button-secondary self-end" type="submit">
            Filtrar
          </button>
        </form>

        <DataTable
          columns={[
            { key: "funcionario", label: "Funcionário" },
            { key: "valor", label: "Valor" },
            { key: "status", label: "Status" },
            { key: "pago_em", label: "Pago em" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows.map((row) => ({
            ...row,
            valor: formatMoney(row.valor),
            pago_em: formatDate(row.pago_em),
            created_at: formatDate(row.created_at)
          }))}
          actions={(row) =>
            row.status === "pendente" ? (
              <form action={markComissaoPaga}>
                <input name="id" type="hidden" value={String(row.id)} />
                <SubmitButton>Marcar como pago</SubmitButton>
              </form>
            ) : null
          }
        />
      </section>
    </main>
  );
}
