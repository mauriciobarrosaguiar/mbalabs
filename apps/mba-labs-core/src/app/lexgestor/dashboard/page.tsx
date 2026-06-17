import Link from "next/link";
import { DashboardCards } from "@/components/lexgestor/DashboardCards";
import { DropboxStatus } from "@/components/lexgestor/DropboxStatus";
import { MiniBarChart } from "@/components/lexgestor/MiniBarChart";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

export default async function DashboardPage() {
  const data = await getLexWorkspaceData("/lexgestor/dashboard");

  return (
    <ResponsivePageContainer
      title="Dashboard"
      description="Indicadores reais do escritorio e proximas acoes recomendadas."
      action={
        <Link className="button" href="/lexgestor/casos/novo">
          Abrir novo caso
        </Link>
      }
    >
      {data.error ? <p className="notice">Nao foi possivel carregar todas as tabelas: {data.error}</p> : null}
      <DashboardCards metrics={data.metrics} />
      <section className="split">
        <MiniBarChart title="Casos por categoria" rows={data.casosPorCategoria} />
        <MiniBarChart title="Casos por status" rows={data.casosPorStatus} />
      </section>
      <section className="split">
        <ListCard title="Ultimos clientes" empty="Nenhum cliente cadastrado." rows={data.ultimosClientes.map((cliente) => ({
          href: `/lexgestor/clientes/${cliente.id}`,
          label: cliente.nome,
          meta: `${cliente.cpfCnpj} - ${cliente.casosCount} caso(s)`,
        }))} />
        <ListCard title="Ultimos casos" empty="Nenhum caso aberto." rows={data.ultimosCasos.map((caso) => ({
          href: `/lexgestor/casos/${caso.id}`,
          label: caso.titulo,
          meta: `${caso.cliente} - ${caso.status}`,
        }))} />
      </section>
      <section className="split">
        <ListCard title="Ultimos documentos" empty="Nenhum documento anexado." rows={data.ultimosDocumentos.map((documento) => ({
          href: `/lexgestor/documentos?documento=${documento.id}`,
          label: documento.nome,
          meta: `${documento.cliente} - ${documento.status}`,
        }))} />
        <ListCard title="Proximos prazos" empty="Nenhum prazo nos proximos 15 dias." rows={data.proximosPrazos.map((caso) => ({
          href: `/lexgestor/casos/${caso.id}`,
          label: caso.proximoPrazo,
          meta: `${caso.cliente} - ${caso.tipoPrazo || caso.titulo}`,
        }))} />
      </section>
      <section className="split">
        <MiniBarChart title="Documentos por status" rows={data.documentosPorStatus} />
        <DropboxStatus connections={data.storageConnections} />
      </section>
    </ResponsivePageContainer>
  );
}

function ListCard({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ href: string; label: string; meta: string }>;
}) {
  return (
    <section className="card stack">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        rows.map((row) => (
          <Link className="list-row" href={row.href} key={`${row.href}-${row.label}`}>
            <strong>{row.label}</strong>
            <span>{row.meta}</span>
          </Link>
        ))
      )}
    </section>
  );
}
