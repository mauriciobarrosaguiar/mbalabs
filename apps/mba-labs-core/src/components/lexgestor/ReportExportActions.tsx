"use client";

import { FileDown, FileSpreadsheet, Printer } from "lucide-react";

export function ReportExportActions({ query }: { query: string }) {
  const suffix = query ? `?${query}` : "";
  const exportJoin = query ? `&${query}` : "";

  return (
    <div className="button-row">
      <a className="button" href={`/api/lexgestor/relatorios/pdf${suffix}`}>
        <FileDown size={17} aria-hidden />
        Gerar PDF
      </a>
      <a className="button secondary" href={`/api/lexgestor/relatorios/export?format=csv${exportJoin}`}>
        <FileDown size={17} aria-hidden />
        Baixar CSV
      </a>
      <a className="button secondary" href={`/api/lexgestor/relatorios/export?format=excel${exportJoin}`}>
        <FileSpreadsheet size={17} aria-hidden />
        Baixar Excel
      </a>
      <button className="button secondary" type="button" onClick={() => window.print()}>
        <Printer size={17} aria-hidden />
        Imprimir
      </button>
    </div>
  );
}
