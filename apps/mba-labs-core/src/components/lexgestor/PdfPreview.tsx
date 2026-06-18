"use client";

export function PdfPreview({ documentoId }: { documentoId?: string }) {
  const pdfUrl = documentoId
    ? `/api/lexgestor/pdf/watermark?documento=${encodeURIComponent(documentoId)}`
    : "";

  function visualizarPdf() {
    if (!pdfUrl) {
      window.alert("Nenhum documento encontrado para pre-visualizar. Anexe um documento primeiro.");
      return;
    }

    const janela = window.open(pdfUrl, "_blank", "noopener,noreferrer");

    if (!janela) {
      window.location.href = pdfUrl;
    }
  }

  function imprimirPdf() {
    if (!pdfUrl) {
      window.print();
      return;
    }

    const janela = window.open(pdfUrl, "_blank", "noopener,noreferrer");

    if (!janela) {
      window.location.href = pdfUrl;
    }
  }

  return (
    <section className="pdf-preview" aria-label="Pré-visualização de PDF">
      <div>
        <strong>Pré-visualização do PDF com marca d'água</strong>
        <p>
          O sistema gera uma cópia em PDF com identificação do escritório e preserva o
          arquivo original.
        </p>
      </div>
      <div className="pdf-watermark">Marca d'água do escritório</div>
      <div className="button-row">
        <button className="button secondary" type="button" onClick={visualizarPdf} style={{ cursor: "pointer" }}>
          Visualizar
        </button>
        <button className="button secondary" type="button" onClick={imprimirPdf} style={{ cursor: "pointer" }}>
          Imprimir
        </button>
      </div>
    </section>
  );
}
