import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { BotaoWhatsAppCliente } from "@/components/lexgestor/BotaoWhatsAppCliente";
import { EmptyState } from "@/components/lexgestor/EmptyState";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { UploadDocumentos } from "@/components/lexgestor/UploadDocumentos";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

type ClienteDetalhePageProps = {
  params: Promise<{ clienteId: string }>;
};

export default async function ClienteDetalhePage({ params }: ClienteDetalhePageProps) {
  const { clienteId } = await params;
  const data = await getLexWorkspaceData(`/lexgestor/clientes/${clienteId}`);
  const cliente = data.clientes.find((item) => item.id === clienteId);
  const casos = data.casos.filter((caso) => caso.clienteId === clienteId);
  const novoCasoHref = `/lexgestor/casos/novo?cliente=${clienteId}`;

  if (!cliente) {
    return (
      <ResponsivePageContainer title="Cliente não encontrado">
        <EmptyState title="Registro indisponível" description="Verifique se o cliente existe ou se o acesso está liberado." />
      </ResponsivePageContainer>
    );
  }

  return (
    <ResponsivePageContainer
      title={cliente.nome}
      description="Dados do cliente, casos vinculados, documentos e contato."
      action={
        <Link className="button" href={novoCasoHref}>
          <BriefcaseBusiness size={17} aria-hidden />
          Abrir caso deste cliente
        </Link>
      }
    >
      <section className="split">
        <div className="card stack">
          <h2>Dados pessoais</h2>
          <div className="detail-grid">
            <Info label="CPF/CNPJ" value={cliente.cpfCnpj} />
            <Info label="Telefone" value={cliente.telefone} />
            <Info label="WhatsApp" value={cliente.whatsapp} />
            <Info label="E-mail" value={cliente.email} />
            <Info label="Endereço" value={cliente.endereco} />
            <Info label="Origem" value={cliente.origem} />
          </div>
          <BotaoWhatsAppCliente
            telefone={cliente.whatsapp || cliente.telefone}
            mensagem="Olá, estamos organizando seu dossiê jurídico no LexGestor."
          />
        </div>
        <div className="card stack">
          <h2>Resumo</h2>
          <span className="status-pill">{cliente.status}</span>
          <p>{cliente.observacoes || "Sem observações."}</p>
          <div className="grid">
            <span className="badge">{cliente.casosCount} caso(s)</span>
            <span className="badge">{cliente.documentosCount} documento(s)</span>
          </div>
        </div>
      </section>

      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Casos vinculados</h2>
            <p>Abra um caso antes de anexar documentos ou salvar provas.</p>
          </div>
          <Link className="button secondary" href={novoCasoHref}>
            <BriefcaseBusiness size={17} aria-hidden />
            Abrir caso para este cliente
          </Link>
        </div>

        {casos.length === 0 ? (
          <div className="notice">
            Este cliente ainda não possui caso. Clique em <strong>Abrir caso para este cliente</strong> para vincular o atendimento.
          </div>
        ) : (
          casos.map((caso) => (
            <Link className="list-row" href={`/lexgestor/casos/${caso.id}`} key={caso.id}>
              <strong>{caso.titulo}</strong>
              <span>{caso.categoria} / {caso.subcategoria} - {caso.status}</span>
            </Link>
          ))
        )}
      </section>

      <section className="card stack">
        <h2>WhatsApp manual</h2>
        <label className="field-full">
          Colar mensagem recebida
          <textarea placeholder="Cole aqui uma mensagem relevante recebida do cliente." />
        </label>
        <div className="button-row">
          <button className="button secondary" type="button">
            Salvar como relato do cliente
          </button>
          <button className="button secondary" type="button" disabled={casos.length === 0}>
            Salvar como prova/documento
          </button>
        </div>
        {casos.length === 0 ? (
          <p className="muted">Para salvar como prova ou documento, primeiro abra um caso vinculado ao cliente.</p>
        ) : null}
      </section>

      {casos.length > 0 ? (
        <UploadDocumentos
          clientes={data.clientes}
          casos={casos}
          categorias={data.categorias}
          connections={data.storageConnections}
          defaultClienteId={cliente.id}
        />
      ) : (
        <section className="card stack">
          <h2>Anexar documento</h2>
          <div className="notice">
            Abra um caso para este cliente antes de anexar documentos, fotos, prints ou gerar PDF com marca d’água.
          </div>
          <Link className="button" href={novoCasoHref}>
            <BriefcaseBusiness size={17} aria-hidden />
            Abrir caso para este cliente
          </Link>
        </section>
      )}
    </ResponsivePageContainer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-box">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
