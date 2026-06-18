import { DropboxStatus } from "@/components/lexgestor/DropboxStatus";
import { FormAdvogadoEscritorio } from "@/components/lexgestor/FormAdvogadoEscritorio";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { pastasPadraoCaso } from "@/lib/lexgestor/dropbox";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

type ConfiguracoesPageProps = {
  searchParams?: Promise<{ erro?: string; status?: string }>;
};

export default async function ConfiguracoesPage({ searchParams }: ConfiguracoesPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/configuracoes");

  return (
    <ResponsivePageContainer
      title="Configurações"
      description="Dados do escritório, marca d'água, equipe, segurança e armazenamento."
    >
      {params.erro ? (
        <p className="notice danger" role="alert">
          {feedbackMessage(params.erro)}
        </p>
      ) : null}
      {params.status ? (
        <p className="notice success" role="status">
          {feedbackMessage(params.status)}
        </p>
      ) : null}
      {data.error ? (
        <p className="notice warning" role="alert">
          Configuração pendente: {data.error}
        </p>
      ) : null}
      <FormAdvogadoEscritorio escritorio={data.escritorio} />
      <DropboxStatus connections={data.storageConnections} />
      <section className="card stack">
        <h2>Estrutura de pastas</h2>
        <p className="notice">
          Cada cliente terá uma pasta própria dentro de /LexGestor no Dropbox ou Google Drive conectado. Casos separam originais,
          PDFs com marca d'água, relatos, checklist, processo e relatórios.
        </p>
        <code>/LexGestor/Clientes/Nome do Cliente - CPF ou CNPJ/Casos/Nome do Caso</code>
        <div className="grid">
          {pastasPadraoCaso.map((pasta) => (
            <span className="badge" key={pasta}>
              {pasta}
            </span>
          ))}
        </div>
      </section>
    </ResponsivePageContainer>
  );
}

function feedbackMessage(value: string) {
  const messages: Record<string, string> = {
    "armazenamento-conectado": "Armazenamento conectado.",
    "armazenamento-desconectado": "Armazenamento desconectado.",
    "configuracoes-salvas": "Configurações salvas.",
    "oauth-invalido": "Conexão inválida ou expirada. Tente conectar novamente.",
    "provedor-invalido": "Provedor de armazenamento inválido.",
  };

  return messages[value] ?? value;
}
