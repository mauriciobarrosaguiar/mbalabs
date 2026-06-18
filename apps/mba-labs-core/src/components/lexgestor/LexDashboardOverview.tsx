import Link from "next/link";
import { BriefcaseBusiness, FilePlus2, FolderSearch, Settings, UsersRound } from "lucide-react";
import type { LexWorkspaceData } from "@/lib/lexgestor/data";
import { DashboardCards } from "./DashboardCards";
import { DashboardListCard } from "./DashboardListCard";
import { DropboxStatus } from "./DropboxStatus";
import { MiniBarChart } from "./MiniBarChart";

export function LexDashboardOverview({ data }: { data: LexWorkspaceData }) {
  const pendingSetup = data.setupSteps.filter((step) => !step.done);

  return (
    <>
      {data.demoMode ? (
        <p className="notice warning" role="status">
          Modo demonstração ativo. Estes dados são fictícios e não se misturam aos dados reais do escritório.
        </p>
      ) : null}

      {data.error ? (
        <p className="notice">
          Não foi possível carregar todas as tabelas: {data.error}
        </p>
      ) : null}

      <DashboardCards metrics={data.metrics} />

      {pendingSetup.length > 0 && !data.demoMode ? (
        <section className="card stack setup-compact">
          <div className="section-title">
            <div>
              <h2>Configuração inicial</h2>
              <p>Complete apenas o que falta para o escritório operar sem pendências.</p>
            </div>
            <Settings size={22} color="var(--primary)" aria-hidden />
          </div>
          <div className="grid">
            {pendingSetup.map((step) => (
              <Link className="list-row" href={step.href} key={step.label}>
                <strong>{step.label}</strong>
                <span>{step.action}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid-wide dashboard-actions" aria-label="Atalhos do LexGestor">
        <Link className="card quick-action" href="/lexgestor/casos/novo">
          <BriefcaseBusiness size={24} color="var(--primary)" aria-hidden />
          <strong>Abrir novo caso</strong>
          <span>Categoria, checklist, processo e prazos.</span>
        </Link>
        <Link className="card quick-action" href="/lexgestor/clientes/novo">
          <UsersRound size={24} color="var(--primary)" aria-hidden />
          <strong>Novo cliente</strong>
          <span>Cadastrar dados, contatos e observações.</span>
        </Link>
        <Link className="card quick-action" href="/lexgestor/documentos">
          <FilePlus2 size={24} color="var(--primary)" aria-hidden />
          <strong>Anexar documento</strong>
          <span>Upload direto para o armazenamento do escritório.</span>
        </Link>
        <Link className="card quick-action" href="/lexgestor/documentos">
          <FolderSearch size={24} color="var(--primary)" aria-hidden />
          <strong>Ver documentos</strong>
          <span>Consultar originais, PDFs e pendências.</span>
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
