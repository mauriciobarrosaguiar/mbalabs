"use client";

export function PdfPreview({ documentoId, href = "" }: { documentoId?: string; href?: string }) {
  const pdfUrl = href || (documentoId ? `/api/lexgestor/pdf/watermark?documento=${encodeURIComponent(documentoId)}` : "");

  function abrirPdf() {
    if (!pdfUrl) {
      window.alert("Nenhum PDF encontrado para visualizar.");
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
        <strong>Pré-visualização do PDF</strong>
        <p>Abra o arquivo gerado para revisar ou imprimir dentro do LexGestor.</p>
      </div>
      <div className="pdf-watermark">Marca d'água do escritório</div>
      <div className="button-row">
        <button className="button secondary" type="button" onClick={abrirPdf} style={{ cursor: "pointer" }}>
          Visualizar
        </button>
        <button className="button secondary" type="button" onClick={abrirPdf} style={{ cursor: "pointer" }}>
          Imprimir
        </button>
      </div>
    </section>
  );
}
