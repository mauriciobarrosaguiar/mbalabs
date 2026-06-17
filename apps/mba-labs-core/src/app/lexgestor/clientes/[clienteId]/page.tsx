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

  if (!cliente) {
    return (
      <ResponsivePageContainer title="Cliente nao encontrado">
        <EmptyState title="Registro indisponivel" description="Verifique se o cliente existe ou se o acesso esta liberado." />
      </ResponsivePageContainer>
    );
  }

  return (
    <ResponsivePageContainer
      title={cliente.nome}
      description="Dados do cliente, casos vinculados, documentos e contato."
      action={
        <Link className="button" href={`/lexgestor/casos/novo?cliente=${cliente.id}`}>
          <BriefcaseBusiness size={17} aria-hidden />
          Abrir caso
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
            <Info label="Endereco" value={cliente.endereco} />
            <Info label="Origem" value={cliente.origem} />
          </div>
          <BotaoWhatsAppCliente
            telefone={cliente.whatsapp || cliente.telefone}
            mensagem="Ola, estamos organizando seu dossie juridico no LexGestor."
          />
        </div>
        <div className="card stack">
          <h2>Resumo</h2>
          <span className="status-pill">{cliente.status}</span>
          <p>{cliente.observacoes || "Sem observacoes."}</p>
          <div className="grid">
            <span className="badge">{cliente.casosCount} caso(s)</span>
            <span className="badge">{cliente.documentosCount} documento(s)</span>
          </div>
        </div>
      </section>
      <section className="card stack">
        <h2>Casos vinculados</h2>
        {casos.length === 0 ? (
          <p className="muted">Este cliente ainda nao possui caso.</p>
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
            Salvar como relato
          </button>
          <button className="button secondary" type="button">
            Salvar como prova/documento
          </button>
        </div>
      </section>
      <UploadDocumentos
        clientes={data.clientes}
        casos={data.casos}
        categorias={data.categorias}
        connections={data.storageConnections}
        defaultClienteId={cliente.id}
      />
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
