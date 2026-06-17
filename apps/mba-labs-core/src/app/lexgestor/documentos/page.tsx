import { FileText } from "lucide-react";
import { DocumentActions } from "@/components/lexgestor/DocumentActions";
import { PdfPreview } from "@/components/lexgestor/PdfPreview";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { UploadDocumentos } from "@/components/lexgestor/UploadDocumentos";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

type DocumentosPageProps = {
  searchParams?: Promise<{ cliente?: string; caso?: string }>;
};

export default async function DocumentosPage({ searchParams }: DocumentosPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/documentos");

  return (
    <ResponsivePageContainer
      title="Documentos"
      description="Originais ficam no Drive/Dropbox do escritorio; Supabase guarda somente metadados."
    >
      {data.error ? <p className="notice">Documentos ainda indisponiveis: {data.error}</p> : null}
      <UploadDocumentos
        clientes={data.clientes}
        casos={data.casos}
        categorias={data.categorias}
        connections={data.storageConnections}
        defaultClienteId={params.cliente ?? ""}
        defaultCasoId={params.caso ?? ""}
      />

      <section className="table-panel desktop-only">
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Cliente/Caso</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {data.documentos.length === 0 ? (
              <tr>
                <td colSpan={5}>Nenhum documento cadastrado.</td>
              </tr>
            ) : (
              data.documentos.map((documento) => (
                <tr key={documento.id}>
                  <td>
                    <FileText size={17} aria-hidden /> {documento.nome}
                  </td>
                  <td>
                    {documento.cliente}
                    <br />
                    <span className="muted">{documento.caso}</span>
                  </td>
                  <td>{documento.categoria} / {documento.subcategoria}</td>
                  <td>
                    <span className="status-pill">{documento.status}</span>
                  </td>
                  <td>
                    <DocumentActions url={documento.storageUrl} path={documento.storagePath} id={documento.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="mobile-card-list mobile-only">
        {data.documentos.length === 0 ? (
          <article className="empty-state">
            <strong>Nenhum documento cadastrado</strong>
            <p>Anexe o primeiro documento do caso.</p>
          </article>
        ) : (
          data.documentos.map((documento) => (
            <article className="card stack" key={documento.id}>
              <h2>{documento.nome}</h2>
              <p>{documento.cliente} - {documento.caso}</p>
              <span className="status-pill">{documento.status}</span>
              <DocumentActions url={documento.storageUrl} path={documento.storagePath} id={documento.id} />
            </article>
          ))
        )}
      </section>
      <PdfPreview />
    </ResponsivePageContainer>
  );
}
