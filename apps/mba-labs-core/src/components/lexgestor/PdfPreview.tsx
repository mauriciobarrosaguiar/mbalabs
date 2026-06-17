"use client";

export function PdfPreview() {
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
