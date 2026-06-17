import Link from "next/link";
import { Eye, FileText } from "lucide-react";

export type CasoCardData = {
  id: string;
  titulo: string;
  cliente: string;
  area: string;
  subarea: string;
  status: string;
  prioridade: string;
};

export function CardCaso({ caso }: { caso: CasoCardData }) {
  return (
    <article className="card stack">
      <div>
        <h3>{caso.titulo}</h3>
        <p>
          {caso.cliente} - {caso.area} / {caso.subarea}
        </p>
      </div>
      <div className="button-row">
        <span className="status-pill">{caso.status}</span>
        <span className="badge warning">{caso.prioridade}</span>
      </div>
      <div className="button-row">
        <Link className="button secondary" href={`/lexgestor/casos/${caso.id}`}>
          <Eye size={17} aria-hidden />
          Ver caso
        </Link>
        <Link className="button secondary" href="/lexgestor/documentos">
          <FileText size={17} aria-hidden />
          Documentos
        </Link>
      </div>
    </article>
  );
}
