import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { LAVA_STATUS_OPTIONS, getLavaLookups, listLavaLavagens } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function LavagensPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = { data: firstParam(params.data), funcionario: firstParam(params.funcionario), status: firstParam(params.status) };
  const [{ rows, error }, lookups] = await Promise.all([listLavaLavagens(filters), getLavaLookups()]);

  return (
    <LavaGestorShell activePath="/lavagestor/lavagens">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Lavagens"
          description="Histórico de lavagens com valor, comissão, funcionário, status e recibo."
          actions={
            <>
              <BackButton href="/lavagestor" />
              <Link className="button-primary" href="/lavagestor/nova-lavagem">Nova lavagem</Link>
            </>
          }
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />

        <form className="panel grid gap-3 p-4 md:grid-cols-4" action="">
          <label className="grid gap-2"><span className="text-sm font-bold">Data</span><input className="input" name="data" type="date" defaultValue={filters.data ?? ""} /></label>
          <label className="grid gap-2"><span className="text-sm font-bold">Funcionário</span><select className="input" name="funcionario" defaultValue={filters.funcionario ?? ""}><option value="">Todos</option>{lookups.funcionarios.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)}</option>)}</select></label>
          <label className="grid gap-2"><span className="text-sm font-bold">Status</span><select className="input" name="status" defaultValue={filters.status ?? ""}><option value="">Todos</option>{LAVA_STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <button className="button-secondary self-end" type="submit">Filtrar</button>
        </form>

        <DataTable
          columns={[
            { key: "cliente", label: "Cliente" },
            { key: "veiculo", label: "Veículo" },
            { key: "funcionario", label: "Funcionário" },
            { key: "servico", label: "Serviço" },
            { key: "valor", label: "Valor" },
            { key: "comissao", label: "Comissão" },
            { key: "status_label", label: "Status" },
            { key: "status_pagamento_label", label: "Pagamento" },
            { key: "data_lavagem", label: "Data" }
          ]}
          rows={rows.map((row) => ({ ...row, valor: formatMoney(row.valor_final ?? row.valor), comissao: formatMoney(row.comissao), data_lavagem: formatDate(row.data_entrada ?? row.data_lavagem) }))}
          actions={(row) => <div className="flex flex-wrap justify-end gap-2"><Link className="button-secondary" href={`/lavagestor/checklists/${row.id}`}>Checklist</Link><Link className="button-secondary" href={`/lavagestor/tickets/${row.id}`}>Ticket</Link><Link className="button-secondary" href={`/lavagestor/recibos/${row.id}`}>Recibo</Link></div>}
        />
      </section>
    </LavaGestorShell>
  );
}
