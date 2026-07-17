import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, FilePlus2, Gavel, UsersRound } from "lucide-react";
import type { LexWorkspaceData } from "@/lib/lexgestor/data";
import { DashboardCards } from "./DashboardCards";
import { DashboardListCard } from "./DashboardListCard";
import { DropboxStatus } from "./DropboxStatus";
import { MiniBarChart } from "./MiniBarChart";

export function LexDashboardOverview({ data }: { data: LexWorkspaceData }) {
  const pendentes = data.documentos.filter((documento) =>
    ["Pendente", "Original indisponível", "Original indisponivel", "Precisa reenviar arquivo", "Falha no envio"].includes(documento.status),
  );

  return (
    <>
      {data.error ? <p className="notice danger">{data.error}</p> : null}

      <section className="simple-hero card">
        <div>
          <span className="eyebrow">Atendimento jurídico</span>
          <h2>O que deseja fazer agora?</h2>
        </div>
        <div className="simple-actions">
          <Link className="button" href="/lexgestor/clientes/novo">
            <UsersRound size={18} aria-hidden />
            Novo cliente
          </Link>
          <Link className="button" href="/lexgestor/casos/novo">
            <BriefcaseBusiness size={18} aria-hidden />
            Novo caso
          </Link>
          <Link className="button secondary" href="/lexgestor/processos">
            <Gavel size={18} aria-hidden />
            Processo
          </Link>
          <Link className="button secondary" href="/lexgestor/documentos#documentos">
            <FilePlus2 size={18} aria-hidden />
            Documento
          </Link>
        </div>
      </section>

      <DashboardCards metrics={data.metrics.slice(0, 4)} />

      <section className="split">
        <DashboardListCard
          title="Atenção hoje"
          empty="Nada pendente por enquanto."
          rows={[
            ...data.proximosPrazos.slice(0, 3).map((caso) => ({
              href: `/lexgestor/casos/${caso.id}`,
              label: caso.proximoPrazo || "Prazo próximo",
              meta: caso.cliente,
              note: caso.tipoPrazo || caso.titulo,
            })),
            ...pendentes.slice(0, 3).map((documento) => ({
              href: `/lexgestor/documentos?reenviar=${documento.id}#documentos`,
              label: documento.nome,
              meta: documento.cliente,
              note: "Documento pendente",
            })),
          ]}
        />
        <DashboardListCard
          title="Casos recentes"
          empty="Nenhum caso aberto."
          rows={data.ultimosCasos.slice(0, 5).map((caso) => ({
            href: `/lexgestor/casos/${caso.id}`,
            label: caso.titulo,
            meta: `${caso.cliente} - ${caso.status}`,
            note: caso.numeroProcesso || `${caso.categoria} / ${caso.subcategoria}`,
          }))}
        />
      </section>

      <section className="split">
        <DashboardListCard
          title="Clientes recentes"
          empty="Nenhum cliente cadastrado."
          rows={data.ultimosClientes.slice(0, 5).map((cliente) => ({
            href: `/lexgestor/clientes/${cliente.id}`,
            label: cliente.nome,
            meta: cliente.whatsapp || cliente.telefone || cliente.cpfCnpj,
            note: `${cliente.casosCount} caso(s)`,
          }))}
        />
        <DashboardListCard
          title="Documentos recentes"
          empty="Nenhum documento anexado."
          rows={data.ultimosDocumentos.slice(0, 5).map((documento) => ({
            href: `/lexgestor/documentos/${documento.id}`,
            label: documento.nome,
            meta: documento.cliente,
            note: documento.status,
          }))}
        />
      </section>

      <details className="form-card stack advanced-area">
        <summary>
          <CalendarClock size={18} aria-hidden />
          Avançado
        </summary>
        <section className="split">
          <MiniBarChart title="Documentos por status" rows={data.documentosPorStatus} />
          <DropboxStatus connections={data.storageConnections} />
        </section>
        <section className="split">
          <MiniBarChart title="Casos por categoria" rows={data.casosPorCategoria} />
          <MiniBarChart title="Casos por status" rows={data.casosPorStatus} />
        </section>
      </details>
    </>
  );
}
