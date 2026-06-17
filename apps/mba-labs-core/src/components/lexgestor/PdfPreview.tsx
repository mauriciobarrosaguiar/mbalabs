"use client";

export function PdfPreview() {
  return (
    <section className="pdf-preview" aria-label="Pre-visualizacao de PDF">
      <div>
        <strong>Pre-visualizacao do PDF com marca d'agua</strong>
        <p>
          O sistema gera uma copia em PDF com identificacao do escritorio e preserva o
          arquivo original.
        </p>
      </div>
      <div className="pdf-watermark">Marca d'agua do escritorio</div>
      <div className="button-row">
        <button className="button secondary" type="button">
          Visualizar
        </button>
        <button className="button secondary" type="button" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
    </section>
  );
}
