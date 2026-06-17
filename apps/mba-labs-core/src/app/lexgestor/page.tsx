import Link from "next/link";
import { BriefcaseBusiness, FileText, Settings, UsersRound } from "lucide-react";
import { DashboardCards } from "@/components/lexgestor/DashboardCards";
import { DropboxStatus } from "@/components/lexgestor/DropboxStatus";
import { MiniBarChart } from "@/components/lexgestor/MiniBarChart";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

export default async function LexGestorHomePage() {
  const data = await getLexWorkspaceData("/lexgestor");

  return (
    <ResponsivePageContainer
      title="LexGestor"
      description="Sistema juridico para organizar clientes, casos, documentos, prazos e dossies."
      action={
        <Link className="button" href="/lexgestor/casos/novo">
          Abrir caso
        </Link>
      }
    >
      {data.error ? <p className="notice">Banco LexGestor: {data.error}</p> : null}
      <section className="setup-steps">
        {data.setupSteps.map((step, index) => (
          <Link className={`setup-step${step.done ? " done" : ""}`} href={step.href} key={step.label}>
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
            <small>{step.done ? "Concluido" : step.action}</small>
          </Link>
        ))}
      </section>
      <section className="grid-wide">
        <Link className="card quick-action" href="/lexgestor/clientes/novo">
          <UsersRound size={24} color="var(--primary)" aria-hidden />
          <strong>Cadastrar cliente</strong>
          <span>Dados, contatos e observacoes.</span>
        </Link>
        <Link className="card quick-action" href="/lexgestor/casos/novo">
          <BriefcaseBusiness size={24} color="var(--primary)" aria-hidden />
          <strong>Abrir caso</strong>
          <span>Categoria, checklist e processo.</span>
        </Link>
        <Link className="card quick-action" href="/lexgestor/documentos">
          <FileText size={24} color="var(--primary)" aria-hidden />
          <strong>Anexar documento</strong>
          <span>Upload, foto e marca d'agua.</span>
        </Link>
        <Link className="card quick-action" href="/lexgestor/configuracoes">
          <Settings size={24} color="var(--primary)" aria-hidden />
          <strong>Configurar escritorio</strong>
          <span>Marca d'agua e armazenamento.</span>
        </Link>
      </section>
      <DashboardCards metrics={data.metrics} />
      <section className="split">
        <MiniBarChart title="Casos por categoria" rows={data.casosPorCategoria} />
        <DropboxStatus connections={data.storageConnections} />
      </section>
    </ResponsivePageContainer>
  );
}
