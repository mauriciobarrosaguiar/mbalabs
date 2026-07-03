import Link from "next/link";
import { BriefcaseBusiness, FilePlus2, FolderSearch, UsersRound } from "lucide-react";
import type { LexWorkspaceData } from "@/lib/lexgestor/data";
import { DashboardCards } from "./DashboardCards";
import { DashboardListCard } from "./DashboardListCard";
import { DropboxStatus } from "./DropboxStatus";
import { MiniBarChart } from "./MiniBarChart";

export function LexDashboardOverview({ data }: { data: LexWorkspaceData }) {
  return (
    <>
      {data.error ? <p className="notice danger">{data.error}</p> : null}

      <DashboardCards metrics={data.metrics} />

      <section className="grid-wide dashboard-actions" aria-label="Atalhos do LexGestor">
        <Link className="card quick-action" href="/lexgestor/casos/novo">
          <BriefcaseBusiness size={24} color="var(--primary)" aria-hidden />
          <strong>Abrir novo caso</strong>
        </Link>
        <Link className="card quick-action" href="/lexgestor/clientes/novo">
          <UsersRound size={24} color="var(--primary)" aria-hidden />
          <strong>Novo cliente</strong>
        </Link>
        <Link className="card quick-action" href="/lexgestor/documentos">
          <FilePlus2 size={24} color="var(--primary)" aria-hidden />
          <strong>Anexar documento</strong>
        </Link>
        <Link className="card quick-action" href="/lexgestor/documentos">
          <FolderSearch size={24} color="var(--primary)" aria-hidden />
          <strong>Ver documentos</strong>
        </Link>
      </section>

      <section className="split">
        <DashboardListCard
          title="Últimos clientes"
          empty="Nenhum cliente cadastrado."
          rows={data.ultimosClientes.map((cliente) => ({
            href: `/lexgestor/clientes/${cliente.id}`,
            label: cliente.nome,
            meta: `${cliente.cpfCnpj} - ${cliente.casosCount} caso(s)`,
            note: cliente.email,
          }))}
        />
        <DashboardListCard
          title="Últimos casos"
          empty="Nenhum caso aberto."
          rows={data.ultimosCasos.map((caso) => ({
            href: `/lexgestor/casos/${caso.id}`,
            label: caso.titulo,
            meta: `${caso.cliente} - ${caso.status}`,
            note: `${caso.categoria} / ${caso.subcategoria}`,
          }))}
        />
      </section>

      <section className="split">
        <DashboardListCard
          title="Últimos documentos"
          empty="Nenhum documento anexado."
          rows={data.ultimosDocumentos.map((documento) => ({
            href: `/lexgestor/documentos/${documento.id}`,
            label: documento.nome,
            meta: `${documento.cliente} - ${documento.status}`,
            note: documento.caso,
          }))}
        />
        <DashboardListCard
          title="Próximos prazos"
          empty="Nenhum prazo nos próximos 15 dias."
          rows={data.proximosPrazos.map((caso) => ({
            href: `/lexgestor/casos/${caso.id}`,
            label: caso.proximoPrazo,
            meta: `${caso.cliente} - ${caso.tipoPrazo || caso.titulo}`,
            note: caso.numeroProcesso,
          }))}
        />
      </section>

      <section className="split">
        <MiniBarChart title="Documentos por status" rows={data.documentosPorStatus} />
        <DropboxStatus connections={data.storageConnections} />
      </section>

      <section className="split">
        <MiniBarChart title="Casos por categoria" rows={data.casosPorCategoria} />
        <MiniBarChart title="Casos por status" rows={data.casosPorStatus} />
      </section>
    </>
  );
}
